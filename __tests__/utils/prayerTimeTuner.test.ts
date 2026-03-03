/**
 * Tests for prayerTimeTuner utility functions.
 *
 * Verifies:
 * - extractCityIdFromRegionId handles direct mappings and multi-word cities
 * - applyLocalDataCityAdjustments applies correct offsets
 * - applyTuningParameters adjusts prayer times correctly
 */
import {
  extractCityIdFromRegionId,
  applyLocalDataCityAdjustments,
  applyTuningParameters,
} from '../../utils/prayerTimeTuner';

describe('extractCityIdFromRegionId', () => {
  it('maps "qatar-qatar-doha" to "doha"', () => {
    expect(extractCityIdFromRegionId('qatar-qatar-doha')).toBe('doha');
  });

  it('maps "qatar-qatar-abu-samra" to "abu-samra"', () => {
    expect(extractCityIdFromRegionId('qatar-qatar-abu-samra')).toBe('abu-samra');
  });

  it('maps "qatar-qatar-dukhan" to "dukhan"', () => {
    expect(extractCityIdFromRegionId('qatar-qatar-dukhan')).toBe('dukhan');
  });

  it('maps "qatar-qatar-alshamal" to "alshamal"', () => {
    expect(extractCityIdFromRegionId('qatar-qatar-alshamal')).toBe('alshamal');
  });

  it('defaults to "doha" for invalid regionId', () => {
    expect(extractCityIdFromRegionId('')).toBe('doha');
    expect(extractCityIdFromRegionId(null as any)).toBe('doha');
    expect(extractCityIdFromRegionId(undefined as any)).toBe('doha');
  });

  it('handles unknown region via fallback parsing', () => {
    // Should take last part
    expect(extractCityIdFromRegionId('somecountry-somestate-somecity')).toBe('somecity');
  });
});

describe('applyLocalDataCityAdjustments', () => {
  const baseTimes = {
    Fajr: '05:00',
    Sunrise: '06:20',
    Dhuhr: '11:38',
    Asr: '14:37',
    Maghrib: '16:57',
    Isha: '18:27',
  };

  it('returns unchanged times for doha', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'doha', true);
    expect(result.Fajr).toBe('05:00');
    expect(result.Maghrib).toBe('16:57');
  });

  it('returns unchanged times when isLocalData is false', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'abu-samra', false);
    expect(result.Fajr).toBe('05:00');
    expect(result.Maghrib).toBe('16:57');
  });

  it('applies +3 Fajr, +2 Maghrib for abu-samra', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'abu-samra', true);
    expect(result.Fajr).toBe('05:03');
    expect(result.Maghrib).toBe('16:59');
    // Other prayers unchanged
    expect(result.Dhuhr).toBe('11:38');
  });

  it('applies +4 Fajr, +2 Maghrib for dukhan', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'dukhan', true);
    expect(result.Fajr).toBe('05:04');
    expect(result.Maghrib).toBe('16:59');
  });

  it('applies +2 Fajr, -1 Maghrib for alshamal', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'alshamal', true);
    expect(result.Fajr).toBe('05:02');
    expect(result.Maghrib).toBe('16:56');
  });

  it('returns unchanged for unknown city with isLocalData=true', () => {
    const result = applyLocalDataCityAdjustments(baseTimes, 'unknown-city', true);
    expect(result.Fajr).toBe('05:00');
  });
});

describe('applyTuningParameters', () => {
  const baseTimes = {
    Fajr: '05:00',
    Sunrise: '06:20',
    Dhuhr: '11:38',
    Asr: '14:37',
    Maghrib: '16:57',
    Isha: '18:27',
  };

  it('returns unchanged times for empty tuning', () => {
    const result = applyTuningParameters(baseTimes, '');
    expect(result.Fajr).toBe('05:00');
  });

  it('applies tuning adjustments correctly', () => {
    // Format: Imsak,Fajr,Sunrise,Dhuhr,Asr,Sunset,Maghrib,Isha,Midnight
    const result = applyTuningParameters(baseTimes, '0,-2,-2,-2,-1,0,-1,-1,0');
    expect(result.Fajr).toBe('04:58');  // -2
    expect(result.Sunrise).toBe('06:18'); // -2
    expect(result.Dhuhr).toBe('11:36');  // -2
    expect(result.Asr).toBe('14:36');   // -1
    expect(result.Maghrib).toBe('16:56'); // -1
    expect(result.Isha).toBe('18:26');  // -1
  });

  it('pads missing parameters with zeros', () => {
    // Only 3 params: Imsak(0), Fajr(+5), Sunrise(-3)
    const result = applyTuningParameters(baseTimes, '0,5,-3');
    expect(result.Fajr).toBe('05:05');  // +5
    expect(result.Sunrise).toBe('06:17'); // -3
    expect(result.Dhuhr).toBe('11:38');  // 0 (padded)
    expect(result.Asr).toBe('14:37');   // 0 (padded)
  });
});
