# Windows Server Deployment Guide

This guide covers deploying Aura (YouTube video generation) to a Windows Server instance.

## Prerequisites

- Windows Server 2019 or 2022
- Node.js 18+ installed (https://nodejs.org/)
- PM2 globally installed: `npm install -g pm2`
- Git installed
- FFmpeg installed (add to PATH)
- Google Chrome installed (for Playwright)
- A dedicated service account with Google credentials

## System Setup

### 1. Install Dependencies

```powershell
# Install Node.js from https://nodejs.org/ (LTS recommended)
# Verify installation
node --version
npm --version

# Install PM2 globally
npm install -g pm2

# Install FFmpeg
# Download from https://ffmpeg.org/download.html
# Extract and add bin folder to system PATH
```

### 2. Clone Repository

```powershell
cd C:\
git clone https://github.com/n1meli333-ops/soft-video.git
cd soft-video
npm install
```

### 3. Environment Configuration

Create `.env` file in project root:

```env
# Database
DATABASE_URL="file:./data/soft-video.db"

# AssemblyAI (for audio transcription)
ASSEMBLYAI_API_KEY=your_assemblyai_key

# Google Account (for Flow + Gemini Web automation)
GOOGLE_EMAIL=your_google_email@gmail.com
GOOGLE_PASSWORD=your_google_password

# Playwright settings (Windows doesn't need virtual display)
PLAYWRIGHT_USER_DATA_DIR=C:\soft-video\data\browser-profile

# Project data directory
DATA_DIR=C:\soft-video\data

# Fragment duration in seconds
FRAGMENT_DURATION=8

# Node environment
NODE_ENV=production
```

**Important**: For Google login with 2FA enabled, use an [App Password](https://myaccount.google.com/apppasswords) instead of your actual Google password.

### 4. Initialize Database

```powershell
npx prisma migrate deploy
npx prisma generate
```

### 5. Build Next.js App

```powershell
npm run build
```

## PM2 Configuration

Windows Server uses a different PM2 configuration than Linux (no Xvfb virtual display needed).

### ecosystem.config.windows.cjs

```javascript
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
      error_file: "logs/web-error.log",
      out_file: "logs/web-out.log",
    },
    {
      name: "aura-worker",
      script: "npm",
      args: "run worker",
      cwd: "C:\\soft-video",
      env: {
        NODE_ENV: "production",
        // No DISPLAY needed on Windows
      },
      exec_mode: "fork",
      max_memory_restart: "1000M",
      error_file: "logs/worker-error.log",
      out_file: "logs/worker-out.log",
      // Restart on crash
      restart_delay: 5000,
      max_restarts: 10,
    },
  ],
};
```

## Starting Services

### Using PM2

```powershell
# Start with Windows configuration
pm2 start ecosystem.config.windows.cjs

# Save PM2 configuration to auto-start on reboot
pm2 startup windows
pm2 save

# View logs
pm2 logs

# Monitor
pm2 monit
```

### Manual Start (for testing)

```powershell
# Terminal 1: Start Next.js web server
npm run start

# Terminal 2: Start pipeline worker
npm run worker
```

## Accessing the Application

Once services are running:

- **Web UI**: http://localhost:3000 (or your server IP)
- **API**: http://localhost:3000/api

## Windows Service Auto-Start

To make PM2 apps start automatically on Windows Server boot:

```powershell
# Install as Windows service
pm2 startup windows -u [username] --no-save

# Save PM2 state
pm2 save

# Verify service is installed
Get-Service pm2
```

## Monitoring

### Check Process Status

```powershell
pm2 list
pm2 status
pm2 info aura-web
pm2 info aura-worker
```

### View Logs

```powershell
# Real-time logs
pm2 logs

# Specific app logs
pm2 logs aura-web
pm2 logs aura-worker

# Log files are in ./logs directory
```

### Memory & CPU Usage

```powershell
pm2 monit
```

## Troubleshooting

### Google Login Issues

If Playwright automation fails to login:

1. Check that Chrome is installed: `chrome://version/`
2. Verify credentials in `.env` file
3. If using 2FA, use an [App Password](https://myaccount.google.com/apppasswords)
4. Manually test login in browser to ensure account is accessible

### FFmpeg Not Found

If FFmpeg errors occur:

1. Verify FFmpeg is installed: `ffmpeg -version`
2. Ensure `bin` folder is added to system PATH
3. Restart terminal/PowerShell after PATH update

### Port Already in Use

If port 3000 is in use:

```powershell
# Find process using port 3000
Get-Process | Where-Object { $_.Name -like "*node*" }

# Change port in ecosystem.config.windows.cjs
env: {
  PORT: 3001,
  ...
}
```

### Worker Not Processing

Check logs and ensure database migrations are complete:

```powershell
npx prisma migrate deploy
pm2 restart aura-worker
```

## Updating Application

```powershell
cd C:\soft-video

# Stop services
pm2 stop all

# Pull latest code
git pull origin claude/youtube-video-generator-WWZsv

# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Build
npm run build

# Restart services
pm2 start ecosystem.config.windows.cjs
```

## Firewall Configuration

Allow port 3000 through Windows Firewall:

```powershell
# Using PowerShell as Administrator
New-NetFirewallRule -DisplayName "Allow Node.js 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000
```

Or use Windows Defender Firewall GUI:
- Settings > Windows Defender Firewall > Allow an app through firewall
- Add Node.js (node.exe) with Public & Private checked

## SSL/HTTPS (Recommended for Production)

For HTTPS, use a reverse proxy like nginx or configure IIS:

### Option 1: IIS Reverse Proxy

1. Install IIS on Windows Server
2. Install URL Rewrite and Application Request Routing modules
3. Create reverse proxy rule pointing to http://localhost:3000
4. Bind HTTPS certificate to IIS site
5. Route traffic through IIS to Node.js backend

### Option 2: nginx on Windows

1. Download nginx from https://nginx.org/
2. Configure as reverse proxy to localhost:3000
3. Add SSL certificate configuration

## Backups

Regular backups are important:

```powershell
# Create database backup
Copy-Item "data/soft-video.db" "backups/soft-video-$(Get-Date -Format yyyyMMdd).db"

# Create project data backup
Copy-Item -Recurse "data/projects" "backups/projects-$(Get-Date -Format yyyyMMdd)"
```

## Performance Optimization

### Increase Resource Limits

Edit `ecosystem.config.windows.cjs`:

```javascript
max_memory_restart: "1500M",  // Increase if needed
max_restarts: 5,             // More restart retries
restart_delay: 5000,         // Delay between restarts
```

### Enable Process Manager Clustering

For multi-core utilization:

```javascript
exec_mode: "cluster",        // Changed from "fork"
instances: 2,                // Number of processes
```

## Next Steps

1. Test the application at http://localhost:3000
2. Create initial project and test full pipeline
3. Verify Activity logs appear in real-time
4. Monitor worker processing
5. Configure SSL/HTTPS for production use
