// scripts/compress-heroes.mjs — 母版 → 512×768 WebP ≤80KB（spec 10.2 管线）
// 用法: pnpm heroes  |  node scripts/compress-heroes.mjs
import sharp from 'sharp';
import { readdirSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(root, 'docs/samples/heroes');
const OUT = join(root, 'src/assets/heroes');
const H5_PUBLIC = join(root, 'src/containers/h5/public/heroes');
const LIMIT = 80 * 1024;

// 源文件名 → heroId（赵云样张在 samples 根目录，单独映射）
const MAP = {
  'zhaoyun-ink-sample.png': 'zhaoyun',
  'guanyu.png': 'guanyu', 'zhangfei.png': 'zhangfei', 'zhugeliang.png': 'zhugeliang',
  'machao.png': 'machao', 'huangzhong.png': 'huangzhong',
  'lvbu.png': 'lvbu', 'zhouyu.png': 'zhouyu', 'zhangliao.png': 'zhangliao',
};

mkdirSync(OUT, { recursive: true });
mkdirSync(H5_PUBLIC, { recursive: true });

for (const [file, id] of Object.entries(MAP)) {
  const src = file === 'zhaoyun-ink-sample.png' ? join(root, 'docs/samples', file) : join(SRC, file);
  let q = 78, width = 512, out;
  for (;;) {
    out = await sharp(src)
      .resize(width, 768, { fit: 'cover', position: 'attention' })
      .webp({ quality: q })
      .toBuffer();
    if (out.length <= LIMIT || q <= 50) break;
    if (q - 8 <= 50 && width > 400) { width = Math.round(width * 0.9); q = 78; continue; } // 缩幅重压
    q -= 8;
  }
  const dst = join(OUT, `${id}.webp`);
  const { writeFileSync } = await import('node:fs');
  writeFileSync(dst, out);
  copyFileSync(dst, join(H5_PUBLIC, `${id}.webp`));
  console.log(`${id}.webp  ${Math.round(out.length / 1024)}KB  q${q} w${width}`);
  if (out.length > LIMIT) console.warn(`  ⚠ ${id} 仍超 80KB（q 下限），验收时人工复核`);
}
console.log('done: src/assets/heroes + src/containers/h5/public/heroes');
