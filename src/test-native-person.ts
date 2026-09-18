import fs from 'node:fs/promises';

async function main() {
  const buffer = await fs.readFile('./person.jpg');
  const imageBase64 = buffer.toString('base64');

  const body = {
    prompt:
      'Turn this photo into a clean illustrated poster. Preserve the main person, pose, proportions, clothing, and overall composition. Use crisp graphic shapes, a limited retro color palette, strong visual design, and poster-like illustration aesthetics.',

    negative_prompt:
      'Do not change the person identity, do not add people, do not distort the body, do not change the pose, no extra limbs, no deformed hands, no duplicated person.',

    width: 512,
    height: 512,

    init_image: imageBase64,

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

  console.log('Starting single-image person edit...');

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
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
        console.error(JSON.stringify(jobStatus, null, 2));
        process.exit(1);
      }

      const outputBuffer = Buffer.from(imageBase64, 'base64');

      await fs.writeFile(
        './generated-native-person.png',
        outputBuffer
      );

      console.log(
        'Saved: generated-native-person.png'
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