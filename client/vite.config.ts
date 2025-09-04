import { defineConfig } from 'vite'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(async () => {
  const react = (await import('@vitejs/plugin-react')).default
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@assets": path.resolve(__dirname, "../attached_assets")
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5000,
      strictPort: true,
      allowedHosts: [
        'qr-gatepass-manager-hemanthvardhan7.replit.app',
        '21a92ee8-ddfa-4e5b-8475-a9fd540bb9d1-00-2psjlie2z8vv7.kirk.replit.dev',
        '.replit.dev',
        '.replit.app'
      ]
    },
    preview: {
      host: '0.0.0.0',
      port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
      strictPort: false,
      allowedHosts: [
        'qr-gatepass-manager-hemanthvardhan7.replit.app',
        '21a92ee8-ddfa-4e5b-8475-a9fd540bb9d1-00-2psjlie2z8vv7.kirk.replit.dev',
        '.replit.dev',
        '.replit.app'
      ]
    }
  }
})