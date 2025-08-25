# PowerShell script to set up HomeOps environment

param(
    [string]$Environment = "development"
)

Write-Host "Setting up HomeOps environment for: $Environment" -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "Creating .env.local from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env.local"
    Write-Host "Please edit .env.local with your configuration values" -ForegroundColor Yellow
}

# Check Docker installation
Write-Host "Checking Docker installation..." -ForegroundColor Cyan
try {
    $dockerVersion = docker --version
    Write-Host "Docker found: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "Docker not found. Please install Docker Desktop." -ForegroundColor Red
    exit 1
}

# Check Node.js installation
Write-Host "Checking Node.js installation..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
    
    # Check if version is 20 or higher
    $versionNumber = [version]($nodeVersion -replace 'v', '')
    if ($versionNumber.Major -lt 20) {
        Write-Host "Node.js version 20 or higher required. Current: $nodeVersion" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Node.js not found. Please install Node.js 20 or higher." -ForegroundColor Red
    exit 1
}

# Check Supabase CLI
Write-Host "Checking Supabase CLI..." -ForegroundColor Cyan
try {
    $supabaseVersion = supabase --version
    Write-Host "Supabase CLI found: $supabaseVersion" -ForegroundColor Green
} catch {
    Write-Host "Supabase CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g supabase
}

# Create necessary directories
Write-Host "Creating project directories..." -ForegroundColor Cyan
$directories = @(
    "logs",
    "docker/gluetun",
    "data/redis",
    "data/timescale",
    "uploads",
    "temp"
)

foreach ($dir in $directories) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
        Write-Host "Created directory: $dir" -ForegroundColor Green
    }
}

# Install backend dependencies
if (Test-Path "backend/package.json") {
    Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
    Set-Location backend
    npm install
    Set-Location ..
    Write-Host "Backend dependencies installed" -ForegroundColor Green
}

# Install frontend dependencies (if exists)
if (Test-Path "package.json") {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    npm install
    Write-Host "Frontend dependencies installed" -ForegroundColor Green
}

# Initialize Supabase (if not already done)
if (-not (Test-Path "supabase/.gitignore")) {
    Write-Host "Initializing Supabase..." -ForegroundColor Cyan
    supabase init
}

# Start Docker services (optional)
$startDocker = Read-Host "Do you want to start Docker services? (y/n)"
if ($startDocker -eq 'y') {
    Write-Host "Starting Docker services..." -ForegroundColor Cyan
    docker-compose up -d
    Write-Host "Docker services started" -ForegroundColor Green
}

# Start Supabase locally (optional)
$startSupabase = Read-Host "Do you want to start Supabase locally? (y/n)"
if ($startSupabase -eq 'y') {
    Write-Host "Starting Supabase..." -ForegroundColor Cyan
    supabase start
    Write-Host "Supabase started" -ForegroundColor Green
    
    # Apply migrations
    Write-Host "Applying database migrations..." -ForegroundColor Cyan
    supabase db push
    Write-Host "Migrations applied" -ForegroundColor Green
    
    # Seed database (optional)
    $seedDb = Read-Host "Do you want to seed the database? (y/n)"
    if ($seedDb -eq 'y') {
        supabase db seed
        Write-Host "Database seeded" -ForegroundColor Green
    }
}

Write-Host "`nEnvironment setup complete!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Edit .env.local with your configuration values"
Write-Host "2. Run 'npm run dev' in the backend directory to start the API"
Write-Host "3. Run 'npm run dev' in the root directory to start the frontend"
Write-Host "4. Visit http://localhost:3000 to see the application"