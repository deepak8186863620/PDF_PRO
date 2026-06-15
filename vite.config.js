import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const gaId = env.VITE_GA_ID || '';

  return {
    plugins: [
      react(), 
      tailwindcss(),
      // Inject real GA ID into index.html at build time
      {
        name: 'html-ga-inject',
        transformIndexHtml(html) {
          return html.replace('__VITE_GA_ID__', gaId);
        },
      },
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'PageDocx',
          short_name: 'PageDocx',
          description: 'Professional PDF and image processing tools',
          theme_color: '#080c14',
          background_color: '#080c14',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'https://pdf-pro-dx2i.onrender.com'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Firebase — changes rarely, cache forever
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'firebase';
            }
            // PDF.js — large worker-based renderer, keep separate
            if (id.includes('node_modules/pdfjs-dist')) {
              return 'pdf';
            }
            // pdf-lib — PDF manipulation, separate from renderer
            if (id.includes('node_modules/pdf-lib')) {
              return 'pdf-lib';
            }
            // Framer Motion / motion — animation engine
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
              return 'motion';
            }
            // React core — must be single instance
            if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-firebase-hooks')) {
              return 'react-vendor';
            }
            // Lucide icons — tree-shaken but still sizeable
            if (id.includes('node_modules/lucide-react')) {
              return 'icons';
            }
          },
        },
      },
    },
  };
});
