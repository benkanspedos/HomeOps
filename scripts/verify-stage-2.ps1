# Verify Stage 2 outputs
$outputs = @(
    "C:\Projects\HomeOps\docs\planning\PRD.md",
    "C:\Projects\HomeOps\docs\planning\user-stories.md",
    "C:\Projects\HomeOps\docs\planning\epics.md"
)

$missing = @()
foreach ($file in $outputs) {
    if (!(Test-Path $file)) {
        $missing += $file
    }
}

if ($missing.Count -eq 0) {
    Write-Host "[OK] Stage 2 COMPLETE - All outputs verified" -ForegroundColor Green
    Write-Host "Ready for Stage 3: Architecture" -ForegroundColor Yellow
} else {
    Write-Host "[FAIL] Stage 2 INCOMPLETE - Missing files:" -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
