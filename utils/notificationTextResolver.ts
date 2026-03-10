/**
 * Notification Text Resolver
 * ==========================
 * Single source of truth for notification title/body strings used by:
 * - Rolling-window scheduler (prayerNotificationScheduler.ts)
 * - Direct Notifee scheduler (notifeePrayerService.js)
 * - Test notification
 * - Iqama reminders
 *
 * Reads the stored language from AsyncStorage (key: 'app_language') and
 * resolves strings via the existing translations/{en,ar}.js dictionaries.
 * Falls back to English if language is unknown or translation is missing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTranslation, getAllTranslations } from '../translations';

// Prayer name keys used across the app — must match translation dictionary keys
const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
type PrayerName = typeof PRAYER_KEYS[number];

// Message key convention: lowercase prayer + 'Message' (e.g. fajrMessage)
function messageKey(prayer: PrayerName): string {
    return `${prayer.charAt(0).toLowerCase()}${prayer.slice(1)}Message`;
}

/**
 * Read stored app language. Returns 'en' or 'ar' (or 'en' on failure).
 */
export async function getStoredLanguage(): Promise<string> {
    try {
        const lang = await AsyncStorage.getItem('app_language');
        return lang === 'ar' ? 'ar' : 'en';
    } catch {
        return 'en';
    }
}

/**
 * Build prayer notification title.
 */
export function getPrayerNotificationTitle(prayer: string, lang: string): string {
    const t = (key: string) => getTranslation(lang, key);
    const localName = t(prayer);

    if (prayer === 'Sunrise') {
        return `☀️ ${localName}`;
    }
    // "🕌 الفجر" or "🕌 Fajr Prayer Time"
    if (lang === 'ar') {
        return `🕌 ${localName}`;
    }
    return `🕌 ${localName} Prayer Time`;
}

/**
 * Build prayer notification body.
 */
export function getPrayerNotificationBody(prayer: string, time: string, lang: string): string {
    const t = (key: string) => getTranslation(lang, key);
    const localName = t(prayer);
    const msgKey = messageKey(prayer as PrayerName);
    const message = t(msgKey);

    if (prayer === 'Sunrise') {
        // "Sunrise time (06:15)" / "شروق الشمس (06:15)"
        return `${message} (${time})`;
    }
    // "حان وقت صلاة الفجر (04:30)" / "It's time for Fajr prayer (04:30)"
    return `${message} (${time})`;
}

/**
 * Build prayer reminder title (pre-prayer reminder).
 */
export function getPrayerReminderTitle(prayer: string, lang: string): string {
    const localName = getTranslation(lang, prayer);
    if (lang === 'ar') {
        return `🔔 تذكير ${localName}`;
    }
    return `🔔 ${localName} Prayer Reminder`;
}

/**
 * Build prayer reminder body.
 */
export function getPrayerReminderBody(prayer: string, time: string, lang: string): string {
    const localName = getTranslation(lang, prayer);
    if (lang === 'ar') {
        return `صلاة ${localName} بعد 15 دقيقة (${time})`;
    }
    return `${localName} prayer starts in 15 minutes (${time})`;
}

/**
 * Build iqama notification title.
 */
export function getIqamaNotificationTitle(prayer: string, lang: string): string {
    const localName = getTranslation(lang, prayer);
    if (lang === 'ar') {
        return `🕌 إقامة – ${localName}`;
    }
    return `🕌 Iqama – ${localName}`;
}

/**
 * Build iqama notification body.
 */
export function getIqamaNotificationBody(prayer: string, minutes: number, lang: string): string {
    const localName = getTranslation(lang, prayer);
    if (minutes === 0) {
        if (lang === 'ar') {
            return `إقامة صلاة ${localName} الآن`;
        }
        return `Iqama for ${localName} prayer is now`;
    }
    if (lang === 'ar') {
        return `إقامة صلاة ${localName} خلال ${minutes} دقائق`;
    }
    return `Iqama for ${localName} prayer in ${minutes} min`;
}

/**
 * Build test notification title.
 */
export function getTestNotificationTitle(lang: string): string {
    if (lang === 'ar') {
        return '🧪 اختبار إشعار الصلاة';
    }
    return '🧪 Test Prayer Notification';
}

/**
 * Build test notification body.
 */
export function getTestNotificationBody(useAzanSound: boolean, lang: string): string {
    if (lang === 'ar') {
        return `اختبار صوت ${useAzanSound ? 'الأذان' : 'التنبيه الافتراضي'}`;
    }
    return `Testing ${useAzanSound ? 'azan' : 'default Android'} sound from channel`;
}

/**
 * Build a complete localized labels map for widget data bridge.
 * Provides pre-translated prayer names and helper labels
 * so native widgets don't need their own translation dictionaries.
 */
export function getWidgetLocalizedLabels(lang: string): Record<string, string> {
    const t = (key: string) => getTranslation(lang, key);
    return {
        Fajr: t('Fajr'),
        Sunrise: t('Sunrise'),
        Dhuhr: t('Dhuhr'),
        Asr: t('Asr'),
        Maghrib: t('Maghrib'),
        Isha: t('Isha'),
        nextPrayer: t('nextPrayer'),
        tomorrow: t('tomorrow'),
    };
}
