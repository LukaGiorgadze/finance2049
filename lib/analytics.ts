import {
  type OnboardingDiscoverySource,
  type OnboardingStep,
  type OnboardingThemeMode,
} from "@/constants/onboarding";
import { reportWarning } from "@/lib/crashlytics";
import analytics from "@react-native-firebase/analytics";

type AnalyticsParams = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | null | undefined
>;

async function logEvent(name: string, params?: AnalyticsParams) {
  try {
    await analytics().logEvent(name, params);
  } catch (error) {
    reportWarning(`analytics.logEvent failed: ${name}`, error, {
      analytics_method: "logEvent",
      analytics_event_name: name,
      analytics_params: params ? JSON.stringify(params) : undefined,
    });
  }
}

async function setUserProperty(name: string, value: string) {
  try {
    await analytics().setUserProperty(name, value);
  } catch (error) {
    reportWarning(`analytics.setUserProperty failed: ${name}`, error, {
      analytics_method: "setUserProperty",
      analytics_property_name: name,
      analytics_property_value: value,
    });
  }
}

export async function trackOnboardingScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Onboarding",
      screen_class: "OnboardingScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: onboarding", error, {
      analytics_method: "logScreenView",
      screen_name: "Onboarding",
      screen_class: "OnboardingScreen",
    });
  }
}

export async function trackOnboardingStarted() {
  await Promise.all([
    logEvent("onboarding_started"),
    setUserProperty("onboarding_state", "started"),
  ]);
}

export async function trackOnboardingStepViewed(
  step: OnboardingStep,
  stepIndex: number,
) {
  await logEvent("onboarding_step_viewed", {
    step_name: step,
    step_index: stepIndex,
  });
}

export async function trackOnboardingNavigation(params: {
  action: "next" | "back" | "skip" | "jump_to_rate" | "complete";
  step: OnboardingStep;
  stepIndex: number;
  cta: string;
}) {
  await logEvent("onboarding_navigation", {
    action: params.action,
    step_name: params.step,
    step_index: params.stepIndex,
    cta: params.cta,
  });
}

export async function trackOnboardingDiscoverySelected(
  source: OnboardingDiscoverySource,
) {
  await Promise.all([
    logEvent("onboarding_discovery_selected", { source }),
    setUserProperty("discovery_source", source),
  ]);
}

export async function trackOnboardingThemeSelected(theme: OnboardingThemeMode) {
  await Promise.all([
    logEvent("onboarding_theme_selected", { theme }),
    setUserProperty("theme_pref", theme),
  ]);
}

export async function trackOnboardingImportDecision(
  choice: "import_now" | "later",
) {
  await logEvent("onboarding_import_decision", { choice });
}

export async function trackOnboardingReviewPrompt(
  status: "requested" | "unavailable" | "failed",
) {
  await logEvent("onboarding_review_prompt", { status });
}

export async function trackOnboardingExited(params: {
  step: OnboardingStep;
  stepIndex: number;
  discoverySource: OnboardingDiscoverySource | null;
  importPlanned: boolean;
}) {
  await logEvent("onboarding_exited", {
    step_name: params.step,
    step_index: params.stepIndex,
    discovery_source: params.discoverySource ?? "unknown",
    import_planned: params.importPlanned,
  });
}

export async function trackOnboardingCompleted(params: {
  discoverySource: OnboardingDiscoverySource | null;
  theme: OnboardingThemeMode;
  importPlanned: boolean;
}) {
  await Promise.all([
    logEvent("onboarding_completed", {
      discovery_source: params.discoverySource ?? "unknown",
      theme: params.theme,
      import_planned: params.importPlanned,
    }),
    setUserProperty("onboarding_done", "true"),
    setUserProperty("onboarding_state", "completed"),
  ]);
}

export async function trackHomeScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Home",
      screen_class: "HomeScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: home", error, {
      analytics_method: "logScreenView",
      screen_name: "Home",
      screen_class: "HomeScreen",
    });
  }
}

export async function trackHomeAction(params: {
  action:
    | "refresh"
    | "search_open"
    | "search_select_asset"
    | "market_chart_tab"
    | "market_status_open"
    | "top_movers_more"
    | "top_movers_open_stock"
    | "news_more"
    | "news_open_article"
    | "portfolio_toggle_visibility"
    | "portfolio_view_details"
    | "portfolio_add_transaction"
    | "portfolio_import";
  target?: string;
}) {
  await logEvent("home_action", {
    action: params.action,
    target: params.target,
  });
}

export async function trackPortfolioScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Portfolio",
      screen_class: "PortfolioScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: portfolio", error, {
      analytics_method: "logScreenView",
      screen_name: "Portfolio",
      screen_class: "PortfolioScreen",
    });
  }
}

export async function trackPortfolioAction(params: {
  action:
    | "refresh"
    | "search_open"
    | "search_select_asset"
    | "holding_open_stock"
    | "holding_sort"
    | "holding_toggle_gain_view"
    | "holding_open_lots"
    | "holding_buy"
    | "holding_sell"
    | "asset_allocation_toggle"
    | "empty_add_transaction"
    | "empty_import";
  target?: string;
}) {
  await logEvent("portfolio_action", {
    action: params.action,
    target: params.target,
  });
}

export async function trackStatisticsScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Statistics",
      screen_class: "StatisticsScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: statistics", error, {
      analytics_method: "logScreenView",
      screen_name: "Statistics",
      screen_class: "StatisticsScreen",
    });
  }
}

export async function trackStatisticsAction(params: {
  action:
    | "refresh"
    | "search_open"
    | "search_select_asset"
    | "pnl_range_change"
    | "ticker_filter_change"
    | "ticker_open_analytics";
  target?: string;
}) {
  await logEvent("statistics_action", {
    action: params.action,
    target: params.target,
  });
}

export async function trackSettingsScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Settings",
      screen_class: "SettingsScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: settings", error, {
      analytics_method: "logScreenView",
      screen_name: "Settings",
      screen_class: "SettingsScreen",
    });
  }
}

export async function trackSettingsAction(params: {
  action:
    | "theme_change"
    | "backup_export"
    | "backup_restore"
    | "open_storage"
    | "open_support"
    | "open_about"
    | "open_external_link";
  target?: string;
}) {
  await logEvent("settings_action", {
    action: params.action,
    target: params.target,
  });
}

export async function trackNewsScreen(params: {
  articleId?: string;
  source?: string;
}) {
  try {
    await analytics().logScreenView({
      screen_name: "NewsDetail",
      screen_class: "NewsDetailScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: news_detail", error, {
      analytics_method: "logScreenView",
      screen_name: "NewsDetail",
      screen_class: "NewsDetailScreen",
    });
  }

  await logEvent("news_screen_view", {
    article_id: params.articleId,
    source: params.source,
  });
}

export async function trackNewsAction(params: {
  action:
    | "open_news_list"
    | "open_article"
    | "open_full_article"
    | "open_related_ticker"
    | "search_open"
    | "search_select_asset";
  target?: string;
  source?: string;
}) {
  await logEvent("news_action", {
    action: params.action,
    target: params.target,
    source: params.source,
  });
}

export async function trackSearchAction(params: {
  context: string;
  action: "modal_open" | "modal_close" | "query" | "select_asset" | "load_more";
  target?: string;
}) {
  await logEvent("search_action", {
    context: params.context,
    action: params.action,
    target: params.target,
  });
}

export async function trackTransactionsScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Transactions",
      screen_class: "TransactionsScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: transactions", error, {
      analytics_method: "logScreenView",
      screen_name: "Transactions",
      screen_class: "TransactionsScreen",
    });
  }
}

export async function trackTransactionsAction(params: {
  action:
    | "search_open"
    | "search_select_asset"
    | "form_import"
    | "form_type_change"
    | "form_quantity_mode_change"
    | "form_open_symbol_search"
    | "form_select_symbol"
    | "form_open_date"
    | "form_fill_all_shares"
    | "form_submit"
    | "form_cancel"
    | "modal_open"
    | "modal_close"
    | "modal_import";
  target?: string;
  context?: string;
}) {
  await logEvent("transactions_action", {
    action: params.action,
    target: params.target,
    context: params.context,
  });
}

export async function trackImportScreen(screen: "upload" | "confirm") {
  const screenName = screen === "upload" ? "ImportTransactions" : "ImportConfirm";
  const screenClass = screen === "upload" ? "ImportTransactionsScreen" : "ImportConfirmScreen";

  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass,
    });
  } catch (error) {
    reportWarning(`analytics.logScreenView failed: import_${screen}`, error, {
      analytics_method: "logScreenView",
      screen_name: screenName,
      screen_class: screenClass,
    });
  }
}

export async function trackImportAction(params: {
  action:
    | "back"
    | "open_source_sheet"
    | "close_source_sheet"
    | "pick_source"
    | "files_added"
    | "file_removed"
    | "upload_start"
    | "upload_success"
    | "upload_failure"
    | "review_expand_files"
    | "review_toggle_failed_files"
    | "review_dismiss_failed_files"
    | "review_toggle_group"
    | "review_open_symbol_search"
    | "review_select_symbol"
    | "review_change_tx_type"
    | "review_remove_tx"
    | "review_remove_group"
    | "review_import";
  target?: string;
  count?: number;
  step?: "upload" | "confirm";
}) {
  await logEvent("import_action", {
    action: params.action,
    target: params.target,
    count: params.count,
    step: params.step,
  });
}

export async function trackStockScreen(symbol: string) {
  try {
    await analytics().logScreenView({
      screen_name: "StockDetail",
      screen_class: "StockDetailScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: stock_detail", error, {
      analytics_method: "logScreenView",
      screen_name: "StockDetail",
      screen_class: "StockDetailScreen",
    });
  }

  await logEvent("stock_screen_view", { symbol });
}

export async function trackStockAction(params: {
  action:
    | "refresh"
    | "search_open"
    | "search_select_asset"
    | "open_menu"
    | "record_transaction"
    | "remove_position"
    | "open_website"
    | "call_phone"
    | "chart_timeline_change";
  symbol: string;
  target?: string;
}) {
  await logEvent("stock_action", {
    action: params.action,
    symbol: params.symbol,
    target: params.target,
  });
}

export async function trackTopMoversScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "TopMovers",
      screen_class: "TopMoversScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: top_movers", error, {
      analytics_method: "logScreenView",
      screen_name: "TopMovers",
      screen_class: "TopMoversScreen",
    });
  }
}

export async function trackTopMoversAction(params: {
  action: "refresh" | "filter_change" | "open_stock";
  target?: string;
}) {
  await logEvent("top_movers_action", {
    action: params.action,
    target: params.target,
  });
}

export async function trackStorageScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Storage",
      screen_class: "StorageScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: storage", error, {
      analytics_method: "logScreenView",
      screen_name: "Storage",
      screen_class: "StorageScreen",
    });
  }
}

export async function trackStorageAction(params: {
  action: "back" | "clear_cache" | "clear_all_data";
}) {
  await logEvent("storage_action", { action: params.action });
}

export async function trackPositionDetailAction(params: {
  context: "stock_detail" | "portfolio" | "statistics";
  action:
    | "modal_open"
    | "modal_close"
    | "toggle_view"
    | "open_lots"
    | "open_history"
    | "delete_transaction"
    | "delete_lot";
  symbol: string;
  target?: string;
}) {
  await logEvent("position_detail_action", {
    context: params.context,
    action: params.action,
    symbol: params.symbol,
    target: params.target,
  });
}
