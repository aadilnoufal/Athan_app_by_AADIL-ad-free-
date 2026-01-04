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

class PrayerWidget4x2 : AppWidgetProvider() {

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
            val thisAppWidget = ComponentName(context.packageName, PrayerWidget4x2::class.java.name)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(thisAppWidget)
            onUpdate(context, appWidgetManager, appWidgetIds)
        }
    }

    companion object {
        private const val ACTION_AUTO_UPDATE = "com.yourcompany.prayertimes.ACTION_AUTO_UPDATE_4X2"

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            try {
                val todaysPrayers = PrayerTimeRepository.getTodaysPrayers(context)
                val views = RemoteViews(context.packageName, R.layout.widget_prayer_times_4x2)

                if (todaysPrayers != null) {
                    // Update List
                    val prayers = todaysPrayers.prayers
                    val nextIndex = todaysPrayers.nextPrayerIndex

                    val nameIds = intArrayOf(
                        R.id.prayer_name_0, R.id.prayer_name_1, R.id.prayer_name_2,
                        R.id.prayer_name_3, R.id.prayer_name_4, R.id.prayer_name_5
                    )
                    val timeIds = intArrayOf(
                        R.id.prayer_time_0, R.id.prayer_time_1, R.id.prayer_time_2,
                        R.id.prayer_time_3, R.id.prayer_time_4, R.id.prayer_time_5
                    )

                    for (i in 0 until 6) {
                        if (i < prayers.size) {
                            val prayer = prayers[i]
                            val nameId = nameIds[i]
                            val timeId = timeIds[i]

                            views.setTextViewText(nameId, prayer.name)
                            
                            val shortTime = prayer.time.replace(" AM", "").replace(" PM", "")
                            views.setTextViewText(timeId, shortTime)

                            // Highlight Logic
                            // Use a safe color retrieval method
                            val goldColor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                context.resources.getColor(R.color.midnight_accent_gold, null)
                            } else {
                                @Suppress("DEPRECATION")
                                context.resources.getColor(R.color.midnight_accent_gold)
                            }
                            
                            val secondaryColor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                context.resources.getColor(R.color.midnight_text_secondary, null)
                            } else {
                                @Suppress("DEPRECATION")
                                context.resources.getColor(R.color.midnight_text_secondary)
                            }
                            
                            val primaryColor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                context.resources.getColor(R.color.midnight_text_primary, null)
                            } else {
                                @Suppress("DEPRECATION")
                                context.resources.getColor(R.color.midnight_text_primary)
                            }

                            if (i == nextIndex) {
                                views.setTextColor(nameId, goldColor)
                                views.setTextColor(timeId, goldColor)
                            } else {
                                views.setTextColor(nameId, secondaryColor)
                                views.setTextColor(timeId, primaryColor)
                            }
                        }
                    }

                    // Update Bottom Section
                    val nextPrayer = todaysPrayers.nextPrayer
                    views.setTextViewText(R.id.widget_next_prayer_name_bottom, nextPrayer.name)
                    views.setTextViewText(R.id.widget_countdown_bottom, nextPrayer.timeRemaining)

                } else {
                    views.setTextViewText(R.id.widget_next_prayer_name_bottom, "Error")
                    views.setTextViewText(R.id.widget_countdown_bottom, "--:--")
                }

                appWidgetManager.updateAppWidget(appWidgetId, views)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }

        private fun scheduleNextUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, PrayerWidget4x2::class.java)
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
                alarmManager.set(AlarmManager.RTC_WAKEUP, nextUpdate, pendingIntent)
            }
        }

        private fun cancelUpdate(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(context, PrayerWidget4x2::class.java)
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