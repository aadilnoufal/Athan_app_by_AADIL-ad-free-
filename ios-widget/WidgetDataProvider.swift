import Foundation

/// App Group identifier shared between the main app and the widget extension.
let appGroupId = "group.com.aadilnoufal.prayertimes"

/// Key constants matching the JS widgetDataBridge and Android WidgetDataModule.
struct WidgetDataKeys {
    static let widgetData = "widget_data"
    static let themeMode = "theme_mode"
    static let lastUpdated = "last_updated"
}

/// Prayer name constants in display order.
let prayerNames = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"]

/// Represents the data for a single prayer time.
struct PrayerTime: Identifiable {
    let id: String     // Prayer name
    let name: String
    let time24h: String   // "HH:MM"
    let time12h: String   // "H:MM AM/PM"
    let totalMinutes: Int // Minutes since midnight
}

/// The complete widget data snapshot.
struct WidgetPrayerData {
    let prayers: [PrayerTime]
    let date: String        // "DD-MM"
    let cityId: String
    let themeMode: String   // "dark" | "sepia"
    let lastUpdated: Double
    let tomorrowFajrMinutes: Int? // Tomorrow's Fajr in minutes (for accurate post-Isha countdown)

    /// The next upcoming prayer (or tomorrow's Fajr if all are past).
    /// - Parameter referenceDate: The date to compute against. Pass `entry.date`
    ///   so that pre-rendered timeline entries get the correct countdown.
    func nextPrayer(at referenceDate: Date = Date()) -> (prayer: PrayerTime, countdown: String, progress: Double, isTomorrow: Bool)? {
        let cal = Calendar.current
        let currentMinutes = cal.component(.hour, from: referenceDate) * 60 + cal.component(.minute, from: referenceDate)
        let currentSecond = cal.component(.second, from: referenceDate)

        for (index, prayer) in prayers.enumerated() {
            if prayer.totalMinutes > currentMinutes {
                var diff = prayer.totalMinutes - currentMinutes
                // Account for partial minutes elapsed (matches Android precision)
                if currentSecond > 0 { diff -= 1 }
                if diff < 0 { diff = 0 }
                let countdown = formatCountdown(diff)
                let prevMinutes = index > 0 ? prayers[index - 1].totalMinutes : 0
                let totalDuration = prayer.totalMinutes - prevMinutes
                let elapsed = currentMinutes - prevMinutes
                let progress = totalDuration > 0 ? Double(elapsed) / Double(totalDuration) : 0.0
                return (prayer, countdown, min(max(progress, 0), 1), false)
            }
        }

        // All prayers done today → next is tomorrow's Fajr
        if let fajr = prayers.first {
            // Use tomorrow's actual Fajr time if available, otherwise approximate with today's
            let fajrMins = tomorrowFajrMinutes ?? fajr.totalMinutes
            let minutesUntilMidnight = (24 * 60) - currentMinutes
            var totalDiff = minutesUntilMidnight + fajrMins
            // Account for partial minutes elapsed (matches Android precision)
            if currentSecond > 0 { totalDiff -= 1 }
            if totalDiff < 0 { totalDiff = 0 }
            let countdown = formatCountdown(totalDiff)

            let ishaMinutes = prayers.last?.totalMinutes ?? currentMinutes
            let durationUntilMidnight = (24 * 60) - ishaMinutes
            let totalDuration = durationUntilMidnight + fajrMins
            let elapsed = currentMinutes - ishaMinutes
            let progress = totalDuration > 0 ? Double(elapsed) / Double(totalDuration) : 0.0

            return (fajr, countdown, min(max(progress, 0), 1), true)
        }

        return nil
    }

    private func formatCountdown(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        return String(format: "%02d:%02d", h, m)
    }
}

/// Read prayer data from the shared App Group UserDefaults.
func loadWidgetData() -> WidgetPrayerData? {
    guard let defaults = UserDefaults(suiteName: appGroupId) else { return nil }

    let lastUpdated = defaults.double(forKey: WidgetDataKeys.lastUpdated)
    let staleness = Date().timeIntervalSince1970 * 1000 - lastUpdated
    // Allow up to 48 hours of staleness
    if staleness > 48 * 60 * 60 * 1000 { return nil }

    guard let jsonStr = defaults.string(forKey: WidgetDataKeys.widgetData),
          let jsonData = jsonStr.data(using: .utf8),
          let json = try? JSONSerialization.jsonObject(with: jsonData) as? [String: Any],
          let times = json["times"] as? [String: String],
          let times12h = json["times12h"] as? [String: String] else {
        return nil
    }

    let date = json["date"] as? String ?? ""
    let cityId = json["cityId"] as? String ?? "doha"
    let themeMode = defaults.string(forKey: WidgetDataKeys.themeMode) ?? "dark"
    let tomorrowFajrMinutes = json["tomorrowFajrMinutes"] as? Int

    var prayerList: [PrayerTime] = []
    for name in prayerNames {
        guard let t24 = times[name], let t12 = times12h[name] else { continue }
        let parts = t24.split(separator: ":").compactMap { Int($0) }
        let totalMins = parts.count == 2 ? parts[0] * 60 + parts[1] : 0
        prayerList.append(PrayerTime(id: name, name: name, time24h: t24, time12h: t12, totalMinutes: totalMins))
    }

    if prayerList.count != 6 { return nil }

    return WidgetPrayerData(
        prayers: prayerList,
        date: date,
        cityId: cityId,
        themeMode: themeMode,
        lastUpdated: lastUpdated,
        tomorrowFajrMinutes: tomorrowFajrMinutes
    )
}

/// Generate placeholder data for widget previews.
func placeholderData() -> WidgetPrayerData {
    let sampleTimes = [
        ("Fajr", "04:57", "4:57 AM", 297),
        ("Sunrise", "06:20", "6:20 AM", 380),
        ("Dhuhr", "11:38", "11:38 AM", 698),
        ("Asr", "14:37", "2:37 PM", 877),
        ("Maghrib", "16:57", "4:57 PM", 1017),
        ("Isha", "18:27", "6:27 PM", 1107)
    ]

    let prayers = sampleTimes.map {
        PrayerTime(id: $0.0, name: $0.0, time24h: $0.1, time12h: $0.2, totalMinutes: $0.3)
    }

    return WidgetPrayerData(
        prayers: prayers,
        date: "01-01",
        cityId: "doha",
        themeMode: "dark",
        lastUpdated: Date().timeIntervalSince1970 * 1000,
        tomorrowFajrMinutes: nil
    )
}
