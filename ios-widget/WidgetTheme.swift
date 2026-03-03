import SwiftUI

/// Theme colors for widget rendering, matching the app's dark and sepia palettes.
struct WidgetTheme {
    let background: Color
    let backgroundGradientEnd: Color
    let textPrimary: Color
    let textSecondary: Color
    let accentGold: Color
    let progressBackground: Color
    let separator: Color
    let borderColor: Color

    static let dark = WidgetTheme(
        background: Color(red: 0.055, green: 0.075, blue: 0.090),        // #0E1317
        backgroundGradientEnd: Color(red: 0.075, green: 0.102, blue: 0.125), // #131A20
        textPrimary: Color(red: 0.980, green: 0.965, blue: 0.933),       // #FAF6EE
        textSecondary: Color(red: 0.882, green: 0.839, blue: 0.780),     // #E1D6C7
        accentGold: Color(red: 0.941, green: 0.839, blue: 0.380),        // #F0D661
        progressBackground: Color(red: 0.133, green: 0.188, blue: 0.224),// #223039
        separator: Color(red: 0.133, green: 0.188, blue: 0.224),         // #223039
        borderColor: Color(red: 0.118, green: 0.165, blue: 0.200)        // #1E2A33
    )

    static let sepia = WidgetTheme(
        background: Color(red: 0.988, green: 0.984, blue: 0.976),        // #FCFBF9
        backgroundGradientEnd: Color(red: 0.969, green: 0.961, blue: 0.941), // #F7F5F0
        textPrimary: Color(red: 0.176, green: 0.157, blue: 0.141),       // #2D2824
        textSecondary: Color(red: 0.361, green: 0.329, blue: 0.302),     // #5C544D
        accentGold: Color(red: 0.831, green: 0.686, blue: 0.216),        // #D4AF37
        progressBackground: Color(red: 0.855, green: 0.839, blue: 0.812),// #DAD6CF — darkened for better contrast
        separator: Color(red: 0.918, green: 0.906, blue: 0.875),         // #EAE7DF
        borderColor: Color(red: 0.918, green: 0.906, blue: 0.875)        // #EAE7DF
    )

    static func forMode(_ mode: String) -> WidgetTheme {
        mode == "sepia" ? .sepia : .dark
    }
}
