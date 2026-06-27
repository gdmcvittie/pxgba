import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Removes crossorigin attributes from script and link tags.
// Vite adds crossorigin to module scripts for CORS error reporting,
// but when loaded via Electron's loadFile (file:// protocol),
// crossorigin triggers CORS validation that fails for local files.
function removeCrossoriginPlugin() {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin(=["'][^"']*["'])?/gi, '');
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), removeCrossoriginPlugin()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
