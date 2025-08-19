/**
 * Sepia Color Palette for Prayer Times App
 * A very light sepia theme inspired by old parchment and warm earth tones
 */

export const SepiaColors = {
  // Primary background colors - Even lighter sepia tones
  background: {
    primary: '#FEFCF6',      // Ultra light cream/sepia
    secondary: '#FDFAF2',    // Very light warm cream
    tertiary: '#FBF8F0',     // Light warm beige
    overlay: 'rgba(253, 250, 242, 0.95)', // Semi-transparent overlay
  },
  
  // Card and container backgrounds - Lighter sepia surfaces
  surface: {
    primary: '#FDFAF2',      // Very light cream for cards
    secondary: '#F8F5E8',    // Light cream with slight sepia
    elevated: '#FEFCF6',     // Elevated surfaces - even lighter
    transparent: 'rgba(253, 250, 242, 0.85)', // Semi-transparent surfaces
  },
  
  // Text colors - Warmer sepia tones
  text: {
    primary: '#4A3E2A',      // Warm dark brown for main text
    secondary: '#6B5B42',    // Warm medium brown for secondary text
    tertiary: '#8B7B5C',     // Warm light brown for subtle text
    inverse: '#FEFCF6',      // Light text on dark backgrounds
    muted: '#A89775',        // Warm muted text
  },
  
  // Accent colors - Lighter, more golden sepia accents
  accent: {
    gold: '#E6C547',         // Lighter warm gold for highlights
    darkGold: '#D4B335',     // Softer dark gold for active states
    amber: '#F2D865',        // Light warm amber
    copper: '#D4A574',       // Lighter copper accent
  },
  
  // Border colors - Softer, lighter borders
  border: {
    light: 'rgba(139, 123, 92, 0.12)',    // Very subtle borders
    medium: 'rgba(139, 123, 92, 0.20)',   // Light medium borders
    dark: 'rgba(139, 123, 92, 0.30)',     // Softer dark borders
    accent: 'rgba(230, 197, 71, 0.25)',   // Light gold accent borders
  },
  
  // Shadow colors - Softer shadows
  shadow: {
    light: 'rgba(74, 62, 42, 0.08)',      // Very light shadows
    medium: 'rgba(74, 62, 42, 0.12)',     // Light medium shadows
    dark: 'rgba(74, 62, 42, 0.18)',       // Soft dark shadows
  },
  
  // Status colors - Light sepia-toned status colors
  status: {
    success: '#A8C4A2',      // Light sage green with sepia tone
    warning: '#E6D4A1',      // Light warm burlywood
    error: '#D4A574',        // Light warm brown for errors
    info: '#D4B335',         // Light gold for info
  },
  
  // Special elements - Lighter sepia special colors
  special: {
    nextPrayer: '#E6C547',   // Light gold for next prayer highlight
    active: '#D4B335',       // Light gold for active states
    disabled: '#D6C7A8',     // Light muted beige for disabled states
    highlight: 'rgba(230, 197, 71, 0.15)', // Very light gold highlight overlay
  }
};

export default SepiaColors;
