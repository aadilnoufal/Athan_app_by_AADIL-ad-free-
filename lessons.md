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

---

## 2025-02-27: Jest mock hoisting + useEffect race conditions

### The Mistake (1): Jest-expo mock variable hoisting

With `jest-expo` preset, declaring `const mockFn = jest.fn()` before `jest.mock()` and referencing `mockFn` inside the factory FAILS — the variable is `undefined` when the factory runs due to hoisting.

### The Fix (1)

Use inline `jest.fn()` inside `jest.mock()` factories, then get references via `jest.requireMock()`:

```ts
jest.mock("../someModule", () => ({
  myFn: jest.fn().mockResolvedValue("default"),
}));
const someModule = jest.requireMock("../someModule");
// Later: expect(someModule.myFn).toHaveBeenCalled();
```

### The Mistake (2): useEffect async race condition in tests

When a hook has a `useEffect` that loads state from async storage, calling a handler function before that useEffect resolves causes a race. The useEffect's state updates resolve DURING the handler's `act()` block, resetting state back to the loaded defaults.

### The Fix (2)

Always `await waitFor()` for the initial state to load before calling any handler:

```ts
const { result } = renderHook(() => useMyHook());
await waitFor(() => {
  expect(result.current.value).toBe("loaded");
});
// NOW safe to call handlers
await act(async () => {
  await result.current.handleChange("new");
});
expect(result.current.value).toBe("new");
```

### Prevention Strategy

- Never use `const mock = jest.fn()` + reference in `jest.mock()` factory with jest-expo
- Always verify mock function names match actual exports (grep the hook source)
- Always wait for useEffect to complete before testing handler state changes

### The Mistake

When extracting notification code from `settings.tsx` into `useSettingsNotifications`, I removed `StyleSheet` from the `react-native` import block because it wasn't used in the notification code. However, `StyleSheet.absoluteFillObject` was still used in the JSX of settings.tsx, causing a type error.

### The Fix

Added `StyleSheet` back to the import list.

### Prevention Strategy

Before removing any import during a refactor, **always grep** for every symbol being removed to ensure it isn't used elsewhere in the file. Use `grep_search` with the exact symbol name scoped to the specific file.

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

---

## 2026-02-27: React act() batching with state setters

### The Mistake

When testing day navigation in `useHomePrayerData`, calling `goToNextDay()` multiple times inside a single `act()` block only increments `currentDay` by 1 instead of N. This is because React batches the `setCurrentDay` calls and each call reads the stale closure value (always 0).

```ts
// ❌ Bad: all calls read stale `currentDay` = 0, result = 1
act(() => {
  result.current.goToNextDay(); // 0 → 1
  result.current.goToNextDay(); // 0 → 1 (stale!)
  result.current.goToNextDay(); // 0 → 1 (stale!)
});
```

### The Fix

Use separate `act()` calls for each state update so React flushes between them:

```ts
// ✅ Good: each call sees updated state
act(() => {
  result.current.goToNextDay();
}); // 0 → 1
act(() => {
  result.current.goToNextDay();
}); // 1 → 2
act(() => {
  result.current.goToNextDay();
}); // 2 → 3
```

### Prevention Strategy

- When testing functions that depend on prior state updates, always use separate `act()` blocks
- Use `jest.useFakeTimers()` + `jest.clearAllTimers()` in afterEach when hooks have `setInterval`/`setTimeout` to prevent timer leaks and "Cannot log after tests are done" warnings

---

## 2026-02-27: Never jest.mock('react-native') with requireActual Spread

### The Mistake

When writing tests for `useQuranData` and `useQuranAudio`, I used:

```ts
jest.mock("react-native", () => {
  const RN = jest.requireActual("react-native");
  return { ...RN, Keyboard: { dismiss: jest.fn() } };
});
```

This triggered `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'DevMenu' could not be found` because spreading `jest.requireActual('react-native')` forces initialization of all native TurboModules, which fail in the Jest test environment.

### The Fix

Import the needed module normally, then use `jest.spyOn()` at the top level:

```ts
import { Keyboard, Alert } from "react-native";

jest.spyOn(Keyboard, "dismiss").mockImplementation(() => true as any);
jest.spyOn(Alert, "alert").mockImplementation(() => {});
```

### Prevention Strategy

- **NEVER** use `jest.mock('react-native', () => ...)` in this project
- Always import from `react-native` normally and spy on individual methods
- Look at existing passing tests (e.g., `useSettingsDonation.test.ts`) for the correct pattern

---

## 2026-02-27: Multi-Feature Implementation — Careful Prop Drilling

### The Lesson

When adding new features that span multiple layers (hook → screen → component), always:

1. Update the hook to expose new state/handlers
2. Update the component's interface/props
3. Update the screen that connects them to pass the new props

Missing any layer silently fails — TypeScript may not catch missing optional props.

### Example: Iqama Notification Settings

- Hook (`useSettingsNotifications.ts`): Added `iqamaNotificationsEnabled`, `iqamaNotificationSettings`, etc.
- Component (`NotificationSection.tsx`): Updated interface + JSX
- Screen (`settings.tsx`): Must destructure from hook AND pass to component — easy to forget one

---

## 2026-02-28: Alef Wasla (ٱ) Renders Incorrectly on Android

### The Mistake

Using the Unicode character Alef Wasla (ٱ, U+0671) in Arabic text strings. Android's default font (or many Arabic fonts) truncates or fails to render text containing this character. The string "بِسْمِ ٱللَّهِ" was rendering as just "بسم" on Android devices, making it appear as though only the first word was shown.

This was initially misdiagnosed as a cache/build issue across multiple sessions, wasting significant debugging time.

### The Fix

Replace Alef Wasla (ٱ) with standard Alif (ا) in all user-facing Arabic strings:

```
// ❌ Bad: Uses Alef Wasla (ٱ) — breaks on Android
'بِسْمِ ٱللَّهِ'

// ✅ Good: Uses standard Alif (ا) — works everywhere
'بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ'
```

### Prevention

- Always test Arabic text rendering on actual Android devices
- Avoid Unicode characters that look identical in editors but differ in font support (ٱ vs ا)
- If Arabic text appears truncated on Android, inspect for unusual Unicode codepoints first

---

## 2026-02-27: NativeModules Destructuring Breaks Jest Tests

### The Mistake

Destructuring `NativeModules` at the top level of a module (`const { WidgetDataModule } = NativeModules;`) captures the reference at import time. In Jest, this runs before any test setup code, so mock assignments to `NativeModules.WidgetDataModule` in `beforeEach` or even `jest.mock` factories may not be reflected in the captured variable.

### The Solution

Use lazy accessor functions instead of top-level destructuring:

```typescript
// ❌ BAD: captured at import time, before jest mocks are set up
const { WidgetDataModule } = NativeModules;

// ✅ GOOD: resolved at call time, picks up jest mocks
function getWidgetDataModule() {
  return NativeModules.WidgetDataModule;
}
```

### Files Affected

- `utils/widgetDataBridge.ts` — Changed to lazy accessor pattern for both `WidgetDataModule` and `WidgetDataModuleIOS`

### Prevention

- Never destructure `NativeModules` at the top level of files that need to be tested
- Use lazy accessor functions for any module that needs runtime resolution
- Test native module interactions early to catch this pattern
