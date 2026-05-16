import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['favicon.svg', 'apple-touch-icon.svg', 'logo.png'],
    manifest: {
      name: '极星AI',
      short_name: '极星AI',
      description: 'AI 聊天与生图助手',
      theme_color: '#F8F9FA',
      background_color: '#F8F9FA',
      display: 'standalone',
      orientation: 'portrait',
      icons: [
        {
          src: 'logo.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'logo.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'logo.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    }
  }), cloudflare()],
  server: {
    host: true,
    port: 5174,
    allowedHosts: ['.cpolar.top', '.cpolar.cn', 'localhost']
  }
});