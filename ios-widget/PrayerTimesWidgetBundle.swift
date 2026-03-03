import WidgetKit
import SwiftUI

/// Entry point for the Prayer Times Widget extension.
/// Provides both small (2x2 circular) and medium (4x2 list) widget families.
@main
struct PrayerTimesWidgetBundle: WidgetBundle {
    var body: some Widget {
        PrayerTimesCircularWidget()
        PrayerTimesListWidget()
    }
}
