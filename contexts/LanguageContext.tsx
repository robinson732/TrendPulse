import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "en" | "fr" | "es" | "de" | "pt" | "ar" | "zh" | "ja";

interface LanguageOption {
  code: Language;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

type TranslationKey =
  | "trending" | "search" | "watchlist" | "alerts" | "myInteractions"
  | "shareApp" | "aboutTrendPulse" | "language" | "volume" | "velocity"
  | "topics" | "live" | "updated" | "selectLanguage" | "cancel"
  | "all" | "exploding" | "rising" | "stable" | "falling"
  | "noTrends" | "searchPlaceholder" | "emptyWatchlist";

const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    trending: "Trending", search: "Search", watchlist: "Watchlist",
    alerts: "Alerts", myInteractions: "My Interactions", shareApp: "Share App",
    aboutTrendPulse: "About TrendPulse", language: "Language", volume: "Volume",
    velocity: "Velocity", topics: "Topics", live: "LIVE", updated: "Updated",
    selectLanguage: "Select Language", cancel: "Cancel",
    all: "All", exploding: "Exploding", rising: "Rising", stable: "Stable", falling: "Falling",
    noTrends: "No trends found", searchPlaceholder: "Search trends...", emptyWatchlist: "No saved trends yet",
  },
  fr: {
    trending: "Tendances", search: "Rechercher", watchlist: "Favoris",
    alerts: "Alertes", myInteractions: "Mes Interactions", shareApp: "Partager l'app",
    aboutTrendPulse: "À propos de TrendPulse", language: "Langue", volume: "Volume",
    velocity: "Vélocité", topics: "Sujets", live: "EN DIRECT", updated: "Mis à jour",
    selectLanguage: "Choisir la langue", cancel: "Annuler",
    all: "Tout", exploding: "Explosif", rising: "En hausse", stable: "Stable", falling: "En baisse",
    noTrends: "Aucune tendance trouvée", searchPlaceholder: "Rechercher des tendances...", emptyWatchlist: "Aucune tendance sauvegardée",
  },
  es: {
    trending: "Tendencias", search: "Buscar", watchlist: "Favoritos",
    alerts: "Alertas", myInteractions: "Mis Interacciones", shareApp: "Compartir App",
    aboutTrendPulse: "Sobre TrendPulse", language: "Idioma", volume: "Volumen",
    velocity: "Velocidad", topics: "Temas", live: "EN VIVO", updated: "Actualizado",
    selectLanguage: "Seleccionar idioma", cancel: "Cancelar",
    all: "Todo", exploding: "Explosivo", rising: "Subiendo", stable: "Estable", falling: "Bajando",
    noTrends: "No se encontraron tendencias", searchPlaceholder: "Buscar tendencias...", emptyWatchlist: "Sin tendencias guardadas",
  },
  de: {
    trending: "Trends", search: "Suchen", watchlist: "Merkliste",
    alerts: "Benachrichtigungen", myInteractions: "Meine Interaktionen", shareApp: "App teilen",
    aboutTrendPulse: "Über TrendPulse", language: "Sprache", volume: "Volumen",
    velocity: "Geschwindigkeit", topics: "Themen", live: "LIVE", updated: "Aktualisiert",
    selectLanguage: "Sprache wählen", cancel: "Abbrechen",
    all: "Alle", exploding: "Explosiv", rising: "Steigend", stable: "Stabil", falling: "Fallend",
    noTrends: "Keine Trends gefunden", searchPlaceholder: "Trends suchen...", emptyWatchlist: "Keine gespeicherten Trends",
  },
  pt: {
    trending: "Tendências", search: "Pesquisar", watchlist: "Favoritos",
    alerts: "Alertas", myInteractions: "Minhas Interações", shareApp: "Compartilhar App",
    aboutTrendPulse: "Sobre TrendPulse", language: "Idioma", volume: "Volume",
    velocity: "Velocidade", topics: "Tópicos", live: "AO VIVO", updated: "Atualizado",
    selectLanguage: "Selecionar idioma", cancel: "Cancelar",
    all: "Todos", exploding: "Explosivo", rising: "Subindo", stable: "Estável", falling: "Caindo",
    noTrends: "Nenhuma tendência encontrada", searchPlaceholder: "Pesquisar tendências...", emptyWatchlist: "Nenhuma tendência salva",
  },
  ar: {
    trending: "الأكثر رواجاً", search: "بحث", watchlist: "المفضلة",
    alerts: "التنبيهات", myInteractions: "تفاعلاتي", shareApp: "مشاركة التطبيق",
    aboutTrendPulse: "حول TrendPulse", language: "اللغة", volume: "الحجم",
    velocity: "السرعة", topics: "المواضيع", live: "مباشر", updated: "تحديث",
    selectLanguage: "اختر اللغة", cancel: "إلغاء",
    all: "الكل", exploding: "متفجر", rising: "صاعد", stable: "مستقر", falling: "هابط",
    noTrends: "لا توجد اتجاهات", searchPlaceholder: "بحث عن اتجاهات...", emptyWatchlist: "لا توجد اتجاهات محفوظة",
  },
  zh: {
    trending: "热门趋势", search: "搜索", watchlist: "收藏",
    alerts: "通知", myInteractions: "我的互动", shareApp: "分享应用",
    aboutTrendPulse: "关于 TrendPulse", language: "语言", volume: "热度",
    velocity: "速度", topics: "话题", live: "实时", updated: "更新于",
    selectLanguage: "选择语言", cancel: "取消",
    all: "全部", exploding: "爆发", rising: "上升", stable: "稳定", falling: "下降",
    noTrends: "未找到趋势", searchPlaceholder: "搜索趋势...", emptyWatchlist: "暂无收藏",
  },
  ja: {
    trending: "トレンド", search: "検索", watchlist: "ウォッチリスト",
    alerts: "通知", myInteractions: "マイインタラクション", shareApp: "アプリを共有",
    aboutTrendPulse: "TrendPulseについて", language: "言語", volume: "ボリューム",
    velocity: "速度", topics: "トピック", live: "ライブ", updated: "更新",
    selectLanguage: "言語を選択", cancel: "キャンセル",
    all: "すべて", exploding: "爆発的", rising: "上昇中", stable: "安定", falling: "下降中",
    noTrends: "トレンドが見つかりません", searchPlaceholder: "トレンドを検索...", emptyWatchlist: "保存済みのトレンドはありません",
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  currentFlag: string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key) => key,
  currentFlag: "🇺🇸",
});

const STORAGE_KEY = "@trendpulse_language";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && translations[saved as Language]) {
        setLanguageState(saved as Language);
      }
    }).catch(() => {});
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  };

  const t = (key: TranslationKey): string => {
    return translations[language]?.[key] || translations.en[key] || key;
  };

  const currentFlag = LANGUAGES.find((l) => l.code === language)?.flag || "🇺🇸";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, currentFlag }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
