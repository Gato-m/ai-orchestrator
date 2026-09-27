import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import translate from 'google-translate-api-x';

import { queuePrompt, waitForResult } from './comfy.js';

const app = express();
const PORT = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('client'));

const upload = multer({ dest: 'uploads/' });

const WORKFLOW_PATH = path.resolve('ImageStylerAPI.json');
const COMFY_INPUT = '/Users/webdev/ComfyUI-Shared/input';

// Palīgfunkcija attēla reģistrēšanai ComfyUI vidē
async function uploadToComfyAPI(filePath: string, filename: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('image', createReadStream(filePath), filename);
    formData.append('overwrite', 'true');

    const response = await fetch('http://127.0.0.1:8188/upload/image', {
      method: 'POST',
      body: formData as any,
    });

    if (response.ok) {
      const data = (await response.json()) as { name?: string };
      if (data.name) return data.name;
    }
  } catch (err: any) {
    console.warn(`⚠️ Kļūda augšupielādējot uz ComfyUI API: ${err.message}`);
  }
  return filename;
}

// Rekurzīva funkcija, kas izstaigā VISU JSON koku un izlabo vērtības
function deepFixWorkflow(obj: any, targetImg: string, styleImg: string, promptText: string) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];

    // Izlabojam VAE nosaukumus visā strukturā
    if (key === 'vae_name' && val === 'full_encoder_small_decoder.safetensors') {
      obj[key] = 'pixel_space';
      console.log('🔧 [Pielāgots] VAE pārsaukts uz pixel_space');
    }

    // Izlabojam mezglu 81 un 76 attēlus
    if (key === '81' && val?.inputs) {
      val.inputs.image = targetImg;
      console.log(`🔧 [Pielāgots] Mezgls 81 sasaistīts ar: ${targetImg}`);
    }
    if (key === '76' && val?.inputs) {
      val.inputs.image = styleImg;
      console.log(`🔧 [Pielāgots] Mezgls 76 sasaistīts ar: ${styleImg}`);
    }

    // Izlabojam teksta promptu mezglam 92:113
    if (key === '92:113' && val?.inputs) {
      val.inputs.text = promptText;
      console.log('🔧 [Pielāgots] Mezglam 92:113 iestatīts jaunais prompts');
    }

    // Rekurzīvs izsaukums apakšobjektiem un masīviem
    if (typeof val === 'object') {
      deepFixWorkflow(val, targetImg, styleImg, promptText);
    }
  }
}

app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 1. Stila analīze ar Ollama
app.post('/api/analyze-style', async (req, res) => {
  try {
    const rawImage = req.body.imageBase64 || req.body.image || req.body.imageData;
    if (!rawImage || typeof rawImage !== 'string') {
      return res.status(400).json({ error: 'Attēla dati netika saņemti' });
    }

    let cleanBase64 = rawImage.includes(',') ? rawImage.split(',')[1] : rawImage;
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '').trim();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llava',
        prompt: 'Analyze the artistic style of this image. Describe lighting, color palette, medium, texture, and mood for an image generator prompt. Output only the prompt text in English.',
        images: [cleanBase64],
        stream: false,
        keep_alive: 0
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(502).json({ error: 'Ollama kļūda' });
    }

    const data = (await response.json()) as { response?: string };
    res.json({ styleDescription: data.response?.trim() });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to analyze style', details: error.message });
  }
});

// 2. Optimizēšana
app.post('/api/optimize-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Trūkst prompta' });

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:1b',
        prompt: `Refine and optimize the following image prompt for Stable Diffusion / Midjourney. Provide ONLY the final prompt in English.\n\nInput: "${prompt}"`,
        stream: false,
        keep_alive: 0
      })
    });

    const data = (await response.json()) as { response?: string };
    res.json({ optimizedPrompt: data.response?.trim() });
  } catch (error: any) {
    res.status(500).json({ error: 'Kļūda optimizējot promptu' });
  }
});

// 3. Style Transfer
app.post(
  '/api/style-transfer',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'style', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    const targetFile = files?.image?.[0];
    const styleFile = files?.style?.[0];

    if (!targetFile || !styleFile) {
      return res.status(400).json({ error: 'Both image and style images are required' });
    }

    try {
      console.log('🔄 Sākam Style Transfer apstrādi...');
      await fs.mkdir(COMFY_INPUT, { recursive: true });

      const timestamp = Date.now();
      const safeTargetName = `target_${timestamp}.png`;
      const safeStyleName = `style_${timestamp}.png`;

      await fs.copyFile(targetFile.path, path.join(COMFY_INPUT, safeTargetName));
      await fs.copyFile(styleFile.path, path.join(COMFY_INPUT, safeStyleName));

      const finalTargetName = await uploadToComfyAPI(targetFile.path, safeTargetName);
      const finalStyleName = await uploadToComfyAPI(styleFile.path, safeStyleName);

      const workflowText = await fs.readFile(WORKFLOW_PATH, 'utf8');
      let workflow = JSON.parse(workflowText);

      const extraPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      const rawStrength = Number(req.body?.styleStrength ?? 30);
      const styleStrength = Math.max(0, Math.min(100, Number.isFinite(rawStrength) ? rawStrength : 30));
      const personStrength = 100 - styleStrength;

      const basePrompt = `
Transfer the visual style of reference_image2 to the person in reference_image1.
Preserve the identity, face, hairstyle, body, pose and overall composition of reference_image1.
Use reference_image2 only as the source of visual style, including its color palette, graphic language, lighting, materials, shapes and editorial aesthetic.
keep more person - ${personStrength}%, stylize - ${styleStrength}%
Limit colors to 4.
Do not copy the subject or objects from reference_image2.
`.trim();

      const finalPrompt = extraPrompt ? `${basePrompt}\n\nAdditional instructions:\n${extraPrompt}` : basePrompt;

      // Pielietojam globālo un rekurzīvo labojumu
      deepFixWorkflow(workflow, finalTargetName, finalStyleName, finalPrompt);

      console.log('🔄 Nosūtam workflow uz ComfyUI...');
      const queued = await queuePrompt(workflow);

      if (!queued.prompt_id) {
        throw new Error(`ComfyUI neatgrieza prompt_id: ${JSON.stringify(queued)}`);
      }

      console.log(`⏳ Gaidām ComfyUI aprēķinu (ID: ${queued.prompt_id})...`);
      const result = await waitForResult(queued.prompt_id);

      // Mēģinām atrast izvades attēlu no mezgla '94' vai pirmā pieejamā mezgla
      const output = result.outputs?.['94'] || Object.values(result.outputs || {})[0];

      if (!output?.images?.length) {
        throw new Error('ComfyUI pabeidza darbu, bet nesaglabāja gala attēlu');
      }

      const generatedImage = output.images[0];
      const imageUrl =
        `http://127.0.0.1:8188/view` +
        `?filename=${encodeURIComponent(generatedImage.filename)}` +
        `&subfolder=${encodeURIComponent(generatedImage.subfolder ?? '')}` +
        `&type=${encodeURIComponent(generatedImage.type ?? 'output')}`;

      console.log('✅ Style Transfer pabeigts!');
      res.json({
        success: true,
        promptId: queued.prompt_id,
        image: imageUrl,
        filename: generatedImage.filename,
        styleStrength,
      });

    } catch (error: any) {
      console.error('❌ Kļūda Style Transfer procesā:', error);
      res.status(500).json({ error: error.message || 'Style transfer failed' });
    } finally {
      if (targetFile?.path) await fs.unlink(targetFile.path).catch(() => { });
      if (styleFile?.path) await fs.unlink(styleFile.path).catch(() => { });
    }
  }
);

// 4. Tulkošana
app.post('/api/translate', async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt;
    if (!rawPrompt || typeof rawPrompt !== 'string') return res.json({ translatedPrompt: '' });

    const result = await translate(rawPrompt.trim(), { to: 'lv', forceBatch: true });
    return res.json({ translatedPrompt: result.text });
  } catch (error: any) {
    return res.status(500).json({ error: 'Translation failed' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Serveris palaists: http://127.0.0.1:${PORT}`);
});