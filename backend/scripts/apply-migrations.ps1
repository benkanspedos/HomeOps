# Apply database migrations for HomeOps monitoring system
# This script applies TimescaleDB migrations for health monitoring and alerts

$ErrorActionPreference = "Stop"

Write-Host "HomeOps Database Migration Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Database connection parameters
$DB_HOST = "localhost"
$DB_PORT = "5433"
$DB_NAME = "metrics"
$DB_USER = "homeops"
$DB_PASS = "homeops123"

# Migration files
$MIGRATIONS_PATH = "$PSScriptRoot\..\src\database\migrations"

# Check if migrations directory exists
if (-not (Test-Path $MIGRATIONS_PATH)) {
    Write-Host "[ERROR] Migrations directory not found: $MIGRATIONS_PATH" -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Found migrations directory: $MIGRATIONS_PATH" -ForegroundColor Green
Write-Host ""

# List migration files
$migrationFiles = Get-ChildItem -Path $MIGRATIONS_PATH -Filter "*.sql" | Sort-Object Name
Write-Host "[INFO] Found $($migrationFiles.Count) migration files:" -ForegroundColor Yellow
foreach ($file in $migrationFiles) {
    Write-Host "  - $($file.Name)" -ForegroundColor Gray
}
Write-Host ""

# Apply each migration
foreach ($file in $migrationFiles) {
    Write-Host "[MIGRATION] Applying: $($file.Name)" -ForegroundColor Cyan
    
    try {
        # Use psql to execute the migration
        $env:PGPASSWORD = $DB_PASS
        & psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $file.FullName 2>&1 | Out-String
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] Applied: $($file.Name)" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Migration may have had issues: $($file.Name)" -ForegroundColor Yellow
            Write-Host "  Check if tables already exist or review the output above" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[ERROR] Failed to apply migration: $($file.Name)" -ForegroundColor Red
        Write-Host "  Error: $_" -ForegroundColor Red
    }
    
    Write-Host ""
}

Write-Host "[COMPLETE] All migrations processed" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start the backend server: npm run dev" -ForegroundColor Gray
Write-Host "  2. Test health monitoring: curl http://localhost:3101/api/health/containers" -ForegroundColor Gray
Write-Host "  3. Configure alerts: POST http://localhost:3101/api/alerts/configure" -ForegroundColor Gray
Write-Host ""