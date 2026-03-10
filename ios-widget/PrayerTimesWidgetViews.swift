import SwiftUI
import WidgetKit

// MARK: - iOS 16/17+ Background Compatibility

extension View {
    /// Applies the widget background correctly on both iOS 16 and 17+.
    /// On iOS 17+ uses `.containerBackground`, on iOS 16 wraps in a ZStack.
    func widgetBackground<Background: View>(_ background: Background) -> some View {
        if #available(iOSApplicationExtension 17.0, *) {
            return AnyView(
                self.containerBackground(for: .widget) {
                    background
                }
            )
        } else {
            return AnyView(
                ZStack {
                    ContainerRelativeShape()
                        .fill(.clear)
                        .background(background)
                        .clipShape(ContainerRelativeShape())
                    self
                }
            )
        }
    }
}

// MARK: - 2x2 Circular Widget View (Small Family)

struct CircularWidgetView: View {
    let entry: PrayerTimelineEntry

    private var theme: WidgetTheme {
        WidgetTheme.forMode(entry.data?.themeMode ?? "dark")
    }

    private var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [theme.background, theme.backgroundGradientEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var body: some View {
        let next = entry.data?.nextPrayer(at: entry.date)

        ZStack {
            // Circular progress ring
            ZStack {
                // Background ring
                Circle()
                    .stroke(theme.progressBackground, lineWidth: 6)
                    .padding(12)

                // Progress arc
                Circle()
                    .trim(from: 0, to: CGFloat(next?.progress ?? 0))
                    .stroke(
                        AngularGradient(
                            colors: [theme.accentGold, theme.accentGold.opacity(0.7)],
                            center: .center
                        ),
                        style: StrokeStyle(lineWidth: 6, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .padding(12)

                // Content inside the circle
                VStack(spacing: 2) {
                    // Prayer name
                    Text(next?.prayer.name.uppercased() ?? (entry.data?.nextPrayerLabel.uppercased() ?? "PRAYER"))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(theme.textSecondary)
                        .tracking(1.2)

                    // Countdown
                    Text(next?.countdown ?? "--:--")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundColor(theme.textPrimary)
                        .minimumScaleFactor(0.7)

                    // Prayer time
                    Text(next?.prayer.time12h ?? "--:--")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(theme.accentGold)

                    // Tomorrow indicator
                    if next?.isTomorrow == true {
                        Text(entry.data?.tomorrowSuffix.uppercased() ?? "TOMORROW")
                            .font(.system(size: 8, weight: .medium))
                            .foregroundColor(theme.textSecondary.opacity(0.7))
                    }
                }
            }
        }
        .widgetBackground(backgroundGradient)
    }
}

// MARK: - 4x2 List Widget View (Medium Family)

struct ListWidgetView: View {
    let entry: PrayerTimelineEntry

    private var theme: WidgetTheme {
        WidgetTheme.forMode(entry.data?.themeMode ?? "dark")
    }

    private var backgroundGradient: LinearGradient {
        LinearGradient(
            colors: [theme.background, theme.backgroundGradientEnd],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    var body: some View {
        let prayers = entry.data?.prayers ?? placeholderData().prayers
        let next = entry.data?.nextPrayer(at: entry.date)

        VStack(spacing: 0) {
            // Top section: All 6 prayer times in a row
            HStack(spacing: 0) {
                ForEach(prayers) { prayer in
                    let isNext = prayer.name == next?.prayer.name && !(next?.isTomorrow ?? false)
                    VStack(spacing: 4) {
                        Text(shortName(prayer.name))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(isNext ? theme.accentGold : theme.textSecondary)

                        Text(shortTime(prayer.time12h))
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(isNext ? theme.accentGold : theme.textPrimary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 12)
            .padding(.top, 14)

            Spacer(minLength: 6)

            // Separator
            Rectangle()
                .fill(theme.separator)
                .frame(height: 1)
                .padding(.horizontal, 12)

            Spacer(minLength: 6)

            // Bottom section: Next prayer + countdown
            HStack {
                HStack(spacing: 4) {
                    Text("\(entry.data?.nextPrayerLabel ?? "Next Prayer"):")
                        .font(.system(size: 14))
                        .foregroundColor(theme.textSecondary)

                    Text(next?.prayer.name ?? "Fajr")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(theme.accentGold)

                    if next?.isTomorrow == true {
                        Text(entry.data?.tomorrowSuffix ?? "(tmrw)")
                            .font(.system(size: 10))
                            .foregroundColor(theme.textSecondary.opacity(0.7))
                    }
                }

                Spacer()

                Text(next?.countdown ?? "--:--")
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(theme.textPrimary)
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 14)
        }
        .widgetBackground(backgroundGradient)
    }

    /// Abbreviate long English names for compact display.
    /// Arabic names are short enough to display as-is.
    private func shortName(_ name: String) -> String {
        switch name {
        case "Maghrib": return "Magh"
        case "Sunrise": return "Sun"
        default: return name
        }
    }

    /// Remove AM/PM suffix for compact display: "4:57 AM" → "4:57".
    private func shortTime(_ time: String) -> String {
        time.replacingOccurrences(of: " AM", with: "")
            .replacingOccurrences(of: " PM", with: "")
    }
}

// MARK: - Previews

#if DEBUG
struct CircularWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        CircularWidgetView(entry: PrayerTimelineEntry(date: Date(), data: placeholderData()))
            .previewContext(WidgetPreviewContext(family: .systemSmall))
            .previewDisplayName("Dark - Small")

        CircularWidgetView(entry: PrayerTimelineEntry(
            date: Date(),
            data: WidgetPrayerData(
                prayers: placeholderData().prayers,
                date: "01-01",
                cityId: "doha",
                themeMode: "sepia",
                lastUpdated: Date().timeIntervalSince1970 * 1000,
                tomorrowFajrMinutes: nil,
                localizedLabels: [:]
            )
        ))
        .previewContext(WidgetPreviewContext(family: .systemSmall))
        .previewDisplayName("Sepia - Small")
    }
}

struct ListWidgetView_Previews: PreviewProvider {
    static var previews: some View {
        ListWidgetView(entry: PrayerTimelineEntry(date: Date(), data: placeholderData()))
            .previewContext(WidgetPreviewContext(family: .systemMedium))
            .previewDisplayName("Dark - Medium")

        ListWidgetView(entry: PrayerTimelineEntry(
            date: Date(),
            data: WidgetPrayerData(
                prayers: placeholderData().prayers,
                date: "01-01",
                cityId: "doha",
                themeMode: "sepia",
                lastUpdated: Date().timeIntervalSince1970 * 1000,
                tomorrowFajrMinutes: nil,
                localizedLabels: [:]
            )
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
        .previewDisplayName("Sepia - Medium")
    }
}
#endif
