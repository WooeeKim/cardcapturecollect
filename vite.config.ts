import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS dev server by default: iPhone Safari only allows geolocation on https pages.
// `vite --mode http` = plain http (desktop previews that reject self-signed certs).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'http' ? [] : [basicSsl()])],
}))
