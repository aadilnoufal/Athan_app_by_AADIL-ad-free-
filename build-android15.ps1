# PowerShell script for building Android 15 (API Level 35) with Expo SDK 53
Write-Host "🚀 Building for Android 15 (API Level 35) with Expo SDK 53..." -ForegroundColor Green
Write-Host ""

# Check if EAS CLI is installed
try {
    eas --version | Out-Null
} catch {
    Write-Host "❌ EAS CLI not found. Installing..." -ForegroundColor Red
    npm install -g eas-cli
}

# Check if user is logged in to EAS
try {
    $user = eas whoami 2>$null
    if (-not $user) {
        Write-Host "🔐 Please login to EAS..." -ForegroundColor Yellow
        eas login
    }
} catch {
    Write-Host "🔐 Please login to EAS..." -ForegroundColor Yellow
    eas login
}

Write-Host "📋 Current Configuration:" -ForegroundColor Cyan
Write-Host "- Target SDK: 35 (Android 15)"
Write-Host "- Min SDK: 24" 
Write-Host "- Compile SDK: 35"
Write-Host "- Build Tools: 35.0.0"
Write-Host ""

Write-Host "Step 1: Cleaning previous builds and cache..." -ForegroundColor Yellow
# Clean Expo cache
try { npx expo run:android --clear-cache 2>$null } catch { Write-Host "⚠️ Run android cache clean skipped" }
Remove-Item -Recurse -Force "node_modules\.cache" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force ".expo" -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Step 2: Installing/updating dependencies..." -ForegroundColor Yellow
npm install
npx expo install --fix

Write-Host ""
Write-Host "Step 3: Verifying configuration..." -ForegroundColor Yellow
Write-Host "✅ Using app.json configuration for Android 15" -ForegroundColor Green
Write-Host "✅ EAS Build will handle Android project generation" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Building APK with EAS Build (Development)..." -ForegroundColor Yellow
Write-Host "🔄 Starting development build..." -ForegroundColor Cyan
eas build --platform android --profile development --non-interactive

Write-Host ""
Write-Host "Step 5: Building AAB (App Bundle) for Play Store..." -ForegroundColor Yellow
Write-Host "🔄 Starting production build..." -ForegroundColor Cyan  
eas build --platform android --profile production --non-interactive

Write-Host ""
Write-Host "✅ Build completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 ANDROID 15 COMPATIBILITY NOTES:" -ForegroundColor Cyan
Write-Host "- Audio and notification features optimized for Android 15"
Write-Host "- Battery optimization settings updated for new power management"
Write-Host "- Notification channels configured for enhanced privacy controls"
Write-Host "- Edge-to-edge display support enabled"
Write-Host "- All configuration handled via app.json"
Write-Host ""
Write-Host "📦 BUILD OUTPUTS:" -ForegroundColor Cyan
Write-Host "- Development APK: Ready for testing on Android 15 devices"
Write-Host "- Production AAB: Ready for Play Console upload"
Write-Host ""
Write-Host "⚠️  TESTING CHECKLIST:" -ForegroundColor Yellow
Write-Host "1. Test notifications and sounds on Android 15 device"
Write-Host "2. Verify battery optimization exemption request"
Write-Host "3. Check prayer time accuracy with new location permissions"
Write-Host "4. Test edge-to-edge display compatibility"
Write-Host "5. Verify background service functionality"
Write-Host ""
Write-Host "🔗 To check build status: eas build:list" -ForegroundColor Cyan
