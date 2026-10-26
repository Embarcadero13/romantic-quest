import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — относительные пути, поэтому сайт работает по адресу
// https://USERNAME.github.io/REPOSITORY/ с любым названием репозитория.
export default defineConfig({
  base: './',
  plugins: [react()],
});
