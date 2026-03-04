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

## 2026-02-28: WidgetKit Timeline Pre-rendering — Date() is Wrong

### The Mistake

In iOS WidgetKit, `getTimeline()` creates multiple entries (e.g. 60 entries, one per minute). The SwiftUI views for ALL entries are pre-rendered at timeline creation time — NOT when each entry is displayed. Using `Date()` inside a computed property or view body gives the current time at creation, not the entry's scheduled display time.

This means all 60 timeline entries showed identical countdown values (the countdown at minute 0), making the widget appear frozen until the next timeline refresh.

### Files Affected

- `ios-widget/WidgetDataProvider.swift` — `nextPrayer` computed property used `Date()`
- `ios-widget/PrayerTimesWidgetViews.swift` — views didn't pass `entry.date`

### The Fix

Changed `nextPrayer` from a computed property to a method that accepts a `referenceDate` parameter. Views now pass `entry.date`:

```swift
// ❌ Bad: Always uses "now" — wrong for pre-rendered entries
var nextPrayer: ... { let currentMinutes = Calendar.current.component(.hour, from: Date()) * 60 ... }

// ✅ Good: Uses the entry's scheduled date
func nextPrayer(at referenceDate: Date = Date()) -> ... { let currentMinutes = cal.component(.hour, from: referenceDate) * 60 ... }
// In views: entry.data?.nextPrayer(at: entry.date)
```

### Prevention

- In WidgetKit timeline providers, NEVER use `Date()` inside views or data models
- Always thread `entry.date` through to any time-dependent computation
- Remember: WidgetKit renders views as static images at timeline creation time

## 2026-02-28: Expo Config Plugin — Files Copied but Not Compiled

### The Mistake

The config plugin used `fs.copyFileSync()` to copy native module files (`.swift`, `.m`) into the iOS project directory, but never called `xcodeProject.addSourceFile()` to register them in the Xcode project's compile sources. The files existed on disk but Xcode didn't know about them, so they wouldn't compile during EAS Build.

Similarly, the "Embed App Extensions" build phase was created empty — the `.appex` product reference was never added, so the widget extension wouldn't be bundled into the final IPA.

### The Fix

1. Moved native module file operations into the `withXcodeProject` step (where `xcodeProject` is available)
2. Called `xcodeProject.addSourceFile()` for each `.swift` and `.m` file
3. Added the `.appex` product reference to the embed phase with `RemoveHeadersOnCopy` attribute

### Prevention

- When using Expo config plugins that add native files, always verify they're added to BOTH disk AND Xcode project
- Test with `expo prebuild` and inspect the generated `.xcodeproj` to verify files appear in build phases
- `withDangerousMod` only gives filesystem access — for Xcode project manipulation, use `withXcodeProject`

---

## 2026-02-28: React Anti-Patterns Found During Phase 8 Deep Audit

### IIFE Side-Effects During Render

**The Mistake:** Using an IIFE in JSX `{condition && (() => { doSomething(); return null; })()}` to trigger side effects. This runs during React's render phase, causing state updates during render — React's "Cannot update a component while rendering" warning and potential infinite loops.

**The Fix:** Move side effects to `useEffect`:

```tsx
// ❌ Bad: Side effect during render
{
  shouldDoThing &&
    (() => {
      doThing();
      return null;
    })();
}

// ✅ Good: useEffect for side effects
useEffect(() => {
  if (shouldDoThing) doThing();
}, [shouldDoThing]);
```

### State as Effect Dependency Causing Listener Churn

**The Mistake:** Using state (`const [lastX, setLastX] = useState(0)`) as an effect dependency for subscriber setup. Every time the state updates (e.g., on notification receipt), the effect re-runs — tearing down and re-subscribing the listener. This causes missed events during the teardown gap.

**The Fix:** Use `useRef` for values needed inside effects but that shouldn't trigger re-subscription:

```tsx
// ❌ Bad: listener torn down on every notification
const [lastReceivedAt, setLastReceivedAt] = useState(0);
useEffect(() => {
  const unsub = subscribe((event) => {
    setLastReceivedAt(Date.now());
  });
  return unsub;
}, [lastReceivedAt]); // ← re-runs on every notification!

// ✅ Good: listener stays alive
const lastReceivedAtRef = useRef(0);
useEffect(() => {
  const unsub = subscribe((event) => {
    lastReceivedAtRef.current = Date.now();
  });
  return unsub;
}, []); // ← subscribes once
```

### useCallback in setInterval Deps Causing Timer Churn

**The Mistake:** `setInterval(() => updateCountdown(), 1000)` where `updateCountdown` is a `useCallback` with deps that change every second (e.g., `countdown`). Since `updateCountdown` identity changes every second, the interval is torn down and rebuilt 86,400 times/day instead of ~6 (once per prayer transition).

**The Fix:** Use the ref-forwarding pattern:

```tsx
const updateCountdownRef = useRef<() => void>(() => {});
const updateCountdown = useCallback(() => { /* ... */ }, [countdown, ...]);
updateCountdownRef.current = updateCountdown; // sync on every render

useEffect(() => {
  const timer = setInterval(() => updateCountdownRef.current(), 1000);
  return () => clearInterval(timer);
}, [nextPrayer]); // ← stable deps, recreated only on prayer change
```

### Prevention

- Never perform side effects in JSX — always use `useEffect`
- Never use mutable state as an effect dependency for subscription setup
- When a callback's identity changes frequently but the interval/listener should be stable, use the ref-forwarding pattern
- Look for `useEffect` cleanup functions that fire too often — add `console.count('effect-name cleanup')` during debugging

---

## 2026-02-28: String.split() for Multi-Part Identifiers

### The Mistake

Using `parts[2]` to extract a city from `"qatar-qatar-abu-samra".split('-')` returns `"abu"` instead of `"abu-samra"`. Any ID containing multiple dashes after the prefix is truncated.

### The Fix

Use `parts.slice(2).join('-')` to reconstruct the full suffix:

```ts
// ❌ Bad: only gets first part after prefix
const cityId = parts[2]; // "abu" from "qatar-qatar-abu-samra"

// ✅ Good: reconstructs full suffix
const cityId = parts.slice(2).join("-"); // "abu-samra"
```

### Prevention

- When splitting compound identifiers, prefer `slice().join()` over index access for the trailing portion
- Add test cases for multi-word values whenever implementing ID parsing

---

## 2026-02-28: xcode npm Package — addTarget() Doesn't Create Build Phases or Target Dependencies

### The Mistake

The `xcode` npm package's `addTarget('app_extension')` creates a PBXNativeTarget with an **empty `buildPhases` array**. It does NOT create the standard Sources, Frameworks, or Resources build phases that Xcode targets need. When `addSourceFile()` is subsequently called targeting the widget UUID, `addToPbxSourcesBuildPhase()` calls `buildPhaseObject('PBXSourcesBuildPhase', 'Sources', widgetTargetUuid)`, which fails to find a Sources phase on the widget target. On a real project, it silently falls back to the main app target's Sources phase — meaning widget Swift files are compiled as part of the **wrong target**. On a minimal project without any Sources phase, it crashes with `Cannot read properties of null (reading 'files')`.

Additionally, `addTarget('app_extension')` only creates a "Copy Files" embed phase but does NOT create a `PBXTargetDependency`. This is only auto-created for `watch2_app` and `watch2_extension` types. Without it, Xcode might not build the extension before trying to embed it.

Finally, `addTargetDependency()` silently no-ops if the `PBXTargetDependency` and `PBXContainerItemProxy` sections don't exist in the project objects — they must be initialized as empty objects first.

### The Fix

```js
// After addTarget(), create the required build phases:
xcodeProject.addBuildPhase([], "PBXSourcesBuildPhase", "Sources", target.uuid);
xcodeProject.addBuildPhase(
  [],
  "PBXFrameworksBuildPhase",
  "Frameworks",
  target.uuid,
);
xcodeProject.addBuildPhase(
  [],
  "PBXResourcesBuildPhase",
  "Resources",
  target.uuid,
);

// Initialize dependency sections and add the target dependency:
if (!xcodeProject.hash.project.objects["PBXTargetDependency"]) {
  xcodeProject.hash.project.objects["PBXTargetDependency"] = {};
}
if (!xcodeProject.hash.project.objects["PBXContainerItemProxy"]) {
  xcodeProject.hash.project.objects["PBXContainerItemProxy"] = {};
}
xcodeProject.addTargetDependency(mainTarget.uuid, [target.uuid]);
```

### Prevention

- Never assume `addTarget()` creates build phases — always verify by reading the source code
- Write an integration test that simulates the full plugin against a parsed xcode project
- When using `addTargetDependency`, check that required sections exist first
- The `xcode` package's API is incomplete for extension targets — always read the source to understand what each function actually does vs. what you'd expect

## 2026-03-04: xcode npm Package — addSourceFile() Path Resolution with Groups

### The Mistake

When using `addSourceFile(path, opts, groupUuid)`, the `path` is resolved **relative to the group's path**, not relative to the project root. If the group has `path: 'PrayerTimesWidget'` (set by `addPbxGroup`), and you call `addSourceFile('PrayerTimesWidget/file.swift', ...)`, the resolved path becomes `PrayerTimesWidget/PrayerTimesWidget/file.swift` — double-nested and wrong.

Additionally, `addPbxGroup(files, name, path)` creates file references for ALL files in the `files` array. If you then call `addSourceFile()` for the same files, **duplicate file references** are created — one from `addPbxGroup` (correct path) and one from `addSourceFile` (potentially wrong path). The build uses the one from `addSourceFile`, which is the one with the wrong double-nested path.

### The Fix

```js
// ❌ Wrong: Double-nested path
addPbxGroup(
  [...swiftFiles, "Info.plist", "Widget.entitlements"],
  "Widget",
  "Widget",
);
addSourceFile("Widget/file.swift", { target }, groupUuid); // → Widget/Widget/file.swift

// ✅ Correct: Only non-source files in group, just filename for addSourceFile
addPbxGroup(["Info.plist", "Widget.entitlements"], "Widget", "Widget");
addSourceFile("file.swift", { target }, groupUuid); // → Widget/file.swift
```

### Prevention

- When using `addSourceFile` with a group UUID, pass only the filename, not a prefixed path
- Don't include source files in `addPbxGroup` if you plan to call `addSourceFile` for them — that creates duplicates
- `addSourceFile` already adds the file to the group AND to the build phase, so `addPbxGroup` only needs non-compiled files (Info.plist, entitlements)
