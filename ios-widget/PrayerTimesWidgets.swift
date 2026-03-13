import WidgetKit
import SwiftUI

// MARK: - Timeline Entry

struct PrayerTimelineEntry: TimelineEntry {
    let date: Date
    let data: WidgetPrayerData?
}

// MARK: - Shared Timeline Provider Logic

/// Creates timeline entries with hourly refresh, used by both widget types.
func createTimeline(in context: TimelineProviderContext) -> Timeline<PrayerTimelineEntry> {
    let currentDate = Date()
    let calendar = Calendar.current
    let baseMinute = calendar.date(bySetting: .second, value: 0, of: currentDate) ?? currentDate
    let startOfMinute = calendar.date(bySetting: .nanosecond, value: 0, of: baseMinute) ?? baseMinute
    let data = loadWidgetData()

    // Create entries for the next hour (one per minute for accurate countdown)
    var entries: [PrayerTimelineEntry] = []
    for minuteOffset in stride(from: 0, to: 60, by: 1) {
        let entryDate = calendar.date(byAdding: .minute, value: minuteOffset, to: startOfMinute)!
        entries.append(PrayerTimelineEntry(date: entryDate, data: data))
    }

    // Refresh timeline after 30 minutes
    let nextRefresh = calendar.date(byAdding: .minute, value: 30, to: startOfMinute)!
    return Timeline(entries: entries, policy: .after(nextRefresh))
}

// MARK: - 2x2 Circular Widget (Small)

struct CircularTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerTimelineEntry {
        PrayerTimelineEntry(date: Date(), data: placeholderData())
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerTimelineEntry) -> Void) {
        let entry = PrayerTimelineEntry(date: Date(), data: loadWidgetData() ?? placeholderData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerTimelineEntry>) -> Void) {
        completion(createTimeline(in: context))
    }
}

struct PrayerTimesCircularWidget: Widget {
    let kind = "PrayerTimesCircularWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CircularTimelineProvider()) { entry in
            CircularWidgetView(entry: entry)
        }
        .configurationDisplayName("Next Prayer")
        .description("Shows countdown to the next prayer time")
        .supportedFamilies([.systemSmall])
    }
}

// MARK: - 4x2 List Widget (Medium)

struct ListTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerTimelineEntry {
        PrayerTimelineEntry(date: Date(), data: placeholderData())
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerTimelineEntry) -> Void) {
        let entry = PrayerTimelineEntry(date: Date(), data: loadWidgetData() ?? placeholderData())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerTimelineEntry>) -> Void) {
        completion(createTimeline(in: context))
    }
}

struct PrayerTimesListWidget: Widget {
    let kind = "PrayerTimesListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ListTimelineProvider()) { entry in
            ListWidgetView(entry: entry)
        }
        .configurationDisplayName("Prayer Times")
        .description("Shows all prayer times for today with next prayer countdown")
        .supportedFamilies([.systemMedium])
    }
}
