/**
 * Sepia Color Palette for Prayer Times App
 * A very light sepia theme inspired by old parchment and warm earth tones
 */

export const SepiaColors = {
  // Primary background colors
  background: {
    primary: '#FAF7F0',      // Very light cream/sepia
    secondary: '#F5F2E8',    // Slightly warmer cream
    tertiary: '#F0EDE0',     // Light beige
    overlay: 'rgba(240, 237, 224, 0.95)', // Semi-transparent overlay
  },
  
  // Card and container backgrounds
  surface: {
    primary: '#F5F2E8',      // Light cream for cards
    secondary: '#EDE9DC',    // Slightly darker cream
    elevated: '#F8F5ED',     // Elevated surfaces
    transparent: 'rgba(245, 242, 232, 0.8)', // Semi-transparent surfaces
  },
  
  // Text colors
  text: {
    primary: '#3D3425',      // Dark brown for main text
    secondary: '#5A4F3A',    // Medium brown for secondary text
    tertiary: '#8B7355',     // Light brown for subtle text
    inverse: '#FAF7F0',      // Light text on dark backgrounds
    muted: '#9B8B73',        // Muted text
  },
  
  // Accent colors
  accent: {
    gold: '#D4AF37',         // Warm gold for highlights
    darkGold: '#B8941F',     // Darker gold for active states
    amber: '#E6C547',        // Light amber
    copper: '#B87333',       // Copper accent
  },
  
  // Border colors
  border: {
    light: 'rgba(139, 115, 85, 0.15)',    // Very subtle borders
    medium: 'rgba(139, 115, 85, 0.25)',   // Medium borders
    dark: 'rgba(139, 115, 85, 0.4)',      // Darker borders
    accent: 'rgba(212, 175, 55, 0.3)',    // Gold accent borders
  },
  
  // Shadow colors
  shadow: {
    light: 'rgba(61, 52, 37, 0.1)',       // Light shadows
    medium: 'rgba(61, 52, 37, 0.15)',     // Medium shadows
    dark: 'rgba(61, 52, 37, 0.25)',       // Dark shadows
  },
  
  // Status colors (keeping some color for important states)
  status: {
    success: '#8FBC8F',      // Muted sage green
    warning: '#DEB887',      // Burlywood
    error: '#CD853F',        // Peru/brown for errors
    info: '#B8941F',         // Dark gold for info
  },
  
  // Special elements
  special: {
    nextPrayer: '#D4AF37',   // Gold for next prayer highlight
    active: '#B8941F',       // Dark gold for active states
    disabled: '#C4B299',     // Muted beige for disabled states
    highlight: 'rgba(212, 175, 55, 0.2)', // Gold highlight overlay
  }
};

export default SepiaColors;
