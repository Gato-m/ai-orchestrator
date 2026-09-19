// Simple test to check if server can be imported without syntax errors
import('./src/server.js').then(() => {
  console.log('Server imports successfully');
}).catch(err => {
  console.error('Server import failed:', err.message);
});