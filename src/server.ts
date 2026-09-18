import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';

import { analyzeStyle } from './ollama.js';
import { queuePrompt, waitForResult } from './comfy.js';

const app = express();
const PORT = 3000;

const upload = multer({
  dest: 'uploads/',
});

const WORKFLOW_PATH = path.resolve('style-transfer.json');
const COMFY_INPUT = '/Users/webdev/ComfyUI-Shared/input';

app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Style Workflow is running');
});

/**
 * Analyze style image with Ollama
 */
app.post('/api/analyze-style', upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({
      error: 'Image is required',
    });
    return;
  }

  try {
    const analysis = await analyzeStyle(req.file.path);

    res.json(analysis);
  } catch (error) {
    console.error('Style analysis error:', error);

    res.status(500).json({
      error: 'Failed to analyze image',
    });
  }
});

/**
 * Style transfer with ComfyUI + FLUX.2 Klein
 *
 * Form fields:
 *   image       = person / target image
 *   style       = style reference image
 *   prompt      = optional extra prompt
 *   styleStrength = optional 0-100
 */
app.post(
  '/api/style-transfer',
  upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'style', maxCount: 1 },
  ]),
  async (req, res) => {
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const targetFile = files?.image?.[0];
    const styleFile = files?.style?.[0];

    if (!targetFile || !styleFile) {
      res.status(400).json({
        error: 'Both image and style images are required',
      });
      return;
    }

    try {
      await fs.mkdir(COMFY_INPUT, { recursive: true });

      /*
       * Use unique filenames so multiple requests do not overwrite
       * each other's input images.
       */
      const targetName = `style-target-${Date.now()}-${targetFile.originalname}`;
      const styleName = `style-reference-${Date.now()}-${styleFile.originalname}`;

      const targetPath = path.join(COMFY_INPUT, targetName);
      const stylePath = path.join(COMFY_INPUT, styleName);

      await fs.copyFile(targetFile.path, targetPath);
      await fs.copyFile(styleFile.path, stylePath);

      /*
       * Load the working API workflow.
       */
      const workflowText = await fs.readFile(WORKFLOW_PATH, 'utf8');
      const workflow = JSON.parse(workflowText);

      /*
       * Your working workflow:
       *
       * Node 81 = target/person image
       * Node 76 = style reference image
       * Node 113 = prompt
       */
      workflow['81'].inputs.image = targetName;
      workflow['76'].inputs.image = styleName;

      /*
       * Optional prompt from Dashboard.
       */
      const extraPrompt =
        typeof req.body?.prompt === 'string'
          ? req.body.prompt.trim()
          : '';

      /*
       * Style strength:
       * 30 means approximately:
       * person 70% / style 30%
       */
      const rawStrength = Number(req.body?.styleStrength ?? 30);

      const styleStrength = Math.max(
        0,
        Math.min(100, Number.isFinite(rawStrength) ? rawStrength : 30),
      );

      const personStrength = 100 - styleStrength;

      const basePrompt = `
Transfer the visual style of reference_image2 to the person in reference_image1.

Preserve the identity, face, hairstyle, body, pose and overall composition of reference_image1.

Use reference_image2 only as the source of visual style, including its color palette, graphic language, lighting, materials, shapes and editorial aesthetic.

keep more person - ${personStrength}%, stylize - ${styleStrength}%

Limit colors to 4.

Do not copy the subject or objects from reference_image2.
`.trim();

      workflow['92:113'].inputs.text = extraPrompt
        ? `${basePrompt}\n\nAdditional instructions:\n${extraPrompt}`
        : basePrompt;

      console.log('Queueing style transfer...');
      console.log('Target:', targetName);
      console.log('Style:', styleName);
      console.log('Style strength:', styleStrength);

      /*
       * Send workflow to ComfyUI.
       */
      const queued = await queuePrompt(workflow);

      if (!queued.prompt_id) {
        throw new Error(
          `ComfyUI did not return prompt_id: ${JSON.stringify(queued)}`,
        );
      }

      console.log('ComfyUI prompt:', queued.prompt_id);

      /*
       * Wait until generation finishes.
       */
      const result = await waitForResult(queued.prompt_id);

      /*
       * SaveImage node 94 is the output node in the working workflow.
       */
      const output = result.outputs?.['94'];

      if (!output?.images?.length) {
        console.error('Unexpected ComfyUI result:', result);

        throw new Error('ComfyUI finished without an output image');
      }

      const generatedImage = output.images[0];

      /*
       * ComfyUI /view can serve the generated image directly.
       */
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
    } catch (error) {
      console.error('Style transfer error:', error);

      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : 'Style transfer failed',
      });
    }
  },
);

app.listen(PORT, () => {
  console.log(`Style Workflow: http://localhost:${PORT}`);
});