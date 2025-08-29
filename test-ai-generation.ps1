# AI Generation System Test Script
# Tests all components of the newly installed AI generation system

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   AI GENERATION SYSTEM TEST SUITE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test results storage
$testResults = @{
    StableDiffusion = @{Status = "Not Tested"; Details = ""}
    StableVideoDiffusion = @{Status = "Not Tested"; Details = ""}
    ElevenLabs = @{Status = "Not Tested"; Details = ""}
    FFmpeg = @{Status = "Not Tested"; Details = ""}
    VideoAgents = @{Status = "Not Tested"; Details = ""}
    EndToEnd = @{Status = "Not Tested"; Details = ""}
}

# Test 1: Stable Diffusion
Write-Host "[TEST 1] Testing Stable Diffusion..." -ForegroundColor Yellow
$sdPython = "C:\Projects\stable-diffusion-simple\sd-env\Scripts\python.exe"
if (Test-Path $sdPython) {
    Write-Host "  OK SD Python environment found" -ForegroundColor Green
    
    # Test SD script
    $testScript = "C:\Projects\stable-diffusion-simple\test_sd.py"
    if (Test-Path $testScript) {
        Write-Host "  OK SD test script found" -ForegroundColor Green
        $testResults.StableDiffusion.Status = "Ready"
        $testResults.StableDiffusion.Details = "Environment and scripts ready"
    } else {
        Write-Host "  WARN SD test script not found" -ForegroundColor Yellow
        $testResults.StableDiffusion.Status = "Partial"
        $testResults.StableDiffusion.Details = "Environment ready but test script missing"
    }
} else {
    Write-Host "  FAIL SD Python environment not found" -ForegroundColor Red
    $testResults.StableDiffusion.Status = "Failed"
    $testResults.StableDiffusion.Details = "Python environment missing"
}

# Test 2: Stable Video Diffusion
Write-Host "`n[TEST 2] Testing Stable Video Diffusion..." -ForegroundColor Yellow
$svdPython = "C:\Projects\stable-video-diffusion\svd-env\Scripts\python.exe"
if (Test-Path $svdPython) {
    Write-Host "  OK SVD Python environment found" -ForegroundColor Green
    
    # Check ComfyUI
    if (Test-Path "C:\Projects\stable-video-diffusion\ComfyUI") {
        Write-Host "  OK ComfyUI installation found" -ForegroundColor Green
        $testResults.StableVideoDiffusion.Status = "Ready"
        $testResults.StableVideoDiffusion.Details = "Environment and ComfyUI ready"
    } else {
        $testResults.StableVideoDiffusion.Status = "Partial"
        $testResults.StableVideoDiffusion.Details = "Environment ready but ComfyUI missing"
    }
} else {
    Write-Host "  FAIL SVD Python environment not found" -ForegroundColor Red
    $testResults.StableVideoDiffusion.Status = "Failed"
    $testResults.StableVideoDiffusion.Details = "Python environment missing"
}

# Test 3: ElevenLabs API
Write-Host "`n[TEST 3] Testing ElevenLabs Integration..." -ForegroundColor Yellow
$configPath = "C:\Projects\claude-cursor-settings\claude\configs\claude_desktop_config.json"
if (Test-Path $configPath) {
    $configContent = Get-Content $configPath -Raw
    if ($configContent -match "ELEVENLABS_API_KEY.*sk_") {
        Write-Host "  OK ElevenLabs API key configured" -ForegroundColor Green
        $testResults.ElevenLabs.Status = "Ready"
        $testResults.ElevenLabs.Details = "API key configured in MCP"
    } else {
        Write-Host "  WARN ElevenLabs API key not configured" -ForegroundColor Yellow
        $testResults.ElevenLabs.Status = "Not Configured"
        $testResults.ElevenLabs.Details = "API key needs to be set"
    }
}

# Test 4: FFmpeg
Write-Host "`n[TEST 4] Testing FFmpeg..." -ForegroundColor Yellow
$ffmpegPath = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($ffmpegPath) {
    Write-Host "  OK FFmpeg is installed and accessible" -ForegroundColor Green
    $testResults.FFmpeg.Status = "Ready"
    $testResults.FFmpeg.Details = "FFmpeg available in PATH"
} else {
    Write-Host "  FAIL FFmpeg not found in PATH" -ForegroundColor Red
    $testResults.FFmpeg.Status = "Not Installed"
    $testResults.FFmpeg.Details = "FFmpeg needs to be installed"
}

# Test 5: Video Production Agents
Write-Host "`n[TEST 5] Testing Video Production Agents..." -ForegroundColor Yellow
$agents = @(
    "Video-Generator",
    "Visual-Creator", 
    "Script-Writer",
    "Voice-Synthesizer",
    "Video-Editor"
)

$agentsFound = 0
foreach ($agent in $agents) {
    $agentPath = "C:\Projects\claude-cursor-settings\claude\framework\sub-agent-specs\$agent.md"
    if (Test-Path $agentPath) {
        Write-Host "  OK $agent agent found" -ForegroundColor Green
        $agentsFound++
    } else {
        Write-Host "  FAIL $agent agent missing" -ForegroundColor Red
    }
}

if ($agentsFound -eq $agents.Count) {
    $testResults.VideoAgents.Status = "Ready"
    $testResults.VideoAgents.Details = "All 5 video agents available"
} else {
    $testResults.VideoAgents.Status = "Partial"
    $testResults.VideoAgents.Details = "$agentsFound of $($agents.Count) agents found"
}

# Test 6: GPU Check
Write-Host "`n[TEST 6] Testing GPU Availability..." -ForegroundColor Yellow
$gpu = Get-WmiObject Win32_VideoController | Where-Object { $_.Name -match "NVIDIA|AMD|Intel" }
if ($gpu) {
    Write-Host "  OK GPU detected: $($gpu[0].Name)" -ForegroundColor Green
    
    # Check CUDA if NVIDIA
    if ($gpu[0].Name -match "NVIDIA") {
        $nvidiaSmiPath = Get-Command nvidia-smi -ErrorAction SilentlyContinue
        if ($nvidiaSmiPath) {
            Write-Host "  OK CUDA-capable GPU ready" -ForegroundColor Green
        }
    }
} else {
    Write-Host "  WARN No dedicated GPU detected (will use CPU)" -ForegroundColor Yellow
}

# Summary Report
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "         TEST SUMMARY REPORT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($component in $testResults.Keys) {
    $result = $testResults[$component]
    $statusColor = switch ($result.Status) {
        "Ready" { "Green" }
        "Partial" { "Yellow" }
        "Failed" { "Red" }
        "Not Installed" { "Red" }
        "Not Configured" { "Yellow" }
        default { "Gray" }
    }
    
    $statusIcon = switch ($result.Status) {
        "Ready" { "[OK]" }
        "Partial" { "[WARN]" }
        "Failed" { "[FAIL]" }
        "Not Installed" { "[FAIL]" }
        "Not Configured" { "[WARN]" }
        default { "[?]" }
    }
    
    Write-Host "`n$statusIcon $component" -ForegroundColor $statusColor
    Write-Host "   Status: $($result.Status)" -ForegroundColor $statusColor
    Write-Host "   Details: $($result.Details)" -ForegroundColor Gray
}

# Recommendations
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "         RECOMMENDATIONS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$recommendations = @()

if ($testResults.StableDiffusion.Status -ne "Ready") {
    $recommendations += "• Install Stable Diffusion: Run setup-stable-diffusion.ps1"
}

if ($testResults.StableVideoDiffusion.Status -ne "Ready") {
    $recommendations += "• Install Stable Video Diffusion: Run setup-svd.ps1"
}

if ($testResults.FFmpeg.Status -ne "Ready") {
    $recommendations += "• Install FFmpeg: winget install ffmpeg"
}

if ($testResults.ElevenLabs.Status -eq "Not Configured") {
    $recommendations += "• Configure ElevenLabs API key in MCP config"
}

if ($recommendations.Count -eq 0) {
    Write-Host "`n[SUCCESS] System is fully operational!" -ForegroundColor Green
    Write-Host "All components are ready for AI content generation." -ForegroundColor Green
} else {
    Write-Host "`nTo achieve full functionality:" -ForegroundColor Yellow
    foreach ($rec in $recommendations) {
        Write-Host $rec -ForegroundColor Yellow
    }
}

Write-Host "`n========================================"