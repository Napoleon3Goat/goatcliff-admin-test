import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' loads files relative to the page, so the built site works on
// GitHub Pages under any repository name (and on your laptop too).
// Page links use the # style (…/#/bookings), so no server setup is needed.
export default defineConfig({
  plugins: [react()],
  base: './',
})
