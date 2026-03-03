/**
 * Tests for parseRegionId and getRegionConfig in prayerTimeConfig.
 *
 * Verifies:
 * - Simple city IDs ("doha") are parsed correctly
 * - Multi-word city IDs ("abu-samra") are parsed correctly
 * - getRegionConfig returns correct config for all known regions
 * - Fallback for unknown region IDs returns null
 */
import { parseRegionId, getRegionConfig } from '../../app/config/prayerTimeConfig';

describe('parseRegionId', () => {
  it('parses simple city ID correctly', () => {
    const result = parseRegionId('qatar-qatar-doha');
    expect(result).toEqual({
      countryId: 'qatar',
      stateId: 'qatar',
      cityId: 'doha',
    });
  });

  it('parses multi-word city ID "abu-samra" correctly', () => {
    const result = parseRegionId('qatar-qatar-abu-samra');
    expect(result).toEqual({
      countryId: 'qatar',
      stateId: 'qatar',
      cityId: 'abu-samra',
    });
  });

  it('parses "dukhan" correctly', () => {
    const result = parseRegionId('qatar-qatar-dukhan');
    expect(result).toEqual({
      countryId: 'qatar',
      stateId: 'qatar',
      cityId: 'dukhan',
    });
  });

  it('parses "alshamal" correctly', () => {
    const result = parseRegionId('qatar-qatar-alshamal');
    expect(result).toEqual({
      countryId: 'qatar',
      stateId: 'qatar',
      cityId: 'alshamal',
    });
  });

  it('returns empty cityId for short region ID', () => {
    const result = parseRegionId('qatar-qatar');
    expect(result).toEqual({
      countryId: 'qatar',
      stateId: 'qatar',
      cityId: '',
    });
  });

  it('handles hypothetical long city name with multiple dashes', () => {
    const result = parseRegionId('country-state-al-ain-south');
    expect(result).toEqual({
      countryId: 'country',
      stateId: 'state',
      cityId: 'al-ain-south',
    });
  });
});

describe('getRegionConfig', () => {
  it('returns config for doha', () => {
    const config = getRegionConfig('qatar-qatar-doha');
    expect(config).not.toBeNull();
    expect(config!.name).toBe('Doha, Qatar');
  });

  it('returns config for abu-samra', () => {
    const config = getRegionConfig('qatar-qatar-abu-samra');
    expect(config).not.toBeNull();
    expect(config!.name).toBe('Abu Samra, Qatar');
  });

  it('returns config for dukhan', () => {
    const config = getRegionConfig('qatar-qatar-dukhan');
    expect(config).not.toBeNull();
    expect(config!.name).toBe('Dukhan, Qatar');
  });

  it('returns config for alshamal', () => {
    const config = getRegionConfig('qatar-qatar-alshamal');
    expect(config).not.toBeNull();
    expect(config!.name).toBe('Al Shamal, Qatar');
  });

  it('returns null for unknown region', () => {
    const config = getRegionConfig('unknown-unknown-unknown');
    expect(config).toBeNull();
  });
});
