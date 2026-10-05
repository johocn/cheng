import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/containers/h5',
  base: './', // 相对路径：部署到任意子目录（如 /qqc/）资产不落空
  server: { port: 5173 },
});
