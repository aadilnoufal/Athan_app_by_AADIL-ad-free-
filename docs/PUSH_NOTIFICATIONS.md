# Push Notifications — Research & Implementation Guide

> **Last updated:** March 2026
> **Status:** Implemented (client-side) — awaiting first build (Android: local Gradle, iOS: EAS Build) + test send
> **Current state:** Firebase Cloud Messaging integrated. `@react-native-firebase/app` + `@react-native-firebase/messaging` installed. Topics: `all-users` + `country-{XX}`. Foreground pushes displayed via Notifee. Background handler in `index.ts`. See `utils/pushNotifications.ts` for client code. 19 unit tests passing.
> **Sources:** [Firebase Cloud Messaging docs](https://firebase.google.com/docs/cloud-messaging), [React Native Firebase docs](https://rnfirebase.io/messaging/usage), [Expo Push Notifications docs](https://docs.expo.dev/push-notifications/overview/), [Firebase Console docs](https://firebase.google.com/docs/cloud-messaging/send/firebase-console)

---

## Table of Contents

1. [Local vs Push Notifications](#1-local-vs-push-notifications)
2. [Why Add Push Notifications?](#2-why-add-push-notifications)
3. [Architecture Overview](#3-architecture-overview)
4. [FCM Message Types](#4-fcm-message-types)
5. [Provider Comparison](#5-provider-comparison)
6. [Security Considerations](#6-security-considerations)
7. [Implementation Plan (Firebase + React Native Firebase)](#7-implementation-plan)
8. [Firebase Console vs Programmatic Sending](#8-firebase-console-vs-programmatic-sending)
9. [Timeline Estimate](#9-timeline-estimate)
10. [Recommendation](#10-recommendation)
11. [FAQ](#11-faq)

---

## 1. Local vs Push Notifications

### What we have now (Local)

| Aspect      | Detail                                                                           |
| ----------- | -------------------------------------------------------------------------------- |
| Library     | `@notifee/react-native` + `expo-notifications` (dual-library)                    |
| Trigger     | Scheduled on-device via `AlarmManager` (Android) / `UNNotificationRequest` (iOS) |
| Server      | **None** — everything happens on the user's device                               |
| Limit       | iOS caps at 64 scheduled notifications at a time                                 |
| Reliability | Very high for prayer times (exact alarms, `allowWhileIdle`)                      |

### What push notifications add (Remote)

| Aspect    | Detail                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trigger   | Server / Console sends a message → FCM / APNs relay → user's device                                                                                                             |
| Server    | **Firebase Console** works for manual sends (testing, marketing). Automated sends need Cloud Functions or a server ([source](https://firebase.google.com/docs/cloud-messaging)) |
| Use cases | Announcements, Ramadan reminders, community alerts, feature updates, emergency prayer time corrections                                                                          |
| Limit     | No cap on delivered notifications                                                                                                                                               |
| Requires  | Firebase project, client SDK, device token (auto-managed)                                                                                                                       |

**Key point:** Push notifications do **not** replace local prayer notifications. They supplement them for server-initiated content that can't be pre-scheduled on-device. ([source](https://firebase.google.com/docs/cloud-messaging))

---

## 2. Why Add Push Notifications?

### Good use cases for this app

- **Ramadan / Eid announcements** — "Ramadan Mubarak! Taraweeh times are now available"
- **App updates** — "New feature: Iqama times are here!"
- **Emergency corrections** — "Prayer times for [city] were adjusted due to DST error"
- **Community features** (future) — Jumu'ah reminders from local mosques
- **Engagement** — Weekly Quran reading reminders, dua of the day
- **Silent data pushes** — Trigger a background data refresh without showing a notification (**requires Cloud Functions or a server** — cannot be done from Firebase Console; see [Section 4](#4-fcm-message-types))

### Cases where local notifications are better

- **Daily prayer times** — Already perfectly handled by Notifee
- **Iqama reminders** — Scheduled locally with exact timing
- **Anything predictable** — If the content and timing are known in advance, local is more reliable and privacy-preserving

---

## 3. Architecture Overview

### How FCM Works (from [official docs](https://firebase.google.com/docs/cloud-messaging/fcm-architecture))

FCM has three components:

1. **Sending tool** — Firebase Console (manual, testing/marketing) OR a trusted server environment (Cloud Functions, Admin SDK, HTTP v1 API) for automation
2. **FCM backend** — Accepts requests, performs fanout via topics, generates message IDs
3. **Platform transport** — Android Transport Layer (ATL) for Android, Apple Push Notification service (APNs) for iOS

```
┌──────────────────────────────┐
│  SENDING TOOLS               │
│                              │
│  Option A: Firebase Console  │──── Manual sends, testing, marketing
│  (Web UI - free)             │     No code needed. 1000 char limit.
│                              │
│  Option B: Cloud Functions   │──── Automated sends, data-only messages
│  or Admin SDK / HTTP v1 API  │     Full 4KB payload. Requires code.
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  FCM BACKEND                 │
│  (Google infrastructure)     │──── Routing, fanout, topic delivery
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  PLATFORM TRANSPORT          │
│                              │
│  Android: ATL                │
│  iOS: APNs                   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│  USER DEVICE                 │
│                              │
│  @react-native-firebase/     │
│  messaging (receives push)   │
│  +                           │
│  Notifee (displays with      │
│  custom UI, sound, channels) │
└──────────────────────────────┘
```

### Required components

| Component                          | Purpose                                      | Source                                                             |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| Firebase project                   | Container for config + analytics             | [console.firebase.google.com](https://console.firebase.google.com) |
| `@react-native-firebase/app`       | Core Firebase SDK                            | [npm](https://www.npmjs.com/package/@react-native-firebase/app)    |
| `@react-native-firebase/messaging` | Receive FCM messages, manage tokens + topics | [rnfirebase.io](https://rnfirebase.io/messaging/usage)             |
| `google-services.json`             | Android config file                          | Downloaded from Firebase Console                                   |
| `GoogleService-Info.plist`         | iOS config file                              | Downloaded from Firebase Console                                   |
| APNs key (`.p8`)                   | Allows Firebase to send to iOS via Apple     | Apple Developer Console                                            |

### Optional (for automation)

- **Firebase Cloud Functions** — Serverless functions to send automated pushes (e.g., daily Quran verse, timed reminders). [Source](https://firebase.google.com/docs/cloud-messaging/fcm-architecture)
- **Firestore** — Store user preferences for targeted pushes

---

## 4. FCM Message Types

Understanding message types is critical. Firebase has **two distinct** message types with very different behavior. ([source](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type))

### Notification Messages

| Aspect                         | Detail                                                    |
| ------------------------------ | --------------------------------------------------------- |
| **What**                       | Contains a `notification` key with `title` and `body`     |
| **Behavior (background/quit)** | FCM SDK displays the notification automatically           |
| **Behavior (foreground)**      | No notification shown — `onMessage` handler fires instead |
| **How to send**                | Firebase Console, Admin SDK, or HTTP v1 API               |
| **Console support**            | ✅ Yes — this is what the Console sends                   |
| **Payload limit**              | 4 KB via API, **1000 characters via Console**             |

### Data Messages

| Aspect                         | Detail                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| **What**                       | Contains only a `data` key with custom key-value pairs                   |
| **Behavior (background/quit)** | App's `setBackgroundMessageHandler` fires (if priority is set correctly) |
| **Behavior (foreground)**      | `onMessage` handler fires                                                |
| **How to send**                | Admin SDK or HTTP v1 API **only**                                        |
| **Console support**            | ❌ **No** — Console cannot send data-only messages                       |
| **Payload limit**              | 4 KB                                                                     |

### Notification + Data (Combined)

| Aspect                         | Detail                                                                       |
| ------------------------------ | ---------------------------------------------------------------------------- |
| **What**                       | Contains both `notification` and `data` keys                                 |
| **Behavior (background/quit)** | Notification displayed automatically; data payload accessible when user taps |
| **Behavior (foreground)**      | `onMessage` fires with both payloads                                         |
| **How to send**                | Console (via "Custom data" field), Admin SDK, or HTTP v1 API                 |
| **Console support**            | ✅ Yes — use "Custom data" in Advanced Options                               |

### Message handler matrix (from [rnfirebase.io](https://rnfirebase.io/messaging/usage))

| Message Type        | Foreground  | Background                      | Quit                            |
| ------------------- | ----------- | ------------------------------- | ------------------------------- |
| Notification        | `onMessage` | Auto-display                    | Auto-display                    |
| Notification + Data | `onMessage` | Auto-display                    | Auto-display                    |
| Data-only           | `onMessage` | `setBackgroundMessageHandler` ¹ | `setBackgroundMessageHandler` ¹ |

¹ Data-only messages in background/quit are treated as **low priority** by default. You must set `priority: 'high'` (Android) and `content-available: true` + proper APNs headers (iOS) for them to wake the app. ([source](https://rnfirebase.io/messaging/usage))

### Important: Notifee v7+ interaction

> If you use `@notifee/react-native` v7.0.0+, `onNotificationOpenedApp` and `getInitialNotification` from Firebase Messaging **will not trigger** — Notifee handles those events instead. ([source](https://rnfirebase.io/messaging/usage))

### Can you update prayer times via push?

**Yes, but not from Firebase Console alone:**

- Console sends notification messages (visible) — it cannot send silent/data-only pushes
- To silently trigger a prayer time data refresh, you need a **data-only message** sent via Cloud Functions or the Admin SDK
- Alternative: Send a visible notification + data from Console (e.g., "Prayer times updated — tap to refresh"), then handle the data payload on tap
- Since your prayer times are **calculated client-side** from coordinates + date, push-based updates would only be needed for emergency corrections (DST errors, etc.)

---

## 5. Provider Comparison

### Firebase Cloud Messaging (FCM) — ★ RECOMMENDED

| Aspect                 | Detail                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| **Cost**               | **Free** — unlimited messages, no per-message cost ([source](https://firebase.google.com/pricing))       |
| **Platforms**          | Android (native ATL), iOS (via APNs proxy), Web                                                          |
| **Setup complexity**   | Medium — Firebase project + config files + SDK                                                           |
| **React Native SDK**   | `@react-native-firebase/messaging` ([rnfirebase.io](https://rnfirebase.io/messaging/usage))              |
| **Expo compatibility** | ✅ Works with development builds, **NOT** with Expo Go ([source](https://rnfirebase.io/messaging/usage)) |
| **Reliability**        | Very high — Google infrastructure                                                                        |
| **Analytics**          | Delivery tracking, open rates via Firebase Analytics, BigQuery export                                    |
| **Targeting**          | Topics, user segments, conditions. Console: + app version, language targeting                            |
| **Message types**      | Notification, Data-only, Combined (see [Section 4](#4-fcm-message-types))                                |
| **Console UI**         | ✅ Compose, schedule, A/B test, target topics — for notification messages                                |
| **Automated sends**    | Requires Cloud Functions or Admin SDK (not Console)                                                      |
| **Vendor lock-in**     | Medium — tied to Google, but uses APNs natively for iOS                                                  |
| **Privacy**            | Messages routed through Google servers (Apple for iOS via APNs)                                          |

### Expo Push Notifications

| Aspect                 | Detail                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Cost**               | **Free** (generous tier), paid for high volume ([source](https://docs.expo.dev/push-notifications/overview/)) |
| **Platforms**          | Android (via FCM), iOS (via APNs)                                                                             |
| **Setup complexity**   | **Low** — `expo-notifications` is already installed                                                           |
| **React Native SDK**   | `expo-notifications` (already in `package.json`)                                                              |
| **Expo compatibility** | ✅ First-class support                                                                                        |
| **Reliability**        | High — Expo's servers proxy to FCM/APNs                                                                       |
| **Analytics**          | Basic — delivery receipts via Expo Push API                                                                   |
| **Targeting**          | Manual via push tokens — **no built-in topics/segments**                                                      |
| **Console UI**         | ❌ No built-in console — API-only (or build your own)                                                         |
| **Automated sends**    | Requires a server to call `exp.host/--/api/v2/push/send`                                                      |
| **Vendor lock-in**     | High — tied to Expo's push service                                                                            |
| **Privacy**            | Messages routed through Expo → Google/Apple                                                                   |

### OneSignal

| Aspect                 | Detail                                          |
| ---------------------- | ----------------------------------------------- |
| **Cost**               | Free up to 10K subscribers, paid tiers after    |
| **Platforms**          | Android, iOS, Web, Email, SMS                   |
| **Setup complexity**   | Low — dashboard-driven setup                    |
| **React Native SDK**   | `react-native-onesignal`                        |
| **Expo compatibility** | ✅ Works with development builds                |
| **Reliability**        | High                                            |
| **Analytics**          | Excellent — delivery, opens, CTR, A/B testing   |
| **Targeting**          | Segments, tags, user attributes, geofencing     |
| **Console UI**         | ✅ Full web dashboard for composing, scheduling |
| **Automated sends**    | REST API, server SDKs available                 |
| **Vendor lock-in**     | High — proprietary platform                     |
| **Privacy**            | Messages routed through OneSignal servers       |

### Summary Matrix

| Criteria    | FCM ★        | Expo Push    | OneSignal     |
| ----------- | ------------ | ------------ | ------------- |
| Cost        | ✅ Free      | ✅ Free tier | ⚠️ Free < 10K |
| Setup ease  | ⭐⭐⭐       | ⭐⭐⭐⭐⭐   | ⭐⭐⭐⭐      |
| Analytics   | ⭐⭐⭐⭐     | ⭐⭐         | ⭐⭐⭐⭐⭐    |
| Expo compat | ✅           | ✅✅         | ✅            |
| Console UI  | ✅ (manual)  | ❌           | ✅ (full)     |
| Data-only   | ✅ (via API) | ✅ (via API) | ✅            |
| Privacy     | ⭐⭐⭐       | ⭐⭐         | ⭐⭐          |

---

## 6. Security Considerations

### Token Management

- **Device tokens are sensitive** — treat them like session tokens
- **Tokens can rotate** — iOS and Android may issue new tokens at any time; listen via `messaging().onTokenRefresh()` ([source](https://rnfirebase.io/messaging/usage))
- **Token invalidation** — tokens become invalid when users uninstall, or when the app's registration is invalidated
- **Never log tokens** in production — could be used to push spam to a user's device

### Server-Side Security

| Risk                   | Mitigation                                                                                                                                                                                                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Unauthorized sends** | FCM v1 API uses **OAuth 2.0 service account** tokens (short-lived). Legacy server keys are being deprecated. ([source](https://firebase.google.com/docs/cloud-messaging))                                                                                                           |
| **Message spoofing**   | Use HTTPS, validate message origin on the client                                                                                                                                                                                                                                    |
| **Data leakage**       | FCM connection is encrypted, but **not end-to-end encrypted**. Don't send private data in notification bodies. Use data-only pushes + local content generation for sensitive info. ([source](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)) |

### Platform-Specific Security

#### iOS (APNs)

- Requires **APNs authentication key** (`.p8` file) — recommended over certificates
- Key is tied to your Apple Developer Team ID (`MNPBRLN354`)
- APNs enforces TLS 1.2+ and certificate pinning
- Payload limit: **4 KB**
- **Silent pushes** (`content-available`) are throttled by iOS and require Background App Refresh to be enabled ([source](https://rnfirebase.io/messaging/usage))

#### Android (FCM)

- FCM v1 API uses OAuth 2.0 service account credentials (short-lived tokens)
- Payload limit: 4 KB (notification) + 4 KB (data)
- **High-priority** messages bypass Doze mode but may be throttled if abused
- Android Q+ has Notification Delegation via Google Play services — `@react-native-firebase/messaging` disables this by default for compatibility ([source](https://rnfirebase.io/messaging/usage))

### Privacy Considerations

| Concern                   | Detail                                                                                                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Message content**       | Push payloads traverse Google (FCM) and Apple (APNs) servers. The connection is encrypted but not E2E. Don't send private data in notification body. ([source](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)) |
| **User tracking**         | FCM assigns device-level Instance IDs. Be transparent in your privacy policy.                                                                                                                                                                         |
| **GDPR / data residency** | Push tokens stored by Google. Consider implications for EU users.                                                                                                                                                                                     |
| **Opt-out**               | Always provide a clear way to disable push notifications in-app (extend existing per-prayer toggles to push categories).                                                                                                                              |

---

## 7. Implementation Plan

Based on the official [React Native Firebase setup guide](https://rnfirebase.io/messaging/usage) and [Expo integration docs](https://rnfirebase.io/messaging/usage#expo).

### Step 1: Create Firebase Project (15 min)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click "Add project" → name it (e.g., "Prayer Times")
3. Enable Google Analytics (recommended for delivery tracking)

### Step 2: Add Android App to Firebase (15 min)

1. In Firebase Console → Project Settings → "Add app" → Android
2. Package name: `com.yourcompany.prayertimes`
3. Download `google-services.json`
4. Place it in `android/app/google-services.json`
5. Add to `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "googleServicesFile": "./android/app/google-services.json"
       }
     }
   }
   ```

### Step 3: Add iOS App to Firebase (15 min)

1. In Firebase Console → Project Settings → "Add app" → iOS
2. Bundle ID: `com.aadilnoufal.prayertimes`
3. Download `GoogleService-Info.plist`
4. Place it in the project root
5. Add to `app.json`:
   ```json
   {
     "expo": {
       "ios": {
         "googleServicesFile": "./GoogleService-Info.plist"
       }
     }
   }
   ```

### Step 4: Configure APNs for iOS Push (20 min)

Firebase needs an APNs key to deliver pushes to iOS devices:

1. Go to [Apple Developer Console](https://developer.apple.com) → Certificates, Identifiers & Profiles → Keys
2. Create a new key → enable **Apple Push Notifications service (APNs)**
3. Download the `.p8` key file
4. Note the **Key ID** and your **Team ID** (`MNPBRLN354`)
5. In Firebase Console → Project Settings → Cloud Messaging → iOS app
6. Upload the `.p8` key, enter Key ID and Team ID

### Step 5: Install Firebase SDK (30 min)

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

Add the plugin and **required Expo configuration** to `app.json` ([source](https://rnfirebase.io/messaging/usage#expo)):

```json
{
  "expo": {
    "plugins": ["@react-native-firebase/app"],
    "ios": {
      "entitlements": {
        "aps-environment": "production"
      },
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

> **Important (Expo SDK 51+):** The `aps-environment` entitlement is no longer added automatically during prebuild. You must add it manually or push notifications won't work on iOS. ([source](https://rnfirebase.io/messaging/usage#expo))

Then rebuild:

```bash
npx expo prebuild --clean

# Android: local Gradle build (android/ folder exists)
cd android && ./gradlew assembleDebug && cd ..

# iOS: EAS Build (no local ios/ folder — EAS generates it)
eas build --platform ios --profile development
```

### Step 6: Configure `firebase.json` (10 min)

Create `firebase.json` in the project root for React Native Firebase configuration ([source](https://rnfirebase.io/messaging/usage#firebasejson)):

```json
{
  "react-native": {
    "messaging_ios_auto_register_for_remote_messages": true,
    "messaging_ios_foreground_presentation_options": [
      "badge",
      "sound",
      "list",
      "banner"
    ],
    "messaging_android_notification_channel_id": "prayer-push",
    "messaging_android_headless_task_timeout": 30000
  }
}
```

| Setting                                           | Purpose                                                     | Source                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `messaging_ios_auto_register_for_remote_messages` | Auto-register with APNs on startup                          | [rnfirebase.io](https://rnfirebase.io/messaging/usage#auto-registration-ios)               |
| `messaging_ios_foreground_presentation_options`   | Show notification even when app is in foreground on iOS     | [rnfirebase.io](https://rnfirebase.io/messaging/usage#foreground-presentation-options-ios) |
| `messaging_android_notification_channel_id`       | Route FCM notifications through your custom Notifee channel | [rnfirebase.io](https://rnfirebase.io/messaging/usage#notification-channel-id)             |
| `messaging_android_headless_task_timeout`         | Background handler timeout (default 60s)                    | [rnfirebase.io](https://rnfirebase.io/messaging/usage#background-handler-timeout-android)  |

### Step 7: Client Code — Register & Handle Pushes (1-2 hours)

Create `utils/pushNotifications.ts`:

```typescript
import messaging from "@react-native-firebase/messaging";
import { Platform, PermissionsAndroid } from "react-native";

/**
 * Request permission and register for push notifications.
 * Call this once on app startup (e.g., in _layout.tsx).
 *
 * Reference: https://rnfirebase.io/messaging/usage
 */
export async function initializePushNotifications(): Promise<void> {
  try {
    // Request permission
    // iOS: shows system prompt. Android 13+ (API 33+): needs runtime permission.
    // Android 12 and below: resolves automatically.
    // Source: https://rnfirebase.io/messaging/usage#ios---requesting-permissions
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log("Push notification permission denied");
      return;
    }

    // Android 13+ needs POST_NOTIFICATIONS permission separately
    // Source: https://rnfirebase.io/messaging/usage#android---requesting-permissions
    if (Platform.OS === "android" && Platform.Version >= 33) {
      await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log("FCM Token:", token);

    // Listen for token refresh
    // Source: https://rnfirebase.io/messaging/usage
    messaging().onTokenRefresh((newToken) => {
      console.log("FCM Token refreshed:", newToken);
      // If using a server, send newToken to your backend here
    });

    // Handle foreground messages
    // When app is in foreground, no notification is displayed automatically.
    // You must manually display via Notifee if desired.
    // Source: https://rnfirebase.io/messaging/usage#foreground-state-messages
    messaging().onMessage(async (remoteMessage) => {
      console.log("Push received in foreground:", remoteMessage);
      // Option: display via Notifee using your existing notification UI
    });
  } catch (error) {
    console.error("Push notification init error:", error);
  }
}

/**
 * Subscribe to a topic (e.g., 'ramadan', 'announcements').
 * Users subscribed to a topic will receive all pushes sent to that topic.
 *
 * Limits: Max 2000 topics per app instance. Topic names must not include "/".
 * Source: https://rnfirebase.io/messaging/usage#topics
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  await messaging().subscribeToTopic(topic);
}

export async function unsubscribeFromTopic(topic: string): Promise<void> {
  await messaging().unsubscribeFromTopic(topic);
}
```

### Step 8: Background Message Handler (30 min)

Register the background handler in `index.ts` (must be at the top level, outside React components — [source](https://rnfirebase.io/messaging/usage#background--quit-state-messages)):

```typescript
// index.ts
import messaging from "@react-native-firebase/messaging";

// Register background handler BEFORE app component registration
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("Push received in background:", remoteMessage);
  // Handle data payload, trigger Notifee notification, etc.
  // This handler has 60 seconds to complete (configurable in firebase.json)
  // Source: https://rnfirebase.io/messaging/usage#background-handler-timeout-android
});
```

> **iOS Background Behavior:** On iOS, receiving a background message silently starts your entire app (root component mounts). To prevent side effects, use the `isHeadless` prop pattern or `messaging().getIsHeadless()` to skip rendering. ([source](https://rnfirebase.io/messaging/usage#background-application-state))

> **iOS Background App Refresh:** If the user disables Background App Refresh (or the device is in Low Power Mode), `setBackgroundMessageHandler` will **not** trigger on iOS. ([source](https://rnfirebase.io/messaging/usage#ios-background-limitation))

### Step 9: Notification Interaction Handling (30 min)

Handle what happens when the user taps a notification ([source](https://rnfirebase.io/messaging/notifications#handling-interaction)):

```typescript
import messaging from "@react-native-firebase/messaging";

// When app was QUIT and opened via notification tap
const initialNotification = await messaging().getInitialNotification();
if (initialNotification) {
  // Navigate to specific screen based on initialNotification.data
}

// When app was in BACKGROUND and opened via notification tap
messaging().onNotificationOpenedApp((remoteMessage) => {
  // Navigate to specific screen based on remoteMessage.data
});
```

> **Notifee v7+ Note:** If you use `@notifee/react-native` v7.0.0+, `getInitialNotification()` and `onNotificationOpenedApp()` from `@react-native-firebase/messaging` will **not trigger** — Notifee intercepts these events instead. Use Notifee's event handlers. ([source](https://rnfirebase.io/messaging/usage))

### Step 10: Add Push Settings in UI (1 hour)

Add toggles in Settings for push notification categories:

```typescript
// In settings — add toggles for each topic
const pushTopics = [
  { key: "announcements", label: "Announcements & Updates" },
  { key: "ramadan", label: "Ramadan Reminders" },
  { key: "quran-daily", label: "Daily Quran Verse" },
];
```

When a user toggles a topic on/off, call `subscribeToTopic()` / `unsubscribeFromTopic()`.

### Step 11: Test Push Notifications (30 min)

**Via Firebase Console** ([source](https://firebase.google.com/docs/cloud-messaging/send/firebase-console)):

1. Open Firebase Console → Your Project → Messaging
2. Click "Create your first campaign" → Notifications
3. Compose a message → Target a topic (e.g., `announcements`) or all users
4. Send now or schedule for later
5. Test on both platforms — **note: iOS Simulator does NOT support push notifications**, use a real device ([source](https://rnfirebase.io/messaging/notifications#handling-interaction))

| Use Case                  | Console Steps                                      |
| ------------------------- | -------------------------------------------------- |
| **Broadcast to all**      | Target → User segment → All users                  |
| **Ramadan announcement**  | Target → Topic → `ramadan`                         |
| **Scheduled (e.g., Eid)** | Scheduling → Send at specific time                 |
| **A/B test message**      | Create experiment → Test variants                  |
| **Rich notification**     | Add image URL in the "Image" field                 |
| **With data payload**     | Additional options → Custom data → key-value pairs |

---

## 8. Firebase Console vs Programmatic Sending

This is an important distinction the [official docs](https://firebase.google.com/docs/cloud-messaging/send/firebase-console) make clear:

### Firebase Console (Notifications Composer)

- **Best for:** Testing, marketing campaigns, manual announcements, A/B testing
- **Sends:** Notification messages (always visible) with optional custom data
- **Cannot send:** Data-only (silent) messages
- **Payload limit:** **1000 characters** (vs 4 KB from API)
- **Targeting:** All users, topics, user segments, conditions, app version, language
- **Scheduling:** ✅ Yes — specific date/time, or recurring
- **Firebase's own description:** "useful for testing or for highly targeted marketing and user engagement" ([source](https://firebase.google.com/docs/cloud-messaging/send/firebase-console))

### Programmatic Sending (Admin SDK / HTTP v1 API / Cloud Functions)

- **Best for:** Automated messages, scheduled recurring sends, data-only pushes, conditional logic
- **Sends:** All message types — notification, data-only, or combined
- **Payload limit:** 4 KB
- **Required for:** Daily automated pushes (e.g., Quran verse), silent data syncs, prayer time correction triggers
- **Docs:** [Admin SDK](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk), [HTTP v1 API](https://firebase.google.com/docs/cloud-messaging/send/v1-api)

### What you can do with Console alone

| Feature                       | Console? | Notes                           |
| ----------------------------- | -------- | ------------------------------- |
| Ramadan / Eid announcements   | ✅       | Manual compose + schedule       |
| App update notifications      | ✅       | Manual compose + target all     |
| Emergency time corrections    | ✅       | Manual compose with custom data |
| A/B test engagement messages  | ✅       | Built-in experiment feature     |
| Daily Quran verse (automated) | ❌       | Needs Cloud Functions           |
| Silent data refresh           | ❌       | Needs Admin SDK (data-only msg) |
| Triggered by user action      | ❌       | Needs a server/Cloud Functions  |

**Bottom line:** Start with Firebase Console for manual sends. Add Cloud Functions later only if you need automation.

---

## 9. Timeline Estimate

### Phase 1: Firebase Console Only (Manual Sends) — ~5-7 hours

| Task                              | Time           | Description                                                             |
| --------------------------------- | -------------- | ----------------------------------------------------------------------- |
| Firebase project + apps           | 30 min         | Create project, add Android + iOS apps, download config files           |
| APNs key for iOS                  | 20 min         | Create APNs key in Apple Developer Console, upload to Firebase          |
| Install Firebase SDK              | 30 min         | `npm install`, add plugin + Expo config, rebuild                        |
| Configure `firebase.json`         | 10 min         | Notification channel, foreground options, timeouts                      |
| Client code (register + handlers) | 1-2 hrs        | Init, permissions, `onMessage`, background handler, topic subscriptions |
| Notification interaction handling | 30 min         | `getInitialNotification`, `onNotificationOpenedApp` (or Notifee events) |
| Settings UI (topic toggles)       | 1 hr           | Toggle for announcements, Ramadan, daily verse                          |
| Build with Firebase SDK           | 30 min         | Android: local Gradle build. iOS: EAS Build (EAS generates ios/ folder) |
| Testing                           | 1-2 hrs        | Send test pushes from Firebase Console, both platforms, all app states  |
| **Total**                         | **~5-7 hours** | Enables manual push from Firebase Console                               |

### Phase 2: Automation (Optional, Later) — ~4-6 hours additional

| Task                            | Time           | Description                                                       |
| ------------------------------- | -------------- | ----------------------------------------------------------------- |
| Set up Firebase Cloud Functions | 1-2 hrs        | Install `firebase-tools`, init functions, deploy                  |
| Automated push logic            | 2-3 hrs        | Scheduled functions for daily Quran verse, data-only pushes, etc. |
| Testing + monitoring            | 1 hr           | Verify automated sends, set up error monitoring                   |
| **Total**                       | **~4-6 hours** | Enables automated/data-only pushes                                |

---

## 10. Recommendation

### Start with Firebase + Firebase Console

FCM is the clear winner for this app:

1. **Free** — Unlimited messages, no per-message cost, no subscriber limits ([source](https://firebase.google.com/pricing))
2. **Firebase Console** — Compose, target, schedule, and A/B test notification messages from a web UI — no code needed for manual sends ([source](https://firebase.google.com/docs/cloud-messaging/send/firebase-console))
3. **Topics** — Users subscribe to categories (Ramadan, announcements) directly from the app. Send to topics from Console. ([source](https://rnfirebase.io/messaging/usage#topics))
4. **React Native Firebase** — Well-maintained SDK with first-class Expo support ([source](https://rnfirebase.io/messaging/usage#expo))
5. **Notifee integration** — FCM + Notifee work together: FCM receives, Notifee displays with your custom channels/sounds ([source](https://rnfirebase.io/messaging/notifications#notifee---advanced-notifications))
6. **Scalable** — Start with Console, add Cloud Functions later for automation

### Be honest about Console limitations

- Console is great for **manual** sends (announcements, marketing, testing)
- Console **cannot** send data-only (silent) messages
- Console has a **1000 character** payload limit
- For **automated** features (daily Quran verse, silent data sync), you'll eventually need Cloud Functions
- Firebase docs call the Console a tool for "testing or for highly targeted marketing" — not a full replacement for a server ([source](https://firebase.google.com/docs/cloud-messaging/send/firebase-console))

### Why NOT Expo Push

- Requires a server to call the Expo Push API — no built-in console
- Does not support topics natively — manual token management
- Extra network hop: your server → Expo → FCM/APNs
- Less analytics than FCM

### Why NOT OneSignal

- Free tier limited to 10K subscribers
- Adds another third-party vendor
- Overkill for a prayer app's announcement needs

---

## 11. FAQ

### Q: Can push notifications replace local prayer notifications?

**No.** Push notifications require internet and a server trigger. Prayer notifications need to fire at exact times even offline. Keep Notifee for prayer scheduling. Push is for server-initiated content only. ([source](https://firebase.google.com/docs/cloud-messaging))

### Q: Can I update prayer times through push notifications?

**Partially.** Firebase Console can only send visible notification messages — it cannot send silent data-only pushes. To silently trigger a prayer time data refresh, you'd need a data-only message sent via Cloud Functions or the Admin SDK. Alternative: send a visible notification from Console ("Prayer times corrected — tap to update") with custom data that triggers a refresh on tap. Since prayer times are calculated client-side from coordinates + date, push-based updates are only useful for emergency corrections. ([source](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type))

### Q: Will push notifications work when the app is killed?

**Yes.** FCM (Android) and APNs (iOS) deliver notifications even when the app is not running. The OS handles delivery. On iOS, the app silently wakes in the background briefly. ([source](https://rnfirebase.io/messaging/usage#background--quit-state-messages))

### Q: Do I need a server?

**Not to start.** Firebase Console lets you compose and send notification messages directly. For automated sends (scheduled daily messages, data-only pushes, conditional triggers), you will need Cloud Functions or a server. Firebase's own docs describe the Console as "useful for testing or for highly targeted marketing and user engagement." ([source](https://firebase.google.com/docs/cloud-messaging/send/firebase-console))

### Q: What about data privacy?

All push messages traverse third-party servers. FCM connection is encrypted but **not end-to-end encrypted** ([source](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type)). Don't include sensitive personal data in push payloads.

### Q: Will this work with Expo Go?

**No.** `@react-native-firebase/messaging` requires native modules and only works in **development builds** (EAS Build). It does NOT work in Expo Go. ([source](https://rnfirebase.io/messaging/usage#expo))

### Q: What about iOS Simulator?

**Push notifications cannot be received on iOS Simulator.** You must test with a real iOS device. Android emulator works fine. ([source](https://rnfirebase.io/messaging/notifications#handling-interaction))

### Q: What about iOS Background App Refresh?

If the user disables Background App Refresh (or device is in Low Power Mode), `setBackgroundMessageHandler` will **not trigger** on iOS. Visible notifications will still be displayed by the OS, but your custom handler code won't run. ([source](https://rnfirebase.io/messaging/usage#ios-background-limitation))

### Q: How does Android Notification Delegation affect this?

On Android Q+ with current Google Play services, Google implemented "Notification Delegation" for FCM messages. This is **incompatible** with `@react-native-firebase/messaging` — delegated messages bypass your JS listeners. React Native Firebase disables delegation by default via AndroidManifest. ([source](https://rnfirebase.io/messaging/usage#android---google-play-notification-delegation))

### Q: What is the cost for 10K-50K users?

- **FCM:** Free — unlimited ([source](https://firebase.google.com/pricing))
- **Expo Push:** Free (generous free tier)
- **OneSignal:** Free up to 10K subscribers, then paid

### Q: Can I send images in push notifications?

Yes — FCM supports rich notifications with images. Android supports Big Picture style. iOS supports image, video, and audio attachments (requires a Notification Service Extension). Firebase Console has an "Image" field for adding image URLs. ([source](https://rnfirebase.io/messaging/notifications))

---

## Current App Notification Architecture (Reference)

```
┌─────────────────────────────────────────────────────┐
│                    Prayer App                        │
│                                                      │
│  ┌──────────────┐    ┌──────────────────────────┐   │
│  │ Notifee      │    │ @react-native-firebase   │   │
│  │ (Local)      │    │ /messaging (Push)        │   │
│  │              │    │                          │   │
│  │ • Channels   │    │ • Receive FCM pushes     │   │
│  │ • Scheduling │    │ • Topic subscriptions    │   │
│  │ • Sound      │    │ • Token management       │   │
│  │ • Display    │    │ • Foreground handling    │   │
│  └──────┬───────┘    └───────────┬──────────────┘   │
│         │                        │                   │
│         ▼                        ▼                   │
│  ┌─────────────────┐   ┌──────────────────────┐    │
│  │ ON-DEVICE       │   │ REMOTE PUSHES         │    │
│  │ (Local Only)    │   │                       │    │
│  │                 │   │ Manual: Console UI     │    │
│  │ AlarmManager    │   │ Automated: Cloud Fns   │    │
│  │ (Android)       │   │                       │    │
│  │ UNNotification  │   │ FCM → APNs → Device   │    │
│  │ (iOS, max 64)   │   │                       │    │
│  └─────────────────┘   └──────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

---

## Files That Would Change

| File                               | Change                                                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `utils/pushNotifications.ts`       | **NEW** — FCM token registration, topic subscribe/unsubscribe, foreground handler                                                  |
| `index.ts`                         | Add `setBackgroundMessageHandler` at top level                                                                                     |
| `app/_layout.tsx`                  | Call `initializePushNotifications()` on startup, subscribe to default topics                                                       |
| `app/(tabs)/settings.tsx`          | Add push notification topic toggles (announcements, Ramadan, etc.)                                                                 |
| `app.json`                         | Add `googleServicesFile` (both platforms), `@react-native-firebase/app` plugin, `aps-environment` entitlement, `UIBackgroundModes` |
| `firebase.json`                    | **NEW** — React Native Firebase configuration (channels, foreground options, etc.)                                                 |
| `android/app/google-services.json` | **NEW** — Firebase config (downloaded from Firebase Console)                                                                       |
| `GoogleService-Info.plist`         | **NEW** — Firebase config for iOS (downloaded from Firebase Console)                                                               |
| `package.json`                     | Add `@react-native-firebase/app` + `@react-native-firebase/messaging`                                                              |

---

## Sources

All claims in this document are verified against official documentation:

| Source                   | URL                                                                                                                                   | What it covers                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Firebase Cloud Messaging | [firebase.google.com/docs/cloud-messaging](https://firebase.google.com/docs/cloud-messaging)                                          | Overview, key capabilities                |
| FCM Architecture         | [firebase.google.com/docs/.../fcm-architecture](https://firebase.google.com/docs/cloud-messaging/fcm-architecture)                    | Components, lifecycle                     |
| FCM Message Types        | [firebase.google.com/docs/.../set-message-type](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type) | Notification vs Data vs Combined          |
| Firebase Console Sending | [firebase.google.com/docs/.../firebase-console](https://firebase.google.com/docs/cloud-messaging/send/firebase-console)               | Console capabilities + limits             |
| React Native Firebase    | [rnfirebase.io/messaging/usage](https://rnfirebase.io/messaging/usage)                                                                | SDK setup, Expo config, handlers, topics  |
| RNFB Notifications       | [rnfirebase.io/messaging/notifications](https://rnfirebase.io/messaging/notifications)                                                | Display, interaction, Notifee integration |
| Expo Push Overview       | [docs.expo.dev/push-notifications/overview](https://docs.expo.dev/push-notifications/overview/)                                       | Expo push service overview                |
| Expo FCM Credentials     | [docs.expo.dev/push-notifications/fcm-credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)                         | Google Service Account Key setup          |

---

_Client-side implementation complete (March 2026). Next steps: build (Android: local Gradle, iOS: EAS Build), then test send from Firebase Console. See `CHANGELOG.md` for full change details._
