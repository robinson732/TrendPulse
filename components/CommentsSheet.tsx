import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  Animated,
  Keyboard,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { getApiUrl } from "@/lib/query-client";
import Colors from "@/constants/colors";

export interface Comment {
  id: number;
  postId: string;
  trendId: string;
  author: string;
  avatar: string;
  content: string;
  replyTo: number | null;
  likes: number;
  timestamp: string;
  mediaUri?: string | null;
  mediaType?: string | null;
  link?: string | null;
}

interface Attachment {
  uri: string;
  type: "image" | "video" | "gif" | "link";
  label?: string;
}

interface Props {
  visible: boolean;
  postId: string;
  trendId: string;
  postContent: string;
  postAuthor: string;
  onClose: () => void;
  currentUser?: string;
}

function formatRelativeTime(ts: string): string {
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const diff = Date.now() - date.getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return days < 7 ? `${days}d` : date.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return ts;
  }
}

function isValidUrl(str: string) {
  try { new URL(str); return true; } catch { return false; }
}

function CommentMedia({ comment }: { comment: Comment }) {
  if (!comment.mediaUri && !comment.link) return null;

  if (comment.link && !comment.mediaUri) {
    return (
      <View style={mediaStyles.linkBox}>
        <Ionicons name="link-outline" size={13} color={Colors.accent} />
        <Text style={mediaStyles.linkText} numberOfLines={1}>{comment.link}</Text>
      </View>
    );
  }

  if (comment.mediaType === "video") {
    return (
      <Video
        source={{ uri: comment.mediaUri! }}
        style={mediaStyles.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
        isLooping={false}
      />
    );
  }

  return (
    <View>
      <Image
        source={{ uri: comment.mediaUri! }}
        style={mediaStyles.image}
        resizeMode="cover"
      />
      {comment.link && (
        <View style={mediaStyles.linkBox}>
          <Ionicons name="link-outline" size={13} color={Colors.accent} />
          <Text style={mediaStyles.linkText} numberOfLines={1}>{comment.link}</Text>
        </View>
      )}
    </View>
  );
}

function CommentItem({
  comment,
  onReply,
  onLike,
  likedIds,
  allComments,
}: {
  comment: Comment;
  onReply: (comment: Comment) => void;
  onLike: (id: number) => void;
  likedIds: Set<number>;
  allComments: Comment[];
}) {
  const isLiked = likedIds.has(comment.id);
  const replyParent = comment.replyTo
    ? allComments.find((c) => c.id === comment.replyTo)
    : null;
  const isReply = comment.replyTo !== null;

  return (
    <View style={[styles.commentRow, isReply && styles.replyRow]}>
      {isReply && <View style={styles.replyLine} />}
      <View style={styles.commentContent}>
        <View style={styles.commentHeader}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>{comment.avatar}</Text>
          </View>
          <Text style={styles.commentAuthor}>{comment.author}</Text>
          <Text style={styles.commentTime}>{formatRelativeTime(comment.timestamp)}</Text>
        </View>
        {replyParent && (
          <View style={styles.replyQuote}>
            <Text style={styles.replyQuoteAuthor}>@{replyParent.author}</Text>
            <Text style={styles.replyQuoteText} numberOfLines={1}>
              {replyParent.content}
            </Text>
          </View>
        )}
        {!!comment.content && (
          <Text style={styles.commentText}>{comment.content}</Text>
        )}
        <CommentMedia comment={comment} />
        <View style={styles.commentActions}>
          <Pressable
            style={styles.commentAction}
            onPress={() => onLike(comment.id)}
            hitSlop={6}
          >
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={13}
              color={isLiked ? "#ff4d6d" : Colors.textMuted}
            />
            {comment.likes + (isLiked ? 1 : 0) > 0 && (
              <Text style={[styles.commentActionText, isLiked && { color: "#ff4d6d" }]}>
                {comment.likes + (isLiked ? 1 : 0)}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={styles.commentAction}
            onPress={() => onReply(comment)}
            hitSlop={6}
          >
            <Ionicons name="return-down-forward-outline" size={13} color="#40c4ff" />
            <Text style={[styles.commentActionText, { color: "#40c4ff" }]}>Reply</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function CommentsSheet({
  visible,
  postId,
  trendId,
  postContent,
  postAuthor,
  onClose,
  currentUser = "You",
}: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [urlMode, setUrlMode] = useState<"gif" | "link" | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const inputRef = useRef<TextInput>(null);
  const urlRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocalComments([]);
      setAttachment(null);
      setUrlMode(null);
      setUrlInput("");
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const { data, isLoading } = useQuery<{ comments: Comment[] }>({
    queryKey: ["/api/pulse", postId, "comments"],
    queryFn: async () => {
      const url = new URL(`/api/pulse/${postId}/comments`, getApiUrl());
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json();
    },
    enabled: visible && !!postId,
    refetchInterval: 15000,
  });

  const mutation = useMutation({
    mutationFn: async (payload: {
      content: string;
      replyTo?: number;
      mediaUri?: string;
      mediaType?: string;
      link?: string;
    }) => {
      const url = new URL(`/api/pulse/${postId}/comments`, getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trendId,
          author: currentUser,
          content: payload.content || " ",
          replyTo: payload.replyTo ?? null,
          mediaUri: payload.mediaUri ?? null,
          mediaType: payload.mediaType ?? null,
          link: payload.link ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json() as Promise<Comment>;
    },
    onSuccess: (newComment) => {
      setLocalComments((prev) => [...prev, newComment]);
      queryClient.invalidateQueries({ queryKey: ["/api/pulse", postId, "comments"] });
    },
  });

  const pickImage = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to attach images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachment({ uri: result.assets[0].uri, type: "image" });
      setUrlMode(null);
    }
  }, []);

  const pickVideo = useCallback(async () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to your photo library to attach videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      videoMaxDuration: 60,
    });
    if (!result.canceled && result.assets[0]) {
      setAttachment({ uri: result.assets[0].uri, type: "video" });
      setUrlMode(null);
    }
  }, []);

  const confirmUrl = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    const type = urlMode!;
    if (!isValidUrl(trimmed)) {
      Alert.alert("Invalid URL", "Please enter a valid URL starting with https://");
      return;
    }
    setAttachment({ uri: trimmed, type, label: trimmed });
    setUrlMode(null);
    setUrlInput("");
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [urlInput, urlMode]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text && !attachment) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const replyId = replyingTo?.id;
    setInputText("");
    setReplyingTo(null);
    setAttachment(null);
    Keyboard.dismiss();
    mutation.mutate({
      content: text,
      replyTo: replyId,
      mediaUri: attachment?.type !== "link" ? attachment?.uri : undefined,
      mediaType: attachment?.type,
      link: attachment?.type === "link" ? attachment?.uri : undefined,
    });
  }, [inputText, replyingTo, attachment]);

  const handleReply = useCallback((comment: Comment) => {
    setReplyingTo(comment);
    setInputText(`@${comment.author} `);
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleLike = useCallback(async (id: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    try {
      const url = new URL(`/api/pulse/comments/${id}/like`, getApiUrl());
      await fetch(url.toString(), { method: "POST" });
    } catch {}
  }, []);

  const serverComments = data?.comments ?? [];
  const serverIds = new Set(serverComments.map((c) => c.id));
  const newLocals = localComments.filter((c) => !serverIds.has(c.id));
  const allComments = [...serverComments, ...newLocals];
  const canSend = !!(inputText.trim() || attachment);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [700, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8,
            transform: [{ translateY }],
          },
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={Colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.originalPost}>
          <View style={styles.originalAvatar}>
            <Text style={styles.originalAvatarText}>{postAuthor.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.originalAuthor}>{postAuthor}</Text>
            <Text style={styles.originalContent} numberOfLines={3}>{postContent}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={Colors.accent} />
          </View>
        ) : allComments.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubble-outline" size={36} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No comments yet</Text>
            <Text style={styles.emptySubtext}>Be the first to post!</Text>
          </View>
        ) : (
          <FlatList
            data={allComments}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <CommentItem
                comment={item}
                onReply={handleReply}
                onLike={handleLike}
                likedIds={likedIds}
                allComments={allComments}
              />
            )}
            contentContainerStyle={styles.commentList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {replyingTo && (
          <View style={styles.replyBanner}>
            <Ionicons name="return-down-forward-outline" size={14} color="#40c4ff" />
            <Text style={styles.replyBannerText} numberOfLines={1}>
              Replying to <Text style={{ color: Colors.accent }}>@{replyingTo.author}</Text>
            </Text>
            <Pressable onPress={() => { setReplyingTo(null); setInputText(""); }} hitSlop={6}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </Pressable>
          </View>
        )}

        {attachment && (
          <View style={styles.attachPreview}>
            {attachment.type === "image" || attachment.type === "gif" ? (
              <Image source={{ uri: attachment.uri }} style={styles.attachThumb} resizeMode="cover" />
            ) : attachment.type === "video" ? (
              <View style={styles.attachVideoThumb}>
                <Ionicons name="videocam" size={22} color={Colors.accent} />
                <Text style={styles.attachVideoLabel} numberOfLines={1}>Video attached</Text>
              </View>
            ) : (
              <View style={styles.attachLinkThumb}>
                <Ionicons name="link-outline" size={16} color={Colors.accent} />
                <Text style={styles.attachLinkText} numberOfLines={1}>{attachment.uri}</Text>
              </View>
            )}
            <Pressable style={styles.attachRemove} onPress={() => setAttachment(null)} hitSlop={6}>
              <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>
        )}

        {urlMode && (
          <View style={styles.urlInputRow}>
            <Ionicons
              name={urlMode === "gif" ? "gif-outline" : "link-outline"}
              size={16}
              color={Colors.accent}
            />
            <TextInput
              ref={urlRef}
              style={styles.urlInput}
              placeholder={urlMode === "gif" ? "Paste GIF URL…" : "Paste link URL…"}
              placeholderTextColor={Colors.textMuted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={confirmUrl}
              autoFocus
            />
            <Pressable style={styles.urlConfirm} onPress={confirmUrl} hitSlop={6}>
              <Ionicons name="checkmark" size={16} color={Colors.bg} />
            </Pressable>
            <Pressable onPress={() => { setUrlMode(null); setUrlInput(""); }} hitSlop={6}>
              <Ionicons name="close" size={18} color={Colors.textMuted} />
            </Pressable>
          </View>
        )}

        <View style={styles.attachBar}>
          <Pressable
            style={[styles.attachBtn, attachment?.type === "image" && styles.attachBtnActive]}
            onPress={pickImage}
            hitSlop={4}
          >
            <Ionicons name="image-outline" size={18} color="#a78bfa" />
          </Pressable>
          <Pressable
            style={[styles.attachBtn, attachment?.type === "video" && styles.attachBtnActive]}
            onPress={pickVideo}
            hitSlop={4}
          >
            <Ionicons name="videocam-outline" size={18} color="#f59e0b" />
          </Pressable>
          <Pressable
            style={[styles.attachBtn, urlMode === "gif" && styles.attachBtnActive]}
            onPress={() => { setUrlMode(urlMode === "gif" ? null : "gif"); setUrlInput(""); setTimeout(() => urlRef.current?.focus(), 100); }}
            hitSlop={4}
          >
            <Text style={styles.gifLabel}>GIF</Text>
          </Pressable>
          <Pressable
            style={[styles.attachBtn, urlMode === "link" && styles.attachBtnActive]}
            onPress={() => { setUrlMode(urlMode === "link" ? null : "link"); setUrlInput(""); setTimeout(() => urlRef.current?.focus(), 100); }}
            hitSlop={4}
          >
            <Ionicons name="link-outline" size={18} color="#00e676" />
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text style={styles.charCount}>{inputText.length}/300</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputAvatar}>
            <Text style={styles.inputAvatarText}>{currentUser.charAt(0).toUpperCase()}</Text>
          </View>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment…"
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={300}
          />
          <Pressable
            style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!canSend || mutation.isPending}
            hitSlop={6}
          >
            {mutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.bg} />
            ) : (
              <Ionicons name="send" size={16} color={Colors.bg} />
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const mediaStyles = StyleSheet.create({
  image: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: "#000",
  },
  video: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginTop: 6,
    backgroundColor: "#000",
  },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.bgSurface,
    padding: 8,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.accent,
    flex: 1,
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    backgroundColor: "#0f1117",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
  },
  originalPost: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: "flex-start",
  },
  originalAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.accent + "50",
  },
  originalAvatarText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
  },
  originalAuthor: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 2,
  },
  originalContent: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  loadingWrap: {
    paddingVertical: 36,
    alignItems: "center",
  },
  emptyWrap: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  emptySubtext: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  commentList: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 2,
  },
  commentRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + "50",
  },
  replyRow: {
    flexDirection: "row",
    paddingLeft: 22,
  },
  replyLine: {
    width: 2,
    backgroundColor: Colors.accent + "40",
    borderRadius: 1,
    marginRight: 10,
    marginTop: 4,
  },
  commentContent: {
    flex: 1,
    gap: 4,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  avatarSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarSmallText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
  },
  commentAuthor: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    flex: 1,
  },
  commentTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  replyQuote: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: Colors.bgSurface,
    borderLeftWidth: 2,
    borderLeftColor: "#40c4ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
  },
  replyQuoteAuthor: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#40c4ff",
  },
  replyQuoteText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    flex: 1,
  },
  commentText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  commentActions: {
    flexDirection: "row",
    gap: 16,
    marginTop: 4,
  },
  commentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentActionText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    backgroundColor: Colors.bgSurface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  replyBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  attachPreview: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  attachThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#000",
  },
  attachVideoThumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  attachVideoLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  attachLinkThumb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  attachLinkText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.accent,
    flex: 1,
  },
  attachRemove: {
    marginLeft: "auto",
  },
  urlInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  urlInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent + "60",
  },
  urlConfirm: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  attachBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgSurface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attachBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  gifLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#f59e0b",
    letterSpacing: 0.5,
  },
  charCount: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: "#0f1117",
  },
  inputAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.accent + "60",
  },
  inputAvatarText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bgSurface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    maxHeight: 90,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },
});
