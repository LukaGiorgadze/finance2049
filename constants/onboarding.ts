export const ONBOARDING_STEPS = [
  'welcome',
  'discovery',
  'theme',
  'import',
  'rate',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export const ONBOARDING_SOURCES = [
  { id: 'appstore', label: 'App Store', icon: 'logo-apple' },
  { id: 'google', label: 'Google', icon: 'search-outline' },
  { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter' },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
  { id: 'ai', label: 'AI / ChatGPT', icon: 'sparkles-outline' },
  { id: 'friends', label: 'Friends', icon: 'people-outline' },
  { id: 'github', label: 'GitHub', icon: 'logo-github' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' },
] as const;

export type OnboardingDiscoverySource = (typeof ONBOARDING_SOURCES)[number]['id'];
export type OnboardingThemeMode = 'light' | 'dark' | 'system';
