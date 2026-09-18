import fs from 'node:fs/promises';

async function main() {
  const personBuffer = await fs.readFile('./person.jpg');
  const styleBuffer = await fs.readFile('./test-style.jpg');

  const personImage = personBuffer.toString('base64');
  const styleImage = styleBuffer.toString('base64');

  const body = {
    prompt: `
Use the first image as the main subject reference.
Use the second image ONLY as the visual style reference.

Keep the person from the first image clearly recognizable.
Preserve the person's identity, face, body, pose, clothing, proportions,
and overall composition from the first image.

Apply the visual language of the second image to the first image:
its color palette, lighting, contrast, graphic shapes, texture,
composition style, and poster/illustration aesthetic.

Do NOT replace the person with anything from the second image.
Do NOT use the subject, objects, or composition of the second image.
The second image controls STYLE ONLY.
The first image controls SUBJECT ONLY.

Create a coherent final image combining the person from image 1
with the visual style of image 2.
`,

    negative_prompt: `
different person,
new person,
extra person,
changed identity,
different face,
different body,
different pose,
distorted body,
extra limbs,
deformed hands,
duplicated person,
subject from style reference,
composition from style reference
`,

    width: 512,
    height: 512,

    init_image: personImage,

    ref_images: [
      styleImage,
    ],

    strength: 0.75,

    seed: -1,

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

  console.log('Starting native two-image edit...');

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

  if (!response.ok) {
    const errorText = await response.text();

    console.error('Generation request failed.');
    console.error('HTTP status:', response.status);
    console.error('Response:', errorText);

    process.exit(1);
  }

  const job = await response.json();

  console.log('Job created:', job.id);

  const jobUrl =
    `http://127.0.0.1:1234/sdcpp/v1/jobs/${job.id}`;

  while (true) {
    await new Promise((resolve) =>
      setTimeout(resolve, 2000)
    );

    const jobResponse = await fetch(jobUrl);

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();

      console.error('Job polling failed.');
      console.error('HTTP status:', jobResponse.status);
      console.error('Response:', errorText);

      process.exit(1);
    }

    const jobStatus = await jobResponse.json();

    console.log('Job status:', jobStatus.status);

    if (jobStatus.status === 'completed') {
      const imageBase64 =
        jobStatus.result?.images?.[0]?.b64_json;

      if (!imageBase64) {
        console.error(
          'Job completed, but no image was returned.'
        );

        console.error(
          JSON.stringify(jobStatus, null, 2)
        );

        process.exit(1);
      }

      const outputBuffer =
        Buffer.from(imageBase64, 'base64');

      await fs.writeFile(
        './generated-native-two-images.png',
        outputBuffer
      );

      console.log(
        'Saved: generated-native-two-images.png'
      );

      break;
    }

    if (
      jobStatus.status === 'failed' ||
      jobStatus.status === 'error' ||
      jobStatus.status === 'cancelled'
    ) {
      console.error('Generation failed.');

      console.error(
        JSON.stringify(jobStatus, null, 2)
      );

      process.exit(1);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});