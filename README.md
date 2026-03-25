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

## Getting Started

1. Install dependencies:

```bash
yarn install
```

2. Install the Supabase CLI as a dev dependency:

```bash
yarn add -D supabase
```

3. Set the required Expo public Supabase variables in `.env` or `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=""
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
```

4. Log in to Supabase and link this repo to your project:

```bash
yarn supabase login
yarn supabase link --project-ref <your-project-ref>
```

5. Push the database migration to your remote Supabase project:

```bash
yarn supabase db push
```

6. Configure production [Edge Function secrets:](https://supabase.com/docs/guides/functions/secrets#production-secrets)

Set these custom secrets for your deployed functions:

```env
MASSIVE_API_KEY=
OPENAI_API_KEY=
```

You can set them in the Supabase dashboard or with the CLI:

```bash
yarn supabase secrets set MASSIVE_API_KEY=your_massive_api_key OPENAI_API_KEY=your_openai_api_key
```

These built-in secrets should already exist by default, but make sure they are present:

```env
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_DB_URL
```

7. Deploy the Supabase Edge Functions:

```bash
yarn deploy
```

8. Start the Expo development server:

```bash
npx expo start
```

Available Expo commands:

```bash
npx expo run:android
npx expo run:ios
npx expo start --web
```

## Troubleshooting

You might see these warnings in the console:

```text
Could not parse Expo config: android.googleServicesFile: "./android/app/google-services.json"
Could not parse Expo config: ios.googleServicesFile: "./ios/GoogleService-Info.plist"
```

These are Firebase config file warnings. They are safe to ignore if you are not using Firebase locally, and the app should still work. If you do want Firebase features, add the Android `google-services.json` file and the iOS `GoogleService-Info.plist` file in those paths, then rebuild the app.
