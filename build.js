import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const publicDir = path.join(rootDir, 'public');
const distDir = path.join(rootDir, 'dist');

// Ensure directories exist
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(path.join(publicDir, 'admin'), { recursive: true });
fs.mkdirSync(path.join(distDir, 'admin'), { recursive: true });

// Copy index.html
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
fs.writeFileSync(path.join(publicDir, 'index.html'), indexHtml);
fs.writeFileSync(path.join(publicDir, 'admin', 'index.html'), indexHtml);
fs.writeFileSync(path.join(distDir, 'index.html'), indexHtml);
fs.writeFileSync(path.join(distDir, 'admin', 'index.html'), indexHtml);

// Copy data if exists
const dataDir = path.join(rootDir, 'data');
if (fs.existsSync(dataDir)) {
  fs.mkdirSync(path.join(publicDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'data'), { recursive: true });
  const files = fs.readdirSync(dataDir);
  for (const file of files) {
    fs.copyFileSync(path.join(dataDir, file), path.join(publicDir, 'data', file));
    fs.copyFileSync(path.join(dataDir, file), path.join(distDir, 'data', file));
  }
}

console.log('Build complete: output created in both public/ and dist/');
