const isWindows = process.platform === 'win32';
const buildNpmRunner = (npmArgs) =>
  isWindows
    ? {
        script: 'cmd.exe',
        args: `/c npm ${npmArgs}`,
      }
    : {
        script: 'npm',
        args: npmArgs,
      };

module.exports = {
  apps: [
    {
      name: 'uptimewarden-backend',
      cwd: './Backend',
      script: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
    {
      name: 'uptimewarden-frontend',
      cwd: './frontend',
      ...buildNpmRunner('run dev -- --host 0.0.0.0 --port 5173'),
      interpreter: 'none',
      env: {
        NODE_ENV: 'development',
        VITE_API_BASE_URL: '/api',
        VITE_BACKEND_PROXY_TARGET: 'http://127.0.0.1:3002',
      },
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 2000,
      time: true,
    },
  ],
};
