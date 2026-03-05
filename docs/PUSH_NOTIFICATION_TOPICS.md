# Push Notification Topics

> **Last updated:** July 2025
>
> This document describes the FCM (Firebase Cloud Messaging) topic system used
> for sending push notifications to the Prayer Times app.

---

## Table of Contents

1. [Overview](#overview)
2. [Topics](#topics)
3. [How Devices Subscribe](#how-devices-subscribe)
4. [Sending Notifications](#sending-notifications)
5. [FCM Condition Syntax](#fcm-condition-syntax)
6. [Common Scenarios](#common-scenarios)
7. [Limits & Constraints](#limits--constraints)

---

## Overview

The app uses **FCM topic-based messaging** to send push notifications. When a
user opens the app, their device automatically subscribes to a set of topics.
The server (admin script) then sends messages to topics — every device subscribed
to that topic receives the notification.

**No device tokens are stored server-side.** Topic subscriptions are managed
entirely by Firebase. This is simpler and more scalable than token-based
targeting for broadcast use cases.

---

## Topics

| Topic         | Format            | Example         | Purpose                                                       |
| ------------- | ----------------- | --------------- | ------------------------------------------------------------- |
| **All users** | `all-users`       | `all-users`     | Broadcast to every device (e.g. Eid greetings, announcements) |
| **Country**   | `country-{ISO}`   | `country-QA`    | Country-specific messages (ISO 3166-1 alpha-2 code)           |
| **Version**   | `version-{X.Y.Z}` | `version-4.0.1` | Target users on a specific app version                        |

### Topic Details

#### `all-users`

Every device subscribes to this topic on first launch. Use it for app-wide
broadcasts like Eid greetings, Ramadan notices, or critical announcements.

#### `country-{ISO}`

The ISO country code is derived from the user's **selected region** in settings
(not GPS). For example, if a user selects "Qatar > Qatar > Doha", the country ID
`qatar` maps to ISO code `QA`, and the device subscribes to `country-QA`.

This means the country topic reflects the user's **intentional choice**, not
their physical location. A user in the UK who selects Qatar prayer times will be
on `country-QA`.

Supported country codes are defined in `app/config/prayerTimeConfig.ts` via the
`isoCode` field on each `Country` entry.

#### `version-{X.Y.Z}`

The version string comes from the app's native version (`nativeApplicationVersion`
from `expo-application`, which reads `versionName` on Android and `CFBundleShortVersionString`
on iOS).

When a user updates the app, the old version topic is **automatically
unsubscribed** and the new version topic is subscribed. This ensures each device
is only on one version topic at a time.

---

## How Devices Subscribe

Subscription happens automatically in `utils/pushNotifications.ts` when
`initializePushNotifications()` is called on app start:

```
App opens
  → getFCMToken() — registers with Firebase, gets token
  → subscribeToTopics()
      → subscribe to "all-users"
      → read selected_region from AsyncStorage
      → look up ISO code via getCountryIsoCode()
      → subscribe to "country-{ISO}" (e.g. "country-QA")
      → get app version via expo-application
      → if version changed: unsubscribe from old "version-{old}"
      → subscribe to "version-{current}" (e.g. "version-4.0.1")
```

When the user changes their region in settings, `updateCountryTopic()` is called
to unsubscribe from the old country topic and subscribe to the new one.

---

## Sending Notifications

Notifications are sent via the **Firebase Admin SDK** using the Python script at
`scripts/send-push.py`.

### Setup

1. Install the Firebase Admin SDK:

   ```bash
   pip install firebase-admin
   ```

2. Download a **service account key** from the Firebase Console:
   - Go to Project Settings → Service Accounts → Generate New Private Key
   - Save the JSON file **outside the repo** (never commit it)

3. Update the `SERVICE_ACCOUNT_KEY` path in `send-push.py` to point to your
   downloaded key file.

### Available Functions

| Function                                         | Description                                 |
| ------------------------------------------------ | ------------------------------------------- |
| `send_to_topic(topic, title, body, ...)`         | Send to a single topic                      |
| `send_to_condition(condition, title, body, ...)` | Send using an FCM condition expression      |
| `send_update_reminder(latest_version, ...)`      | Send to all users NOT on the latest version |
| `send_to_versions(versions, title, body, ...)`   | Send to users on specific version(s)        |

### Parameters

All functions accept these optional parameters:

- `image_url` — URL to an image displayed in the notification
- `data` — Dictionary of string key-value pairs sent as the data payload

---

## FCM Condition Syntax

FCM conditions allow targeting users based on **combinations of topics** using
boolean logic.

### Operators

| Operator | Meaning | Example                                              |
| -------- | ------- | ---------------------------------------------------- |
| `&&`     | AND     | `'all-users' in topics && 'country-QA' in topics`    |
| `\|\|`   | OR      | `'country-QA' in topics \|\| 'country-AE' in topics` |
| `!`      | NOT     | `!('version-4.0.1' in topics)`                       |

### Syntax Rules

- Each topic reference: `'topic-name' in topics`
- Negation wraps the expression: `!('topic-name' in topics)`
- **Maximum 5 topics** per condition
- Parentheses required for NOT expressions
- Conditions can combine AND, OR, and NOT

### Examples

```python
# All Qatar users
"'country-QA' in topics"

# All users EXCEPT those on version 4.0.1
"'all-users' in topics && !('version-4.0.1' in topics)"

# Qatar OR UAE users
"'country-QA' in topics || 'country-AE' in topics"

# Qatar users NOT on the latest version
"'country-QA' in topics && !('version-4.0.1' in topics)"

# Users on old versions (max 4 versions + 1 topic = 5 limit)
"'version-3.8.0' in topics || 'version-3.9.0' in topics"
```

---

## Common Scenarios

### Broadcast to everyone

```python
send_to_topic(
    topic="all-users",
    title="🌙 Eid Mubarak!",
    body="Wishing you and your family a blessed Eid!",
)
```

### Country-specific announcement

```python
send_to_topic(
    topic="country-QA",
    title="🇶🇦 Qatar Update",
    body="Updated prayer times for the new month.",
)
```

### Update reminder (everyone except latest version)

```python
send_update_reminder(latest_version="4.0.1")
# Default title: "📱 App Update Available"
# Default body: "Version 4.0.1 is out with new features! Update now..."
```

### Target users on a buggy version

```python
send_to_versions(
    versions=["3.9.0", "3.9.1"],
    title="⚠️ Known Issue Fix",
    body="We've fixed the notification bug. Please update your app.",
)
```

### Notification with image

```python
send_to_topic(
    topic="all-users",
    title="🌙 Ramadan Mubarak",
    body="May this blessed month bring you peace.",
    image_url="https://example.com/ramadan-greeting.png",
)
```

### Notification with data payload

```python
send_to_topic(
    topic="all-users",
    title="📱 New Feature",
    body="Check out the new Qibla compass!",
    data={"type": "feature-announcement", "feature": "qibla-compass"},
)
```

---

## Limits & Constraints

| Constraint               | Value                                       | Source            |
| ------------------------ | ------------------------------------------- | ----------------- |
| Max topics per condition | 5                                           | FCM documentation |
| Topic name characters    | `[a-zA-Z0-9-_.~%]`                          | FCM documentation |
| Message size limit       | 4 KB (notification + data)                  | FCM documentation |
| Image support            | Android + iOS (URL must be HTTPS)           | FCM documentation |
| Rate limit               | ~500 messages/second per project            | FCM documentation |
| Topic subscribe latency  | May take a few seconds after subscribe call | FCM documentation |

### Notes

- **Topic subscription is idempotent** — calling `subscribeToTopic` multiple
  times for the same topic is safe (no duplicates).
- **Unsubscribing from a non-existent subscription** is also safe — Firebase
  silently ignores it.
- **Foreground notifications** are displayed via Notifee since Firebase
  suppresses system notifications when the app is in the foreground.
- **Background/killed state** notifications are displayed automatically by the
  system (FCM handles delivery via the notification payload).

---

## Adding a New Country

When adding a new country to the app:

1. Add the country to `COUNTRIES` in `app/config/prayerTimeConfig.ts` with:
   - `id`: lowercase country name (e.g. `'bahrain'`)
   - `isoCode`: ISO 3166-1 alpha-2 code (e.g. `'BH'`)
   - `states` and `cities` with prayer time configurations

2. The push notification system will automatically subscribe users who select
   that country to `country-{isoCode}` (e.g. `country-BH`).

3. Update the Python script's examples if desired.

---

## Architecture Reference

```
┌─────────────────────┐    ┌──────────────────────┐
│   Firebase Console  │    │  scripts/send-push.py │
│   (for quick tests) │    │  (Admin SDK)          │
└────────┬────────────┘    └──────────┬───────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────┐
│              Firebase Cloud Messaging            │
│                                                  │
│  Topics:                                         │
│    all-users ──────────────── All devices         │
│    country-QA ─────────────── Qatar devices       │
│    version-4.0.1 ──────────── v4.0.1 devices      │
└────────────────────┬────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ▼                     ▼
   ┌─────────────┐     ┌──────────────┐
   │   Android    │     │     iOS      │
   │  (FCM SDK)   │     │  (APNs+FCM)  │
   └─────────────┘     └──────────────┘
```

For the full push notification implementation guide, see
[PUSH_NOTIFICATIONS.md](PUSH_NOTIFICATIONS.md).
