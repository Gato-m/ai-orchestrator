import fs from 'node:fs/promises';
import ollama from 'ollama';

const OLLAMA_MODEL = 'gemma4:latest';
const SD_SERVER = 'http://127.0.0.1:1234';

function cleanJson(text: string): string {
  return text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

async function analyzeStyle(styleImagePath: string) {
  const response = await ollama.chat({
    model: OLLAMA_MODEL,
    messages: [
      {
        role: 'user',
        content: `
Analyze this image ONLY as a visual style reference.

The image will be used to stylize a completely different portrait.

Do NOT describe:
- the identity of the person
- facial features
- age
- gender
- body
- pose
- subject identity

Focus exclusively on the visual language that can be transferred
to another photograph.

Return ONLY valid JSON:

{
  "visual_style": "",
  "lighting": "",
  "color_palette": [],
  "contrast": 0.0,
  "saturation": 0.0,
  "mood": "",
  "background_style": "",
  "composition_style": "",
  "texture": "",
  "medium": "",
  "graphic_elements": []
}
`,
        images: [styleImagePath],
      },
    ],
  });

  const cleaned = cleanJson(response.message.content);

  return JSON.parse(cleaned);
}

function buildPrompt(style: any): string {
  return `
Transform the provided portrait photograph into a stylized image.

CRITICAL PRIORITY:
The person in the source photograph is the subject of the final image.
Preserve the person's identity and recognizability.

Keep the same person.
Keep the person's facial identity.
Keep the person's face structure.
Keep the person's hairstyle.
Keep the person's body proportions.
Keep the person's clothing.
Keep the person's pose and overall silhouette.
Keep the original subject placement and composition as much as possible.

Do NOT invent a different person.
Do NOT replace the subject.
Do NOT create a generic portrait.
Do NOT reinterpret the subject as a different character.

STYLE TRANSFER:
Apply ONLY the following visual language to the source portrait:

Visual style:
${style.visual_style}

Lighting:
${style.lighting}

Color palette:
${JSON.stringify(style.color_palette)}

Contrast:
${style.contrast}

Saturation:
${style.saturation}

Mood:
${style.mood}

Background style:
${style.background_style}

Composition style:
${style.composition_style}

Texture:
${style.texture}

Medium:
${style.medium}

Graphic elements:
${JSON.stringify(style.graphic_elements)}

The result should look like the ORIGINAL PERSON photographed in the
visual language of the reference style.

The reference style controls:
colors, lighting, graphic treatment, texture, rendering technique,
and overall artistic appearance.

The source portrait controls:
person, face, identity, pose, clothing, silhouette, and subject.

Preserve recognizable human facial structure.
Do not turn the face into an unrelated illustrated character.

Create a coherent finished portrait.
`;
}

async function generateImage(
  personImagePath: string,
  prompt: string
) {
  const personBuffer = await fs.readFile(personImagePath);
  const personImage = personBuffer.toString('base64');

  const body = {
    prompt,

    negative_prompt: `
different person,
unrecognizable person,
generic face,
new identity,
changed facial structure,
different hairstyle,
different clothing,
different body,
different pose,
different subject,
extra person,
duplicate person,
deformed face,
distorted face,
deformed body,
extra limbs,
cartoon character unrelated to source,
replacement character
`,

    width: 512,
    height: 512,

    init_image: personImage,

    strength: 0.45,

    seed: 42,

    batch_count: 1,

    auto_resize_ref_image: true,

    sample_params: {
      scheduler: 'discrete',
      sample_method: 'euler_a',
      sample_steps: 20,

      guidance: {
        txt_cfg: 7.0,
        distilled_guidance: 3.5,
      },
    },
  };

  console.log('Starting Qwen Image Edit...');

  const response = await fetch(
    `${SD_SERVER}/sdcpp/v1/img_gen`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Generation request failed: ${response.status} ${errorText}`
    );
  }

  const job = await response.json();

  console.log('Job created:', job.id);

  const jobUrl =
    `${SD_SERVER}/sdcpp/v1/jobs/${job.id}`;

  while (true) {
    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );

    const jobResponse = await fetch(jobUrl);

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();

      throw new Error(
        `Job polling failed: ${jobResponse.status} ${errorText}`
      );
    }

    const jobStatus = await jobResponse.json();

    console.log('Job status:', jobStatus.status);

    if (jobStatus.status === 'completed') {
      const imageBase64 =
        jobStatus.result?.images?.[0]?.b64_json;

      if (!imageBase64) {
        throw new Error(
          'Job completed, but no image was returned.'
        );
      }

      const outputBuffer =
        Buffer.from(imageBase64, 'base64');

      await fs.writeFile(
        './generated-style-person.png',
        outputBuffer
      );

      console.log(
        'Saved: generated-style-person.png'
      );

      return;
    }

    if (
      jobStatus.status === 'failed' ||
      jobStatus.status === 'error' ||
      jobStatus.status === 'cancelled'
    ) {
      throw new Error(
        `Generation failed: ${JSON.stringify(jobStatus, null, 2)}`
      );
    }
  }
}

async function main() {
  console.log('Analyzing style reference...');

  const style = await analyzeStyle('./test-style.jpg');

  console.log('\nStyle analysis:');
  console.log(JSON.stringify(style, null, 2));

  await fs.writeFile(
    './style-analysis.json',
    JSON.stringify(style, null, 2)
  );

  console.log(
    '\nSaved: style-analysis.json'
  );

  const prompt = buildPrompt(style);

  await fs.writeFile(
    './style-prompt.txt',
    prompt
  );

  console.log(
    'Saved: style-prompt.txt'
  );

  console.log('\nGenerated prompt:');
  console.log(prompt);

  await generateImage(
    './person.jpg',
    prompt
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});