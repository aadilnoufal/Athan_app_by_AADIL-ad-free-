# iOS WidgetKit Guide for React Native + Expo (EAS Build)

A comprehensive, step-by-step guide for adding native WidgetKit extensions to a React Native + Expo (managed workflow) app, built from hard-won lessons.

> **Audience:** Any developer adding iOS widgets to an Expo/React Native app using EAS Build.  
> **Stack assumed:** React Native 0.76+, Expo SDK 52+, New Architecture, EAS Build (managed credentials).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & Planning](#2-prerequisites--planning)
3. [Step 1: Write the Native Widget (Swift/SwiftUI)](#3-step-1-write-the-native-widget)
4. [Step 2: Build the Data Bridge](#4-step-2-build-the-data-bridge)
5. [Step 3: Write the Expo Config Plugin](#5-step-3-write-the-expo-config-plugin)
6. [Step 4: Configure EAS Build for Extensions](#6-step-4-configure-eas-build-for-extensions)
7. [Step 5: Test Locally & Submit](#7-step-5-test-locally--submit)
8. [Common Pitfalls & Solutions](#8-common-pitfalls--solutions)
9. [Checklist](#9-checklist)

---

## 1. Architecture Overview

```
┌─────────────────────────────────┐
│     React Native App (JS)       │
│  ┌───────────────────────────┐  │
│  │  widgetDataBridge.ts      │  │
│  │  (calls NativeModule)     │  │
│  └───────────┬───────────────┘  │
│              │ NativeModule     │
│  ┌───────────▼───────────────┐  │
│  │  WidgetDataModule.swift   │  │  ← Main App Target
│  │  + ObjC Bridge (.m)       │  │
│  │  Writes to App Group      │  │
│  └───────────┬───────────────┘  │
└──────────────┼──────────────────┘
               │ App Group UserDefaults
┌──────────────▼──────────────────┐
│  WidgetKit Extension Target     │  ← Separate Process
│  ┌───────────────────────────┐  │
│  │  Widget SwiftUI Views     │  │
│  │  TimelineProvider         │  │
│  │  WidgetBundle             │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Key concept:** The widget runs in a **separate process** from your app. Data sharing happens exclusively through **App Group UserDefaults**. There is no direct communication channel.

---

## 2. Prerequisites & Planning

### What you need

| Item                    | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| Apple Developer Account | Bundle IDs, provisioning profiles                              |
| App Group ID            | Shared container: `group.com.yourcompany.yourapp`              |
| Widget Bundle ID        | Extension: `com.yourcompany.yourapp.YourWidget`                |
| Apple Team ID           | 10-char string (e.g., `ABC123XYZ0`) — find in developer portal |
| EAS Build configured    | `eas.json` with production profile                             |

### File structure to create

```
your-project/
├── ios-widget/                    # Widget extension Swift files
│   ├── YourWidgetBundle.swift     # @main entry point
│   ├── YourWidget.swift           # TimelineProvider + Widget definition
│   ├── YourWidgetViews.swift      # SwiftUI views
│   ├── WidgetDataProvider.swift   # Reads App Group UserDefaults
│   └── WidgetTheme.swift          # Theme/colors (optional)
├── ios-native/                    # Native module for main app target
│   ├── WidgetDataModule.swift     # Writes to App Group UserDefaults
│   └── WidgetDataModule.m         # ObjC bridge for React Native
├── plugins/
│   └── withWidgetExtension.js     # Expo config plugin
└── utils/
    └── widgetDataBridge.ts        # JS-side data writing
```

---

## 3. Step 1: Write the Native Widget

### 3.1 Widget Bundle (entry point)

```swift
// ios-widget/YourWidgetBundle.swift
import WidgetKit
import SwiftUI

@main
struct YourWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmallWidget()
        MediumWidget()  // Add multiple widget sizes
    }
}
```

### 3.2 Timeline Provider

```swift
// ios-widget/YourWidget.swift
import WidgetKit
import SwiftUI

struct YourWidgetEntry: TimelineEntry {
    let date: Date
    let data: YourWidgetData  // Your data model
}

struct YourTimelineProvider: TimelineProvider {
    let dataProvider = WidgetDataProvider()

    func placeholder(in context: Context) -> YourWidgetEntry {
        YourWidgetEntry(date: Date(), data: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (YourWidgetEntry) -> Void) {
        let data = dataProvider.loadData()
        completion(YourWidgetEntry(date: Date(), data: data))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<YourWidgetEntry>) -> Void) {
        let data = dataProvider.loadData()
        let entry = YourWidgetEntry(date: Date(), data: data)
        // Refresh every 15 minutes minimum
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}
```

### 3.3 Data Provider (reads App Group)

```swift
// ios-widget/WidgetDataProvider.swift
import Foundation

struct WidgetDataProvider {
    private let appGroupId = "group.com.yourcompany.yourapp"
    private let dataKey = "widget_data"

    func loadData() -> YourWidgetData {
        guard let defaults = UserDefaults(suiteName: appGroupId),
              let jsonString = defaults.string(forKey: dataKey),
              let data = jsonString.data(using: .utf8),
              let decoded = try? JSONDecoder().decode(YourWidgetData.self, from: data) else {
            return .placeholder
        }
        return decoded
    }
}
```

### 3.4 SwiftUI Views

```swift
// ios-widget/YourWidgetViews.swift
import SwiftUI
import WidgetKit

struct SmallWidgetView: View {
    let entry: YourWidgetEntry

    var body: some View {
        VStack {
            Text(entry.data.title)
                .font(.headline)
            Text(entry.data.subtitle)
                .font(.caption)
        }
        .containerBackground(.fill.tertiary, for: .widget)
    }
}

struct SmallWidget: Widget {
    let kind = "SmallWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: YourTimelineProvider()) { entry in
            SmallWidgetView(entry: entry)
        }
        .configurationDisplayName("Your Widget")
        .description("Shows your data at a glance.")
        .supportedFamilies([.systemSmall])
    }
}
```

---

## 4. Step 2: Build the Data Bridge

### 4.1 Native Module (Swift) — writes to App Group

```swift
// ios-native/WidgetDataModule.swift
import Foundation
import WidgetKit

@objc(WidgetDataModule)
class WidgetDataModule: NSObject {
    private let appGroupId = "group.com.yourcompany.yourapp"

    private var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    @objc func setWidgetData(_ jsonString: String,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = defaults else {
            reject("E_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
            return
        }
        defaults.set(jsonString, forKey: "widget_data")
        defaults.synchronize()

        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        resolve(true)
    }
}
```

### 4.2 ObjC Bridge

```objc
// ios-native/WidgetDataModule.m
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(WidgetDataModule, NSObject)

RCT_EXTERN_METHOD(setWidgetData:(NSString *)jsonString
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
```

> **Critical:** The Swift file uses `RCTPromiseResolveBlock` and `RCTPromiseRejectBlock`, which are ObjC types. Swift files in the **main app target** need a [bridging header](#bridging-header) to access them. See Step 3.

### 4.3 JS-Side Bridge

```typescript
// utils/widgetDataBridge.ts
import { NativeModules, Platform } from "react-native";

const WidgetDataModule =
  NativeModules.WidgetDataModuleIOS || NativeModules.WidgetDataModule;

export async function updateWidgetData(data: WidgetData): Promise<void> {
  if (!WidgetDataModule?.setWidgetData) return;
  const json = JSON.stringify(data);
  await WidgetDataModule.setWidgetData(json);
}
```

---

## 5. Step 3: Write the Expo Config Plugin

This is the most complex part. The plugin modifies the Xcode project during `expo prebuild`.

### 5.1 Plugin Structure

```javascript
// plugins/withWidgetExtension.js
const {
  withXcodeProject,
  withEntitlementsPlist,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

function withWidgetExtension(config, options = {}) {
  const { appleTeamId } = options;

  // Step A: Add App Group entitlement to main app
  config = withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults["com.apple.security.application-groups"] = [
      "group.com.yourcompany.yourapp",
    ];
    return modConfig;
  });

  // Step B: Modify Xcode project
  config = withXcodeProject(config, async (modConfig) => {
    const xcodeProject = modConfig.modResults;
    // ... see below
    return modConfig;
  });

  return config;
}

module.exports = withWidgetExtension;
```

### 5.2 Adding the Extension Target

> **⚠️ The `xcode` npm package has many undocumented behaviors. Read every section below carefully.**

```javascript
// Inside withXcodeProject callback:

// 1. Create directory, copy Swift files, write entitlements & Info.plist
//    (standard fs operations — copy from ios-widget/ to ios/YourWidget/)

// 2. Create PBXGroup (DO NOT include Swift source files here!)
const widgetGroup = xcodeProject.addPbxGroup(
  ["Info.plist", "YourWidget.entitlements"], // Only non-source files!
  "YourWidget",
  "YourWidget",
);

// 3. Add group to main project
const mainGroupId = xcodeProject.getFirstProject().firstProject.mainGroup;
xcodeProject.addToPbxGroup(widgetGroup.uuid, mainGroupId);

// 4. Create native target
const target = xcodeProject.addTarget(
  "YourWidget",
  "app_extension",
  "YourWidget",
  widgetBundleId,
);

// 5. CRITICAL: Create build phases (addTarget does NOT create them!)
xcodeProject.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
xcodeProject.addBuildPhase(
  [],
  "PBXFrameworksBuildPhase",
  "Frameworks",
  target.uuid,
);
xcodeProject.addBuildPhase(
  [],
  "PBXResourcesBuildPhase",
  "Resources",
  target.uuid,
);

// 6. CRITICAL: Initialize dependency sections before adding dependency
if (!xcodeProject.hash.project.objects["PBXTargetDependency"]) {
  xcodeProject.hash.project.objects["PBXTargetDependency"] = {};
}
if (!xcodeProject.hash.project.objects["PBXContainerItemProxy"]) {
  xcodeProject.hash.project.objects["PBXContainerItemProxy"] = {};
}
const mainTarget = xcodeProject.getFirstTarget();
xcodeProject.addTargetDependency(mainTarget.uuid, [target.uuid]);

// 7. Add source files (just filename, NOT prefixed with group path!)
for (const swiftFile of swiftFiles) {
  xcodeProject.addSourceFile(
    swiftFile, // ✅ Just "File.swift", NOT "YourWidget/File.swift"
    { target: target.uuid },
    widgetGroup.uuid,
  );
}

// 8. Add frameworks
xcodeProject.addFramework("WidgetKit.framework", {
  target: target.uuid,
  link: true,
});
xcodeProject.addFramework("SwiftUI.framework", {
  target: target.uuid,
  link: true,
});

// 9. Configure build settings
const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
for (const key in buildConfigs) {
  const config = buildConfigs[key];
  if (config?.buildSettings?.PRODUCT_NAME === '"YourWidget"') {
    config.buildSettings.SWIFT_VERSION = "5.0";
    config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "16.0";
    config.buildSettings.CODE_SIGN_ENTITLEMENTS =
      '"YourWidget/YourWidget.entitlements"';
    config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`;
    config.buildSettings.SKIP_INSTALL = "YES";
    config.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
    config.buildSettings.INFOPLIST_FILE = '"YourWidget/Info.plist"';
    if (appleTeamId) {
      config.buildSettings.DEVELOPMENT_TEAM = appleTeamId;
    }
  }
}
```

### 5.3 Bridging Header (for Native Module in Main App) {#bridging-header}

Swift files in the main app target cannot see ObjC types (`RCTPromiseResolveBlock`, etc.) without a bridging header:

```javascript
// Create bridging header file
const bridgingHeaderName = `${projectName}-Bridging-Header.h`;
fs.writeFileSync(
  path.join(destDir, bridgingHeaderName),
  `
#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>
`,
);

// Set build setting on main app target
config.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `"${projectName}/${bridgingHeaderName}"`;
```

### 5.4 Register the Plugin

```json
// app.json
{
  "plugins": [
    ["./plugins/withWidgetExtension", { "appleTeamId": "YOUR_TEAM_ID" }]
  ]
}
```

---

## 6. Step 4: Configure EAS Build for Extensions

### 6.1 Declare the Extension in app.json

EAS sets up credentials **before** `expo prebuild` runs, so it doesn't know about targets the config plugin adds. You must declare them:

```json
{
  "expo": {
    "extra": {
      "eas": {
        "build": {
          "experimental": {
            "ios": {
              "appExtensions": [
                {
                  "targetName": "YourWidget",
                  "bundleIdentifier": "com.yourcompany.yourapp.YourWidget",
                  "entitlements": {
                    "com.apple.security.application-groups": [
                      "group.com.yourcompany.yourapp"
                    ]
                  }
                }
              ]
            }
          }
        }
      }
    }
  }
}
```

This tells EAS CLI to:

- Register the widget bundle ID in Apple Developer Portal
- Enable App Groups capability on it
- Create a provisioning profile for it

### 6.2 Ensure `.easignore` doesn't exclude widget files

```
# .easignore — make sure these are NOT listed:
# ios-widget/
# ios-native/
# plugins/
```

---

## 7. Step 5: Test Locally & Submit

### Local testing

```bash
# Generate the iOS project
npx expo prebuild -p ios --clean

# Open in Xcode to verify
xed ios

# In Xcode, check:
# - YourWidget target exists with correct bundle ID
# - Build phases (Sources, Frameworks, Resources) exist
# - Entitlements file has App Groups
# - Bridging header is set on main target
# - DEVELOPMENT_TEAM is set on widget target
```

### Submit via EAS

```bash
eas build -p ios
```

On first build with the extension, EAS will:

1. Log into Apple Developer Portal
2. Register the widget bundle ID
3. Enable App Groups on both bundle IDs
4. Create provisioning profiles for both targets
5. Build and sign the archive

---

## 8. Common Pitfalls & Solutions

### Pitfall 1: `addTarget()` doesn't create build phases

**Symptom:** `addSourceFile()` silently adds files to the **main app target** instead of the widget target, or crashes with `Cannot read properties of null (reading 'files')`.

**Cause:** `xcode` npm package's `addTarget('app_extension')` creates a target with an **empty `buildPhases` array**. When `addSourceFile()` can't find a `PBXSourcesBuildPhase` on the widget target, it falls back to the main target.

**Fix:** Always call `addBuildPhase()` for Sources, Frameworks, and Resources immediately after `addTarget()`.

---

### Pitfall 2: Double-nested file paths

**Symptom:** `Build input files cannot be found: 'ios/Widget/Widget/File.swift'`

**Cause:** `addSourceFile(path, opts, groupUuid)` resolves `path` **relative to the group's path**. If the group has path `Widget` and you pass `Widget/File.swift`, the resolved path is `Widget/Widget/File.swift`.

**Fix:**

- Pass just the filename to `addSourceFile()`: `addSourceFile('File.swift', ...)`
- Don't include Swift files in `addPbxGroup()` — `addSourceFile` adds them to the group AND the build phase

---

### Pitfall 3: `addTargetDependency()` silently fails

**Symptom:** Widget target builds but isn't embedded in the app. Or no error at all, and the dependency just doesn't exist.

**Cause:** `addTargetDependency()` silently no-ops if `PBXTargetDependency` or `PBXContainerItemProxy` sections don't exist in the project objects.

**Fix:** Initialize both sections as empty objects before calling `addTargetDependency()`.

---

### Pitfall 4: `addTarget()` already creates an embed phase

**Symptom:** `"Multiple commands produce YourWidget.appex"` error during archive.

**Cause:** `addTarget('app_extension')` automatically creates a "Copy Files" build phase on the main target that embeds the `.appex`. If you manually add another embed phase, you get duplicates.

**Fix:** Don't create a manual "Embed App Extensions" phase. `addTarget` already handles it.

---

### Pitfall 5: EAS doesn't know about the widget target

**Symptom:** `Provisioning profile doesn't include the com.apple.security.application-groups entitlement` or `resource bundles are signed by default, which requires setting the development team`.

**Cause:** EAS creates credentials **before** `expo prebuild`, so it only knows about the main app target. The widget target added by your config plugin has no provisioning profile.

**Fix:**

1. Declare the extension in `extra.eas.build.experimental.ios.appExtensions` in `app.json`
2. Set `DEVELOPMENT_TEAM` on the widget's build settings via your config plugin

---

### Pitfall 6: Swift can't find `RCTPromiseResolveBlock`

**Symptom:** `cannot find type 'RCTPromiseResolveBlock' in scope` and `@escaping attribute only applies to function types`.

**Cause:** Swift files in the main app target can't access ObjC types from CocoaPods without a bridging header. Pod targets get auto-generated umbrella headers, but the main app target doesn't.

**Fix:** Create a bridging header with `#import <React/RCTBridgeModule.h>` and set `SWIFT_OBJC_BRIDGING_HEADER` on the main app target's build configurations.

---

### Pitfall 7: Provisioning profile out of sync

**Symptom:** `Profile qualification is using entitlement definitions that may be out of date. Connect to network to update.`

**Cause:** The provisioning profile was created before the App Groups capability was synced.

**Fix:** Delete the stale provisioning profile via `eas credentials -p ios` or Apple Developer Portal, then rebuild. EAS will regenerate it with the correct entitlements.

---

### Pitfall 8: `addFile()` crashes with undefined path

**Symptom:** `TypeError: Cannot read properties of undefined (reading 'replace')` during prebuild.

**Cause:** `xcodeProject.addFile(path, undefined, opts)` — the `xcode` package's internal `pbxFileReferenceObj` calls `file.path.replace()`, which crashes when `path` is `undefined`.

**Fix:** Don't call `addFile()` for the `.appex` product reference. `addTarget()` already creates it. If you need to add files manually, always ensure the path argument is a valid string.

---

## 9. Checklist

Use this checklist before submitting your EAS build:

### Config Plugin

- [ ] `addTarget()` is followed by 3 × `addBuildPhase()` (Sources, Frameworks, Resources)
- [ ] `PBXTargetDependency` and `PBXContainerItemProxy` sections initialized before `addTargetDependency()`
- [ ] `addSourceFile()` uses just filename (not prefixed with group path)
- [ ] Swift source files NOT included in `addPbxGroup()` file list
- [ ] No manual "Embed App Extensions" phase (addTarget handles it)
- [ ] Widget build settings include: `SWIFT_VERSION`, `IPHONEOS_DEPLOYMENT_TARGET`, `CODE_SIGN_ENTITLEMENTS`, `PRODUCT_BUNDLE_IDENTIFIER`, `DEVELOPMENT_TEAM`
- [ ] `SKIP_INSTALL = YES` on widget target
- [ ] `GENERATE_INFOPLIST_FILE = NO` and correct `INFOPLIST_FILE` path

### Bridging Header (if using Swift native module in main app)

- [ ] Bridging header file created with `#import <React/RCTBridgeModule.h>`
- [ ] `SWIFT_OBJC_BRIDGING_HEADER` set on main app target build configs only

### EAS / app.json

- [ ] `appExtensions` declared in `extra.eas.build.experimental.ios`
- [ ] `targetName` matches the target name in your plugin
- [ ] `bundleIdentifier` is `<mainBundleId>.<WidgetName>`
- [ ] `entitlements` includes `com.apple.security.application-groups`
- [ ] Plugin registered with `appleTeamId` option: `["./plugins/withWidgetExtension", { "appleTeamId": "..." }]`

### Widget Extension Files

- [ ] `.entitlements` file has `com.apple.security.application-groups` with correct group ID
- [ ] `Info.plist` has `NSExtensionPointIdentifier: com.apple.widgetkit-extension`
- [ ] `@main` struct exists in widget bundle file
- [ ] Data provider reads from same App Group ID as native module writes to

### .easignore

- [ ] `ios-widget/`, `ios-native/`, and `plugins/` directories are NOT excluded

---

## Appendix: The `xcode` npm Package API

The `xcode` package (v3.0.1) powering Expo's config plugins has several undocumented behaviors:

| Method                                 | What you'd expect         | What it actually does                                                                                                                   |
| -------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `addTarget('app_extension')`           | Creates a complete target | Creates target with **empty** `buildPhases[]`. Creates embed phase on main target. Does NOT create Sources/Frameworks/Resources phases. |
| `addTargetDependency()`                | Adds dependency           | Silently **no-ops** if `PBXTargetDependency` section doesn't exist                                                                      |
| `addSourceFile(path, opts, groupUuid)` | Adds file at `path`       | Resolves path **relative to group's path**, not project root                                                                            |
| `addPbxGroup(files, name, path)`       | Creates group             | Also creates file references for ALL files in the array                                                                                 |
| `addFile(path, group, opts)`           | Adds file reference       | Crashes if `path` is `undefined` (`file.path.replace()`)                                                                                |

**Golden rule:** Always read the `xcode` package source code before using any API. Never assume it works the way the method name implies.
