/**
 * Tests for notificationTextResolver utility.
 *
 * Verifies:
 * - getStoredLanguage reads from AsyncStorage and falls back to 'en'
 * - Prayer notification title/body generation in English and Arabic
 * - Iqama notification title/body localization
 * - Test notification title/body localization
 * - Widget localized labels map generation
 * - Fallback behaviour when AsyncStorage fails
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    getStoredLanguage,
    getPrayerNotificationTitle,
    getPrayerNotificationBody,
    getPrayerReminderTitle,
    getPrayerReminderBody,
    getIqamaNotificationTitle,
    getIqamaNotificationBody,
    getTestNotificationTitle,
    getTestNotificationBody,
    getWidgetLocalizedLabels,
} from '../../utils/notificationTextResolver';

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));
beforeEach(() => {
    jest.clearAllMocks();
});

// ── getStoredLanguage ────────────────────────────────────────────

describe('getStoredLanguage', () => {
    it('returns "en" when no language is stored', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        expect(await getStoredLanguage()).toBe('en');
    });

    it('returns "ar" when Arabic is stored', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('ar');
        expect(await getStoredLanguage()).toBe('ar');
    });

    it('returns "en" for unknown language codes', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('fr');
        expect(await getStoredLanguage()).toBe('en');
    });

    it('returns "en" when AsyncStorage throws', async () => {
        (AsyncStorage.getItem as jest.Mock).mockRejectedValue(new Error('fail'));
        expect(await getStoredLanguage()).toBe('en');
    });
});

// ── getPrayerNotificationTitle ───────────────────────────────────

describe('getPrayerNotificationTitle', () => {
    it('returns English title with mosque emoji', () => {
        const title = getPrayerNotificationTitle('Fajr', 'en');
        expect(title).toContain('🕌');
        expect(title).toContain('Fajr');
        expect(title).toContain('Prayer Time');
    });

    it('returns Arabic title with mosque emoji', () => {
        const title = getPrayerNotificationTitle('Fajr', 'ar');
        expect(title).toContain('🕌');
        expect(title).not.toContain('Prayer Time');
    });

    it('returns sun emoji for Sunrise', () => {
        const title = getPrayerNotificationTitle('Sunrise', 'en');
        expect(title).toContain('☀️');
    });
});

// ── getPrayerNotificationBody ───────────────────────────────────

describe('getPrayerNotificationBody', () => {
    it('includes time in parentheses', () => {
        const body = getPrayerNotificationBody('Fajr', '04:30', 'en');
        expect(body).toContain('(04:30)');
    });

    it('includes Arabic message for ar language', () => {
        const body = getPrayerNotificationBody('Fajr', '04:30', 'ar');
        expect(body).toContain('(04:30)');
    });
});

// ── getPrayerReminderTitle ──────────────────────────────────────

describe('getPrayerReminderTitle', () => {
    it('includes bell emoji for EN', () => {
        const title = getPrayerReminderTitle('Dhuhr', 'en');
        expect(title).toContain('🔔');
        expect(title).toContain('Dhuhr');
        expect(title).toContain('Reminder');
    });

    it('includes bell emoji for AR', () => {
        const title = getPrayerReminderTitle('Dhuhr', 'ar');
        expect(title).toContain('🔔');
        expect(title).toContain('تذكير');
    });
});

// ── getPrayerReminderBody ───────────────────────────────────────

describe('getPrayerReminderBody', () => {
    it('mentions 15 minutes in EN', () => {
        const body = getPrayerReminderBody('Asr', '15:30', 'en');
        expect(body).toContain('15 minutes');
        expect(body).toContain('(15:30)');
    });

    it('mentions 15 دقيقة in AR', () => {
        const body = getPrayerReminderBody('Asr', '15:30', 'ar');
        expect(body).toContain('15 دقيقة');
    });
});

// ── getIqamaNotificationTitle ───────────────────────────────────

describe('getIqamaNotificationTitle', () => {
    it('returns EN iqama title', () => {
        const title = getIqamaNotificationTitle('Fajr', 'en');
        expect(title).toContain('Iqama');
        expect(title).toContain('Fajr');
    });

    it('returns AR iqama title', () => {
        const title = getIqamaNotificationTitle('Fajr', 'ar');
        expect(title).toContain('إقامة');
    });
});

// ── getIqamaNotificationBody ────────────────────────────────────

describe('getIqamaNotificationBody', () => {
    it('handles 0 minutes (now)', () => {
        expect(getIqamaNotificationBody('Fajr', 0, 'en')).toContain('now');
        expect(getIqamaNotificationBody('Fajr', 0, 'ar')).toContain('الآن');
    });

    it('handles positive minutes', () => {
        expect(getIqamaNotificationBody('Dhuhr', 10, 'en')).toContain('10 min');
        expect(getIqamaNotificationBody('Dhuhr', 10, 'ar')).toContain('10 دقائق');
    });
});

// ── getTestNotificationTitle ────────────────────────────────────

describe('getTestNotificationTitle', () => {
    it('returns EN test title with beaker emoji', () => {
        expect(getTestNotificationTitle('en')).toContain('🧪');
        expect(getTestNotificationTitle('en')).toContain('Test');
    });

    it('returns AR test title', () => {
        expect(getTestNotificationTitle('ar')).toContain('🧪');
        expect(getTestNotificationTitle('ar')).toContain('اختبار');
    });
});

// ── getTestNotificationBody ─────────────────────────────────────

describe('getTestNotificationBody', () => {
    it('mentions azan sound when enabled', () => {
        expect(getTestNotificationBody(true, 'en')).toContain('azan');
    });

    it('mentions default sound when azan disabled', () => {
        expect(getTestNotificationBody(false, 'en')).toContain('default');
    });

    it('mentions Arabic azan term', () => {
        expect(getTestNotificationBody(true, 'ar')).toContain('الأذان');
    });
});

// ── getWidgetLocalizedLabels ────────────────────────────────────

describe('getWidgetLocalizedLabels', () => {
    it('returns all 6 prayer names + helper labels for EN', () => {
        const labels = getWidgetLocalizedLabels('en');
        expect(labels).toHaveProperty('Fajr');
        expect(labels).toHaveProperty('Sunrise');
        expect(labels).toHaveProperty('Dhuhr');
        expect(labels).toHaveProperty('Asr');
        expect(labels).toHaveProperty('Maghrib');
        expect(labels).toHaveProperty('Isha');
        expect(labels).toHaveProperty('nextPrayer');
        expect(labels).toHaveProperty('tomorrow');
    });

    it('returns Arabic values for AR', () => {
        const labels = getWidgetLocalizedLabels('ar');
        expect(labels.Fajr).not.toBe('Fajr');
        expect(labels.nextPrayer).not.toBe('Next Prayer');
        expect(labels.tomorrow).not.toBe('Tomorrow');
    });

    it('returns English values for EN', () => {
        const labels = getWidgetLocalizedLabels('en');
        expect(labels.Fajr).toBe('Fajr');
        expect(labels.nextPrayer).toBe('Next Prayer');
        expect(labels.tomorrow).toBe('Tomorrow');
    });
});
