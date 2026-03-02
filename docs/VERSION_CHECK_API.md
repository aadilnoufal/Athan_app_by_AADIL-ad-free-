# Version-Check API — Setup & Implementation Guide

A lightweight, zero-cost approach to nudge users to update when a new version is available, with **zero disruption** if the endpoint is unreachable.

---

## Architecture Overview

```
┌──────────────┐     GET (on app open)      ┌────────────────────────┐
│  Prayer App  │ ─────────────────────────▶  │  Firebase Hosting /    │
│  (RN/Expo)   │ ◀───────────────────────── │  Realtime DB / RTDB   │
│              │     JSON response           │  (free tier)           │
└──────────────┘                             └────────────────────────┘
       │                                              │
       │  If unreachable / error → silently continue   │
       │  If response.latestVersion > local → show     │
       │    a skippable, friendly update banner        │
       └───────────────────────────────────────────────┘
```

---

## 1. How the App Knows Its Local Version

The app already has `expo-constants` installed. At runtime:

```ts
import Constants from "expo-constants";

// This reads "version" from app.json → currently "4.0"
const LOCAL_VERSION = Constants.expoConfig?.version ?? "0.0.0";
```

| Source                          | Value                                 |
| ------------------------------- | ------------------------------------- |
| `app.json` → `expo.version`     | `"4.0"` (you bump this every release) |
| `Constants.expoConfig?.version` | Same value at runtime                 |
| `android.versionCode`           | `90` (Play Store uses this integer)   |
| `ios.buildNumber`               | `"94"` (App Store uses this string)   |

**You only need to compare the semver string** (`"4.0"` vs `"4.1"`). The `versionCode`/`buildNumber` are for store submission, not user-facing.

---

## 2. Firebase Setup (Free Tier — Zero Cost)

You have **three options**, all free. Pick whichever you prefer:

### Option A: Firebase Realtime Database (Recommended — easiest to update)

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create a project (or use existing).
2. Go to **Realtime Database** → Create Database → Start in **locked mode**.
3. Set security rules to **public read-only**:

```json
{
  "rules": {
    "appConfig": {
      ".read": true,
      ".write": false
    }
  }
}
```

4. Add data manually in the console:

```
appConfig/
  latestVersion: "4.0"
  minRecommendedVersion: "3.8"
  updateMessage: "A new version is available with updated prayer times!"
  updateMessageAr: "يتوفر إصدار جديد بأوقات صلاة محدّثة!"
  forceUpdate: false
```

5. Your endpoint URL will be:

```
https://YOUR-PROJECT.firebaseio.com/appConfig.json
```

**To update**: Just change `latestVersion` to `"4.1"` in the Firebase console. That's it — no deploy, no code, takes 5 seconds.

### Option B: Firebase Hosting (static JSON file)

1. Install Firebase CLI: `npm install -g firebase-tools`
2. `firebase init hosting` in a separate folder
3. Create `public/version.json`:

```json
{
  "latestVersion": "4.1",
  "minRecommendedVersion": "3.8",
  "updateMessage": "A new version is available with updated prayer times!",
  "updateMessageAr": "يتوفر إصدار جديد بأوقات صلاة محدّثة!",
  "forceUpdate": false
}
```

4. `firebase deploy --only hosting`
5. URL: `https://YOUR-PROJECT.web.app/version.json`

### Option C: GitHub Gist / GitHub Pages (no Firebase needed)

Create a public Gist with the same JSON. URL will be:

```
https://gist.githubusercontent.com/YOUR_USER/GIST_ID/raw/version.json
```

⚠️ GitHub caches Gist raw content for ~5 minutes. Fine for version checks.

---

## 3. JSON Response Format

Whichever hosting you pick, the response must look like:

```json
{
  "latestVersion": "4.1",
  "minRecommendedVersion": "3.8",
  "updateMessage": "A new version with updated prayer times is available!",
  "updateMessageAr": "يتوفر إصدار جديد بأوقات صلاة محدّثة!",
  "forceUpdate": false
}
```

| Field                   | Type      | Purpose                                                                                                                                                       |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latestVersion`         | `string`  | Newest version in the stores (e.g. `"4.1"`)                                                                                                                   |
| `minRecommendedVersion` | `string`  | Oldest version you consider acceptable. If user's version is older, show stronger wording.                                                                    |
| `updateMessage`         | `string`  | English message shown in the banner                                                                                                                           |
| `updateMessageAr`       | `string`  | Arabic message shown in the banner                                                                                                                            |
| `forceUpdate`           | `boolean` | **Always keep `false`**. Reserved for extreme cases (security vulnerability). Even when `true`, the app still works — it just shows a non-dismissible banner. |

---

## 4. App-Side Implementation Plan

### 4.1 Version comparison utility

Create `utils/versionCheck.ts`:

```ts
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Configuration ──────────────────────────────────────
const VERSION_CHECK_URL = "https://YOUR-PROJECT.firebaseio.com/appConfig.json";
const STORE_URLS = {
  ios: "https://apps.apple.com/qa/app/prayer-times-by-aadil-noufal/id6751736180",
  android:
    "https://play.google.com/store/apps/details?id=com.yourcompany.prayertimes",
};
const CHECK_COOLDOWN_KEY = "version_check_last_ts";
const DISMISSED_VERSION_KEY = "version_check_dismissed";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours between checks

// ── Types ──────────────────────────────────────────────
export interface VersionInfo {
  latestVersion: string;
  minRecommendedVersion?: string;
  updateMessage?: string;
  updateMessageAr?: string;
  forceUpdate?: boolean;
}

export interface VersionCheckResult {
  shouldShow: boolean;
  storeUrl: string;
  message?: string;
  messageAr?: string;
  isStronglyRecommended: boolean;
}

// ── Semver compare (handles "4.0", "4.1.2", etc.) ─────
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

// ── Main check function ───────────────────────────────
export async function checkForUpdate(): Promise<VersionCheckResult | null> {
  try {
    // 1. Cooldown: don't check more than once per 24h
    const lastCheck = await AsyncStorage.getItem(CHECK_COOLDOWN_KEY);
    if (lastCheck && Date.now() - Number(lastCheck) < COOLDOWN_MS) {
      return null; // Checked recently, skip
    }

    // 2. Fetch with a short timeout (5s) — if it fails, we just move on
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(VERSION_CHECK_URL, {
      signal: controller.signal,
      headers: { "Cache-Control": "no-cache" },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data: VersionInfo = await response.json();
    if (!data?.latestVersion) return null;

    // 3. Record that we checked
    await AsyncStorage.setItem(CHECK_COOLDOWN_KEY, String(Date.now()));

    // 4. Compare versions
    const localVersion = Constants.expoConfig?.version ?? "0.0.0";
    const isOutdated = compareVersions(localVersion, data.latestVersion) < 0;

    if (!isOutdated) return null; // Already up to date!

    // 5. Check if user already dismissed THIS specific version
    const dismissed = await AsyncStorage.getItem(DISMISSED_VERSION_KEY);
    if (dismissed === data.latestVersion) return null; // User said "skip" for this version

    // 6. Determine severity
    const isStronglyRecommended = data.minRecommendedVersion
      ? compareVersions(localVersion, data.minRecommendedVersion) < 0
      : false;

    const storeUrl =
      Platform.OS === "ios" ? STORE_URLS.ios : STORE_URLS.android;

    return {
      shouldShow: true,
      storeUrl,
      message: data.updateMessage,
      messageAr: data.updateMessageAr,
      isStronglyRecommended,
    };
  } catch {
    // Network error, timeout, parse error — silently ignore
    return null;
  }
}

// ── Call this when user taps "Skip" / "Maybe later" ───
export async function dismissUpdateForVersion(version: string): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_VERSION_KEY, version);
}
```

### 4.2 Update banner component

Create `components/UpdateBanner.tsx`:

```tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTheme } from "../contexts/ThemeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { goldTint } from "../utils/colorHelpers";

interface Props {
  message?: string;
  messageAr?: string;
  storeUrl: string;
  isStronglyRecommended: boolean;
  onDismiss: () => void;
}

const UpdateBanner: React.FC<Props> = ({
  message,
  messageAr,
  storeUrl,
  isStronglyRecommended,
  onDismiss,
}) => {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const gt = (a: number) => goldTint(a, colors);

  const displayMessage =
    (language === "ar" ? messageAr : message) || t("updateAvailable"); // fallback translation key

  return (
    <View
      style={[s.banner, { backgroundColor: gt(0.06), borderColor: gt(0.15) }]}
    >
      <View style={s.row}>
        <MaterialCommunityIcons
          name="update"
          size={20}
          color={colors.accent.gold}
        />
        <Text style={[s.msg, { color: colors.text.primary }]} numberOfLines={3}>
          {displayMessage}
        </Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={10}>
          <MaterialCommunityIcons
            name="close"
            size={18}
            color={colors.text.secondary}
          />
        </TouchableOpacity>
      </View>

      <View style={s.actions}>
        <TouchableOpacity
          style={[s.updateBtn, { backgroundColor: colors.accent.gold }]}
          onPress={() => Linking.openURL(storeUrl)}
          activeOpacity={0.7}
        >
          <Text style={[s.updateText, { color: colors.background.primary }]}>
            {t("updateNow")}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.6}>
          <Text style={[s.skipText, { color: colors.text.secondary }]}>
            {isStronglyRecommended ? t("updateSkip") : t("updateMaybeLater")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  msg: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  updateBtn: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 18,
  },
  updateText: {
    fontSize: 13,
    fontWeight: "700",
  },
  skipText: {
    fontSize: 13,
    fontWeight: "500",
  },
});

export default UpdateBanner;
```

### 4.3 Integration in Home screen (index.tsx)

```tsx
import {
  checkForUpdate,
  dismissUpdateForVersion,
  VersionCheckResult,
} from "../../utils/versionCheck";

// Inside the component:
const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);

useEffect(() => {
  checkForUpdate().then((result) => {
    if (result?.shouldShow) setUpdateInfo(result);
  });
}, []);

// In JSX (at the top of the page, above prayer times):
{
  updateInfo && (
    <UpdateBanner
      message={updateInfo.message}
      messageAr={updateInfo.messageAr}
      storeUrl={updateInfo.storeUrl}
      isStronglyRecommended={updateInfo.isStronglyRecommended}
      onDismiss={() => {
        dismissUpdateForVersion(latestVersion); // from the check response
        setUpdateInfo(null);
      }}
    />
  );
}
```

---

## 5. Translation Keys to Add

```js
// en.js
updateAvailable: 'A new version is available with improvements!',
updateNow: 'Update',
updateSkip: 'Skip this version',
updateMaybeLater: 'Maybe later',

// ar.js
updateAvailable: 'يتوفر إصدار جديد مع تحسينات!',
updateNow: 'تحديث',
updateSkip: 'تخطي هذا الإصدار',
updateMaybeLater: 'ربما لاحقًا',
```

---

## 6. Behaviour Summary

| Scenario                               | What happens                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| Firebase unreachable / timeout / error | **Nothing** — app works normally, no error shown                                             |
| User is on latest version              | **Nothing** — no banner                                                                      |
| User is 1 minor version behind         | Gentle banner: "A new version is available!" + **Update** / _Maybe later_                    |
| User is below `minRecommendedVersion`  | Slightly stronger wording + **Update** / _Skip this version_                                 |
| User taps "Maybe later"                | Banner disappears, re-checks next day                                                        |
| User taps "Skip this version"          | Banner won't reappear until you bump `latestVersion` again                                   |
| `forceUpdate: true` (emergency only)   | Banner shown without dismiss button (still doesn't block app usage — user can navigate away) |
| Checked within last 24 hours           | Skips the network request entirely                                                           |
| No internet at all                     | `fetch` fails silently → no banner, no crash                                                 |

---

## 7. When to Update the Firebase JSON

Whenever you publish a new version to the stores:

1. Submit build to App Store / Play Store
2. Once **approved and live**, go to Firebase Console
3. Change `latestVersion` to the new version (e.g. `"4.1"`)
4. Optionally update `updateMessage` / `updateMessageAr`
5. Done — users on older versions will see the banner within 24 hours

---

## 8. Cost

| Service              | Free Tier Limit                    | Your Usage                                            |
| -------------------- | ---------------------------------- | ----------------------------------------------------- |
| Firebase Realtime DB | 10 GB transfer/month, 1 GB storage | ~50 bytes per request × even 100K users = ~5 MB/month |
| Firebase Hosting     | 10 GB transfer/month, 1 GB storage | Same — negligible                                     |

**You will never exceed the free tier** for a simple JSON endpoint.

---

## 9. Security Notes

- **Read-only rules**: Nobody can write to your database except you (via Firebase Console)
- **No API keys exposed**: The public Realtime DB URL is read-only; no secrets in the app
- **No user data collected**: The app just does a GET request — no analytics, no tracking
- **AbortController timeout**: 5-second hard timeout prevents hanging on slow networks

---

## 10. Future Extensions (Optional)

Once this endpoint exists, you can later add:

```json
{
  "latestVersion": "4.2",
  "prayerDataVersion": "2027",
  "prayerDataUrl": "https://your-cdn.com/prayer-data/2027.json",
  "announcement": "Ramadan Mubarak! New duas added.",
  "announcementAr": "رمضان مبارك! تمت إضافة أدعية جديدة."
}
```

This lets you:

- **Push new prayer time data** without an app update (download `prayerDataUrl` and cache locally)
- **Show announcements** (Ramadan greetings, new features, etc.)
- All still just a static JSON file — no server code needed
