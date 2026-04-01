# Aura - Windows Server Setup Script
# Run this in PowerShell as Administrator
# Usage: .\setup-windows.ps1

param(
    [string]$GoogleEmail = "",
    [string]$GooglePassword = "",
    [string]$AssemblyAIKey = "",
    [string]$ProjectPath = "C:\soft-video"
)

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Aura Video Generator - Windows Server Setup         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
    Write-Host "⚠️  This script must run as Administrator!" -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

$checks = @{
    "Node.js" = { node --version 2>$null }
    "npm" = { npm --version 2>$null }
    "Git" = { git --version 2>$null }
    "FFmpeg" = { ffmpeg -version 2>$null }
    "Chrome" = { Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" -or Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe" }
}

$missingChecks = @()
foreach ($check in $checks.GetEnumerator()) {
    try {
        if ($check.Value -is [scriptblock]) {
            $result = & $check.Value
            if ($null -ne $result) {
                Write-Host "✓ $($check.Name)" -ForegroundColor Green
            } else {
                Write-Host "✗ $($check.Name)" -ForegroundColor Red
                $missingChecks += $check.Name
            }
        } else {
            if ($check.Value) {
                Write-Host "✓ $($check.Name)" -ForegroundColor Green
            } else {
                Write-Host "✗ $($check.Name)" -ForegroundColor Red
                $missingChecks += $check.Name
            }
        }
    } catch {
        Write-Host "✗ $($check.Name)" -ForegroundColor Red
        $missingChecks += $check.Name
    }
}

if ($missingChecks.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  Missing prerequisites: $($missingChecks -join ', ')" -ForegroundColor Yellow
    Write-Host "Please install before running setup." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Installation links:" -ForegroundColor Cyan
    Write-Host "  Node.js: https://nodejs.org/ (LTS recommended)" -ForegroundColor White
    Write-Host "  Git: https://git-scm.com/" -ForegroundColor White
    Write-Host "  FFmpeg: https://ffmpeg.org/download.html" -ForegroundColor White
    Write-Host "  Chrome: https://www.google.com/chrome/" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "✓ All prerequisites installed!" -ForegroundColor Green
Write-Host ""

# Clone or verify repository
if (-not (Test-Path $ProjectPath)) {
    Write-Host "Cloning repository..." -ForegroundColor Yellow
    git clone https://github.com/n1meli333-ops/soft-video.git $ProjectPath
    if (-not $?) {
        Write-Host "Failed to clone repository!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Project path exists: $ProjectPath" -ForegroundColor Green
}

cd $ProjectPath

# Install npm dependencies
Write-Host ""
Write-Host "Installing npm dependencies..." -ForegroundColor Yellow
npm install
if (-not $?) {
    Write-Host "Failed to install dependencies!" -ForegroundColor Red
    exit 1
}

# Create .env file
Write-Host ""
Write-Host "Setting up .env file..." -ForegroundColor Yellow

# Prompt for credentials if not provided
if ([string]::IsNullOrWhiteSpace($GoogleEmail)) {
    $GoogleEmail = Read-Host "Enter Google Email"
}

if ([string]::IsNullOrWhiteSpace($GooglePassword)) {
    $GooglePassword = Read-Host "Enter Google Password (or App Password if 2FA enabled)" -AsSecureString
    $GooglePassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($GooglePassword))
}

if ([string]::IsNullOrWhiteSpace($AssemblyAIKey)) {
    $AssemblyAIKey = Read-Host "Enter AssemblyAI API Key (or press Enter to skip)"
}

# Create .env content
$envContent = @"
# Database
DATABASE_URL="file:./data/soft-video.db"

# AssemblyAI (for audio transcription)
ASSEMBLYAI_API_KEY=$AssemblyAIKey

# Google Account (for Flow + Gemini Web automation)
GOOGLE_EMAIL=$GoogleEmail
GOOGLE_PASSWORD=$GooglePassword

# Playwright settings
PLAYWRIGHT_USER_DATA_DIR=$ProjectPath\data\browser-profile

# Project data directory
DATA_DIR=$ProjectPath\data

# Fragment duration in seconds (default: 8)
FRAGMENT_DURATION=8

# Node environment
NODE_ENV=production
"@

# Save .env file
$envContent | Out-File -FilePath ".env" -Encoding UTF8 -NoNewline

Write-Host "✓ .env file created" -ForegroundColor Green

# Create necessary directories
Write-Host ""
Write-Host "Creating data directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "data\browser-profile" | Out-Null
New-Item -ItemType Directory -Force -Path "data\projects" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-Host "✓ Directories created" -ForegroundColor Green

# Initialize database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
npx prisma migrate deploy
if (-not $?) {
    Write-Host "Failed to initialize database!" -ForegroundColor Yellow
    Write-Host "You may need to run this manually: npx prisma migrate deploy" -ForegroundColor White
}

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

# Build Next.js app
Write-Host ""
Write-Host "Building Next.js application..." -ForegroundColor Yellow
npm run build
if (-not $?) {
    Write-Host "Failed to build application!" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Build completed" -ForegroundColor Green

# Install PM2 globally if not already installed
Write-Host ""
Write-Host "Checking PM2..." -ForegroundColor Yellow
npm list -g pm2 2>$null | Out-Null
if (-not $?) {
    Write-Host "Installing PM2 globally..." -ForegroundColor Yellow
    npm install -g pm2
}
Write-Host "✓ PM2 installed" -ForegroundColor Green

# Setup complete
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   Setup Complete!                                      ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Review ecosystem.config.windows.cjs and adjust paths if needed" -ForegroundColor White
Write-Host "2. Test the application in development mode:" -ForegroundColor White
Write-Host "   npm run dev       (Terminal 1)" -ForegroundColor Gray
Write-Host "   npm run worker:dev (Terminal 2)" -ForegroundColor Gray
Write-Host "3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host "4. Once tested, deploy with PM2:" -ForegroundColor White
Write-Host "   pm2 start ecosystem.config.windows.cjs" -ForegroundColor Gray
Write-Host "5. Enable auto-start:" -ForegroundColor White
Write-Host "   pm2 startup windows" -ForegroundColor Gray
Write-Host "   pm2 save" -ForegroundColor Gray
Write-Host ""
Write-Host "For detailed deployment guide, see: WINDOWS_DEPLOYMENT.md" -ForegroundColor Yellow
Write-Host ""
