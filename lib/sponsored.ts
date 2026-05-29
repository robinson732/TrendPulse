import * as Linking from "expo-linking";
import { Alert } from "react-native";
import { trackEvent } from "./analytics";

export interface SponsoredContent {
  brand: string;
  label: string;
  url: string;
  keywords: string[];
  videoUrl?: string;
}

const SPONSORED_DATA: SponsoredContent[] = [
  {
    brand: "NordVPN",
    label: "Watch now",
    url: "https://nordvpn.com/trendpulse",
    keywords: ["ai", "tech", "crypto", "blockchain", "cybersecurity", "privacy"],
    videoUrl: "https://videos.pexels.com/video-files/855282/855282-sd_640_360_25fps.mp4",
  },
  {
    brand: "Spotify",
    label: "Listen now",
    url: "https://open.spotify.com",
    keywords: ["music", "k-pop", "pop", "hiphop", "concert", "festival", "grammy"],
    videoUrl: "https://videos.pexels.com/video-files/854614/854614-sd_640_360_25fps.mp4",
  },
  {
    brand: "Nike",
    label: "Shop now",
    url: "https://www.nike.com",
    keywords: ["sports", "nba", "nfl", "soccer", "football", "olympics", "fitness"],
    videoUrl: "https://videos.pexels.com/video-files/853825/853825-sd_640_360_25fps.mp4",
  },
  {
    brand: "Netflix",
    label: "Watch now",
    url: "https://www.netflix.com",
    keywords: ["netflix", "streaming", "movie", "series", "film", "tv", "entertainment"],
    videoUrl: "https://videos.pexels.com/video-files/856028/856028-sd_640_360_25fps.mp4",
  },
  {
    brand: "CoinBase",
    label: "Trade now",
    url: "https://www.coinbase.com",
    keywords: ["bitcoin", "ethereum", "crypto", "defi", "nft", "web3"],
    videoUrl: "https://videos.pexels.com/video-files/3141208/3141208-sd_640_360_25fps.mp4",
  },
];

export function getSponsoredForTrend(keyword: string, category: string): SponsoredContent | null {
  const lowerKeyword = keyword.toLowerCase();
  const lowerCategory = category.toLowerCase();

  for (const sponsor of SPONSORED_DATA) {
    const match = sponsor.keywords.some(
      (kw) => lowerKeyword.includes(kw) || lowerCategory.includes(kw)
    );
    if (match) return sponsor;
  }
  return null;
}

export async function handleSponsoredClick(
  brand: string,
  url: string,
  trendId: string,
  hashtag?: string
): Promise<void> {
  trackEvent("sponsored_click", {
    brand,
    trend_id: trendId,
    hashtag: hashtag || trendId,
  });

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Could not open link", `Visit ${url} in your browser.`);
  }
}
