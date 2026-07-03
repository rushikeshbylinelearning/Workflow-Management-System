import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  define: {
    // Suppress findDOMNode warnings from react-quill
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  server: {
    proxy: {
      '/api/socket.io': {
        target: process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3005',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
