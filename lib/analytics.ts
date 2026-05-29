import AsyncStorage from "@react-native-async-storage/async-storage";
import { getAnalyticsInstance, isFirebaseConfigured } from "./firebaseConfig";
import { logEvent as firebaseLogEvent } from "firebase/analytics";

const CONSENT_VALUE_KEY = "@trendpulse_consent_value";

let consentGranted: boolean | null = null;

export async function loadConsentStatus(): Promise<boolean> {
  if (consentGranted !== null) return consentGranted;
  try {
    const val = await AsyncStorage.getItem(CONSENT_VALUE_KEY);
    consentGranted = val === "true";
  } catch {
    consentGranted = false;
  }
  return consentGranted ?? false;
}

export async function setConsentStatus(consented: boolean): Promise<void> {
  consentGranted = consented;
  await AsyncStorage.setItem(CONSENT_VALUE_KEY, consented ? "true" : "false");
}

export async function trackEvent(
  eventName: string,
  params?: Record<string, string | number>
): Promise<void> {
  const hasConsent = await loadConsentStatus();
  if (!hasConsent) return;

  if (!isFirebaseConfigured()) return;

  try {
    const analytics = await getAnalyticsInstance();
    if (analytics) {
      firebaseLogEvent(analytics, eventName, params);
    }
  } catch {
  }
}

export async function trackScreenView(screenName: string): Promise<void> {
  await trackEvent("screen_view", { screen_name: screenName });
}

export async function trackTrendView(trendId: string, keyword: string): Promise<void> {
  await trackEvent("trend_view", { trend_id: trendId, keyword });
}

export async function trackPulseView(trendId: string): Promise<void> {
  await trackEvent("pulse_view", { trend_id: trendId });
}

export async function trackShare(trendId: string, method: string): Promise<void> {
  await trackEvent("share", { trend_id: trendId, method });
}

export async function trackSearch(query: string): Promise<void> {
  await trackEvent("search", { search_term: query });
}

export async function trackWatchlistAction(
  trendId: string,
  action: "add" | "remove"
): Promise<void> {
  await trackEvent("watchlist_action", { trend_id: trendId, action });
}

export type InteractionType =
  | "view"
  | "click"
  | "post_creation"
  | "media_attach"
  | "boost_request"
  | "ad_impression"
  | "ad_click";

export async function trackTrendInteraction(
  trendId: string,
  interactionType: InteractionType,
  extra?: Record<string, string | number>
): Promise<void> {
  await trackEvent("trend_engagement", {
    trend_id: trendId,
    type: interactionType,
    timestamp: Date.now(),
    ...extra,
  });
}

export async function trackBrandView(
  trendId: string,
  keyword: string,
  cpm: string,
  tier: string
): Promise<void> {
  await trackEvent("brand_analytics_view", {
    trend_id: trendId,
    keyword,
    cpm,
    tier,
    timestamp: Date.now(),
  });
}

export async function trackPostCreation(
  trendId: string,
  hasMedia: boolean,
  hasLink: boolean
): Promise<void> {
  await trackTrendInteraction(trendId, "post_creation", {
    has_media: hasMedia ? 1 : 0,
    has_link: hasLink ? 1 : 0,
  });
}

export async function trackAdInteraction(
  trendId: string,
  type: "ad_impression" | "ad_click",
  brand?: string
): Promise<void> {
  await trackTrendInteraction(trendId, type, {
    ...(brand ? { brand } : {}),
  });
}
