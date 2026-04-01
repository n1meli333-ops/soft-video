module.exports = {
  apps: [
    {
      name: "aura-web",
      script: "npm",
      args: "run start",
      cwd: "/root/soft-video",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
    {
      name: "aura-worker",
      script: "npx",
      args: "tsx src/worker/pipeline-worker.ts",
      cwd: "/root/soft-video",
      env: {
        NODE_ENV: "production",
        DISPLAY: ":99",
      },
      // Restart on crash
      restart_delay: 5000,
      max_restarts: 10,
    },
    {
      name: "xvfb",
      script: "Xvfb",
      args: ":99 -screen 0 1920x1080x24 -ac",
      // Start before worker
      restart_delay: 2000,
    },
  ],
};
