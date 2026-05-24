/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages は https://<user>.github.io/<repo>/ 配下で配信されるため、
// base に "/<repo>/" を指定しないとアセットのパスがずれて真っ白になる。
export default defineConfig({
  base: '/0-sizer/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
})
