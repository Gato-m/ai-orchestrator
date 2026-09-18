import fs from 'node:fs/promises';

const SD_SERVER = 'http://127.0.0.1:1234';
const IMG_GEN_URL = `${SD_SERVER}/sdcpp/v1/img_gen`;

type StyleAnalysis = {
  visual_style?: string;
  lighting?: string;
  color_palette?: string[];
  contrast?: number;
  saturation?: number;
  mood?: string;
  background_style?: string;
  background?: string;
  composition_style?: string;
  composition?: string;
  texture?: string;
  medium?: string;
  photography_style?: string;
  graphic_elements?: string[];
};

function buildPrompt(style: StyleAnalysis): string {
  return `
Transform the provided portrait photograph into a stylized portrait.

The SOURCE IMAGE contains the person who must remain the main subject.

IDENTITY PRESERVATION IS THE HIGHEST PRIORITY.

Preserve the exact person from the source image.
Preserve the person's recognizable facial identity.
Preserve facial proportions and overall face structure.
Preserve hairstyle and hair shape.
Preserve body proportions and silhouette.
Preserve clothing and its overall shape.
Preserve the person's pose and position.
Preserve the original subject composition as much as possible.

The final image MUST still clearly depict the same person
from the source photograph.

Do NOT invent a new person.
Do NOT replace the person's face.
Do NOT turn the person into a generic character.
Do NOT substantially alter the person's facial structure.
Do NOT change the person's identity.

STYLE TRANSFER

Apply the following visual style to the source portrait.

Visual style:
${style.visual_style ?? ''}

Lighting:
${style.lighting ?? ''}

Color palette:
${JSON.stringify(style.color_palette ?? [])}

Contrast:
${style.contrast ?? ''}

Saturation:
${style.saturation ?? ''}

Mood:
${style.mood ?? ''}

Background:
${style.background_style ?? style.background ?? ''}

Composition:
${style.composition_style ?? style.composition ?? ''}

Texture:
${style.texture ?? ''}

Medium:
${style.medium ?? ''}

Photography / illustration style:
${style.photography_style ?? ''}

Graphic elements:
${JSON.stringify(style.graphic_elements ?? [])}

IMPORTANT:

The STYLE information controls ONLY the artistic treatment.

The style controls:
- colors
- lighting
- contrast
- saturation
- texture
- rendering technique
- graphic treatment
- background treatment
- overall visual aesthetic

The SOURCE IMAGE controls:
- person
- face
- identity
- hairstyle
- body
- clothing
- pose
- silhouette
- subject placement

Do not copy a different person or subject.

There is no visual style reference image available to copy from.
Use only the written style description above.

Create a finished stylized portrait that looks like
the ORIGINAL PERSON rendered in this visual style.

The person's face must remain recognizable.
`;
}

async function main() {
  console.log('Reading style-analysis.json...');

  const styleJson = await fs.readFile(
    './style-analysis.json',
    'utf8'
  );

  const style: StyleAnalysis = JSON.parse(styleJson);

  console.log('\nStyle analysis:');
  console.log(JSON.stringify(style, null, 2));

  const prompt = buildPrompt(style);

  await fs.writeFile(
    './json-style-prompt.txt',
    prompt,
    'utf8'
  );

  console.log('\nSaved: json-style-prompt.txt');

  console.log('\nReading person.jpg...');

  const personBuffer = await fs.readFile('./person.jpg');
  const personImage = personBuffer.toString('base64');

  const body = {
    prompt,

    negative_prompt: `
different person,
unrecognizable person,
generic face,
new identity,
replacement person,
replacement face,
changed facial identity,
changed facial structure,
different facial proportions,
different hairstyle,
different clothing,
different body,
different pose,
different silhouette,
different subject,
extra person,
duplicate person,
deformed face,
distorted face,
deformed body,
extra limbs,
extra fingers,
missing fingers,
generic character,
fictional character,
unrelated character
`,

    width: 512,
    height: 512,

    init_image: personImage,

    strength: 0.25,

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

  console.log('\nStarting Qwen Image Edit...');
  console.log('Strength:', body.strength);
  console.log('Endpoint:', IMG_GEN_URL);

  const response = await fetch(
    IMG_GEN_URL,
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

  const jobUrl = `${SD_SERVER}/sdcpp/v1/jobs/${job.id}`;

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
        './generated-json-style-person.png',
        outputBuffer
      );

      console.log(
        '\nSaved: generated-json-style-person.png'
      );

      break;
    }

    if (
      jobStatus.status === 'failed' ||
      jobStatus.status === 'error' ||
      jobStatus.status === 'cancelled'
    ) {
      throw new Error(
        `Generation failed: ${JSON.stringify(
          jobStatus,
          null,
          2
        )}`
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});