// This file defines the prayer time calculation configuration for different regions

// Define the configuration type for a location
export interface RegionConfig {
  id: string;
  name: string;
  location: string; // Location string for the API
  method: number;   // Calculation method number
  tuningParams: string; // Tuning parameters
}

// Define the city structure
export interface City {
  id: string;
  name: string;
  config: RegionConfig;
}

// Define the state structure
export interface State {
  id: string;
  name: string;
  cities: City[];
}

// Define the country structure
export interface Country {
  id: string;
  name: string;
  states: State[];
}

// Default region ID will be Qatar > Qatar > Doha
export const DEFAULT_REGION = 'qatar-qatar-doha';

// Configuration for Qatar cities
const QATAR_CITIES: City[] = [
  {
    id: 'doha',
    name: 'Doha',
    config: {
      id: 'qatar-qatar-doha',
      name: 'Doha, Qatar',
      location: 'Qatar',
      method: 10, // Umm al-Qura University, Makkah
      tuningParams: '0,-2,-2,-2,-1,0,-1,-1,0'
    }
  },
  {
    id: 'abu-samra',
    name: 'Abu Samra',
    config: {
      id: 'qatar-qatar-abu-samra',
      name: 'Abu Samra, Qatar',
      location: 'Qatar',
      method: 10,
      tuningParams: '0,2,-2,-2,0,0,2,1,0' // Same tuning for now
    }
  },
  {
    id: 'dukhan',
    name: 'Dukhan',
    config: {
      id: 'qatar-qatar-dukhan',
      name: 'Dukhan, Qatar',
      location: 'Qatar',
      method: 10,
      tuningParams: '0,2,-2,-2,0,0,3,1,0' // Same tuning for now
    }
  },
  {
    id: 'alshamal',
    name: 'Al Shamal',
    config: {
      id: 'qatar-qatar-alshamal',
      name: 'Al Shamal, Qatar',
      location: 'Qatar',
      method: 10,
      tuningParams: '0,0,-2,-2,0,0,1,1,0' // Same tuning for now
    }
  }
];

// Define all available countries
const COUNTRIES: Country[] = [
  {
    id: 'qatar',
    name: 'Qatar',
    states: [
      {
        id: 'qatar',
        name: 'Qatar',
        cities: QATAR_CITIES
      }
    ]
  }
];

// Get all available countries
export function getAvailableCountries(): Country[] {
  return COUNTRIES;
}

// Get states for a specific country
export function getStatesForCountry(countryId: string): State[] {
  const country = COUNTRIES.find(c => c.id === countryId);
  return country ? country.states : [];
}

// Get cities for a specific state in a country
export function getCitiesForState(countryId: string, stateId: string): City[] {
  const country = COUNTRIES.find(c => c.id === countryId);
  if (!country) return [];
  
  const state = country.states.find(s => s.id === stateId);
  return state ? state.cities : [];
}

// Get all available regions (for backwards compatibility)
export function getAvailableRegions(): RegionConfig[] {
  // Flatten the hierarchical structure to a list of regions
  return COUNTRIES.flatMap(country => 
    country.states.flatMap(state => 
      state.cities.map(city => city.config)
    )
  );
}

// Parse a region ID into its components
export function parseRegionId(regionId: string): { countryId: string, stateId: string, cityId: string } {
  const parts = regionId.split('-');
  return {
    countryId: parts[0] || '',
    stateId: parts[1] || '',
    cityId: parts[2] || ''
  };
}

// Get configuration for a specific region
export function getRegionConfig(regionId: string): RegionConfig | null {
  // For backward compatibility, check if it's a legacy region ID
  const region = getAvailableRegions().find(r => r.id === regionId);
  if (region) return region;
  
  // Parse the region ID into components
  const { countryId, stateId, cityId } = parseRegionId(regionId);
  
  const country = COUNTRIES.find(c => c.id === countryId);
  if (!country) return null;
  
  const state = country.states.find(s => s.id === stateId);
  if (!state) return null;
  
  const city = state.cities.find(c => c.id === cityId);
  return city ? city.config : null;
}

// Get the default region configuration
export function getDefaultRegionConfig(): RegionConfig {
  const config = getRegionConfig(DEFAULT_REGION);
  if (!config) {
    throw new Error(`Default region ${DEFAULT_REGION} not found in configuration`);
  }
  return config;
}

// Adding a default export to satisfy Expo Router requirements
export default {
  getAvailableCountries,
  getStatesForCountry,
  getCitiesForState,
  getAvailableRegions,
  parseRegionId,
  getRegionConfig,
  getDefaultRegionConfig,
  DEFAULT_REGION
};
