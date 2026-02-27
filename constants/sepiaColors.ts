/**
 * Luxurious Light Theme (formerly Sepia)
 * A clean, modern, luxurious light theme with gold accents
 */

export const SepiaColors = {
  // Primary background colors
  background: {
    primary: '#FCFBF9',      // Pearl white
    secondary: '#F4F2EC',    // Soft ivory
    tertiary: '#EAE7DF',     // Warm gray/beige
    overlay: 'rgba(252, 251, 249, 0.95)',
  },

  // Card and container backgrounds
  surface: {
    primary: '#FFFFFF',      // Pure white for cards to pop
    secondary: '#F4F2EC',
    elevated: '#FFFFFF',
    transparent: 'rgba(255, 255, 255, 0.85)',
  },

  // Text colors
  text: {
    primary: '#2D2824',      // Deep warm charcoal
    secondary: '#5C544D',    // Medium warm gray
    tertiary: '#8C8278',     // Light warm gray
    inverse: '#FFFFFF',
    muted: '#B3A89E',
  },

  // Accent colors
  accent: {
    gold: '#D4AF37',         // Metallic Gold
    darkGold: '#AA8C2C',
    amber: '#E5C158',
    copper: '#B87333',
  },

  // Border colors
  border: {
    light: 'rgba(45, 40, 36, 0.08)',
    medium: 'rgba(45, 40, 36, 0.15)',
    dark: 'rgba(45, 40, 36, 0.25)',
    accent: 'rgba(212, 175, 55, 0.30)',
  },

  // Shadow colors
  shadow: {
    light: 'rgba(45, 40, 36, 0.06)',
    medium: 'rgba(45, 40, 36, 0.12)',
    dark: 'rgba(45, 40, 36, 0.18)',
  },

  // Status colors
  status: {
    success: '#4CAF50',
    warning: '#D4AF37',
    error: '#B85C5C',
    info: '#5C8EB8',
  },

  // Special elements
  special: {
    nextPrayer: '#D4AF37',
    active: '#AA8C2C',
    disabled: '#D9D4CC',
    highlight: 'rgba(212, 175, 55, 0.15)',
  },

  // Extended overlay tokens
  overlay: {
    subtle: 'rgba(45, 40, 36, 0.03)',
    medium: 'rgba(45, 40, 36, 0.06)',
    strong: 'rgba(45, 40, 36, 0.10)',
    card: 'rgba(255, 255, 255, 0.92)',
    gold: 'rgba(212, 175, 55, 0.12)',
  },

  // Prayer-specific notification colors
  prayer: {
    fajr: '#5C8EB8',         // Dawn blue
    sunrise: '#E5A840',      // Sunrise orange-gold
    default: '#4CAF50',      // Prayer green
  },
};

export default SepiaColors;
