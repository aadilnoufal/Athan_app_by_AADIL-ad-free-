import Foundation
import WidgetKit

/// React Native native module for iOS that writes prayer data to
/// App Group UserDefaults, making it accessible to the WidgetKit extension.
///
/// Mirrors the Android WidgetDataModule interface:
/// - setWidgetData(jsonString) → writes prayer times + metadata
/// - setThemeMode(mode) → updates theme for widget rendering
/// - getWidgetData() → reads back the stored data
@objc(WidgetDataModuleIOS)
class WidgetDataModuleIOS: NSObject {

    private let appGroupId = "group.com.aadilnoufal.prayertimes"
    private let keyWidgetData = "widget_data"
    private let keyThemeMode = "theme_mode"
    private let keyCityId = "city_id"
    private let keyLastUpdated = "last_updated"

    private var defaults: UserDefaults? {
        UserDefaults(suiteName: appGroupId)
    }

    /// Write the full prayer data JSON to App Group UserDefaults.
    @objc func setWidgetData(_ jsonString: String,
                             resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = defaults else {
            reject("E_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
            return
        }

        defaults.set(jsonString, forKey: keyWidgetData)
        defaults.set(Date().timeIntervalSince1970 * 1000, forKey: keyLastUpdated)

        // Extract cityId and themeMode for quick access
        if let data = jsonString.data(using: .utf8),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let cityId = json["cityId"] as? String {
                defaults.set(cityId, forKey: keyCityId)
            }
            if let themeMode = json["themeMode"] as? String {
                defaults.set(themeMode, forKey: keyThemeMode)
            }
        }

        defaults.synchronize()

        // Request WidgetKit to reload timelines
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        resolve(true)
    }

    /// Update only the theme mode.
    @objc func setThemeMode(_ themeMode: String,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = defaults else {
            reject("E_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
            return
        }

        defaults.set(themeMode, forKey: keyThemeMode)
        defaults.synchronize()

        // Reload widget timelines to apply new theme
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }

        resolve(true)
    }

    /// Read back the stored widget data (for debugging/verification).
    @objc func getWidgetData(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        guard let defaults = defaults else {
            reject("E_NO_DEFAULTS", "Could not access App Group UserDefaults", nil)
            return
        }

        let result: [String: Any] = [
            "widgetData": defaults.string(forKey: keyWidgetData) ?? "",
            "themeMode": defaults.string(forKey: keyThemeMode) ?? "dark",
            "cityId": defaults.string(forKey: keyCityId) ?? "doha",
            "lastUpdated": defaults.double(forKey: keyLastUpdated)
        ]

        resolve(result)
    }
}
