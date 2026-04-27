import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// 908-doha-ui sits OUTSIDE this project's root, so Rollup can't resolve
// shared deps (react, lucide-react) from its files using the default
// node_modules walk. Pin them to this project's node_modules.
const pkg = (name) => path.resolve(__dirname, 'node_modules', name);

const DS_DIR = path.resolve(__dirname, '../908-doha-ui');
const STUB_DIR = path.resolve(__dirname, 'src/providers/dsStubs');

// Map specific 908-doha-ui lib files to local stubs so we can mount
// the real AuthProvider + design-system components (NoteCard, TaskCard,
// VaultEntry, MemberAvatar) WITHOUT a Supabase backend. Keys are the
// fully resolved absolute paths Vite arrives at after walking the
// design-system's relative imports (`../lib/supabase.js` etc.).
const DS_LIB_STUBS = {
  [path.join(DS_DIR, 'lib/supabase.js')]: path.join(STUB_DIR, 'supabase.js'),
  [path.join(DS_DIR, 'lib/members.js')]:  path.join(STUB_DIR, 'members.js'),
  [path.join(DS_DIR, 'lib/auth.js')]:     path.join(STUB_DIR, 'auth.js'),
};

function dsStubPlugin() {
  return {
    name: 'ds-lib-stub',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer) return null;
      // Only intercept relative imports out of the 908-doha-ui package.
      if (!source.startsWith('.')) return null;
      const resolved = path.resolve(path.dirname(importer), source);
      return DS_LIB_STUBS[resolved] ?? null;
    },
  };
}

export default defineConfig({
  plugins: [dsStubPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ds': DS_DIR,
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
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
