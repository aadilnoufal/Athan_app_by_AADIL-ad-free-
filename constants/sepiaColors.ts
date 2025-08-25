/**
 * Sepia Color Palette for Prayer Times App
 * A very light sepia theme inspired by old parchment and warm earth tones
 */

export const SepiaColors = {
  // Primary background colors - Even lighter sepia tones
  background: {
    primary: '#FBF7EE',      // Slightly deeper cream (was #FEFCF6)
    secondary: '#F9F4E9',    // Warm cream (was #FDFAF2)
    tertiary: '#F4EEDD',     // Deeper warm beige (was #FBF8F0)
    overlay: 'rgba(249, 244, 233, 0.95)', // Adjusted to match new base
  },
  
  // Card and container backgrounds - Lighter sepia surfaces
  surface: {
    primary: '#F9F4E9',      // Match background.secondary (slightly darker)
    secondary: '#F2E9D8',    // Darkened ~4% (was #F8F5E8)
    elevated: '#FBF7EE',     // Align with new background.primary
    transparent: 'rgba(249, 244, 233, 0.85)', // Updated tint
  },
  
  // Text colors - Warmer sepia tones
  text: {
    primary: '#463A28',      // Slightly deeper (was #4A3E2A -> actually lighten? keep close) adjusted for contrast
    secondary: '#615238',    // Darkened (was #6B5B42)
    tertiary: '#7E6F51',     // Darkened (was #8B7B5C)
    inverse: '#FBF7EE',      // Updated inverse to new light base
    muted: '#9C8A69',        // Slightly toned to match darker base
  },
  
  // Accent colors - Lighter, more golden sepia accents
  accent: {
    gold: '#DDB842',         // Slightly deeper gold
    darkGold: '#C6A330',     // Darkened
    amber: '#E9CC5C',        // Deeper amber
    copper: '#C89563',       // Darker copper
  },
  
  // Border colors - Softer, lighter borders
  border: {
    light: 'rgba(110, 96, 70, 0.14)',    // Slightly stronger
    medium: 'rgba(110, 96, 70, 0.24)',   // Adjusted
    dark: 'rgba(110, 96, 70, 0.34)',     // Slightly deeper
    accent: 'rgba(221, 184, 66, 0.30)',  // Match new gold tone
  },
  
  // Shadow colors - Softer shadows
  shadow: {
    light: 'rgba(70, 58, 40, 0.10)',      // Slightly stronger
    medium: 'rgba(70, 58, 40, 0.16)',     // Increased
    dark: 'rgba(70, 58, 40, 0.22)',       // Increased
  },
  
  // Status colors - Light sepia-toned status colors
  status: {
    success: '#9AB894',      // Slightly deeper
    warning: '#DCC48F',      // Darker
    error: '#C48F60',        // Deeper brown
    info: '#C6A330',         // Match darkGold
  },
  
  // Special elements - Lighter sepia special colors
  special: {
    nextPrayer: '#DDB842',   // Updated gold
    active: '#C6A330',       // Updated dark gold
    disabled: '#CBB994',     // Slightly deeper beige
    highlight: 'rgba(221, 184, 66, 0.18)', // Slightly stronger overlay
  }
};

export default SepiaColors;
