# Finance 2049

<p align="center">
  <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_home.png" alt="Finance 2049 home screen" width="45%" />
  <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_home_dark.png" alt="Finance 2049 home screen dark mode" width="45%" />
</p>

<details>
  <summary><strong>Open more screenshots</strong></summary>
  <br />

  <p align="center">
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_ticker.png" alt="Finance 2049 NVDA ticker screen dark mode" width="45%" />
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_ticker_dark.png" alt="Finance 2049 NVDA ticker screen dark mode" width="45%" />
  </p>

  <p align="center">
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_portfolio.png" alt="Finance 2049 portfolio screen light mode" width="45%" />
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_portfolio_dark.png" alt="Finance 2049 portfolio screen dark mode" width="45%" />
  </p>

  <p align="center">
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_analytics.png" alt="Finance 2049 analytics screen light mode" width="45%" />
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_analytics_dark.png" alt="Finance 2049 analytics screen dark mode" width="45%" />
  </p>

  <p align="center">
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_news.png" alt="Finance 2049 news screen light mode" width="45%" />
    <img src="https://raw.githubusercontent.com/LukaGiorgadze/finance2049.com/refs/heads/main/public/app_news_dark.png" alt="Finance 2049 news screen dark mode" width="45%" />
  </p>
</details>

---

Simple, open-source portfolio tracking app for long-term investors.

Finance 2049 helps you clearly understand how much you invested, how your portfolio performs over time, and what you actually earned — without trading noise, subscriptions, or complex tools.

## Why Finance 2049

Most finance apps are built as full investing platforms with busy interfaces and unnecessary features for long-term investors.  
Others are simple but too limited and do not provide essential portfolio analytics.

Finance 2049 is built in the middle — calm, simple, but complete.

## Features

- Portfolio value and total return tracking
- Cost basis and invested capital visibility
- Realized and unrealized gains separation
- Transaction and lot history
- Performance analytics
- Import transactions from `.xlsx`, `.json`, `.pdf`, images and more
- Export full portfolio data anytime
- Local-first storage (your data stays on your device)
- Fully open-source and transparent

## Not a trading app

Finance 2049 does not support buying or selling assets.  
It is designed purely for portfolio tracking and performance understanding.

## Data & Privacy

All portfolio data is stored locally on your device.  
No subscriptions. No hidden tracking. Full control.

## Status

Early stage project. Feedback and contributions are welcome.

## Self-Hosting

Finance 2049 is local-first, but a full self-hosted install uses a few trusted services:

- **Supabase** for anonymous auth, database migrations, and Edge Functions
- **Massive** for market data through the `massive-proxy` Edge Function
- **OpenAI** for transaction extraction through the `extract-transactions` Edge Function
- **Firebase** for Analytics, Crashlytics, In-App Messaging, and FCM push notifications
- **Apple Developer / Google Firebase app config** for production mobile push delivery

Portfolio data stays on the device. The hosted backend stores only operational metadata such as anonymous user identity and notification device tokens.

### Prerequisites

- Node.js and Yarn
- Supabase CLI
- Xcode for iOS builds
- Android Studio for Android builds
- A Supabase project
- A Firebase project with iOS and Android apps
- Massive API key
- OpenAI API key
- Apple Developer account if you want iOS push notifications

This app uses native Firebase modules, so Expo Go is not enough for a full local test. Use native builds with `npx expo run:ios` and `npx expo run:android`, or build from Xcode/Android Studio.

### 1. Install Dependencies

```bash
yarn install
```

If you do not already have the Supabase CLI installed globally, install it for this repo:

```bash
yarn add -D supabase
```

### 2. Configure Environment Variables

Create `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=""
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
```

Use your Supabase project URL and publishable/anon key.

### 3. Configure Supabase

Log in and link the repo:

```bash
yarn supabase login
yarn supabase link --project-ref <your-project-ref>
```

Enable anonymous auth in Supabase:

```text
Supabase Dashboard -> Authentication -> Sign In / Providers -> Anonymous Sign-Ins
```

Push database migrations:

```bash
yarn supabase db push
```

This creates the app tables, including `notification_devices` for push token metadata.

### 4. Configure Edge Function Secrets

Set these production secrets in Supabase:

```env
MASSIVE_API_KEY=
OPENAI_API_KEY=
```

Dashboard path:

```text
Supabase Dashboard -> Edge Functions -> Secrets
```

Or set them with the CLI:

```bash
yarn supabase secrets set MASSIVE_API_KEY=your_massive_api_key OPENAI_API_KEY=your_openai_api_key
```

These built-in Supabase secrets should already exist:

```env
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
```

Deploy Edge Functions:

```bash
yarn deploy
```

### 5. Configure Firebase

Create Firebase iOS and Android apps with IDs that match `app.json`:

```text
iOS bundle ID: com.lomsa.finance2049
Android package: com.lomsa.finance2049
```

Download the Firebase config files into these exact paths:

```text
ios/GoogleService-Info.plist
android/app/google-services.json
```

Firebase Console paths:

```text
Firebase Console -> Project settings -> General -> Your apps
Firebase Console -> Project settings -> Cloud Messaging
Firebase Console -> Run -> In-App Messaging
```

For iOS push notifications, upload an APNs authentication key in Firebase:

```text
Firebase Console -> Project settings -> Cloud Messaging -> Apple app configuration -> APNs Authentication Key
```

You do not need Apple Push Notification service SSL certificates if Firebase has a valid APNs auth key.

### 6. Configure Apple and Android Push

Apple Developer Console:

```text
Certificates, Identifiers & Profiles -> Identifiers -> your App ID -> Capabilities -> Push Notifications
```

Xcode:

```text
Target -> Signing & Capabilities -> Push Notifications
Target -> Signing & Capabilities -> Background Modes -> Remote notifications
```

Android notification permission is declared in `app.json`:

```text
android.permission.POST_NOTIFICATIONS
```

Android 13+ still asks the user for runtime permission when push notifications are enabled.

### 7. Run Locally

Start Metro:

```bash
npx expo start
```

Build and run native apps:

```bash
npx expo run:android
npx expo run:ios
```

If you build iOS directly from Xcode after adding native dependencies, run:

```bash
cd ios && pod install
```

### 8. Push Notifications

In the app:

```text
Settings -> Notifications -> Push Notifications
```

Supported FCM data payload examples:

```json
{ "type": "stock", "symbol": "AAPL", "notification_id": "unique-id" }
```

```json
{ "type": "portfolio", "notification_id": "unique-id" }
```

```json
{ "type": "import_result", "notification_id": "unique-id" }
```

```json
{
  "type": "article",
  "article_id": "article-id",
  "title": "Article title",
  "url": "https://example.com/article",
  "source": "Source name",
  "published_at": "2026-05-19T12:00:00Z",
  "notification_id": "unique-id"
}
```

Route-style payloads are also supported:

```json
{ "route": "/stock/AAPL", "notification_id": "unique-id" }
```

```json
{ "route": "/news/article-id", "title": "Article title", "url": "https://example.com/article", "notification_id": "unique-id" }
```

### 9. Test Firebase In-App Messaging

Firebase Console:

```text
Firebase Console -> Run -> In-App Messaging -> Create campaign -> Test on device
```

In-app messages are enabled by default and can be controlled from:

```text
Settings -> Notifications -> In-App Messages
```

Messages are suppressed during onboarding, transaction import, and app modals so campaigns do not interrupt critical workflows.

### 10. Production Checklist

- Supabase migrations are pushed.
- Supabase Edge Function secrets are set.
- Supabase Edge Functions are deployed.
- Firebase iOS and Android config files match your app IDs.
- Firebase Cloud Messaging has an APNs auth key for iOS.
- Apple App ID has Push Notifications enabled.
- Xcode target has Push Notifications and Remote notifications background mode.
- Android package name matches Firebase and `app.json`.
- Real devices have tested push delivery.
- In-App Messaging campaign test device works.
- Store builds were created from the native iOS/Android projects or equivalent CI.

## Troubleshooting

You might see these warnings in the console:

```text
Could not parse Expo config: android.googleServicesFile: "./android/app/google-services.json"
Could not parse Expo config: ios.googleServicesFile: "./ios/GoogleService-Info.plist"
```

These are Firebase config file warnings. They are safe to ignore only if you are not testing Firebase locally. If you want Firebase features, add the Android `google-services.json` file and the iOS `GoogleService-Info.plist` file in those paths, then rebuild the app.

If iOS push registration fails with an APNs token error:

- Use a real iOS device.
- Confirm Push Notifications capability is enabled in Apple Developer Console.
- Confirm Xcode Signing & Capabilities includes Push Notifications.
- Confirm Firebase has the APNs auth key uploaded.
- Rebuild the app after changing native capabilities.

If Android push delivery is missing:

- Confirm notification permission is allowed in Android system settings.
- Check `adb logcat` for `RNFirebaseMsgReceiver`.
- Make sure you rebuilt after changing native notification dependencies.
