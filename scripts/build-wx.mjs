// scripts/build-wx.mjs — 微信小游戏构建：vite lib 单文件 bundle + game.json 拷贝 + 首包断言
import { build } from 'vite';
import { copyFileSync, statSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url)); // 项目根
const distDir = join(root, 'src/containers/wx-mini/dist');
const wxDir = join(root, 'src/containers/wx-mini');

await build({
  root,
  configFile: false, // 不复用 h5 的 vite.config.js（其 root 指向 h5）
  logLevel: 'info',
  build: {
    outDir: 'src/containers/wx-mini/dist',
    emptyOutDir: true,
    target: 'es6', // 小游戏基础库基线
    minify: 'esbuild',
    lib: {
      entry: join(wxDir, 'game.js'),
      formats: ['iife'],
      name: 'qqc',
      fileName: () => 'game.js',
    },
  },
});

// game.json 必须位于 miniprogramRoot（dist/）内；emptyOutDir 会清掉，故构建后拷入
mkdirSync(distDir, { recursive: true });
copyFileSync(join(wxDir, 'game.json'), join(distDir, 'game.json'));

// 首包体积硬指标（spec 第二章：≤4MB）
const kb = Math.round(statSync(join(distDir, 'game.js')).size / 1024);
console.log(`[wx] dist/game.js = ${kb} KB`);
if (kb > 4096) {
  console.error('[wx] 首包超过 4MB 上限，需拆分包或远程资源');
  process.exit(1);
}
