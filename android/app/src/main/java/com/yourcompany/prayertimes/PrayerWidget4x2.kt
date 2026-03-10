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
                val colors = WidgetThemeHelper.getWidgetColors(context)

                // Apply theme-aware background
                views.setInt(R.id.widget_4x2_root, "setBackgroundResource", colors.backgroundRes)

                // ── Click-to-open-app ──
                val launchIntent = Intent(context, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                val launchFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val launchPending = PendingIntent.getActivity(context, 101, launchIntent, launchFlags)
                views.setOnClickPendingIntent(R.id.widget_4x2_root, launchPending)

                // Theme the separator line and labels
                views.setInt(R.id.widget_separator, "setBackgroundColor", colors.separatorColor)
                views.setTextColor(R.id.widget_next_label, colors.textSecondary)

                // Set localized "NEXT" label
                val localLabels = PrayerTimeRepository.getLocalizedLabels(context)
                val nextLabelText = PrayerTimeRepository.getNextPrayerLabel(localLabels)
                views.setTextViewText(R.id.widget_next_label, nextLabelText.uppercase())

                val nameIds = intArrayOf(
                    R.id.prayer_name_0, R.id.prayer_name_1, R.id.prayer_name_2,
                    R.id.prayer_name_3, R.id.prayer_name_4, R.id.prayer_name_5
                )
                val timeIds = intArrayOf(
                    R.id.prayer_time_0, R.id.prayer_time_1, R.id.prayer_time_2,
                    R.id.prayer_time_3, R.id.prayer_time_4, R.id.prayer_time_5
                )
                val itemIds = intArrayOf(
                    R.id.prayer_item_0, R.id.prayer_item_1, R.id.prayer_item_2,
                    R.id.prayer_item_3, R.id.prayer_item_4, R.id.prayer_item_5
                )

                if (todaysPrayers != null) {
                    val prayers = todaysPrayers.prayers
                    val nextIndex = todaysPrayers.nextPrayerIndex

                    for (i in 0 until 6) {
                        if (i < prayers.size) {
                            val prayer = prayers[i]
                            views.setTextViewText(nameIds[i], prayer.name)

                            val shortTime = prayer.time.replace(" AM", "").replace(" PM", "")
                            views.setTextViewText(timeIds[i], shortTime)

                            // Highlight next prayer: gold text + pill background
                            if (i == nextIndex) {
                                views.setTextColor(nameIds[i], colors.accentGold)
                                views.setTextColor(timeIds[i], colors.accentGold)
                                views.setInt(itemIds[i], "setBackgroundResource", colors.prayerHighlightRes)
                            } else {
                                views.setTextColor(nameIds[i], colors.textSecondary)
                                views.setTextColor(timeIds[i], colors.textPrimary)
                                views.setInt(itemIds[i], "setBackgroundResource", 0)
                            }
                        }
                    }

                    // Bottom section: next prayer name + countdown + progress ring
                    val nextPrayer = todaysPrayers.nextPrayer
                    val labels = PrayerTimeRepository.getLocalizedLabels(context)
                    val tomorrowSuffix = if (nextPrayer.isNextDay) " ${PrayerTimeRepository.getTomorrowLabel(labels)}" else ""
                    val displayName = "${nextPrayer.name}${tomorrowSuffix}"
                    views.setTextViewText(R.id.widget_next_prayer_name_bottom, displayName)
                    views.setTextViewText(R.id.widget_countdown_bottom, nextPrayer.timeRemaining)
                    views.setTextColor(R.id.widget_next_prayer_name_bottom, colors.accentGold)
                    views.setTextColor(R.id.widget_countdown_bottom, colors.textPrimary)
                    views.setProgressBar(R.id.widget_mini_progress, 100, nextPrayer.progress, false)
                } else {
                    // No data — clear highlights and show error state
                    for (id in itemIds) {
                        views.setInt(id, "setBackgroundResource", 0)
                    }
                    views.setTextViewText(R.id.widget_next_prayer_name_bottom, "Error")
                    views.setTextViewText(R.id.widget_countdown_bottom, "--:--")
                    views.setTextColor(R.id.widget_next_prayer_name_bottom, colors.accentGold)
                    views.setTextColor(R.id.widget_countdown_bottom, colors.textPrimary)
                    views.setProgressBar(R.id.widget_mini_progress, 100, 0, false)
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