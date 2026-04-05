import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require('./package.json');
const dependencies = pkg.dependencies || {};
const externalList = Object.keys(dependencies).filter(dep => dep !== 'dayjs');

// 构建 admin 前端
function buildAdmin() {
  console.log('Building admin frontend...');
  const adminDir = path.join(__dirname, '..', 'admin');
  const publicDir = path.join(__dirname, 'public', 'admin');
  
  try {
    // 确保 public/admin 目录存在
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    
    // 使用 vite 构建
    execSync('npx vite build --outDir ../server/public/admin', {
      cwd: adminDir,
      stdio: 'inherit'
    });
    console.log('✅ Admin frontend built successfully!');
  } catch (e) {
    console.warn('⚠️ Admin frontend build skipped:', e.message);
  }
}

try {
  // 先构建 admin
  buildAdmin();
  
  // 然后构建 server
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    external: externalList,
  });
  console.log('⚡ Build complete!');
} catch (e) {
  console.error(e);
  process.exit(1);
}
