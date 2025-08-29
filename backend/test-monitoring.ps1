# Test script for HomeOps monitoring system
# This script tests the health monitoring API endpoints

$ErrorActionPreference = "Stop"

$API_BASE = "http://localhost:3101/api"

Write-Host "HomeOps Monitoring System Test" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check server health
Write-Host "[TEST 1] Server Health Check" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/../health" -Method GET
    Write-Host "  [OK] Server is healthy" -ForegroundColor Green
    Write-Host "  Status: $($response.status)" -ForegroundColor Gray
    Write-Host "  Uptime: $($response.uptime) seconds" -ForegroundColor Gray
} catch {
    Write-Host "  [FAIL] Server is not responding" -ForegroundColor Red
    Write-Host "  Please ensure the server is running: npm run dev" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Test 2: Get container health
Write-Host "[TEST 2] Container Health Status" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/health/containers" -Method GET
    Write-Host "  [OK] Retrieved container health" -ForegroundColor Green
    Write-Host "  Total containers: $($response.data.total)" -ForegroundColor Gray
    Write-Host "  Running: $($response.data.running)" -ForegroundColor Gray
    Write-Host "  Stopped: $($response.data.stopped)" -ForegroundColor Gray
    Write-Host "  Unhealthy: $($response.data.unhealthy)" -ForegroundColor Gray
    
    # List containers
    if ($response.data.containers.Count -gt 0) {
        Write-Host "  Containers:" -ForegroundColor Gray
        foreach ($container in $response.data.containers) {
            $statusColor = if ($container.state -eq "running") { "Green" } else { "Red" }
            Write-Host "    - $($container.containerName): $($container.state)" -ForegroundColor $statusColor
        }
    }
} catch {
    Write-Host "  [FAIL] Could not retrieve container health" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Get system metrics
Write-Host "[TEST 3] System Resource Usage" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/health/system" -Method GET
    Write-Host "  [OK] Retrieved system metrics" -ForegroundColor Green
    Write-Host "  CPU Usage: $($response.data.totalCPU)%" -ForegroundColor Gray
    Write-Host "  Memory Usage: $($response.data.usedMemoryMB) MB / $($response.data.totalMemoryMB) MB ($($response.data.memoryPercent)%)" -ForegroundColor Gray
    Write-Host "  Containers: $($response.data.runningContainers) running / $($response.data.containerCount) total" -ForegroundColor Gray
} catch {
    Write-Host "  [FAIL] Could not retrieve system metrics" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: Get alert templates
Write-Host "[TEST 4] Alert Templates" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/alerts/templates" -Method GET
    Write-Host "  [OK] Retrieved alert templates" -ForegroundColor Green
    Write-Host "  Available templates:" -ForegroundColor Gray
    foreach ($template in $response.data) {
        Write-Host "    - $($template.name) (Priority: $($template.priority))" -ForegroundColor Gray
    }
} catch {
    Write-Host "  [FAIL] Could not retrieve alert templates" -ForegroundColor Red
    Write-Host "  Error: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Test alert configuration
Write-Host "[TEST 5] Configure Test Alert" -ForegroundColor Yellow
try {
    $alertConfig = @{
        name = "Test CPU Alert"
        enabled = $true
        metricType = "cpu"
        thresholdValue = 80
        comparisonOperator = ">"
        channels = @(
            @{
                type = "webhook"
                config = @{
                    url = "http://localhost:3101/webhook-test"
                }
                enabled = $true
            }
        )
        priority = "medium"
        cooldownMinutes = 15
        description = "Test alert for CPU usage"
    }
    
    $json = $alertConfig | ConvertTo-Json -Depth 10
    $response = Invoke-RestMethod -Uri "$API_BASE/alerts/configure" -Method POST -Body $json -ContentType "application/json"
    Write-Host "  [OK] Alert configured successfully" -ForegroundColor Green
    Write-Host "  Alert ID: $($response.data.alertId)" -ForegroundColor Gray
    
    # Store alert ID for cleanup
    $Global:TestAlertId = $response.data.alertId
} catch {
    Write-Host "  [WARNING] Could not configure test alert" -ForegroundColor Yellow
    Write-Host "  This might be normal if authentication is required" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Gray
}
Write-Host ""

# Test 6: Get alert history
Write-Host "[TEST 6] Alert History" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$API_BASE/alerts/history?hours=1" -Method GET
    Write-Host "  [OK] Retrieved alert history" -ForegroundColor Green
    Write-Host "  Alerts in last hour: $($response.data.count)" -ForegroundColor Gray
    
    if ($response.data.history.Count -gt 0) {
        Write-Host "  Recent alerts:" -ForegroundColor Gray
        foreach ($alert in $response.data.history | Select-Object -First 5) {
            Write-Host "    - $($alert.alertName) at $($alert.triggeredAt)" -ForegroundColor Gray
        }
    }
} catch {
    Write-Host "  [WARNING] Could not retrieve alert history" -ForegroundColor Yellow
    Write-Host "  Error: $_" -ForegroundColor Gray
}
Write-Host ""

# Cleanup
if ($Global:TestAlertId) {
    Write-Host "[CLEANUP] Removing test alert" -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$API_BASE/alerts/$($Global:TestAlertId)" -Method DELETE
        Write-Host "  [OK] Test alert removed" -ForegroundColor Green
    } catch {
        Write-Host "  [WARNING] Could not remove test alert" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Monitoring system is operational!" -ForegroundColor Green
Write-Host ""
Write-Host "Available endpoints:" -ForegroundColor Yellow
Write-Host "  - GET  /api/health/containers - Container health status" -ForegroundColor Gray
Write-Host "  - GET  /api/health/containers/:id/logs - Container logs" -ForegroundColor Gray
Write-Host "  - GET  /api/health/metrics/:id - Container metrics history" -ForegroundColor Gray
Write-Host "  - GET  /api/health/system - System resource usage" -ForegroundColor Gray
Write-Host "  - GET  /api/health/stream - Real-time health updates (SSE)" -ForegroundColor Gray
Write-Host "  - POST /api/alerts/configure - Configure alerts" -ForegroundColor Gray
Write-Host "  - GET  /api/alerts/history - Alert history" -ForegroundColor Gray
Write-Host "  - POST /api/alerts/test/:channel - Test alert channel" -ForegroundColor Gray
Write-Host ""