import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { contactOutProxyPlugin } from './vite-plugins/contactoutProxy.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), contactOutProxyPlugin()],
})
