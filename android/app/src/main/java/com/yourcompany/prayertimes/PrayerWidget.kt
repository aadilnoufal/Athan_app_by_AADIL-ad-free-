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
            val views = RemoteViews(context.packageName, R.layout.widget_prayer_times)

            if (prayerInfo != null) {
                views.setTextViewText(R.id.widget_next_prayer_name, prayerInfo.name)
                views.setTextViewText(R.id.widget_next_prayer_time, prayerInfo.time)
                views.setTextViewText(R.id.widget_time_remaining, prayerInfo.timeRemaining)
                views.setProgressBar(R.id.widget_progress_bar, 100, prayerInfo.progress, false)
            } else {
                views.setTextViewText(R.id.widget_next_prayer_name, "PRAYER")
                views.setTextViewText(R.id.widget_next_prayer_time, "--:--")
                views.setTextViewText(R.id.widget_time_remaining, "No Data")
                views.setProgressBar(R.id.widget_progress_bar, 100, 0, false)
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

            val now = Calendar.getInstance().timeInMillis
            val nextUpdate = now + 60000 // 1 minute

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, nextUpdate, pendingIntent)
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, nextUpdate, pendingIntent)
                }
            } catch (e: SecurityException) {
                // Fallback for Android 12+ if permission not granted, though for widgets it's usually fine or ignored
                // Just use set() which is inexact but better than crash
                alarmManager.set(AlarmManager.RTC_WAKEUP, nextUpdate, pendingIntent)
            }
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