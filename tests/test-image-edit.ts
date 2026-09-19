import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SD_SERVER_URL = 'http://127.0.0.1:1234';
const INPUT_IMAGE = './test-style.jpg';
const OUTPUT_IMAGE = './generated.png';

console.log('Sending image to stable-diffusion.cpp...');
console.log('This may take several minutes...');

const prompt =
  'Preserve the main subject and composition. Transform the image into a clean retro poster illustration with crisp graphic shapes and a limited teal, burnt orange, navy and cream color palette.';

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
    `image=@${INPUT_IMAGE}`,
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
