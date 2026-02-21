## Build & Deploy Command

**Build release APK and install on phone via ADB:**

```powershell
# One-liner (from project root):
cd android; .\gradlew assembleRelease; cd ..; adb install -r "android\app\build\outputs\apk\release\app-release.apk"

# Script (Windows PowerShell):
powershell -ExecutionPolicy Bypass -File .\scripts\build-and-install.ps1

# Shortcut (recommended):
.\scripts\build-and-install.bat
```

**APK location:** `android/app/build/outputs/apk/release/app-release.apk`

**Prerequisites:** Phone connected via USB with USB Debugging enabled. ADB must be on PATH (`$env:LOCALAPPDATA\Android\Sdk\platform-tools`).

---

make widget for ios

make light mode much better
make widgets look slighty better
