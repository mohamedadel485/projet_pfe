import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const backendEnv = loadEnv(mode, '../Backend', '');
  const backendPort = backendEnv.PORT || '3001';
  const backendTarget =
    env.VITE_BACKEND_PROXY_TARGET || `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
