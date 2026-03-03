import SwiftUI
import WidgetKit

// MARK: - 2x2 Circular Widget View (Small Family)

struct CircularWidgetView: View {
    let entry: PrayerTimelineEntry

    var body: some View {
        let theme = WidgetTheme.forMode(entry.data?.themeMode ?? "dark")
        let next = entry.data?.nextPrayer

        ZStack {
            // Background
            ContainerRelativeShape()
                .fill(
                    LinearGradient(
                        colors: [theme.background, theme.backgroundGradientEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

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
                    Text(next?.prayer.name.uppercased() ?? "PRAYER")
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
                }
            }
        }
    }
}

// MARK: - 4x2 List Widget View (Medium Family)

struct ListWidgetView: View {
    let entry: PrayerTimelineEntry

    var body: some View {
        let theme = WidgetTheme.forMode(entry.data?.themeMode ?? "dark")
        let prayers = entry.data?.prayers ?? placeholderData().prayers
        let next = entry.data?.nextPrayer

        ZStack {
            // Background
            ContainerRelativeShape()
                .fill(
                    LinearGradient(
                        colors: [theme.background, theme.backgroundGradientEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )

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
                        Text("Next Prayer:")
                            .font(.system(size: 14))
                            .foregroundColor(theme.textSecondary)

                        Text(next?.prayer.name ?? "Fajr")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(theme.accentGold)

                        if next?.isTomorrow == true {
                            Text("(tmrw)")
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
        }
    }

    /// Abbreviate "Maghrib" → "Magh", "Sunrise" → "Sun", others keep full name.
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
                lastUpdated: Date().timeIntervalSince1970 * 1000
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
                lastUpdated: Date().timeIntervalSince1970 * 1000
            )
        ))
        .previewContext(WidgetPreviewContext(family: .systemMedium))
        .previewDisplayName("Sepia - Medium")
    }
}
#endif
