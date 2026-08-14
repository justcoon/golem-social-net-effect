import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
  ],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:9006",
        changeOrigin: true,
        // headers: {
        //   Host: "golem-social-net.test.local",
        // },
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
