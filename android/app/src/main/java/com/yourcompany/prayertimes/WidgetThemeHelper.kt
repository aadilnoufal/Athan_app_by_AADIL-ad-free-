package com.yourcompany.prayertimes

import android.content.Context
import android.os.Build

/**
 * Centralized widget color/resource resolver.
 *
 * Reads the current theme mode from PrayerTimeRepository and returns
 * the appropriate color values and drawable resource IDs for widgets.
 */
object WidgetThemeHelper {

    data class WidgetColors(
        val backgroundRes: Int,       // Drawable resource for widget background
        val progressRes: Int,          // Drawable resource for circular progress
        val textPrimary: Int,          // Primary text (countdown, times)
        val textSecondary: Int,        // Secondary text (labels, prayer names)
        val accentGold: Int,           // Gold accent (next prayer highlight)
        val separatorColor: Int,       // Divider line color
        val subtleText: Int            // Subtle/muted text
    )

    /**
     * Get the complete set of colors and resources for the current theme.
     */
    fun getWidgetColors(context: Context): WidgetColors {
        val themeMode = PrayerTimeRepository.getThemeMode(context)
        return if (themeMode == "sepia") getSepiaColors(context) else getDarkColors(context)
    }

    private fun getDarkColors(context: Context): WidgetColors {
        return WidgetColors(
            backgroundRes = R.drawable.widget_background,
            progressRes = R.drawable.circular_progress,
            textPrimary = resolveColor(context, R.color.midnight_text_primary),
            textSecondary = resolveColor(context, R.color.midnight_text_secondary),
            accentGold = resolveColor(context, R.color.midnight_accent_gold),
            separatorColor = resolveColor(context, R.color.midnight_progress_background),
            subtleText = resolveColor(context, R.color.midnight_text_secondary)
        )
    }

    private fun getSepiaColors(context: Context): WidgetColors {
        return WidgetColors(
            backgroundRes = R.drawable.widget_background_sepia,
            progressRes = R.drawable.circular_progress_sepia,
            textPrimary = resolveColor(context, R.color.sepia_text_primary),
            textSecondary = resolveColor(context, R.color.sepia_text_secondary),
            accentGold = resolveColor(context, R.color.sepia_accent_gold),
            separatorColor = resolveColor(context, R.color.sepia_progress_background),
            subtleText = resolveColor(context, R.color.sepia_text_secondary)
        )
    }

    @Suppress("DEPRECATION")
    private fun resolveColor(context: Context, colorRes: Int): Int {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            context.resources.getColor(colorRes, null)
        } else {
            context.resources.getColor(colorRes)
        }
    }
}
