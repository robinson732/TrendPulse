import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";

export type Platform = "all" | "twitter" | "instagram" | "tiktok" | "reddit" | "youtube";

export interface Trend {
  id: string;
  keyword: string;
  category: string;
  platform: Platform[];
  volume: number;
  volumeChange: number;
  velocity: "exploding" | "rising" | "stable" | "falling";
  rank: number;
  relatedKeywords: string[];
  volumeHistory: number[];
  peakTime: string;
  sentiment: "positive" | "neutral" | "negative";
  region: string;
  sponsor?: string | null;
  ad_video_url?: string | null;
  ad_headline?: string | null;
  ad_cpm?: number | null;
}

interface TrendsApiResponse {
  trends: Trend[];
  updatedAt: string;
}

interface TrendsContextValue {
  trends: Trend[];
  watchlist: string[];
  selectedPlatform: Platform;
  setSelectedPlatform: (p: Platform) => void;
  addToWatchlist: (id: string) => void;
  removeFromWatchlist: (id: string) => void;
  isWatched: (id: string) => boolean;
  filteredTrends: Trend[];
  searchTrends: (query: string) => Trend[];
  getTrend: (id: string) => Trend | undefined;
  lastUpdated: Date;
  refreshTrends: () => void;
  isRefreshing: boolean;
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
}

const TrendsContext = createContext<TrendsContextValue | null>(null);

const WATCHLIST_KEY = "@trendpulse_watchlist";
const POLL_INTERVAL = 15000;

export function TrendsProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("all");

  const { data, isLoading, isRefetching, dataUpdatedAt, isError, error } = useQuery<TrendsApiResponse>({
    queryKey: ["/api/trends"],
    refetchInterval: POLL_INTERVAL,
    staleTime: POLL_INTERVAL - 1000,
  });

  const { data: ytData, isLoading: ytLoading, isRefetching: ytRefetching } = useQuery<TrendsApiResponse>({
    queryKey: ["/api/trends", "youtube"],
    queryFn: async () => {
      const url = new URL("/api/trends", getApiUrl());
      url.searchParams.set("platform", "youtube");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("YouTube trends fetch failed");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL * 2,
    staleTime: POLL_INTERVAL * 2 - 1000,
  });

  const { data: rdData, isLoading: rdLoading, isRefetching: rdRefetching } = useQuery<TrendsApiResponse>({
    queryKey: ["/api/trends", "reddit"],
    queryFn: async () => {
      const url = new URL("/api/trends", getApiUrl());
      url.searchParams.set("platform", "reddit");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Reddit trends fetch failed");
      return res.json();
    },
    refetchInterval: POLL_INTERVAL * 2,
    staleTime: POLL_INTERVAL * 2 - 1000,
  });

  const trends = data?.trends ?? [];
  const youtubeTrends = ytData?.trends ?? [];
  const redditTrends = rdData?.trends ?? [];
  const lastUpdated = useMemo(() => new Date(dataUpdatedAt || Date.now()), [dataUpdatedAt]);
  const isRefreshing = (isRefetching || ytRefetching || rdRefetching) && !isLoading;
  const errorMessage = isError && error ? (error as Error).message : null;

  useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY).then((raw) => {
      if (raw) setWatchlist(JSON.parse(raw));
    });
  }, []);

  const saveWatchlist = useCallback((list: string[]) => {
    AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  }, []);

  const addToWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => {
      const next = [...prev, id];
      saveWatchlist(next);
      return next;
    });
  }, [saveWatchlist]);

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((w) => w !== id);
      saveWatchlist(next);
      return next;
    });
  }, [saveWatchlist]);

  const isWatched = useCallback((id: string) => watchlist.includes(id), [watchlist]);

  const filteredTrends = useMemo(() => {
    if (selectedPlatform === "youtube") return youtubeTrends;
    if (selectedPlatform === "reddit") return redditTrends;
    if (selectedPlatform === "all") return trends;
    return trends.filter((t) => t.platform.includes(selectedPlatform));
  }, [trends, youtubeTrends, redditTrends, selectedPlatform]);

  const searchTrends = useCallback((query: string): Trend[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return trends.filter(
      (t) =>
        t.keyword.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.relatedKeywords.some((r) => r.toLowerCase().includes(q))
    );
  }, [trends]);

  const getTrend = useCallback((id: string) => trends.find((t) => t.id === id), [trends]);

  const refreshTrends = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/trends"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trends", "youtube"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trends", "reddit"] });
  }, [queryClient]);

  const effectiveIsLoading =
    selectedPlatform === "youtube" ? ytLoading :
    selectedPlatform === "reddit" ? rdLoading :
    isLoading;

  const value = useMemo(
    () => ({
      trends,
      watchlist,
      selectedPlatform,
      setSelectedPlatform,
      addToWatchlist,
      removeFromWatchlist,
      isWatched,
      filteredTrends,
      searchTrends,
      getTrend,
      lastUpdated,
      refreshTrends,
      isRefreshing,
      isLoading: effectiveIsLoading,
      isError,
      errorMessage,
    }),
    [trends, watchlist, selectedPlatform, addToWatchlist, removeFromWatchlist, isWatched, filteredTrends, searchTrends, getTrend, lastUpdated, refreshTrends, isRefreshing, effectiveIsLoading, isError, errorMessage]
  );

  return <TrendsContext.Provider value={value}>{children}</TrendsContext.Provider>;
}

export function useTrends() {
  const ctx = useContext(TrendsContext);
  if (!ctx) throw new Error("useTrends must be used within TrendsProvider");
  return ctx;
}
