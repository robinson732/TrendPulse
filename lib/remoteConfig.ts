import { Platform } from "react-native";
import { isFirebaseConfigured, getFirebaseAuth } from "./firebaseConfig";
import { initializeApp, getApps, getApp } from "firebase/app";

export interface RemoteConfigValues {
  pulse_enabled: boolean;
  ads_enabled: boolean;
  brand_analytics_enabled: boolean;
  max_trends: number;
  ad_refresh_interval_ms: number;
  welcome_message: string;
  min_post_length: number;
  max_post_length: number;
}

const DEFAULTS: RemoteConfigValues = {
  pulse_enabled: true,
  ads_enabled: true,
  brand_analytics_enabled: true,
  max_trends: 20,
  ad_refresh_interval_ms: 30000,
  welcome_message: "Bienvenue sur TrendPulse !",
  min_post_length: 3,
  max_post_length: 280,
};

let _config: RemoteConfigValues = { ...DEFAULTS };
let _fetched = false;

export function getRemoteConfig(): RemoteConfigValues {
  return _config;
}

export async function fetchRemoteConfig(): Promise<RemoteConfigValues> {
  if (_fetched) return _config;
  if (!isFirebaseConfigured() || Platform.OS !== "web") {
    _fetched = true;
    return _config;
  }

  try {
    const { getRemoteConfig: getRC, fetchAndActivate, getValue } = await import("firebase/remote-config");
    const app = getApps().length > 0 ? getApp() : null;
    if (!app) return _config;

    const rc = getRC(app);
    rc.defaultConfig = DEFAULTS as unknown as Record<string, string | number | boolean>;
    rc.settings = { minimumFetchIntervalMillis: 3600000, fetchTimeoutMillis: 10000 };

    await fetchAndActivate(rc);

    _config = {
      pulse_enabled: getValue(rc, "pulse_enabled").asBoolean(),
      ads_enabled: getValue(rc, "ads_enabled").asBoolean(),
      brand_analytics_enabled: getValue(rc, "brand_analytics_enabled").asBoolean(),
      max_trends: getValue(rc, "max_trends").asNumber() || DEFAULTS.max_trends,
      ad_refresh_interval_ms: getValue(rc, "ad_refresh_interval_ms").asNumber() || DEFAULTS.ad_refresh_interval_ms,
      welcome_message: getValue(rc, "welcome_message").asString() || DEFAULTS.welcome_message,
      min_post_length: getValue(rc, "min_post_length").asNumber() || DEFAULTS.min_post_length,
      max_post_length: getValue(rc, "max_post_length").asNumber() || DEFAULTS.max_post_length,
    };

    console.log("[RemoteConfig] Fetched and activated config");
    _fetched = true;
  } catch (err) {
    console.warn("[RemoteConfig] Fetch failed, using defaults:", err);
    _fetched = true;
  }

  return _config;
}
