/**
 * Expo Config Plugin: withWidgetExtension
 * ========================================
 * Adds a WidgetKit extension target to the iOS Xcode project during `expo prebuild`.
 * This enables native Swift widgets to be built alongside the main app via EAS Build.
 *
 * What this plugin does:
 * 1. Adds App Group entitlement to main app target
 * 2. Creates the WidgetKit extension target in the Xcode project
 * 3. Copies Swift source files from ios-widget/ into the extension
 * 4. Configures build settings (Swift version, deployment target, frameworks)
 * 5. Adds the iOS native module for data sharing (WidgetDataModuleIOS)
 */
const {
  withXcodeProject,
  withEntitlementsPlist,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const APP_GROUP_ID = 'group.com.aadilnoufal.prayertimes';
const WIDGET_EXTENSION_NAME = 'PrayerTimesWidget';
const WIDGET_BUNDLE_ID_SUFFIX = '.PrayerTimesWidget';
const IOS_DEPLOYMENT_TARGET = '16.0';

/**
 * Main plugin entry point
 */
function withWidgetExtension(config, options = {}) {
  const { appleTeamId } = options;

  // Step 1: Add App Group to main app entitlements
  config = withEntitlementsPlist(config, (modConfig) => {
    modConfig.modResults['com.apple.security.application-groups'] = [APP_GROUP_ID];
    return modConfig;
  });

  // Step 2: Add WidgetKit extension + native module to Xcode project
  config = withXcodeProject(config, async (modConfig) => {
    const xcodeProject = modConfig.modResults;
    const projectRoot = modConfig.modRequest.projectRoot;
    const platformProjectRoot = modConfig.modRequest.platformProjectRoot; // ios/
    const bundleId = modConfig.ios?.bundleIdentifier || 'com.aadilnoufal.prayertimes';
    const appVersion = modConfig.version || '1.0';
    const buildNumber = modConfig.ios?.buildNumber || '1';

    await addWidgetExtension(
      xcodeProject,
      projectRoot,
      platformProjectRoot,
      bundleId,
      appVersion,
      buildNumber,
      appleTeamId
    );

    // Step 3: Copy and register native module files in the main app target
    await copyAndRegisterNativeModule(
      xcodeProject,
      projectRoot,
      platformProjectRoot
    );

    return modConfig;
  });

  return config;
}

/**
 * Add the WidgetKit extension target to the Xcode project.
 */
async function addWidgetExtension(
  xcodeProject,
  projectRoot,
  platformProjectRoot,
  mainBundleId,
  appVersion = '1.0',
  buildNumber = '1',
  appleTeamId = null
) {
  const widgetBundleId = mainBundleId + WIDGET_BUNDLE_ID_SUFFIX;
  const widgetDir = path.join(platformProjectRoot, WIDGET_EXTENSION_NAME);

  // Create the widget extension directory
  if (!fs.existsSync(widgetDir)) {
    fs.mkdirSync(widgetDir, { recursive: true });
  }

  // Copy Swift source files from project's ios-widget/ directory
  const sourceDir = path.join(projectRoot, 'ios-widget');
  if (fs.existsSync(sourceDir)) {
    const sourceFiles = fs.readdirSync(sourceDir);
    for (const file of sourceFiles) {
      const srcPath = path.join(sourceDir, file);
      const destPath = path.join(widgetDir, file);
      if (fs.statSync(srcPath).isFile()) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Create the widget extension entitlements file
  const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP_ID}</string>
    </array>
</dict>
</plist>`;
  fs.writeFileSync(
    path.join(widgetDir, `${WIDGET_EXTENSION_NAME}.entitlements`),
    entitlementsContent
  );

  // Create Info.plist for the widget extension
  const infoPlistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>en</string>
    <key>CFBundleDisplayName</key>
    <string>Prayer Times</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
</dict>
</plist>`;
  fs.writeFileSync(path.join(widgetDir, 'Info.plist'), infoPlistContent);

  // === Xcode project manipulation ===
  // Add the extension target with its source files

  const widgetSourceFiles = fs.readdirSync(widgetDir).filter(f => f.endsWith('.swift'));

  // Add a PBXGroup for the widget extension files.
  // Only include non-source files here (Info.plist, entitlements).
  // Swift source files are added separately via addSourceFile() which
  // both adds them to this group AND registers them in the build phase.
  const widgetGroup = xcodeProject.addPbxGroup(
    ['Info.plist', `${WIDGET_EXTENSION_NAME}.entitlements`],
    WIDGET_EXTENSION_NAME,
    WIDGET_EXTENSION_NAME
  );

  // Add the group to the main project
  const mainGroupId = xcodeProject.getFirstProject().firstProject.mainGroup;
  xcodeProject.addToPbxGroup(widgetGroup.uuid, mainGroupId);

  // Add the native target for the widget extension
  const target = xcodeProject.addTarget(
    WIDGET_EXTENSION_NAME,
    'app_extension',
    WIDGET_EXTENSION_NAME,
    widgetBundleId
  );

  // addTarget() creates the target with an empty buildPhases array.
  // We must explicitly create Sources, Frameworks, and Resources build phases
  // so that addSourceFile() and addFramework() can find the correct phase
  // on the widget target (not the main app target).
  xcodeProject.addBuildPhase(
    [],
    'PBXSourcesBuildPhase',
    'Sources',
    target.uuid
  );
  xcodeProject.addBuildPhase(
    [],
    'PBXFrameworksBuildPhase',
    'Frameworks',
    target.uuid
  );
  xcodeProject.addBuildPhase(
    [],
    'PBXResourcesBuildPhase',
    'Resources',
    target.uuid
  );

  // Ensure the main target depends on the widget target so Xcode
  // builds the extension before embedding it.
  // addTargetDependency() silently no-ops if these sections don't exist,
  // so we create them first.
  const mainTarget = xcodeProject.getFirstTarget();
  if (!xcodeProject.hash.project.objects['PBXTargetDependency']) {
    xcodeProject.hash.project.objects['PBXTargetDependency'] = {};
  }
  if (!xcodeProject.hash.project.objects['PBXContainerItemProxy']) {
    xcodeProject.hash.project.objects['PBXContainerItemProxy'] = {};
  }
  xcodeProject.addTargetDependency(mainTarget.uuid, [target.uuid]);

  // Add source files to the target's build phase.
  // Pass just the filename (not "PrayerTimesWidget/file.swift") because
  // addSourceFile resolves paths relative to the group's path.
  // The group already has path "PrayerTimesWidget", so using just "file.swift"
  // resolves to "PrayerTimesWidget/file.swift" — which is correct.
  // Using "PrayerTimesWidget/file.swift" would resolve to
  // "PrayerTimesWidget/PrayerTimesWidget/file.swift" — double-nested and wrong.
  for (const swiftFile of widgetSourceFiles) {
    xcodeProject.addSourceFile(
      swiftFile,
      { target: target.uuid },
      widgetGroup.uuid
    );
  }

  // Add WidgetKit and SwiftUI frameworks
  xcodeProject.addFramework('WidgetKit.framework', {
    target: target.uuid,
    link: true,
  });
  xcodeProject.addFramework('SwiftUI.framework', {
    target: target.uuid,
    link: true,
  });

  // Configure build settings for the widget target
  const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
  for (const key in buildConfigs) {
    const config = buildConfigs[key];
    if (
      config &&
      config.buildSettings &&
      config.name &&
      config.buildSettings.PRODUCT_NAME === `"${WIDGET_EXTENSION_NAME}"`
    ) {
      config.buildSettings.SWIFT_VERSION = '5.0';
      config.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = IOS_DEPLOYMENT_TARGET;
      config.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
      config.buildSettings.CODE_SIGN_ENTITLEMENTS = `"${WIDGET_EXTENSION_NAME}/${WIDGET_EXTENSION_NAME}.entitlements"`;
      config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER = `"${widgetBundleId}"`;
      config.buildSettings.MARKETING_VERSION = `"${appVersion}"`;
      config.buildSettings.CURRENT_PROJECT_VERSION = `"${buildNumber}"`;
      config.buildSettings.GENERATE_INFOPLIST_FILE = 'NO';
      config.buildSettings.INFOPLIST_FILE = `"${WIDGET_EXTENSION_NAME}/Info.plist"`;
      config.buildSettings.ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = '"AccentColor"';
      config.buildSettings.ASSETCATALOG_COMPILER_WIDGET_BACKGROUND_COLOR_NAME = '"WidgetBackground"';
      config.buildSettings.SKIP_INSTALL = 'YES';

      // Code signing: DEVELOPMENT_TEAM is required for EAS Build.
      // EAS injects signing for targets it knows about, but the extension
      // target is added during prebuild (after EAS's credential phase).
      // Setting it here ensures the widget target is always signable.
      if (appleTeamId) {
        config.buildSettings.DEVELOPMENT_TEAM = appleTeamId;
      }
    }
  }

  // NOTE: addTarget() for 'app_extension' already:
  //   1. Creates a "Copy Files" PBXCopyFilesBuildPhase on the main target (dstSubfolderSpec=13 → PlugIns)
  //   2. Adds the .appex product to that phase
  //   3. Adds a target dependency from the main app to the widget extension
  // No additional embed phase is needed — creating one would produce a
  // "Multiple commands produce PrayerTimesWidget.appex" error in Xcode 14+.
}

/**
 * Copy the iOS native module files (WidgetDataModuleIOS) into the main app
 * AND add them to the Xcode project's compile sources so they actually build.
 *
 * Also creates a bridging header so Swift files in the main app target can
 * access React Native ObjC types (RCTPromiseResolveBlock, etc.).
 */
async function copyAndRegisterNativeModule(
  xcodeProject,
  projectRoot,
  platformProjectRoot
) {
  const sourceDir = path.join(projectRoot, 'ios-native');
  if (!fs.existsSync(sourceDir)) return;

  // Find the main app target directory (usually named same as the project)
  const projectName = path.basename(platformProjectRoot) === 'ios' 
    ? fs.readdirSync(platformProjectRoot)
        .find(name => fs.statSync(path.join(platformProjectRoot, name)).isDirectory() && 
              name !== 'Pods' && 
              name !== 'build' && 
              !name.endsWith('.xcodeproj') && 
              !name.endsWith('.xcworkspace') &&
              name !== WIDGET_EXTENSION_NAME)
    : null;

  if (!projectName) {
    console.warn('[withWidgetExtension] Could not find main app directory');
    return;
  }

  const destDir = path.join(platformProjectRoot, projectName);
  const mainTarget = xcodeProject.getFirstTarget();
  const files = fs.readdirSync(sourceDir);

  // Create a bridging header so Swift files in the main app target
  // can use React Native ObjC types (RCTPromiseResolveBlock, etc.).
  // Without this, Swift files compiled in the main app target cannot
  // find types defined in ObjC headers from CocoaPods dependencies.
  const bridgingHeaderName = `${projectName}-Bridging-Header.h`;
  const bridgingHeaderPath = path.join(destDir, bridgingHeaderName);
  const bridgingHeaderContent = `//
//  ${bridgingHeaderName}
//  Auto-generated by withWidgetExtension config plugin.
//  Exposes React Native ObjC types to Swift files in the main app target.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>
`;
  fs.writeFileSync(bridgingHeaderPath, bridgingHeaderContent);

  // Set SWIFT_OBJC_BRIDGING_HEADER on all main app target build configurations
  const buildConfigs = xcodeProject.pbxXCBuildConfigurationSection();
  for (const key in buildConfigs) {
    const config = buildConfigs[key];
    if (
      config &&
      config.buildSettings &&
      config.name &&
      config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER &&
      !config.buildSettings.PRODUCT_BUNDLE_IDENTIFIER.includes(WIDGET_EXTENSION_NAME)
    ) {
      // Only set on main app target configs (not widget target configs)
      // Check that this looks like the main app by confirming it has an INFOPLIST_FILE
      // that references the project name directory
      if (
        config.buildSettings.INFOPLIST_FILE &&
        config.buildSettings.INFOPLIST_FILE.includes(projectName)
      ) {
        config.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `"${projectName}/${bridgingHeaderName}"`;
      }
    }
  }

  for (const file of files) {
    const srcPath = path.join(sourceDir, file);
    const destPath = path.join(destDir, file);
    if (!fs.statSync(srcPath).isFile()) continue;

    // Copy file to disk
    fs.copyFileSync(srcPath, destPath);

    // Add to Xcode project compile sources (main app target)
    if (file.endsWith('.swift') || file.endsWith('.m')) {
      xcodeProject.addSourceFile(
        `${projectName}/${file}`,
        { target: mainTarget.uuid },
        xcodeProject.getFirstProject().firstProject.mainGroup
      );
    }
  }
}

module.exports = withWidgetExtension;
