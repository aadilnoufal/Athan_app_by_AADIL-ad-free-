package com.yourcompany.prayertimes

import android.content.Context
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

object PrayerTimeRepository {

    fun getTodaysPrayers(context: Context): TodaysPrayers? {
        try {
            val inputStream = context.resources.openRawResource(R.raw.prayer_times)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val csvLines = reader.readLines()
            reader.close()

            val calendar = Calendar.getInstance()
            val currentMonth = calendar.get(Calendar.MONTH) + 1
            val currentDay = calendar.get(Calendar.DAY_OF_MONTH)
            
            val dateKey = String.format(Locale.US, "%02d-%02d", currentDay, currentMonth)
            
            var todayRow: String? = null
            for (line in csvLines) {
                if (line.startsWith(dateKey)) {
                    todayRow = line
                    break
                }
            }

            if (todayRow == null) return null

            val parts = todayRow.split(",")
            if (parts.size < 7) return null

            val prayerNames = listOf("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
            val prayerTimes = parts.subList(1, 7)

            val now = Calendar.getInstance()
            val currentHour = now.get(Calendar.HOUR_OF_DAY)
            val currentMinute = now.get(Calendar.MINUTE)
            val currentTimeMinutes = currentHour * 60 + currentMinute

            var nextPrayerIndex = -1
            var nextPrayerTimeMinutes = -1
            var previousPrayerTimeMinutes = -1

            val allPrayers = mutableListOf<PrayerInfo>()

            for (i in prayerTimes.indices) {
                val pTotalMinutes = parseTime(prayerTimes[i], prayerNames[i])
                val displayTime = format12Hour(prayerTimes[i], prayerNames[i])
                
                // We don't calculate progress/remaining for individual list items here, 
                // but we could if needed. For now, just basic info.
                allPrayers.add(PrayerInfo(prayerNames[i], displayTime, "", 0))

                if (nextPrayerIndex == -1 && pTotalMinutes > currentTimeMinutes) {
                    nextPrayerIndex = i
                    nextPrayerTimeMinutes = pTotalMinutes
                    if (i > 0) {
                        previousPrayerTimeMinutes = parseTime(prayerTimes[i-1], prayerNames[i-1])
                    } else {
                        previousPrayerTimeMinutes = 0
                    }
                }
            }

            // If we found the next prayer today
            if (nextPrayerIndex != -1) {
                var diffMinutes = nextPrayerTimeMinutes - currentTimeMinutes
                if (now.get(Calendar.SECOND) > 0) {
                    diffMinutes--
                }
                if (diffMinutes < 0) diffMinutes = 0

                val hoursLeft = diffMinutes / 60
                val minsLeft = diffMinutes % 60
                val timeRemaining = String.format(Locale.US, "%02d:%02d", hoursLeft, minsLeft)
                
                val displayTime = format12Hour(prayerTimes[nextPrayerIndex], prayerNames[nextPrayerIndex])

                var progress = 0
                if (previousPrayerTimeMinutes != -1) {
                    val totalDuration = nextPrayerTimeMinutes - previousPrayerTimeMinutes
                    val elapsed = currentTimeMinutes - previousPrayerTimeMinutes
                    if (totalDuration > 0) {
                        progress = ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
                    }
                }

                val nextPrayerInfo = PrayerInfo(prayerNames[nextPrayerIndex], displayTime, timeRemaining, progress)
                return TodaysPrayers(allPrayers, nextPrayerIndex, nextPrayerInfo)
            } else {
                // Next prayer is Fajr tomorrow
                // We still return today's list, but nextPrayer is tomorrow's Fajr
                // And nextPrayerIndex can be 6 (indicating all done today) or 0 (wrapping around)
                // Let's use 0 but mark isNextDay in the single PrayerInfo
                
                // ... (Reuse logic for tomorrow's Fajr) ...
                val tomorrow = Calendar.getInstance()
                tomorrow.add(Calendar.DAY_OF_MONTH, 1)
                val tMonth = tomorrow.get(Calendar.MONTH) + 1
                val tDay = tomorrow.get(Calendar.DAY_OF_MONTH)
                val tDateKey = String.format(Locale.US, "%02d-%02d", tDay, tMonth)

                var tomorrowRow: String? = null
                for (line in csvLines) {
                    if (line.startsWith(tDateKey)) {
                        tomorrowRow = line
                        break
                    }
                }
                 if (tomorrowRow == null && tDateKey == "01-01") {
                     for (line in csvLines) {
                        if (line.startsWith("01-01")) {
                            tomorrowRow = line
                            break
                        }
                     }
                }

                if (tomorrowRow != null) {
                    val tParts = tomorrowRow.split(",")
                    val fajrTime = tParts[1]
                    val pTotalMinutes = parseTime(fajrTime, "Fajr")
                    val minutesUntilMidnight = (24 * 60) - currentTimeMinutes
                    var totalDiff = minutesUntilMidnight + pTotalMinutes
                    
                    if (now.get(Calendar.SECOND) > 0) {
                        totalDiff--
                    }
                    if (totalDiff < 0) totalDiff = 0

                    val hoursLeft = totalDiff / 60
                    val minsLeft = totalDiff % 60
                    val timeRemaining = String.format(Locale.US, "%02d:%02d", hoursLeft, minsLeft)
                    val displayTime = format12Hour(fajrTime, "Fajr")
                    
                    // Progress logic for tomorrow...
                    val ishaTimeStr = prayerTimes[5]
                    val ishaMinutes = parseTime(ishaTimeStr, "Isha")
                    val durationUntilMidnight = (24 * 60) - ishaMinutes
                    val totalDuration = durationUntilMidnight + pTotalMinutes
                    val elapsed = currentTimeMinutes - ishaMinutes
                    var progress = 0
                    if (totalDuration > 0 && elapsed >= 0) {
                         progress = ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
                    }

                    val nextPrayerInfo = PrayerInfo("Fajr", displayTime, timeRemaining, progress, true)
                    return TodaysPrayers(allPrayers, -1, nextPrayerInfo) // -1 indicates all today are done
                }
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    fun getNextPrayer(context: Context): PrayerInfo? {
        try {
            val inputStream = context.resources.openRawResource(R.raw.prayer_times)
            val reader = BufferedReader(InputStreamReader(inputStream))
            val csvLines = reader.readLines()
            reader.close()

            val calendar = Calendar.getInstance()
            val currentMonth = calendar.get(Calendar.MONTH) + 1
            val currentDay = calendar.get(Calendar.DAY_OF_MONTH)
            
            val dateKey = String.format(Locale.US, "%02d-%02d", currentDay, currentMonth)
            
            var todayRow: String? = null
            for (line in csvLines) {
                if (line.startsWith(dateKey)) {
                    todayRow = line
                    break
                }
            }

            if (todayRow == null) return null

            val parts = todayRow.split(",")
            if (parts.size < 7) return null

            val prayerNames = listOf("Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")
            val prayerTimes = parts.subList(1, 7) // 0 is Date

            val now = Calendar.getInstance()
            val currentHour = now.get(Calendar.HOUR_OF_DAY)
            val currentMinute = now.get(Calendar.MINUTE)
            val currentTimeMinutes = currentHour * 60 + currentMinute

            var nextPrayerIndex = -1
            var nextPrayerTimeMinutes = -1
            var previousPrayerTimeMinutes = -1

            for (i in prayerTimes.indices) {
                val pTotalMinutes = parseTime(prayerTimes[i], prayerNames[i])

                if (pTotalMinutes > currentTimeMinutes) {
                    nextPrayerIndex = i
                    nextPrayerTimeMinutes = pTotalMinutes
                    // Previous prayer is the one before this, or if i=0, it's Isha from yesterday (approx)
                    // For simplicity, if i=0, we can assume previous was 0 (midnight) or just use a fixed window
                    if (i > 0) {
                        previousPrayerTimeMinutes = parseTime(prayerTimes[i-1], prayerNames[i-1])
                    } else {
                        // If next is Fajr, previous was Isha yesterday. 
                        // Let's just assume a default window or try to find yesterday's Isha
                        previousPrayerTimeMinutes = 0 // Start of day
                    }
                    break
                }
            }

            if (nextPrayerIndex != -1) {
                var diffMinutes = nextPrayerTimeMinutes - currentTimeMinutes
                if (now.get(Calendar.SECOND) > 0) {
                    diffMinutes--
                }
                if (diffMinutes < 0) diffMinutes = 0

                val hoursLeft = diffMinutes / 60
                val minsLeft = diffMinutes % 60
                val timeRemaining = String.format(Locale.US, "%02d:%02d", hoursLeft, minsLeft)
                
                val displayTime = format12Hour(prayerTimes[nextPrayerIndex], prayerNames[nextPrayerIndex])

                // Calculate Progress
                // Total duration = Next - Previous
                // Elapsed = Current - Previous
                // Progress = (Elapsed / Total) * 100
                var progress = 0
                if (previousPrayerTimeMinutes != -1) {
                    val totalDuration = nextPrayerTimeMinutes - previousPrayerTimeMinutes
                    val elapsed = currentTimeMinutes - previousPrayerTimeMinutes
                    if (totalDuration > 0) {
                        progress = ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
                    }
                }

                return PrayerInfo(prayerNames[nextPrayerIndex], displayTime, timeRemaining, progress)
            } else {
                // Next prayer is Fajr tomorrow
                val tomorrow = Calendar.getInstance()
                tomorrow.add(Calendar.DAY_OF_MONTH, 1)
                val tMonth = tomorrow.get(Calendar.MONTH) + 1
                val tDay = tomorrow.get(Calendar.DAY_OF_MONTH)
                val tDateKey = String.format(Locale.US, "%02d-%02d", tDay, tMonth)

                var tomorrowRow: String? = null
                for (line in csvLines) {
                    if (line.startsWith(tDateKey)) {
                        tomorrowRow = line
                        break
                    }
                }
                
                if (tomorrowRow == null && tDateKey == "01-01") {
                     for (line in csvLines) {
                        if (line.startsWith("01-01")) {
                            tomorrowRow = line
                            break
                        }
                     }
                }

                if (tomorrowRow != null) {
                    val tParts = tomorrowRow.split(",")
                    val fajrTime = tParts[1]
                    
                    val pTotalMinutes = parseTime(fajrTime, "Fajr")
                    
                    val minutesUntilMidnight = (24 * 60) - currentTimeMinutes
                    var totalDiff = minutesUntilMidnight + pTotalMinutes
                    
                    if (now.get(Calendar.SECOND) > 0) {
                        totalDiff--
                    }
                    if (totalDiff < 0) totalDiff = 0

                    val hoursLeft = totalDiff / 60
                    val minsLeft = totalDiff % 60
                    val timeRemaining = String.format(Locale.US, "%02d:%02d", hoursLeft, minsLeft)
                    
                    val displayTime = format12Hour(fajrTime, "Fajr")
                    
                    // Progress for Fajr tomorrow
                    // Previous prayer was Isha today
                    val ishaTimeStr = prayerTimes[5] // Isha is last
                    val ishaMinutes = parseTime(ishaTimeStr, "Isha")
                    
                    // Total duration = (Midnight - Isha) + Fajr
                    val durationUntilMidnight = (24 * 60) - ishaMinutes
                    val totalDuration = durationUntilMidnight + pTotalMinutes
                    
                    // Elapsed = Current - Isha
                    val elapsed = currentTimeMinutes - ishaMinutes
                    
                    var progress = 0
                    if (totalDuration > 0 && elapsed >= 0) {
                         progress = ((elapsed.toFloat() / totalDuration.toFloat()) * 100).toInt()
                    }
                    
                    return PrayerInfo("Fajr", displayTime, timeRemaining, progress, true)
                }
            }

        } catch (e: Exception) {
            e.printStackTrace()
        }
        return null
    }

    private fun parseTime(timeStr: String, prayerName: String): Int {
        val parts = timeStr.split(":")
        var hour = parts[0].toInt()
        val minute = parts[1].toInt()

        // Adjust for PM if needed
        // Asr, Maghrib, Isha are always PM
        if (prayerName == "Asr" || prayerName == "Maghrib" || prayerName == "Isha") {
            if (hour < 12) {
                hour += 12
            }
        }
        // Dhuhr is usually PM unless it's 11:xx AM. 
        // If it's 12:xx, it's PM (but 12 is 12 in 24h).
        // If it's 01:xx, it's 13:xx.
        if (prayerName == "Dhuhr") {
             if (hour < 11) { // If it's like 01:00, it's 13:00
                 hour += 12
             }
        }

        return hour * 60 + minute
    }

    private fun format12Hour(timeStr: String, prayerName: String): String {
        try {
            val totalMinutes = parseTime(timeStr, prayerName)
            var hour = totalMinutes / 60
            val minute = totalMinutes % 60
            
            val ampm = if (hour >= 12) "PM" else "AM"
            if (hour > 12) hour -= 12
            if (hour == 0) hour = 12
            
            return String.format(Locale.US, "%d:%02d %s", hour, minute, ampm)
        } catch (e: Exception) {
            return timeStr
        }
    }
}