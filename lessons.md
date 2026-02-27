# Lessons Learned

This document tracks mistakes made during development and how to avoid them in the future.

---

## 2026-02-24: Light Mode Contrast Issues with Pure White Surfaces

### The Mistake
When creating light themes, using `surface.primary: '#FFFFFF'` (pure white) for cards and containers on warm cream backgrounds (like `#FAF8F3` or `#F8F5F0`) creates harsh contrast. The white boxes "pop" too much and look out of place.

Additionally, using `withAlpha(colors.surface.primary, 0.7)` (70% opaque white) or similar transparent overlays still results in washed-out, low-contrast appearances on light backgrounds.

### Files Affected
- `app/(tabs)/index.tsx` - Date navigation, prayer times container, prayer items
- `app/(tabs)/dua.tsx` - Dua cards
- `app/(tabs)/qibla.tsx` - Compass cards
- `app/(tabs)/quran.tsx` - Surah cards, search container
- `app/(tabs)/settings.tsx` - Section cards, option containers

### The Fix
For **light mode** card backgrounds, use the theme's **background.secondary** or **background.tertiary** colors instead of **surface.primary**. These warmer colors blend better with the themed backgrounds:

```tsx
// ❌ Bad: Pure white or transparent white on warm backgrounds
const cardBg = isDark ? ... : withAlpha(colors.surface.primary, 0.7);
const cardBg = isDark ? ... : colors.surface.primary;

// ✅ Good: Use warmer background colors for light mode
const cardBg = isDark ? withAlpha(colors.surface.primary, 0.04) : colors.background.secondary;
backgroundColor: isDark ? C.surface.primary : C.background.secondary
```

### Prevention Strategy
When implementing light themes:
1. **Never use `surface.primary` (#FFFFFF) directly for cards** in light mode - always use conditional logic
2. **Use `background.secondary` or `background.tertiary`** for card backgrounds in light mode
3. **Test new themes visually** on actual device before considering work complete
4. **Review the color hierarchy**: `background.primary` → `background.secondary` → `background.tertiary` for increasing depth

### Theme Color Hierarchy (Light Mode)
```
background.primary  - Main page background (lightest)
background.secondary - Cards, containers (slightly darker, warm tint)
background.tertiary - Nested cards, items (darker still)
surface.primary     - Reserved for pure white elements only (rarely appropriate in light mode)
```
