# Create desktop shortcuts for HomeOps browsers

$desktopPath = [Environment]::GetFolderPath("Desktop")
$projectPath = "C:\Projects\HomeOps"

Write-Host "Creating HomeOps Browser Desktop Shortcuts..." -ForegroundColor Green

# Create Private Browser shortcut (VPN)
$privateShortcut = "$desktopPath\HomeOps Private Browser (VPN).lnk"
$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($privateShortcut)
$Shortcut.TargetPath = "$projectPath\launch-private-browser.bat"
$Shortcut.WorkingDirectory = $projectPath
$Shortcut.IconLocation = "C:\Windows\System32\shell32.dll,13"
$Shortcut.Description = "Launch private browser with VPN protection"
$Shortcut.Save()
Write-Host "Created: Private Browser (VPN) shortcut" -ForegroundColor Yellow

# Create Regular Browser shortcut (Direct)
$browserShortcut = "$desktopPath\HomeOps Browser.lnk"
$Shortcut2 = $WshShell.CreateShortcut($browserShortcut)
$Shortcut2.TargetPath = "$projectPath\launch-browser.bat"
$Shortcut2.WorkingDirectory = $projectPath
$Shortcut2.IconLocation = "C:\Windows\System32\shell32.dll,135"
$Shortcut2.Description = "Launch browser with direct connection"
$Shortcut2.Save()
Write-Host "Created: Regular Browser shortcut" -ForegroundColor Yellow

# Create Browser Control Panel shortcut
$controlShortcut = "$desktopPath\HomeOps Browser Control.lnk"
$Shortcut3 = $WshShell.CreateShortcut($controlShortcut)
$Shortcut3.TargetPath = "cmd.exe"
$Shortcut3.Arguments = "/k cd /d $projectPath && browser-control.bat access"
$Shortcut3.WorkingDirectory = $projectPath
$Shortcut3.IconLocation = "C:\Windows\System32\shell32.dll,21"
$Shortcut3.Description = "HomeOps Browser Control Panel"
$Shortcut3.Save()
Write-Host "Created: Browser Control Panel shortcut" -ForegroundColor Yellow

Write-Host "`nDesktop shortcuts created successfully!" -ForegroundColor Green
Write-Host "You can now double-click the shortcuts to launch browsers." -ForegroundColor Cyan