package com.yourcompany.prayertimes

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Native module that lets the JS layer request the OS widget-pin dialog.
 * Uses AppWidgetManager.requestPinAppWidget() (Android 8.0+ / API 26).
 */
class WidgetPinModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetPinModule"

    /**
     * @param size "small" → PrayerWidget (2×2), "large" → PrayerWidget4x2 (4×2)
     * @param promise resolves true if the pin request was sent, false if unsupported
     */
    @ReactMethod
    fun requestPinWidget(size: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                promise.resolve(false)
                return
            }

            val context = reactApplicationContext
            val appWidgetManager = AppWidgetManager.getInstance(context)

            if (!appWidgetManager.isRequestPinAppWidgetSupported) {
                promise.resolve(false)
                return
            }

            val widgetClass = when (size) {
                "large" -> PrayerWidget4x2::class.java
                else    -> PrayerWidget::class.java
            }

            val provider = ComponentName(context, widgetClass)
            val success = appWidgetManager.requestPinAppWidget(provider, null, null)
            promise.resolve(success)
        } catch (e: Exception) {
            promise.reject("PIN_WIDGET_ERROR", e.message, e)
        }
    }
}
