import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 908-doha-ui sits OUTSIDE this project's root, so Rollup can't resolve
// shared deps (react, lucide-react) from its files using the default
// node_modules walk. Pin them to this project's node_modules.
const pkg = (name) =>
  path.resolve(__dirname, 'node_modules', name);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ds': path.resolve(__dirname, '../908-doha-ui'),
      react: pkg('react'),
      'react-dom': pkg('react-dom'),
      'react/jsx-runtime': pkg('react/jsx-runtime'),
      'lucide-react': pkg('lucide-react'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    fs: {
      // allow importing from sibling 908-doha-ui directory
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
