/**
 * Tests for utils/iqamaConfig.ts
 *
 * Validates iqama offsets, getIqamaTime() computation, and hasIqama() checks.
 */

import { IQAMA_OFFSETS, IQAMA_PRAYERS, getIqamaTime, hasIqama } from '../../utils/iqamaConfig';

describe('iqamaConfig', () => {
  // ── IQAMA_OFFSETS ────────────────────────────────────
  describe('IQAMA_OFFSETS', () => {
    it('has correct offset for Fajr (+25 min)', () => {
      expect(IQAMA_OFFSETS.Fajr).toBe(25);
    });

    it('has correct offset for Dhuhr (+20 min)', () => {
      expect(IQAMA_OFFSETS.Dhuhr).toBe(20);
    });

    it('has correct offset for Asr (+25 min)', () => {
      expect(IQAMA_OFFSETS.Asr).toBe(25);
    });

    it('has correct offset for Maghrib (+10 min)', () => {
      expect(IQAMA_OFFSETS.Maghrib).toBe(10);
    });

    it('has correct offset for Isha (+20 min)', () => {
      expect(IQAMA_OFFSETS.Isha).toBe(20);
    });

    it('does not include Sunrise', () => {
      expect(IQAMA_OFFSETS.Sunrise).toBeUndefined();
    });
  });

  // ── IQAMA_PRAYERS ────────────────────────────────────
  describe('IQAMA_PRAYERS', () => {
    it('contains exactly 5 prayers', () => {
      expect(IQAMA_PRAYERS).toHaveLength(5);
    });

    it('includes Fajr, Dhuhr, Asr, Maghrib, Isha', () => {
      expect(IQAMA_PRAYERS).toEqual(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']);
    });

    it('does not include Sunrise', () => {
      expect(IQAMA_PRAYERS).not.toContain('Sunrise');
    });
  });

  // ── getIqamaTime ────────────────────────────────────
  describe('getIqamaTime', () => {
    it('returns iqama time 25 min after Fajr adhan', () => {
      const adhan = new Date(2025, 0, 1, 5, 0, 0); // 5:00 AM
      const iqama = getIqamaTime('Fajr', adhan);
      expect(iqama).not.toBeNull();
      expect(iqama!.getHours()).toBe(5);
      expect(iqama!.getMinutes()).toBe(25);
    });

    it('returns iqama time 25 min after Asr adhan', () => {
      const adhan = new Date(2025, 0, 1, 15, 30, 0); // 3:30 PM
      const iqama = getIqamaTime('Asr', adhan);
      expect(iqama).not.toBeNull();
      expect(iqama!.getHours()).toBe(15);
      expect(iqama!.getMinutes()).toBe(55);
    });

    it('returns iqama time 10 min after Maghrib adhan', () => {
      const adhan = new Date(2025, 0, 1, 17, 45, 0); // 5:45 PM
      const iqama = getIqamaTime('Maghrib', adhan);
      expect(iqama).not.toBeNull();
      expect(iqama!.getHours()).toBe(17);
      expect(iqama!.getMinutes()).toBe(55);
    });

    it('returns null for Sunrise (no iqama)', () => {
      const adhan = new Date(2025, 0, 1, 6, 30, 0);
      expect(getIqamaTime('Sunrise', adhan)).toBeNull();
    });

    it('returns null for unknown prayer name', () => {
      const adhan = new Date(2025, 0, 1, 12, 0, 0);
      expect(getIqamaTime('UnknownPrayer', adhan)).toBeNull();
    });

    it('handles minute rollover correctly (Isha at 20:50 → 21:10)', () => {
      const adhan = new Date(2025, 0, 1, 20, 50, 0); // 8:50 PM
      const iqama = getIqamaTime('Isha', adhan);
      expect(iqama).not.toBeNull();
      expect(iqama!.getHours()).toBe(21);
      expect(iqama!.getMinutes()).toBe(10);
    });
  });

  // ── hasIqama ────────────────────────────────────────
  describe('hasIqama', () => {
    it.each(['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'])('returns true for %s', (prayer) => {
      expect(hasIqama(prayer)).toBe(true);
    });

    it('returns false for Sunrise', () => {
      expect(hasIqama('Sunrise')).toBe(false);
    });

    it('returns false for unknown prayer', () => {
      expect(hasIqama('Tahajjud')).toBe(false);
    });
  });
});
