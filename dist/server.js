import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { queuePrompt, waitForResult } from './comfy.js';
const app = express();
const PORT = 3000;
const upload = multer({
    dest: 'uploads/',
});
const WORKFLOW_PATH = path.resolve('style-transfer.json');
const COMFY_INPUT = '/Users/webdev/ComfyUI-Shared/input';
app.use(express.json());
app.use(express.static('client')); // Serve static files from client directory
app.get('/', (_req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Image Stylizer Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background-color: #1a1a1a;
                color: #e0e0e0;
                margin: 0;
                padding: 20px;
                line-height: 1.6;
            }
            .container {
                max-width: 800px;
                margin: 0 auto;
                background-color: #2d2d2d;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            }
            h1 {
                color: #4caf50;
                text-align: center;
            }
            .endpoint {
                background-color: #3a3a3a;
                border-radius: 5px;
                padding: 15px;
                margin: 10px 0;
            }
            .endpoint h2 {
                margin-top: 0;
                color: #8bc34a;
            }
            .endpoint pre {
                background-color: #000;
                padding: 10px;
                border-radius: 5px;
                overflow-x: auto;
                font-size: 14px;
            }
            button {
                background-color: #4caf50;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin: 5px;
            }
            button:hover {
                background-color: #45a049;
            }
            .status {
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
            }
            .status.ok {
                background-color: #d4edda;
                color: #155724;
            }
            .status.error {
                background-color: #f8d7da;
                color: #721c24;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Image Stylizer Dashboard</h1>
            
            <div class="status ok">
                <strong>Status:</strong> Server is running and ready
            </div>
            
            <p>This is the dashboard for the Image Stylizer API. You can use the following endpoints to interact with the system.</p>
            
            <div class="endpoint">
                <h2>1. Analyze Style</h2>
                <p><strong>Endpoint:</strong> POST /api/analyze-style</p>
                <p><strong>Description:</strong> Analyzes an image and returns its visual style information</p>
                <pre>curl -X POST http://localhost:3000/api/analyze-style \\
  -F "image=@path/to/image.jpg"</pre>
            </div>
            
            <div class="endpoint">
                <h2>2. Optimize Prompt</h2>
                <p><strong>Endpoint:</strong> POST /api/optimize-prompt</p>
                <p><strong>Description:</strong> Optimizes a prompt using Qwen 30B model</p>
                <pre>curl -X POST http://localhost:3000/api/optimize-prompt \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "A beautiful landscape"}'</pre>
            </div>
            
            <div class="endpoint">
                <h2>3. Style Transfer</h2>
                <p><strong>Endpoint:</strong> POST /api/style-transfer</p>
                <p><strong>Description:</strong> Performs complete style transfer with ComfyUI and FLUX.2 Klein</p>
                <pre>curl -X POST http://localhost:3000/api/style-transfer \\
  -F "image=@target.jpg" \\
  -F "style=@style-reference.jpg"</pre>
            </div>
            
            <p><strong>Current Configuration:</strong></p>
            <ul>
                <li>Ollama Model: gemma4:latest</li>
                <li>ComfyUI URL: http://127.0.0.1:8188</li>
                <li>Workflow File: ${WORKFLOW_PATH}</li>
                <li>Upload Directory: uploads/</li>
            </ul>
            
            <p><strong>Next Steps:</strong></p>
            <ol>
                <li>Ensure Ollama is running with the Qwen 30B model</li>
                <li>Ensure ComfyUI is running on port 8188</li>
                <li>Test any endpoint using curl or a tool like Postman</li>
            </ol>
            
            <div style="text-align: center; margin-top: 20px;">
                <button onclick="window.open('http://localhost:3000', '_blank')">Open in New Tab</button>
            </div>
        </div>
    </body>
    </html>
  `);
});
/**
 * Optimize prompt using Qwen
 */
app.post('/api/optimize-prompt', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({
                error: 'Prompt is required',
            });
        }
        // Use Ollama to optimize the prompt with Qwen
        const optimizedPrompt = await new Promise((resolve, reject) => {
            exec(`ollama run qwen3-coder:30b "Optimize this prompt for image generation: ${prompt}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Qwen prompt optimization error:', error);
                    reject(new Error('Failed to optimize prompt with Qwen'));
                    return;
                }
                // Extract the optimized prompt from the response
                const result = stdout.trim();
                resolve(result);
            });
        });
        res.json({
            optimizedPrompt,
        });
    }
    catch (error) {
        console.error('Prompt optimization error:', error);
        res.status(500).json({
            error: 'Failed to optimize prompt',
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
app.post('/api/style-transfer', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'style', maxCount: 1 },
]), async (req, res) => {
    const files = req.files;
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
        const extraPrompt = typeof req.body?.prompt === 'string'
            ? req.body.prompt.trim()
            : '';
        /*
         * Style strength:
         * 30 means approximately:
         * person 70% / style 30%
         */
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
        // If there's an extra prompt, optimize it with Qwen before using
        let finalPrompt = basePrompt;
        if (extraPrompt) {
            try {
                // Use Ollama to get optimized version of the extra prompt
                const optimizedExtraPrompt = await new Promise((resolve, reject) => {
                    exec(`ollama run qwen3-coder:30b "Optimize this prompt for image generation: ${extraPrompt}"`, (error, stdout, stderr) => {
                        if (error) {
                            console.error('Qwen prompt optimization error:', error);
                            resolve(extraPrompt); // fallback to original prompt
                            return;
                        }
                        const result = stdout.trim();
                        resolve(result);
                    });
                });
                finalPrompt = `${basePrompt}\n\nAdditional instructions:\n${optimizedExtraPrompt}`;
            }
            catch (error) {
                console.error('Error optimizing extra prompt:', error);
                // Continue with original extra prompt if optimization fails
                finalPrompt = `${basePrompt}\n\nAdditional instructions:\n${extraPrompt}`;
            }
        }
        workflow['92:113'].inputs.text = finalPrompt;
        console.log('Queueing style transfer...');
        console.log('Target:', targetName);
        console.log('Style:', styleName);
        console.log('Style strength:', styleStrength);
        /*
         * Send workflow to ComfyUI.
         */
        const queued = await queuePrompt(workflow);
        if (!queued.prompt_id) {
            throw new Error(`ComfyUI did not return prompt_id: ${JSON.stringify(queued)}`);
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
        const imageUrl = `http://127.0.0.1:8188/view` +
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
    }
    catch (error) {
        console.error('Style transfer error:', error);
        res.status(500).json({
            error: error instanceof Error
                ? error.message
                : 'Style transfer failed',
        });
    }
});
app.listen(PORT, () => {
    console.log(`Style Workflow Dashboard: http://localhost:${PORT}`);
    console.log(`Please open your browser to http://localhost:${PORT}`);
});
// Add a simple health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
//# sourceMappingURL=server.js.map