package com.yourcompany.prayertimes

import android.content.Context
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.util.Calendar
import java.util.Locale

data class PrayerInfo(
    val name: String,
    val time: String,
    val timeRemaining: String,
    val progress: Int = 0,
    val isNextDay: Boolean = false
)

data class TodaysPrayers(
    val prayers: List<PrayerInfo>,
    val nextPrayerIndex: Int,
    val nextPrayer: PrayerInfo
)

/**
 * Central data provider for Android widgets.
 *
 * Data source priority:
 *   1. SharedPreferences ("PrayerWidgetData") — written by JS via WidgetDataModule
 *      Contains city-tuned times in 24h format, already adjusted for selected city.
 *   2. Bundled CSV (res/raw/prayer_times.csv) — fallback if SharedPreferences is empty/stale.
 *      Contains raw Doha times only (no city tuning).
 *
 * Theme mode is also read from SharedPreferences for widget color theming.
 */
object PrayerTimeRepository {

    private const val PREFS_NAME = "PrayerWidgetData"
    private const val KEY_WIDGET_DATA = "widget_data"
    private const val KEY_THEME_MODE = "theme_mode"
    private const val KEY_LAST_UPDATED = "last_updated"
    private const val STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000L // 48 hours

    private val PRAYER_NAMES = listOf("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")

    // ========================================================================
    // Public API
    // ========================================================================

    /**
     * Get the current theme mode for widget rendering.
     * Returns "dark" or "sepia". Default: "dark".
     */
    fun getThemeMode(context: Context): String {
        return try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.getString(KEY_THEME_MODE, "dark") ?: "dark"
        } catch (e: Exception) {
            "dark"
        }
    }

    /**
     * Get all 6 prayer times + next prayer info for the 4x2 widget.
     * Tries SharedPreferences first, falls back to CSV.
     */
    fun getTodaysPrayers(context: Context): TodaysPrayers? {
        // Try SharedPreferences first (has city-tuned times)
        val fromPrefs = getTodaysPrayersFromPrefs(context)
        if (fromPrefs != null) return fromPrefs

        // Fallback to CSV (raw Doha times)
        return getTodaysPrayersFromCSV(context)
    }

    /**
     * Get next prayer info for the 2x2 circular widget.
     * Tries SharedPreferences first, falls back to CSV.
     */
    fun getNextPrayer(context: Context): PrayerInfo? {
        // Try SharedPreferences first (has city-tuned times)
        val fromPrefs = getNextPrayerFromPrefs(context)
        if (fromPrefs != null) return fromPrefs

        // Fallback to CSV (raw Doha times)
        return getNextPrayerFromCSV(context)
    }

    // ========================================================================
    // SharedPreferences data source (primary — city-tuned times from JS app)
    // ========================================================================

    private fun getTodaysPrayersFromPrefs(context: Context): TodaysPrayers? {
        val prayerMinutes = getPrayerTimesFromPrefs(context) ?: return null
        return buildTodaysPrayers(context, prayerMinutes)
    }

    private fun getNextPrayerFromPrefs(context: Context): PrayerInfo? {
        val prayerMinutes = getPrayerTimesFromPrefs(context) ?: return null
        return buildNextPrayer(context, prayerMinutes)
    }

    /**
     * Parse prayer times from SharedPreferences JSON.
     * Returns a list of 6 total-minutes values in prayer order, or null if data is stale/missing.
     *
     * JSON format: { "times": { "Fajr":"04:57", ..., "Isha":"18:27" }, "date":"03-03", ... }
     * Times are in 24h format, already city-tuned by JS.
     */
    private fun getPrayerTimesFromPrefs(context: Context): List<Int>? {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val lastUpdated = prefs.getLong(KEY_LAST_UPDATED, 0)

            // Check staleness
            if (System.currentTimeMillis() - lastUpdated > STALE_THRESHOLD_MS) {
                return null
            }

            val jsonStr = prefs.getString(KEY_WIDGET_DATA, null) ?: return null
            val json = JSONObject(jsonStr)
            val timesObj = json.optJSONObject("times") ?: return null

            // Verify the date matches today (data might be from yesterday)
            val dataDate = json.optString("date", "")
            val calendar = Calendar.getInstance()
            val todayKey = String.format(Locale.US, "%02d-%02d",
                calendar.get(Calendar.DAY_OF_MONTH),
                calendar.get(Calendar.MONTH) + 1)

            // If date doesn't match today, still use the data since
            // times don't change dramatically day-to-day and the app
            // will resync. Only reject if data is truly stale (>48h).

            val result = mutableListOf<Int>()
            for (name in PRAYER_NAMES) {
                val timeStr = timesObj.optString(name, "") 
                if (timeStr.isEmpty()) return null
                result.add(parse24hTime(timeStr))
            }
            return result
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    /**
     * Get 12h display times from SharedPreferences.
     * Returns the pre-formatted 12h strings, or null.
     */
    private fun get12hTimesFromPrefs(context: Context): Map<String, String>? {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_WIDGET_DATA, null) ?: return null
            val json = JSONObject(jsonStr)
            val times12hObj = json.optJSONObject("times12h") ?: return null

            val result = mutableMapOf<String, String>()
            for (name in PRAYER_NAMES) {
                result[name] = times12hObj.optString(name, "")
            }
            return result
        } catch (e: Exception) {
            return null
        }
    }

    // ========================================================================
    // CSV data source (fallback — raw Doha times, no city tuning)
    // ========================================================================

    private fun getTodaysPrayersFromCSV(context: Context): TodaysPrayers? {
        val prayerMinutes = getPrayerTimesFromCSV(context) ?: return null
        return buildTodaysPrayers(context, prayerMinutes)
    }

    private fun getNextPrayerFromCSV(context: Context): PrayerInfo? {
        val prayerMinutes = getPrayerTimesFromCSV(context) ?: return null
        return buildNextPrayer(context, prayerMinutes)
    }

    /**
     * Parse today's prayer times from the bundled CSV.
     * Returns a list of 6 total-minutes values (Fajr through Isha).
     */
    private fun getPrayerTimesFromCSV(context: Context): List<Int>? {
        try {
            val inputStream = context.resources.openRawResource(R.raw.prayer_times)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val csvLines = reader.readLines()
            reader.close()

            val calendar = Calendar.getInstance()
            val dateKey = String.format(Locale.US, "%02d-%02d",
                calendar.get(Calendar.DAY_OF_MONTH),
                calendar.get(Calendar.MONTH) + 1)

            val todayRow = csvLines.find { it.startsWith(dateKey) } ?: return null
            val parts = todayRow.split(",")
            if (parts.size < 7) return null

            val rawTimes = parts.subList(1, 7)
            return rawTimes.mapIndexed { i, timeStr ->
                parseCSVTime(timeStr, PRAYER_NAMES[i])
            }
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    /**
     * Get tomorrow's Fajr time from CSV (for post-Isha countdown).
     */
    private fun getTomorrowFajrFromCSV(context: Context): Int? {
        try {
            val inputStream = context.resources.openRawResource(R.raw.prayer_times)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val csvLines = reader.readLines()
            reader.close()

            val tomorrow = Calendar.getInstance()
            tomorrow.add(Calendar.DAY_OF_MONTH, 1)
            val tDateKey = String.format(Locale.US, "%02d-%02d",
                tomorrow.get(Calendar.DAY_OF_MONTH),
                tomorrow.get(Calendar.MONTH) + 1)

            val tomorrowRow = csvLines.find { it.startsWith(tDateKey) }
                ?: csvLines.find { it.startsWith("01-01") }
                ?: return null

            val parts = tomorrowRow.split(",")
            if (parts.size < 2) return null
            return parseCSVTime(parts[1], "Fajr")
        } catch (e: Exception) {
            return null
        }
    }

    /**
     * Get tomorrow's Fajr time, preferring city-tuned value from SharedPrefs
     * over raw CSV. The JS bridge sends tomorrowFajrMinutes already adjusted
     * for the selected city, so this is more accurate for non-Doha users.
     */
    private fun getTomorrowFajr(context: Context): Int? {
        // Try SharedPreferences first (city-tuned)
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val jsonStr = prefs.getString(KEY_WIDGET_DATA, null)
            if (jsonStr != null) {
                val json = JSONObject(jsonStr)
                val tomorrowFajr = json.optInt("tomorrowFajrMinutes", -1)
                if (tomorrowFajr > 0) return tomorrowFajr
            }
        } catch (_: Exception) { }
        // Fall back to CSV (raw Doha times)
        return getTomorrowFajrFromCSV(context)
    }

    // ========================================================================
    // Shared computation: build PrayerInfo / TodaysPrayers from minute values
    // ========================================================================

    /**
     * Build TodaysPrayers from a list of 6 prayer time values (in total minutes).
     */
    private fun buildTodaysPrayers(context: Context, prayerMinutes: List<Int>): TodaysPrayers? {
        val now = Calendar.getInstance()
        val currentTimeMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val currentSecond = now.get(Calendar.SECOND)

        // Get pre-formatted 12h strings if available from SharedPreferences
        val prefs12h = get12hTimesFromPrefs(context)

        var nextPrayerIndex = -1
        var nextPrayerTimeMinutes = -1
        var previousPrayerTimeMinutes = -1

        val allPrayers = mutableListOf<PrayerInfo>()

        for (i in prayerMinutes.indices) {
            val displayTime = prefs12h?.get(PRAYER_NAMES[i])
                ?: minutesTo12h(prayerMinutes[i])
            allPrayers.add(PrayerInfo(PRAYER_NAMES[i], displayTime, "", 0))

            if (nextPrayerIndex == -1 && prayerMinutes[i] > currentTimeMinutes) {
                nextPrayerIndex = i
                nextPrayerTimeMinutes = prayerMinutes[i]
                previousPrayerTimeMinutes = if (i > 0) prayerMinutes[i - 1] else 0
            }
        }

        if (nextPrayerIndex != -1) {
            // Next prayer is today
            var diffMinutes = nextPrayerTimeMinutes - currentTimeMinutes
            if (currentSecond > 0) diffMinutes--
            if (diffMinutes < 0) diffMinutes = 0

            val timeRemaining = formatCountdown(diffMinutes)
            val displayTime = prefs12h?.get(PRAYER_NAMES[nextPrayerIndex])
                ?: minutesTo12h(nextPrayerTimeMinutes)
            val progress = calcProgress(previousPrayerTimeMinutes, nextPrayerTimeMinutes, currentTimeMinutes)

            val nextPrayerInfo = PrayerInfo(PRAYER_NAMES[nextPrayerIndex], displayTime, timeRemaining, progress)
            return TodaysPrayers(allPrayers, nextPrayerIndex, nextPrayerInfo)
        } else {
            // All prayers done today → next is tomorrow's Fajr
            // Prefer city-tuned value from SharedPrefs over raw CSV
            val tomorrowFajr = getTomorrowFajr(context) ?: return TodaysPrayers(allPrayers, -1,
                PrayerInfo("Fajr", "--:--", "--:--", 0, true))

            val minutesUntilMidnight = (24 * 60) - currentTimeMinutes
            var totalDiff = minutesUntilMidnight + tomorrowFajr
            if (currentSecond > 0) totalDiff--
            if (totalDiff < 0) totalDiff = 0

            val timeRemaining = formatCountdown(totalDiff)
            val displayTime = minutesTo12h(tomorrowFajr)

            val ishaMinutes = prayerMinutes[5]
            val durationUntilMidnight = (24 * 60) - ishaMinutes
            val totalDuration = durationUntilMidnight + tomorrowFajr
            val elapsed = currentTimeMinutes - ishaMinutes
            val progress = if (totalDuration > 0 && elapsed >= 0) {
                ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
            } else 0

            val nextPrayerInfo = PrayerInfo("Fajr", displayTime, timeRemaining, progress, true)
            return TodaysPrayers(allPrayers, -1, nextPrayerInfo)
        }
    }

    /**
     * Build a single PrayerInfo for the next upcoming prayer.
     */
    private fun buildNextPrayer(context: Context, prayerMinutes: List<Int>): PrayerInfo? {
        val now = Calendar.getInstance()
        val currentTimeMinutes = now.get(Calendar.HOUR_OF_DAY) * 60 + now.get(Calendar.MINUTE)
        val currentSecond = now.get(Calendar.SECOND)

        val prefs12h = get12hTimesFromPrefs(context)

        for (i in prayerMinutes.indices) {
            if (prayerMinutes[i] > currentTimeMinutes) {
                var diffMinutes = prayerMinutes[i] - currentTimeMinutes
                if (currentSecond > 0) diffMinutes--
                if (diffMinutes < 0) diffMinutes = 0

                val displayTime = prefs12h?.get(PRAYER_NAMES[i])
                    ?: minutesTo12h(prayerMinutes[i])
                val previousMinutes = if (i > 0) prayerMinutes[i - 1] else 0
                val progress = calcProgress(previousMinutes, prayerMinutes[i], currentTimeMinutes)

                return PrayerInfo(PRAYER_NAMES[i], displayTime, formatCountdown(diffMinutes), progress)
            }
        }

        // All prayers done today → next is tomorrow's Fajr
        // Prefer city-tuned value from SharedPrefs over raw CSV
        val tomorrowFajr = getTomorrowFajr(context) ?: return null

        val minutesUntilMidnight = (24 * 60) - currentTimeMinutes
        var totalDiff = minutesUntilMidnight + tomorrowFajr
        if (currentSecond > 0) totalDiff--
        if (totalDiff < 0) totalDiff = 0

        val displayTime = minutesTo12h(tomorrowFajr)
        val ishaMinutes = prayerMinutes[5]
        val durationUntilMidnight = (24 * 60) - ishaMinutes
        val totalDuration = durationUntilMidnight + tomorrowFajr
        val elapsed = currentTimeMinutes - ishaMinutes
        val progress = if (totalDuration > 0 && elapsed >= 0) {
            ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
        } else 0

        return PrayerInfo("Fajr", displayTime, formatCountdown(totalDiff), progress, true)
    }

    // ========================================================================
    // Time parsing utilities
    // ========================================================================

    /**
     * Parse a 24h time string "HH:MM" → total minutes since midnight.
     * Used for SharedPreferences data (times already in 24h format).
     */
    private fun parse24hTime(timeStr: String): Int {
        val parts = timeStr.split(":")
        return parts[0].toInt() * 60 + parts[1].toInt()
    }

    /**
     * Parse a CSV time string with AM/PM heuristic.
     * CSV stores Asr/Maghrib/Isha in 12h format without AM/PM markers.
     * Used only for CSV fallback data.
     */
    private fun parseCSVTime(timeStr: String, prayerName: String): Int {
        val parts = timeStr.split(":")
        var hour = parts[0].toInt()
        val minute = parts[1].toInt()

        when (prayerName) {
            "Asr", "Maghrib", "Isha" -> {
                if (hour < 12) hour += 12
            }
            "Dhuhr" -> {
                if (hour < 11) hour += 12
            }
        }

        return hour * 60 + minute
    }

    /**
     * Convert total minutes to "H:MM AM/PM" display format.
     */
    private fun minutesTo12h(totalMinutes: Int): String {
        var hour = totalMinutes / 60
        val minute = totalMinutes % 60
        val ampm = if (hour >= 12) "PM" else "AM"
        if (hour > 12) hour -= 12
        if (hour == 0) hour = 12
        return String.format(Locale.US, "%d:%02d %s", hour, minute, ampm)
    }

    /**
     * Format a duration in minutes as "HH:MM" countdown string.
     */
    private fun formatCountdown(minutes: Int): String {
        val h = minutes / 60
        val m = minutes % 60
        return String.format(Locale.US, "%02d:%02d", h, m)
    }

    /**
     * Calculate progress percentage between previous and next prayer.
     */
    private fun calcProgress(previousMinutes: Int, nextMinutes: Int, currentMinutes: Int): Int {
        val totalDuration = nextMinutes - previousMinutes
        val elapsed = currentMinutes - previousMinutes
        return if (totalDuration > 0) {
            ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt().coerceIn(0, 100)
        } else 0
    }
}