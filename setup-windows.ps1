# Aura - Windows Server Setup Script
# Run in PowerShell as Administrator
# Usage: Set-ExecutionPolicy Bypass -Scope Process; .\setup-windows.ps1

Write-Host ""
Write-Host "=== Aura Video Generator - Windows Server Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
$nodeVer = node --version 2>$null
if ($nodeVer) {
    Write-Host "[OK] Node.js $nodeVer" -ForegroundColor Green
} else {
    Write-Host "[X] Node.js not found! Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check Git
$gitVer = git --version 2>$null
if ($gitVer) {
    Write-Host "[OK] Git installed" -ForegroundColor Green
} else {
    Write-Host "[X] Git not found! Install from https://git-scm.com/" -ForegroundColor Red
    exit 1
}

# Check FFmpeg
$ffVer = ffmpeg -version 2>$null
if ($ffVer) {
    Write-Host "[OK] FFmpeg installed" -ForegroundColor Green
} else {
    Write-Host "[X] FFmpeg not found! Install from https://ffmpeg.org/download.html" -ForegroundColor Red
    Write-Host "    Add ffmpeg bin folder to system PATH" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "All prerequisites OK!" -ForegroundColor Green
Write-Host ""

# Set project path
$ProjectPath = "C:\soft-video"

# Already cloned if we are running from the repo
if (Test-Path "$ProjectPath\package.json") {
    Write-Host "Project found at $ProjectPath" -ForegroundColor Green
} else {
    Write-Host "ERROR: Project not found at $ProjectPath" -ForegroundColor Red
    exit 1
}

Set-Location $ProjectPath

# Install npm dependencies
Write-Host ""
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install

# Prompt for credentials
Write-Host ""
Write-Host "=== Configuration ===" -ForegroundColor Cyan
$GoogleEmail = Read-Host "Google Email"
$GooglePassword = Read-Host "Google Password (or App Password for 2FA)"
$AssemblyAIKey = Read-Host "AssemblyAI API Key (Enter to skip)"

# Write .env file
$envLines = @(
    '# Database',
    'DATABASE_URL="file:./data/soft-video.db"',
    '',
    '# AssemblyAI',
    "ASSEMBLYAI_API_KEY=$AssemblyAIKey",
    '',
    '# Google Account',
    "GOOGLE_EMAIL=$GoogleEmail",
    "GOOGLE_PASSWORD=$GooglePassword",
    '',
    '# Playwright',
    "PLAYWRIGHT_USER_DATA_DIR=$ProjectPath\data\browser-profile",
    '',
    '# Data',
    "DATA_DIR=$ProjectPath\data",
    '',
    '# Settings',
    'FRAGMENT_DURATION=8',
    'NODE_ENV=production'
)
$envLines -join "`r`n" | Set-Content -Path ".env" -Encoding UTF8

Write-Host "[OK] .env created" -ForegroundColor Green

# Create directories
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "data\browser-profile" | Out-Null
New-Item -ItemType Directory -Force -Path "data\projects" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-Host "[OK] Directories created" -ForegroundColor Green

# Database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
npx prisma generate
npx prisma db push

# Build
Write-Host ""
Write-Host "Building Next.js..." -ForegroundColor Yellow
npm run build

# PM2
Write-Host ""
Write-Host "Installing PM2..." -ForegroundColor Yellow
npm install -g pm2

Write-Host ""
Write-Host "=== Setup Complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "To start:" -ForegroundColor Cyan
Write-Host "  pm2 start ecosystem.config.windows.cjs" -ForegroundColor White
Write-Host ""
Write-Host "To test first:" -ForegroundColor Cyan
Write-Host "  npm run dev          (Terminal 1)" -ForegroundColor White
Write-Host "  npm run worker:dev   (Terminal 2)" -ForegroundColor White
Write-Host ""
Write-Host "Open: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""
