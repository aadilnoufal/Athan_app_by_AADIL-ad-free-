package com.yourcompany.prayertimes

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import java.util.Calendar

class PrayerWidget : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
        scheduleNextUpdate(context)
    }

    override fun onEnabled(context: Context) {
        scheduleNextUpdate(context)
    }

    override fun onDisabled(context: Context) {
        cancelUpdate(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (ACTION_AUTO_UPDATE == intent.action) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val thisAppWidget = ComponentName(context.packageName, PrayerWidget::class.java.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    companion object {
        private const val ACTION_AUTO_UPDATE = "com.yourcompany.prayertimes.ACTION_AUTO_UPDATE"

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prayerInfo = PrayerTimeRepository.getNextPrayer(context)
            val colors = WidgetThemeHelper.getWidgetColors(context)
            val views = RemoteViews(context.packageName, R.layout.widget_prayer_times)

            // Apply theme-aware background
            views.setInt(R.id.widget_root, "setBackgroundResource", colors.backgroundRes)

            // ── Click-to-open-app ──
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val launchFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val launchPending = PendingIntent.getActivity(context, 100, launchIntent, launchFlags)
            views.setOnClickPendingIntent(R.id.widget_root, launchPending)

            if (prayerInfo != null) {
                views.setTextViewText(R.id.widget_next_prayer_name, prayerInfo.name.uppercase())
                views.setTextViewText(R.id.widget_next_prayer_time, prayerInfo.time)
                views.setTextViewText(R.id.widget_time_remaining, prayerInfo.timeRemaining)
                views.setProgressBar(R.id.widget_progress_bar, 100, prayerInfo.progress, false)

                // Theme-aware text colors
                views.setTextColor(R.id.widget_next_prayer_name, colors.textSecondary)
                views.setTextColor(R.id.widget_time_remaining, colors.textPrimary)
                views.setTextColor(R.id.widget_next_prayer_time, colors.accentGold)
            } else {
                val localLabels = PrayerTimeRepository.getLocalizedLabels(context)
                val fallbackLabel = PrayerTimeRepository.getNextPrayerLabel(localLabels)
                views.setTextViewText(R.id.widget_next_prayer_name, fallbackLabel.uppercase())
                views.setTextViewText(R.id.widget_next_prayer_time, "--:--")
                views.setTextViewText(R.id.widget_time_remaining, "No Data")
                views.setProgressBar(R.id.widget_progress_bar, 100, 0, false)

                views.setTextColor(R.id.widget_next_prayer_name, colors.textSecondary)
                views.setTextColor(R.id.widget_time_remaining, colors.textPrimary)
                views.setTextColor(R.id.widget_next_prayer_time, colors.accentGold)
            }

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun scheduleNextUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, PrayerWidget::class.java)
            intent.action = ACTION_AUTO_UPDATE
            
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            
            val pendingIntent = PendingIntent.getBroadcast(context, 0, intent, flags)

            // Align to 30s into the next minute so the countdown updates
            // promptly when the minute rolls over.
            val nextMinute = Calendar.getInstance().apply {
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                add(Calendar.MINUTE, 1)
            }.timeInMillis
            // Fire 30s before the next minute boundary too, for smoother updates
            val now = Calendar.getInstance().timeInMillis
            val nextUpdate = if (nextMinute - now > 30000) now + 30000 else nextMinute

            // setExact(RTC) = precise when screen is on, does NOT wake device
            // when screen is off. Best of both worlds for widget countdowns.
            alarmManager.setExact(AlarmManager.RTC, nextUpdate, pendingIntent)
        }

        private fun cancelUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, PrayerWidget::class.java)
            intent.action = ACTION_AUTO_UPDATE
            
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            
            val pendingIntent = PendingIntent.getBroadcast(context, 0, intent, flags)
            alarmManager.cancel(pendingIntent)
        }
    }
}