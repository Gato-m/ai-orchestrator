import express from 'express';
import multer from 'multer';
import cors from 'cors';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

import { analyzeStyle } from './ollama.js';
import { queuePrompt, waitForResult } from './comfy.js';

const app = express();
const PORT = 3000;

// 1. Pareiza CORS konfigurācija (automātiski apstrādā arī OPTIONS pieprasījumus)
app.use(cors({
  origin: true, // Automātiski pielāgojas pieprasītāja izcelsmei (127.0.0.1:3001 u.c.)
  credentials: true
}));

// 2. Parseri ar limitu
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('client')); // Statisko failu padeve

const upload = multer({
  dest: 'uploads/',
});

const WORKFLOW_PATH = path.resolve('style-transfer.json');
const COMFY_INPUT = '/Users/webdev/ComfyUI-Shared/input';

// Health check maršruts
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Stila analīzes galapunkts ar Ollama (llava)
app.post('/api/analyze-style', async (req, res) => {
  try {
    const rawImage = req.body.imageBase64 || req.body.image || req.body.imageData;

    if (!rawImage || typeof rawImage !== 'string') {
      console.error('❌ [/api/analyze-style] Attēls netika saņemts vai nav teksta formātā');
      return res.status(400).json({ error: 'Attēla dati netika saņemti korektā formātā' });
    }

    // Droša Base64 nodrošināšana - noņem visu pirms komata (data:image/...;base64,)
    let cleanBase64 = rawImage;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    // Attīram atstarpes un jaunas rindiņas
    cleanBase64 = cleanBase64.replace(/[\r\n\s]/g, '').trim();

    if (!cleanBase64) {
      console.error('❌ [/api/analyze-style] Tukšs Base64 saturs');
      return res.status(400).json({ error: 'Attēla base64 datu virkne ir tukša' });
    }

    console.log('🔄 Sūtam pieprasījumu uz Ollama (llava modelis)...');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90 sekunžu timeout

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'llava',
        prompt: 'Analyze the artistic style of this image. Describe lighting, color palette, medium, texture, and mood for an image generator prompt. Output only the prompt text in English.',
        images: [cleanBase64],
        stream: false
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
    console.error('❌ Servera kļūda /api/analyze-style:', error.message || error);
    res.status(500).json({ error: 'Failed to analyze style', details: error.message });
  }
});

// Prompta optimizācija ar Qwen
app.post('/api/optimize-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const optimizedPrompt = await new Promise((resolve, reject) => {
      exec(
        `ollama run qwen3-coder:30b "Optimize this prompt for image generation: ${prompt}"`,
        (error, stdout) => {
          if (error) {
            console.error('Qwen prompt optimization error:', error);
            reject(new Error('Failed to optimize prompt with Qwen'));
            return;
          }
          resolve(stdout.trim());
        }
      );
    });

    res.json({ optimizedPrompt });
  } catch (error) {
    console.error('Prompt optimization error:', error);
    res.status(500).json({ error: 'Failed to optimize prompt' });
  }
});

// Style Transfer ar ComfyUI
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
        try {
          const optimizedExtraPrompt = await new Promise((resolve) => {
            exec(
              `ollama run qwen3-coder:30b "Optimize this prompt for image generation: ${extraPrompt}"`,
              (error, stdout) => {
                if (error) resolve(extraPrompt);
                else resolve(stdout.trim());
              }
            );
          });
          finalPrompt = `${basePrompt}\n\nAdditional instructions:\n${optimizedExtraPrompt}`;
        } catch {
          finalPrompt = `${basePrompt}\n\nAdditional instructions:\n${extraPrompt}`;
        }
      }

      workflow['92:113'].inputs.text = finalPrompt;

      const queued = await queuePrompt(workflow);
      if (!queued.prompt_id) {
        throw new Error(`ComfyUI did not return prompt_id: ${JSON.stringify(queued)}`);
      }

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

      res.json({
        success: true,
        promptId: queued.prompt_id,
        image: imageUrl,
        filename: generatedImage.filename,
        styleStrength,
      });
    } catch (error: any) {
      console.error('Style transfer error:', error);
      res.status(500).json({ error: error.message || 'Style transfer failed' });
    }
  }
);

// Servera palaišana uz visu saskarņu adresi (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Style Workflow Dashboard: http://127.0.0.1:${PORT}`);
});