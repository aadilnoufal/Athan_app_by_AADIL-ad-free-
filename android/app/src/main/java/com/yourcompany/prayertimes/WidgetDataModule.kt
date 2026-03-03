package com.yourcompany.prayertimes

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * Native module that bridges prayer time data from React Native (JS)
 * to SharedPreferences so Android widgets can read it.
 *
 * Data flow:
 *   JS app (city-tuned prayer times) → setWidgetData(json) → SharedPreferences
 *   Android widgets → PrayerTimeRepository → SharedPreferences (primary) / CSV (fallback)
 *
 * SharedPreferences key: "PrayerWidgetData" (MODE_PRIVATE)
 * JSON format stored in "widget_data" key:
 * {
 *   "times": { "Fajr":"04:57", "Sunrise":"06:20", "Dhuhr":"11:38", "Asr":"14:37", "Maghrib":"16:57", "Isha":"18:27" },
 *   "times12h": { "Fajr":"4:57 AM", ... },
 *   "date": "03-03",
 *   "cityId": "doha",
 *   "themeMode": "dark",
 *   "lastUpdated": 1709467200000
 * }
 */
class WidgetDataModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetDataModule"

    companion object {
        const val PREFS_NAME = "PrayerWidgetData"
        const val KEY_WIDGET_DATA = "widget_data"
        const val KEY_THEME_MODE = "theme_mode"
        const val KEY_CITY_ID = "city_id"
        const val KEY_LAST_UPDATED = "last_updated"
    }

    /**
     * Write prayer time data to SharedPreferences and trigger widget refresh.
     * Called from JS whenever prayer times are recalculated, city changes, or theme changes.
     *
     * @param jsonString JSON string containing prayer times, city, theme
     */
    @ReactMethod
    fun setWidgetData(jsonString: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val editor = prefs.edit()

            editor.putString(KEY_WIDGET_DATA, jsonString)
            editor.putLong(KEY_LAST_UPDATED, System.currentTimeMillis())

            // Also extract cityId and themeMode for quick access
            try {
                val json = org.json.JSONObject(jsonString)
                if (json.has("cityId")) {
                    editor.putString(KEY_CITY_ID, json.getString("cityId"))
                }
                if (json.has("themeMode")) {
                    editor.putString(KEY_THEME_MODE, json.getString("themeMode"))
                }
            } catch (e: Exception) {
                // JSON parsing failed — still write the raw string
            }

            editor.apply()

            // Force-refresh both widget types
            refreshWidgets(context)

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_DATA_ERROR", "Failed to write widget data: ${e.message}", e)
        }
    }

    /**
     * Update only the theme mode (called when user toggles theme without changing prayer times).
     */
    @ReactMethod
    fun setThemeMode(themeMode: String, promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // Update theme_mode in the top-level prefs
            prefs.edit().putString(KEY_THEME_MODE, themeMode).apply()

            // Also update it inside the JSON data if it exists
            val existingData = prefs.getString(KEY_WIDGET_DATA, null)
            if (existingData != null) {
                try {
                    val json = org.json.JSONObject(existingData)
                    json.put("themeMode", themeMode)
                    prefs.edit().putString(KEY_WIDGET_DATA, json.toString()).apply()
                } catch (e: Exception) {
                    // JSON parsing failed — just keep theme_mode updated separately
                }
            }

            refreshWidgets(context)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("THEME_ERROR", "Failed to set theme mode: ${e.message}", e)
        }
    }

    /**
     * Read current widget data (for debugging).
     */
    @ReactMethod
    fun getWidgetData(promise: Promise) {
        try {
            val context = reactApplicationContext
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val data = prefs.getString(KEY_WIDGET_DATA, null)
            promise.resolve(data)
        } catch (e: Exception) {
            promise.reject("READ_ERROR", "Failed to read widget data: ${e.message}", e)
        }
    }

    /**
     * Send broadcast to refresh both widget types immediately.
     */
    private fun refreshWidgets(context: Context) {
        try {
            // Refresh 2x2 circular widget
            val intent2x2 = Intent(context, PrayerWidget::class.java).apply {
                action = "com.yourcompany.prayertimes.ACTION_AUTO_UPDATE"
            }
            context.sendBroadcast(intent2x2)

            // Refresh 4x2 list widget
            val intent4x2 = Intent(context, PrayerWidget4x2::class.java).apply {
                action = "com.yourcompany.prayertimes.ACTION_AUTO_UPDATE_4X2"
            }
            context.sendBroadcast(intent4x2)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
