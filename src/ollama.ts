import ollama from 'ollama';

const MODEL = 'gemma4:latest';

function cleanJson(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export async function analyzeStyle(imagePath: string) {
  const response = await ollama.chat({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: `
Analyze this image as a visual style reference.

Focus ONLY on the visual style.

Do not describe the person's identity, facial features,
age, or other personal characteristics.

Return ONLY valid JSON with this structure:

{
  "visual_style": "",
  "lighting": "",
  "color_palette": [],
  "contrast": 0.0,
  "saturation": 0.0,
  "mood": "",
  "background": "",
  "composition": "",
  "texture": "",
  "photography_style": ""
}
`,
        images: [imagePath],
      },
    ],
  });

  const cleaned = cleanJson(response.message.content);

  return JSON.parse(cleaned);
}

