# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# RevenueCat
-keep class com.revenuecat.purchases.** { *; }
-keep class com.revenuecat.purchases.common.** { *; }
-keep class com.revenuecat.purchases.hybridcommon.** { *; }

# Add any project specific keep options here:

# Prayer Times native modules and widget classes
# These are accessed via reflection by React Native's native module registry
# and by AppWidgetProvider subclasses declared in AndroidManifest.xml.
-keep class com.yourcompany.prayertimes.WidgetDataModule { *; }
-keep class com.yourcompany.prayertimes.WidgetPinModule { *; }
-keep class com.yourcompany.prayertimes.WidgetDataPackage { *; }
-keep class com.yourcompany.prayertimes.PrayerTimeRepository { *; }
-keep class com.yourcompany.prayertimes.WidgetThemeHelper { *; }
-keep class com.yourcompany.prayertimes.PrayerWidget { *; }
-keep class com.yourcompany.prayertimes.PrayerWidget4x2 { *; }
