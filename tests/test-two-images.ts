import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SD_SERVER_URL = 'http://127.0.0.1:1234';
const STYLE_IMAGE = './test-style.jpg';
const PERSON_IMAGE = './person.jpg';
const OUTPUT_IMAGE = './generated-two-images.png';

const prompt =
  'Use the first image as the visual style reference and the second image as the main subject. Preserve the main subject identity, pose and composition from the second image. Apply the visual style, color palette, lighting and graphic treatment of the first image. Create a clean retro poster illustration with crisp graphic shapes and a limited teal, burnt orange, navy and cream color palette.';

console.log('Sending style + person images to stable-diffusion.cpp...');
console.log('This may take several minutes...');

const { stdout } = await execFileAsync(
  'curl',
  [
    '-sS',
    '--max-time',
    '1200',
    `${SD_SERVER_URL}/v1/images/edits`,
    '-F',
    'model=sd-cpp-local',
    '-F',
    `prompt=${prompt}`,
    '-F',
    `image[]=@${STYLE_IMAGE}`,
    '-F',
    `image[]=@${PERSON_IMAGE}`,
  ],
  {
    maxBuffer: 50 * 1024 * 1024,
  },
);

const result = JSON.parse(stdout);

if (!result.data?.[0]?.b64_json) {
  throw new Error(
    'Response does not contain data[0].b64_json',
  );
}

const outputBuffer = Buffer.from(
  result.data[0].b64_json,
  'base64',
);

await writeFile(
  OUTPUT_IMAGE,
  outputBuffer,
);

console.log(`Generated image saved to: ${OUTPUT_IMAGE}`);