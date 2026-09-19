import fs from 'node:fs/promises';

async function main() {
  const buffer = await fs.readFile('./person.jpg');

  const imageBase64 = buffer.toString('base64');

  const body = {
    prompt: 'Turn this photo into a simple illustrated poster.',
    width: 512,
    height: 512,
    init_image: imageBase64,
  };

  console.log('Sending minimal init_image request...');

  const response = await fetch(
    'http://127.0.0.1:1234/sdcpp/v1/img_gen',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  console.log('HTTP status:', response.status);
  console.log('Response:', await response.text());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

