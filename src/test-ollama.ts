import { analyzeStyle } from './ollama.js';

const imagePath = process.argv[2];

if (!imagePath) {
  console.error('Usage: npm exec tsx src/test-ollama.ts <image>');
  process.exit(1);
}

try {
  const result = await analyzeStyle(imagePath);

  console.log('\n--- STYLE ANALYSIS ---\n');
  console.log(result);
} catch (error) {
  console.error('Ollama error:', error);
}
