/**
 * Utility to apply tuning parameters to prayer times
 */

/**
 * Convert time string in format "HH:MM" to minutes since midnight
 * @param {string} timeStr - Time string in format "HH:MM"
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes since midnight to time string in format "HH:MM"
 * @param {number} minutes - Minutes since midnight
 * @returns {string} Time string in format "HH:MM"
 */
function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Apply tuning parameters to prayer times
 * @param {Object} times - Prayer times object with times in "HH:MM" format
 * @param {string} tuningParams - Comma-separated tuning parameters
 * @returns {Object} Adjusted prayer times object
 */
export function applyTuningParameters(times, tuningParams) {
  // If no tuning parameters, return original times
  if (!tuningParams || tuningParams.trim() === '') {
    return { ...times };
  }

  // Parse the tuning parameters
  const params = tuningParams.split(',').map(p => parseInt(p, 10));
  
  // Default to 0 for any missing parameters
  while (params.length < 9) {
    params.push(0);
  }

  const result = { ...times };
  
  // Apply adjustments to each prayer time based on the parameters
  // The order in the API is: Imsak, Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Midnight
  // We only tune the standard prayer times
  if (result.Fajr && params[1] !== 0) {
    const fajrMinutes = timeToMinutes(result.Fajr);
    result.Fajr = minutesToTime(fajrMinutes + params[1]);
  }
  
  if (result.Sunrise && params[2] !== 0) {
    const sunriseMinutes = timeToMinutes(result.Sunrise);
    result.Sunrise = minutesToTime(sunriseMinutes + params[2]);
  }
  
  if (result.Dhuhr && params[3] !== 0) {
    const dhuhrMinutes = timeToMinutes(result.Dhuhr);
    result.Dhuhr = minutesToTime(dhuhrMinutes + params[3]);
  }
  
  if (result.Asr && params[4] !== 0) {
    const asrMinutes = timeToMinutes(result.Asr);
    result.Asr = minutesToTime(asrMinutes + params[4]);
  }
  
  if (result.Maghrib && params[6] !== 0) {
    const maghribMinutes = timeToMinutes(result.Maghrib);
    result.Maghrib = minutesToTime(maghribMinutes + params[6]);
  }
  
  if (result.Isha && params[7] !== 0) {
    const ishaMinutes = timeToMinutes(result.Isha);
    result.Isha = minutesToTime(ishaMinutes + params[7]);
  }
  
  return result;
}

/**
 * Apply tuning parameters to batch of prayer times (multiple days)
 * @param {Array} timesBatch - Array of prayer times objects
 * @param {string} tuningParams - Comma-separated tuning parameters
 * @returns {Array} Adjusted prayer times array
 */
export function applyTuningParametersToBatch(timesBatch, tuningParams) {
  return timesBatch.map(timesObj => {
    // Create a copy of the times object with tuned prayer times
    const result = { ...timesObj };
    result.times = applyTuningParameters(timesObj.times, tuningParams);
    return result;
  });
}

/**
 * Apply city-specific adjustments to local prayer times data
 * This function applies specific minute adjustments based on the city
 * and only when using local CSV data (not API data)
 * @param {Object} times - Prayer times object with times in "HH:MM" format
 * @param {string} cityId - The city ID (e.g., 'doha', 'abu-samra', 'dukhan', 'alshamal')
 * @param {boolean} isLocalData - Whether this is local CSV data (true) or API data (false)
 * @returns {Object} Adjusted prayer times object
 */
export function applyLocalDataCityAdjustments(times, cityId, isLocalData = false) {
  console.log(`applyLocalDataCityAdjustments called with cityId: ${cityId}, isLocalData: ${isLocalData}`);
  
  // If this is not local data, return original times without adjustments
  if (!isLocalData) {
    console.log('Not local data, returning original times');
    return { ...times };
  }

  // For Doha: Use local CSV times as-is (no adjustments)
  if (cityId === 'doha') {
    console.log('Doha detected: Using local CSV times as-is (no adjustments)');
    return { ...times };
  }

  // Define city-specific adjustments for local data
  const cityAdjustments = {
    'abu-samra': {
      Fajr: 5,    // +5 minutes
      Maghrib: 1  // +1 minute
    },
    'dukhan': {
      Fajr: 3,    // +3 minutes
      Maghrib: 3  // +3 minutes
    },
    'alshamal': {
      Fajr: -1,   // -1 minute
      Maghrib: 2  // +2 minutes
    }
  };

  const adjustments = cityAdjustments[cityId];
  
  // If no adjustments defined for this city, return original times
  if (!adjustments) {
    console.log(`No adjustments defined for city: ${cityId}, returning original times`);
    return { ...times };
  }

  console.log(`Applying adjustments for ${cityId}:`, adjustments);
  const result = { ...times };
  
  // Apply Fajr adjustment if defined
  if (adjustments.Fajr && result.Fajr) {
    const fajrMinutes = timeToMinutes(result.Fajr);
    const originalFajr = result.Fajr;
    result.Fajr = minutesToTime(fajrMinutes + adjustments.Fajr);
    console.log(`Fajr adjusted: ${originalFajr} -> ${result.Fajr} (${adjustments.Fajr > 0 ? '+' : ''}${adjustments.Fajr} min)`);
  }
  
  // Apply Maghrib adjustment if defined
  if (adjustments.Maghrib && result.Maghrib) {
    const maghribMinutes = timeToMinutes(result.Maghrib);
    const originalMaghrib = result.Maghrib;
    result.Maghrib = minutesToTime(maghribMinutes + adjustments.Maghrib);
    console.log(`Maghrib adjusted: ${originalMaghrib} -> ${result.Maghrib} (${adjustments.Maghrib > 0 ? '+' : ''}${adjustments.Maghrib} min)`);
  }
  
  console.log('Final adjusted times:', result);
  return result;
}

/**
 * Extract city ID from region ID
 * @param {string} regionId - The full region ID (e.g., 'qatar-qatar-doha')
 * @returns {string} The city ID (e.g., 'doha')
 */
export function extractCityIdFromRegionId(regionId) {
  console.log(`extractCityIdFromRegionId called with regionId: ${regionId}`);
  
  if (!regionId || typeof regionId !== 'string') {
    console.log('Invalid regionId, defaulting to doha');
    return 'doha'; // Default to doha
  }
  
  // Handle specific known region IDs directly first
  const regionMappings = {
    'qatar-qatar-doha': 'doha',
    'qatar-qatar-abu-samra': 'abu-samra',
    'qatar-qatar-dukhan': 'dukhan',
    'qatar-qatar-alshamal': 'alshamal'
  };
  
  // Check for direct mapping first
  if (regionMappings[regionId]) {
    const cityId = regionMappings[regionId];
    console.log(`Direct mapping found: ${regionId} -> ${cityId}`);
    return cityId;
  }
  
  // Fallback: Split by dashes and get the last part(s)
  const parts = regionId.split('-');
  let cityId;
  
  // Special handling for multi-word cities like 'abu-samra'
  if (parts.length >= 3 && parts[parts.length - 2] === 'abu') {
    cityId = `${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
  } else {
    cityId = parts[parts.length - 1] || 'doha';
  }
  
  // Handle specific mappings for city names
  const cityMappings = {
    'abu-samra': 'abu-samra',
    'abusamra': 'abu-samra',
    'dukhan': 'dukhan',
    'alshamal': 'alshamal',
    'al-shamal': 'alshamal',
    'doha': 'doha'
  };
  
  // Check if we have a specific mapping
  if (cityMappings[cityId.toLowerCase()]) {
    cityId = cityMappings[cityId.toLowerCase()];
  }
  
  console.log(`Extracted city ID: ${cityId} from region ID: ${regionId}`);
  return cityId;
}
