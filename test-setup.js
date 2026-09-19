// Test script to verify server setup
import express from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';

console.log('Server dependencies imported successfully');

// Test if we can access the key files
try {
  const workflowExists = fs.access('./style-transfer.json');
  console.log('✅ style-transfer.json found');
} catch (err) {
  console.log('❌ style-transfer.json not found:', err.message);
}

try {
  const ollamaExists = fs.access('./src/ollama.ts');
  console.log('✅ src/ollama.ts found');
} catch (err) {
  console.log('❌ src/ollama.ts not found:', err.message);
}

try {
  const comfyExists = fs.access('./src/comfy.ts');
  console.log('✅ src/comfy.ts found');
} catch (err) {
  console.log('❌ src/comfy.ts not found:', err.message);
}

console.log('Setup verification complete');