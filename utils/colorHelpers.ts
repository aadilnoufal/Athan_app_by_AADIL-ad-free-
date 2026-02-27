/**
 * Centralized Color Utilities
 * 
 * Use these helpers instead of hardcoding rgba() values throughout the app.
 * This ensures consistency and makes theme switching work correctly.
 */

/**
 * Convert a hex color to rgba with specified alpha
 * @param hex - Color in hex format (#RRGGBB or #RGB)
 * @param alpha - Opacity value from 0 to 1
 * @returns rgba string
 * 
 * @example
 * withAlpha('#D4AF37', 0.5) // returns 'rgba(212, 175, 55, 0.5)'
 */
export function withAlpha(hex: string, alpha: number): string {
    // Handle already-rgba strings
    if (hex.startsWith('rgba')) {
        // Extract RGB and replace alpha
        const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (match) {
            return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
        }
        return hex;
    }

    // Handle rgb strings
    if (hex.startsWith('rgb(')) {
        const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
        }
        return hex;
    }

    // Remove # if present
    const cleanHex = hex.replace('#', '');

    // Handle shorthand (#RGB)
    let r: number, g: number, b: number;
    if (cleanHex.length === 3) {
        r = parseInt(cleanHex[0] + cleanHex[0], 16);
        g = parseInt(cleanHex[1] + cleanHex[1], 16);
        b = parseInt(cleanHex[2] + cleanHex[2], 16);
    } else {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
    }

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get theme-aware gold color with alpha
 * Use this instead of hardcoding rgba(218, 165, 32, X)
 * 
 * @param alpha - Opacity value from 0 to 1
 * @param colors - Theme colors object from useTheme()
 * @returns rgba string using theme's gold color
 * 
 * @example
 * const { colors } = useTheme();
 * goldTint(0.2, colors) // returns theme-appropriate gold with 20% opacity
 */
export function goldTint(alpha: number, colors: { accent: { gold: string } }): string {
    return withAlpha(colors.accent.gold, alpha);
}

/**
 * Get a subtle overlay color appropriate for the theme
 * Use for card backgrounds, hover states, etc.
 * 
 * @param alpha - Opacity value from 0 to 1
 * @param isDark - Whether dark mode is active
 * @param colors - Theme colors object
 * @returns rgba string
 */
export function subtleOverlay(alpha: number, isDark: boolean, colors: { surface: { primary: string }, text: { primary: string } }): string {
    if (isDark) {
        // In dark mode, use white for subtle overlays
        return `rgba(255, 255, 255, ${alpha})`;
    } else {
        // In light mode, use the text primary color for subtle depth
        return withAlpha(colors.text.primary, alpha * 0.5); // Reduce intensity for light mode
    }
}

/**
 * Get time-based gradient colors for backgrounds
 * Replaces the duplicate getTimeBasedGradient() functions across files
 * 
 * @param colors - Theme colors object
 * @param isDark - Whether dark mode is active
 * @returns Array of 3 gradient colors [start, middle, end]
 */
export function getTimeBasedGradientColors(
    colors: { background: { primary: string; secondary: string; tertiary: string } },
    isDark: boolean
): [string, string, string] {
    // For dark mode or any theme, use the theme's background colors
    return [
        colors.background.primary,
        colors.background.secondary,
        colors.background.tertiary,
    ];
}

/**
 * Parse an rgba string into components
 * Useful for debugging or when you need to manipulate existing colors
 */
export function parseRGBA(rgbaString: string): { r: number; g: number; b: number; a: number } | null {
    const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) return null;
    return {
        r: parseInt(match[1], 10),
        g: parseInt(match[2], 10),
        b: parseInt(match[3], 10),
        a: match[4] ? parseFloat(match[4]) : 1,
    };
}

/**
 * Lighten a hex color by a percentage
 * @param hex - Color in hex format
 * @param percent - Amount to lighten (0-100)
 */
export function lighten(hex: string, percent: number): string {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Darken a hex color by a percentage
 * @param hex - Color in hex format
 * @param percent - Amount to darken (0-100)
 */
export function darken(hex: string, percent: number): string {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

// Type definitions for theme color structure
export interface ThemeColors {
    background: {
        primary: string;
        secondary: string;
        tertiary: string;
        overlay: string;
    };
    surface: {
        primary: string;
        secondary: string;
        elevated: string;
        transparent: string;
    };
    text: {
        primary: string;
        secondary: string;
        tertiary: string;
        inverse: string;
        muted: string;
    };
    accent: {
        gold: string;
        darkGold: string;
        amber: string;
        copper: string;
    };
    border: {
        light: string;
        medium: string;
        dark: string;
        accent: string;
    };
    shadow: {
        light: string;
        medium: string;
        dark: string;
    };
    status: {
        success: string;
        warning: string;
        error: string;
        info: string;
    };
    special: {
        nextPrayer: string;
        active: string;
        disabled: string;
        highlight: string;
    };
    // Extended tokens for overlays and tints (optional - themes can omit these)
    overlay?: {
        subtle: string;
        medium: string;
        strong: string;
        card: string;
        gold: string;
    };
    prayer?: {
        fajr: string;
        sunrise: string;
        default: string;
    };
}
