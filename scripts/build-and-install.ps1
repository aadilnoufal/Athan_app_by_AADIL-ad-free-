#!/usr/bin/env powershell
# build-and-install.ps1
# Builds Android release APK and installs it on the connected device via ADB.
# Usage (from project root): powershell -ExecutionPolicy Bypass -File .\scripts\build-and-install.ps1

$ErrorActionPreference = "Stop"
$ROOT = Split-Path $PSScriptRoot -Parent
$ANDROID_DIR = Join-Path $ROOT "android"
$LOCAL_PROPERTIES = Join-Path $ANDROID_DIR "local.properties"
$APK = Join-Path $ROOT "android\app\build\outputs\apk\release\app-release.apk"

function Resolve-AndroidSdkPath {
    $candidates = @()
    if ($env:ANDROID_HOME) { $candidates += $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk") }
    if ($env:USERPROFILE) { $candidates += (Join-Path $env:USERPROFILE "AppData\Local\Android\Sdk") }
    $candidates += "C:\Android\Sdk"

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            return $candidate
        }
    }

    throw "Android SDK not found. Install Android SDK or set ANDROID_HOME/ANDROID_SDK_ROOT."
}

$sdkPath = Resolve-AndroidSdkPath
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath

# Ensure local.properties matches detected SDK path
$sdkForGradle = $sdkPath -replace "\\", "/"
Set-Content -Path $LOCAL_PROPERTIES -Value "sdk.dir=$sdkForGradle" -Encoding ascii

$adbPath = Join-Path $sdkPath "platform-tools\adb.exe"
if (-not (Test-Path $adbPath)) {
    throw "adb.exe not found at $adbPath"
}

Write-Host "Using Android SDK: $sdkPath" -ForegroundColor DarkCyan
Write-Host "Building release APK..." -ForegroundColor Cyan
Push-Location $ANDROID_DIR
try {
    .\gradlew assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Gradle build failed (exit code $LASTEXITCODE)" }
} finally {
    Pop-Location
}

Write-Host "Checking for connected device..." -ForegroundColor Cyan
$adbOutput = & $adbPath devices
$deviceLines = $adbOutput | Where-Object { $_ -match "\tdevice$" }
if (-not $deviceLines) {
    throw "No ADB device connected. Connect your phone and enable USB debugging."
}

Write-Host "Installing APK: $APK" -ForegroundColor Cyan
& $adbPath install -r $APK
if ($LASTEXITCODE -ne 0) { throw "adb install failed (exit code $LASTEXITCODE)" }

Write-Host "Done! APK installed successfully." -ForegroundColor Green
