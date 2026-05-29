import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Platform,
  Image,
  Share,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import CommentsSheet from "@/components/CommentsSheet";
import Toast from "react-native-toast-message";

export default function PostFeedScreen() {
  const { postId, author, content, trendId, hashtag, timestamp, mediaUri, mediaType, link } =
    useLocalSearchParams<{
      postId: string;
      author: string;
      content: string;
      trendId: string;
      hashtag: string;
      timestamp: string;
      mediaUri?: string;
      mediaType?: string;
      link?: string;
    }>();
  const insets = useSafeAreaInsets();
  const { displayName } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [repostCount, setRepostCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [comments, setComments] = useState<
    { id: string; author: string; text: string; timestamp: string }[]
  >([]);
  const [showComments, setShowComments] = useState(false);
  const likeScale = React.useRef(new Animated.Value(1)).current;

  const postDate = timestamp ? new Date(timestamp) : new Date();
  const timeAgo = getTimeAgo(postDate);

  const handleLike = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(likeScale, { toValue: 1.4, duration: 120, useNativeDriver: true }),
      Animated.timing(likeScale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  }, [liked, likeScale]);

  const handleRepost = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setReposted((prev) => !prev);
    setRepostCount((prev) => (reposted ? prev - 1 : prev + 1));
    Toast.show({
      type: "success",
      text1: reposted ? "Repost retiré" : "Reposté !",
      position: "bottom",
      visibilityTime: 1500,
    });
  }, [reposted]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `${content}\n\n#${hashtag} via TrendPulse` });
    } catch {}
  }, [content, hashtag]);

  const handleAddComment = useCallback(
    (text: string) => {
      const newComment = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        author: displayName || "You",
        text,
        timestamp: new Date().toISOString(),
      };
      setComments((prev) => [...prev, newComment]);
    },
    [displayName],
  );

  const authorInitial = (author || "Y").charAt(0).toUpperCase();

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Post Feed</Text>
        <View style={{ width: 34 }} />
      </View>

      <FlatList
        data={[{ id: "post" }]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scrollContent}
        renderItem={() => (
          <View style={styles.postCard}>
            <View style={styles.postHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>{authorInitial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.authorName}>@{author || "You"}</Text>
                {hashtag ? (
                  <Pressable onPress={() => router.push({ pathname: "/pulse/[id]", params: { id: trendId } })}>
                    <Text style={styles.hashtagLink}>#{hashtag}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.timestamp}>{timeAgo}</Text>
            </View>

            <Text style={styles.postContent}>{content}</Text>

            {mediaUri ? (
              <View style={styles.mediaContainer}>
                <Image source={{ uri: mediaUri }} style={styles.mediaImage} resizeMode="cover" />
              </View>
            ) : null}

            {link ? (
              <View style={styles.linkContainer}>
                <Ionicons name="link" size={16} color="#00f2ff" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {link}
                </Text>
              </View>
            ) : null}

            <View style={styles.divider} />

            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
                <Ionicons name="chatbubble-outline" size={20} color="#94A3B8" />
                <Text style={styles.actionCount}>{comments.length}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleRepost}>
                <Ionicons
                  name="repeat"
                  size={20}
                  color={reposted ? "#00f2ff" : "#94A3B8"}
                />
                <Text style={[styles.actionCount, reposted && { color: "#00f2ff" }]}>
                  {repostCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
                <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                  <Ionicons
                    name={liked ? "heart" : "heart-outline"}
                    size={20}
                    color={liked ? "#FF4757" : "#94A3B8"}
                  />
                </Animated.View>
                <Text style={[styles.actionCount, liked && { color: "#FF4757" }]}>
                  {likeCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {comments.length > 0 && (
              <View style={styles.commentsSection}>
                <Text style={styles.commentsSectionTitle}>
                  💬 {comments.length} réponse{comments.length > 1 ? "s" : ""}
                </Text>
                {comments.map((c) => (
                  <View key={c.id} style={styles.commentCard}>
                    <View style={styles.commentHeader}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentAvatarLetter}>
                          {c.author.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.commentAuthor}>@{c.author}</Text>
                      <Text style={styles.commentTime}>{getTimeAgo(new Date(c.timestamp))}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          <Pressable
            style={styles.backToFeedBtn}
            onPress={() =>
              router.push({ pathname: "/pulse/[id]", params: { id: trendId } })
            }
          >
            <Ionicons name="arrow-back" size={16} color="#00f2ff" />
            <Text style={styles.backToFeedText}>Retour au feed #{hashtag}</Text>
          </Pressable>
        }
      />

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        comments={comments}
        onAddComment={handleAddComment}
      />

      <Toast />
    </View>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1E293B",
  },
  backBtn: {
    width: 34,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  postCard: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1E293B",
    padding: 20,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1E293B",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarLetter: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  authorName: {
    color: "#FFFFFF",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  hashtagLink: {
    color: "#00f2ff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  timestamp: {
    color: "#64748B",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  postContent: {
    color: "#E2E8F0",
    fontSize: 17,
    lineHeight: 26,
    fontFamily: "Inter_400Regular",
    marginBottom: 16,
  },
  mediaContainer: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  mediaImage: {
    width: "100%",
    height: 250,
    borderRadius: 12,
  },
  linkContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E293B",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  linkText: {
    color: "#00f2ff",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#1E293B",
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionCount: {
    color: "#94A3B8",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  commentsSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#1E293B",
    paddingTop: 16,
  },
  commentsSectionTitle: {
    color: "#94A3B8",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 12,
  },
  commentCard: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  commentAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  commentAvatarLetter: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  commentAuthor: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  commentTime: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  commentText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
    paddingLeft: 32,
  },
  backToFeedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  backToFeedText: {
    color: "#00f2ff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
