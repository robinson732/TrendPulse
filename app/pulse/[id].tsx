import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Platform,
  ActivityIndicator,
  Image,
  Alert,
  Share,
  TouchableOpacity,
  Animated,
} from "react-native";
import { Video, ResizeMode } from "expo-av";

import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { XIcon } from "@/components/XIcon";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { isFirebaseConfigured } from "@/lib/firebaseConfig";
import { subscribeToFirestorePosts, reportFirestorePost, type FirestorePulsePost } from "@/lib/firestorePulse";
import { trackPulseView } from "@/lib/analytics";
import CommentsSheet from "@/components/CommentsSheet";
import Toast from "react-native-toast-message";
import { useAuth } from "@/contexts/AuthContext";


const PLATFORM_ICONS: Record<string, string> = {
  twitter: "x-icon",
  x: "x-icon",
  instagram: "logo-instagram",
  tiktok: "musical-notes",
  reddit: "logo-reddit",
  youtube: "logo-youtube",
  apple: "logo-apple",
};

interface PulsePost {
  id: string;
  trendId: string;
  author: string;
  avatar: string;
  platform: string;
  content: string;
  timestamp: string;
  likes: number;
  reposts: number;
}

interface PulseResponse {
  posts: PulsePost[];
  trendKeyword: string;
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

function formatRelativeTime(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: "#FFFFFF",
  x: "#FFFFFF",
  instagram: "#E1306C",
  tiktok: "#25F4EE",
  reddit: "#FF4500",
  youtube: "#FF0000",
  apple: "#FA243C",
};

function PulsePostCard({
  post,
  liked,
  reposted,
  onLike,
  onRepost,
  onReport,
  onShare,
  onComment,
}: {
  post: PulsePost;
  liked: boolean;
  reposted: boolean;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onReport: (id: string) => void;
  onShare: (post: PulsePost) => void;
  onComment: (post: PulsePost) => void;
}) {
  const [imageLoading, setImageLoading] = useState(true);
  const platformColor = PLATFORM_COLORS[post.platform] || Colors.accent;
  const displayLikes = post.likes + (liked ? 1 : 0);
  const displayReposts = post.reposts + (reposted ? 1 : 0);

  return (
    <View style={styles.forumCard}>
      <View style={styles.cardHeader}>
        <Text style={[styles.userTag, { color: platformColor }]}>@{post.author}</Text>
        <Text style={styles.timeStamp}>{formatRelativeTime(post.timestamp)}</Text>
      </View>

      {(post as any).mediaUri && (post as any).mediaType === "video" ? (
        <View style={styles.videoContainer}>
          <Video
            source={{ uri: (post as any).mediaUri }}
            style={styles.postVideo}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
          />
        </View>
      ) : (post as any).mediaUri ? (
        <TouchableOpacity activeOpacity={0.9}>
          <View style={styles.mediaContainer}>
            <Image
              source={{ uri: (post as any).mediaUri }}
              style={styles.postImage}
              resizeMode="cover"
              onLoadEnd={() => setImageLoading(false)}
            />
            {imageLoading && (
              <ActivityIndicator
                size="large"
                color={Colors.accent}
                style={styles.mediaLoadingOverlay}
              />
            )}
          </View>
        </TouchableOpacity>
      ) : null}

      <Text style={styles.messageText}>{post.content}</Text>

      {(post as any).link ? (
        <View style={styles.linkPreview}>
          <Ionicons name="link-outline" size={14} color="#38BDF8" />
          <Text style={styles.linkText} numberOfLines={1}>
            {(post as any).link}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardFooterSection}>
        <Pressable style={styles.interactionBtn} onPress={() => onComment(post)} hitSlop={6}>
          <Text style={styles.footerEmoji}>💬</Text>
          <Text style={styles.footerStat}>{formatCount(displayReposts)} réponses</Text>
        </Pressable>
        <Pressable style={styles.interactionBtn} onPress={() => onLike(post.id)} hitSlop={6}>
          <Text style={styles.footerEmoji}>🔥</Text>
          <Text style={[styles.footerStat, liked && { color: platformColor }]}>{formatCount(displayLikes)} points</Text>
        </Pressable>
        <Pressable style={styles.interactionBtn} onPress={() => onShare(post)} hitSlop={6}>
          <Ionicons name="share-outline" size={16} color="#64748B" />
        </Pressable>
      </View>
    </View>
  );
}

function PulsFab({ onPress, bottom }: { onPress: () => void; bottom: number }) {
  const vibAnim = useRef(new Animated.Value(0)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(vibAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(vibAnim, { toValue: -1, duration: 500, useNativeDriver: true }),
        Animated.timing(vibAnim, { toValue: 0.5, duration: 500, useNativeDriver: true }),
        Animated.timing(vibAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateX = vibAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-1, 0, 1] });
  const translateY = vibAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, -1] });

  return (
    <Animated.View style={[styles.pulsFab, { bottom, transform: [{ translateX }, { translateY }, { scale: glowScale }] }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.pulsFabInner}>
        <Image source={require("@/assets/images/logo.png")} style={styles.pulsFabIcon} resizeMode="contain" />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function PulseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const { displayName, signInAnon, uid } = useAuth();
  const [commentingPost, setCommentingPost] = useState<PulsePost | null>(null);
  const [localPosts, setLocalPosts] = useState<PulsePost[]>([]);
  const [firestorePosts, setFirestorePosts] = useState<PulsePost[]>([]);
  const [likedPosts, setLikedPosts] = useState<Record<string, boolean>>({});
  const [repostedPosts, setRepostedPosts] = useState<Record<string, boolean>>({});
  const [realtimeConnected, setRealtimeConnected] = useState(false);


  useEffect(() => {
    if (id) trackPulseView(id);
  }, [id]);

  useEffect(() => {
    if (!uid) signInAnon();
  }, [uid]);

  useEffect(() => {
    if (!id || !isFirebaseConfigured()) return;
    const unsub = subscribeToFirestorePosts(id, (posts) => {
      setFirestorePosts(posts as PulsePost[]);
      setRealtimeConnected(true);
    });
    return () => { unsub?.(); };
  }, [id]);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<PulseResponse>({
    queryKey: [`/api/trends/${id}/pulse`],
    refetchInterval: realtimeConnected ? false : 30000,
  });

  const handleLike = useCallback((postId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }, []);

  const handleRepost = useCallback((postId: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRepostedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  }, []);

  const handleReport = useCallback((postId: string) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Report Post",
      "Are you sure you want to report this post?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            if (isFirebaseConfigured() && id) {
              await reportFirestorePost(id, postId, uid || "anonymous");
            }
            Toast.show({
              type: "success",
              text1: "Reported",
              text2: "Thanks \u2014 we\u2019ll review it.",
              position: "bottom",
              visibilityTime: 3000,
            });
          },
        },
      ]
    );
  }, [id, uid]);

  const handleShare = useCallback(async (post: PulsePost) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const hashtag = data?.trendKeyword || id || "TrendPulse";
    const link = `https://trendpulse.app/pulse/${id}`;
    const text = `${post.content}\n\n#${hashtag.replace(/^#/, "")} via TrendPulse\n${link}`;
    try {
      await Share.share(
        Platform.OS === "ios"
          ? { message: text, url: link }
          : { message: text }
      );
    } catch {
      // user cancelled
    }
  }, [id, data?.trendKeyword]);

  const handleComment = useCallback((post: PulsePost) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCommentingPost(post);
  }, []);

  const handleBack = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };



  const basePosts = realtimeConnected ? firestorePosts : (data?.posts ?? []);
  const allPosts = [...localPosts, ...basePosts];
  const trendKeyword = data?.trendKeyword ?? "Pulse Feed";
  const cleanHashtag = trendKeyword.replace(/^#/, "");
  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.minimalNav}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={22} color="#F8FAFC" />
        </Pressable>
        <Text style={styles.navHashtag} numberOfLines={1}>#{cleanHashtag}</Text>
        <View style={{ flex: 1 }} />
        {realtimeConnected && (
          <View style={styles.forumLiveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.forumStatText}>Live</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>Loading pulse feed...</Text>
        </View>
      ) : isError ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.red} />
          <Text style={styles.loadingText}>Could not load pulse feed</Text>
        </View>
      ) : (
        <FlatList
          data={allPosts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PulsePostCard
              post={item}
              liked={!!likedPosts[item.id]}
              reposted={!!repostedPosts[item.id]}
              onLike={handleLike}
              onRepost={handleRepost}
              onReport={handleReport}
              onShare={handleShare}
              onComment={handleComment}
            />
          )}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Platform.OS === "web" ? 140 : insets.bottom + 140 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No pulse posts yet</Text>
              <Text style={styles.emptySubtext}>Be the first to post!</Text>
            </View>
          }
        />
      )}


      {commentingPost && (
        <CommentsSheet
          visible={!!commentingPost}
          postId={commentingPost.id}
          trendId={id}
          postContent={commentingPost.content}
          postAuthor={commentingPost.author}
          onClose={() => setCommentingPost(null)}
          currentUser={displayName || "You"}
        />
      )}

      <PulsFab onPress={() => router.push("/puls-talk")} bottom={Platform.OS === "web" ? 124 : insets.bottom + 90} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  minimalNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: {
    justifyContent: "center",
    alignItems: "center",
  },
  navHashtag: {
    color: "#94A3B8",
    fontSize: 15,
    fontFamily: "Inter_500Medium",
  },
  forumLiveRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  forumStatText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#00ff9d",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  list: {
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  forumCard: {
    backgroundColor: "#0F172A",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#1E293B",
    width: "100%" as any,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  userTag: {
    fontFamily: "Inter_700Bold",
    fontSize: 14,
    color: "#38BDF8",
  },
  timeStamp: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  messageText: {
    color: "#CBD5E1",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  cardFooterSection: {
    marginTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: "#1E293B",
    paddingTop: 10,
    flexDirection: "row",
    gap: 20,
    alignItems: "center",
  },
  interactionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerEmoji: {
    fontSize: 14,
  },
  footerStat: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#94A3B8",
  },
  pulsFab: {
    position: "absolute" as const,
    right: 30,
    width: 70,
    height: 70,
    zIndex: 9999,
  },
  pulsFabInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#0a0a0b",
    borderWidth: 2,
    borderColor: "#2a2a2c",
    justifyContent: "center" as const,
    alignItems: "center" as const,
    shadowColor: "rgba(0, 242, 255, 0.6)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 30,
  },
  pulsFabIcon: {
    width: "60%" as any,
    height: "60%" as any,
  },
  videoContainer: {
    borderRadius: 12,
    overflow: "hidden" as const,
    marginTop: 4,
  },
  playOverlay: {
    position: "absolute" as const,
    top: "40%" as any,
    left: "45%" as any,
  },
  mediaContainer: {
    position: "relative" as const,
    width: "100%",
    marginTop: 8,
  },
  postImage: {
    width: "100%" as any,
    height: 160,
    borderRadius: 12,
  },
  mediaLoadingOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  postVideo: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#000",
  },
  linkPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E293B",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  linkText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#38BDF8",
    flex: 1,
  },
  empty: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  emptySubtext: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});
