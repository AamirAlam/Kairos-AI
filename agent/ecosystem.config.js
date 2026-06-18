// pm2 process definition for the Kairos agent.
// Run from the agent/ directory:  pm2 start ecosystem.config.js
//
// Paths are relative to this file's directory (pm2 sets cwd accordingly), so
// there are no hardcoded home paths. .env in this dir is auto-loaded by the
// app's `import 'dotenv/config'`. DB_PATH points at the persistent volume.

module.exports = {
  apps: [
    {
      name: 'kairos-agent',
      script: 'dist/index.js',
      // env injected on top of the app's own dotenv (.env in this dir)
      env: {
        NODE_ENV: 'production',
        DB_PATH: '/var/lib/kairos/agent.db',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      max_memory_restart: '400M',
      // logs land on the persistent volume so they survive restarts
      out_file: '/var/lib/kairos/agent-out.log',
      error_file: '/var/lib/kairos/agent-error.log',
      merge_logs: true,
      time: true, // prefix log lines with timestamps
    },
  ],
};
