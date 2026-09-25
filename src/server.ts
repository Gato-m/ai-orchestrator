import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';

import { queuePrompt, waitForResult } from './comfy.js';

const app = express();
const PORT = 3000;

// 1. CORS konfigurācija
app.use(cors({
  origin: true,
  credentials: true
}));

// 2. Body parseri
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('client'));

const upload = multer({
  dest: 'uploads/',
});

const WORKFLOW_PATH = path.resolve('style-transfer.json');
const COMFY_INPUT = '/Users/webdev/ComfyUI-Shared/input';

// Health check maršruts
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 1. Stila analīzes galapunkts ar Ollama (llava)
app.post('/api/analyze-style', async (req, res) => {
  try {
    const rawImage = req.body.imageBase64 || req.body.image || req.body.imageData;

    if (!rawImage || typeof rawImage !== 'string') {
      console.error('❌ [/api/analyze-style] Attēls netika saņemts vai nav teksta formātā');
      return res.status(400).json({ error: 'Attēla dati netika saņemti korektā formātā' });
    }

    let cleanBase64 = rawImage;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '').trim();

    if (!cleanBase64) {
      console.error('❌ [/api/analyze-style] Tukšs Base64 saturs');
      return res.status(400).json({ error: 'Attēla base64 datu virkne ir tukša' });
    }

    console.log('🔄 Sūtam pieprasījumu uz Ollama (llava modelis)...');

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
      const errorText = await response.text();
      console.error(`❌ Ollama kļūda ${response.status}:`, errorText);
      return res.status(502).json({ error: 'Ollama kļūda', details: errorText });
    }

    const data = (await response.json()) as { response?: string };

    if (!data.response) {
      return res.status(502).json({ error: 'Ollama neatgrieza atbildi' });
    }

    console.log('✅ Stils veiksmīgi izanalizēts!');
    res.json({ styleDescription: data.response.trim() });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ [/api/analyze-style] Pieprasījuma laiks beidzās (Timeout)');
      return res.status(504).json({ error: 'Stila analīze prasīja pārāk ilgu laiku' });
    }
    console.error('❌ Servera kļūda /api/analyze-style:', error.message || error);
    res.status(500).json({ error: 'Failed to analyze style', details: error.message });
  }
});

// 2. Promptu optimizēšana izmantojot Llama 3.2
app.post('/api/optimize-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Trūkst prompta teksta optimizēšanai' });
    }

    console.log('🔄 Optimizējam promptu ar llama3.2:1b...');

    const targetModel = 'llama3.2:1b';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: targetModel,
        prompt: `You are an expert AI prompt engineer for image generation (Stable Diffusion / Midjourney).
Refine and optimize the following image prompt to make it descriptive, clear, and high quality.
Add artistic details, lighting, style terms, and composition cues if needed.
Provide ONLY the final optimized prompt in English and nothing else. No conversational text, no quotes.

Input prompt: "${prompt}"`,
        stream: false,
        keep_alive: 0
      })
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ollama optimizēšanas kļūda (${response.status}):`, errorText);
      return res.status(502).json({ error: `Ollama kļūda: ${errorText}` });
    }

    const data = (await response.json()) as { response?: string };

    if (!data.response) {
      return res.status(502).json({ error: 'Ollama neatgrieza optimizēto promptu' });
    }

    const optimizedPrompt = data.response.trim();
    console.log('✅ Prompts veiksmīgi optimizēts!');
    res.json({ optimizedPrompt });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('❌ Optimizēšanas pieprasījuma laiks beidzās (Timeout)');
      return res.status(504).json({ error: 'Optimizēšana prasīja pārāk ilgu laiku' });
    }
    console.error('❌ Servera kļūda /api/optimize-prompt:', error.message || error);
    res.status(500).json({ error: 'Kļūda optimizējot promptu', details: error.message });
  }
});

// 3. Style Transfer ar ComfyUI
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

      const targetName = `style-target-${Date.now()}-${targetFile.originalname}`;
      const styleName = `style-reference-${Date.now()}-${styleFile.originalname}`;

      const targetPath = path.join(COMFY_INPUT, targetName);
      const stylePath = path.join(COMFY_INPUT, styleName);

      await fs.copyFile(targetFile.path, targetPath);
      await fs.copyFile(styleFile.path, stylePath);

      const workflowText = await fs.readFile(WORKFLOW_PATH, 'utf8');
      const workflow = JSON.parse(workflowText);

      workflow['81'].inputs.image = targetName;
      workflow['76'].inputs.image = styleName;

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

      let finalPrompt = basePrompt;
      if (extraPrompt) {
        finalPrompt = `${basePrompt}\n\nAdditional instructions:\n${extraPrompt}`;
      }

      workflow['92:113'].inputs.text = finalPrompt;

      console.log('🔄 Nosūtam darbu uz ComfyUI rindu...');
      const queued = await queuePrompt(workflow);
      if (!queued.prompt_id) {
        throw new Error(`ComfyUI did not return prompt_id: ${JSON.stringify(queued)}`);
      }

      console.log(`⏳ Gaidām ComfyUI rezultātu (ID: ${queued.prompt_id})...`);
      const result = await waitForResult(queued.prompt_id);
      const output = result.outputs?.['94'];

      if (!output?.images?.length) {
        throw new Error('ComfyUI finished without an output image');
      }

      const generatedImage = output.images[0];
      const imageUrl =
        `http://127.0.0.1:8188/view` +
        `?filename=${encodeURIComponent(generatedImage.filename)}` +
        `&subfolder=${encodeURIComponent(generatedImage.subfolder ?? '')}` +
        `&type=${encodeURIComponent(generatedImage.type ?? 'output')}`;

      console.log('✅ Style Transfer pabeigts veiksmīgi!');
      res.json({
        success: true,
        promptId: queued.prompt_id,
        image: imageUrl,
        filename: generatedImage.filename,
        styleStrength,
      });
    } catch (error: any) {
      console.error('❌ Style transfer error:', error);
      res.status(500).json({ error: error.message || 'Style transfer failed' });
    } finally {
      if (targetFile?.path) await fs.unlink(targetFile.path).catch(() => { });
      if (styleFile?.path) await fs.unlink(styleFile.path).catch(() => { });
    }
  }
);

// 4. Pilnībā darboties spējīgs EN -> LV tulkošanas maršruts ar Ollama un drošu fallback
import translate from 'google-translate-api-x';

app.post('/api/translate', async (req, res) => {
  try {
    const rawPrompt = req.body?.prompt;

    if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
      return res.json({ translatedPrompt: '' });
    }

    const cleanPrompt = rawPrompt
      .trim()
      .replace(/^["'“`]+|["'”`]+$/g, '')
      .replace(/^Artistic style:\s*/i, '');

    console.log('\n========================================');
    console.log('📥 [BACKEND SĀK TULKOT]');
    console.log('EN Teksts:', cleanPrompt.substring(0, 70) + '...');

    // Izmantojam oficiālo pakotni ar piespiedu 'lv' mērķa valodu
    const result = await translate(cleanPrompt, { to: 'lv', forceBatch: true });

    console.log('✅ [BACKEND TULKOJUMS PABEIGTS]');
    console.log('LV Teksts:', result.text.substring(0, 70) + '...');
    console.log('========================================\n');

    return res.json({
      translatedPrompt: result.text,
      translatedText: result.text
    });

  } catch (error: any) {
    console.error('❌ [Backend Kļūda]:', error);
    return res.status(500).json({ error: 'Translation failed', details: String(error) });
  }
});

// Servera palaišana
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Style Workflow Dashboard: http://127.0.0.1:${PORT}`);
});