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
npm install
```

2. Set the required Expo public Supabase variables in `.env` or `.env.local`:

```env
EXPO_PUBLIC_SUPABASE_URL=""
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
```

3. Start the Expo development server:

```bash
npx expo start
```

Available Expo commands:

```bash
npx expo run:android
npx expo run:ios
npx expo start --web
```
