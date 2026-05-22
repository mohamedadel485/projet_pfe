import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
  const backendEnv = loadEnv(mode, '../backend', '');
  const backendPort = backendEnv.PORT || '3001';
  const backendTarget = `http://localhost:${backendPort}`;

  return {
    plugins: [react()],
    define:
      command === 'serve'
        ? {
            'import.meta.env.VITE_BACKEND_PROXY_TARGET': JSON.stringify(backendTarget),
          }
        : undefined,
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
