module.exports = {
  apps: [
    {
      name: "aura-web",
      script: "npm",
      args: "run start",
      cwd: "C:\\soft-video",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // Windows-specific settings
      exec_mode: "fork",
      max_memory_restart: "500M",
      error_file: "logs\\web-error.log",
      out_file: "logs\\web-out.log",
      autorestart: true,
      watch: false,
    },
    {
      name: "aura-worker",
      script: "npm",
      args: "run worker",
      cwd: "C:\\soft-video",
      env: {
        NODE_ENV: "production",
      },
      // Windows-specific settings
      exec_mode: "fork",
      max_memory_restart: "1000M",
      error_file: "logs\\worker-error.log",
      out_file: "logs\\worker-out.log",
      autorestart: true,
      watch: false,
      // Restart on crash
      restart_delay: 5000,
      max_restarts: 10,
      min_uptime: "10s",
    },
  ],
};
