@echo off
echo Building for Android 15 (API Level 35)...
echo.

echo Step 1: Cleaning previous builds...
call npx expo run:android --clear-cache

echo.
echo Step 2: Building APK with EAS Build...
call eas build --platform android --profile production

echo.
echo Step 3: Building AAB (App Bundle) for Play Store...
call eas build --platform android --profile production

echo.
echo Build completed! 
echo Remember to test the APK before uploading to Play Store.
echo The AAB file should be uploaded to Play Console for Android 15 compliance.
pause
