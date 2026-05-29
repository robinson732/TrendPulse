import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { isFirebaseConfigured } from "@/lib/firebaseConfig";
import { createFirestorePost, uploadPulseMedia } from "@/lib/firestorePulse";
import { trackPostCreation } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";

interface NewPostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (post: {
    text: string;
    mediaUri: string | null;
    mediaType: string | null;
    link: string;
    timestamp: Date;
    user: string;
  }) => void;
  hashtag: string;
  trendId?: string;
}

const NewPostModal = ({ visible, onClose, onSubmit, hashtag, trendId }: NewPostModalProps) => {
  const { displayName } = useAuth();
  const [text, setText] = useState("");
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(false);

  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "We need access to your photos/videos.");
      return false;
    }
    return true;
  };

  const pickMedia = async (type: "image" | "video" = "image") => {
    if (Platform.OS !== "web") {
      if (!(await requestPermissions())) return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:
        type === "image"
          ? ImagePicker.MediaTypeOptions.Images
          : ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      setMediaUri(asset.uri);
      setMediaType(asset.type || (asset.duration ? "video" : "image"));
    }
  };

  const removeMedia = () => {
    setMediaUri(null);
    setMediaType(null);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !mediaUri && !link.trim()) {
      Alert.alert("Empty post", "Add text, media, or a link.");
      return;
    }

    setLoading(true);

    try {
      let uploadedMediaUrl = mediaUri;

      if (isFirebaseConfigured() && trendId) {
        if (mediaUri) {
          const uploaded = await uploadPulseMedia(
            mediaUri,
            hashtag,
            mediaType || "image"
          );
          if (uploaded) uploadedMediaUrl = uploaded;
        }

        const content = text + (link ? `\n🔗 ${link}` : "");
        await createFirestorePost(trendId, displayName, content, "twitter", {
          mediaUri: uploadedMediaUrl,
          mediaType,
          link: link || null,
        });
      }

      if (trendId) {
        trackPostCreation(trendId, !!mediaUri, !!link.trim());
      }

      onSubmit({
        text,
        mediaUri: uploadedMediaUrl,
        mediaType,
        link,
        timestamp: new Date(),
        user: displayName,
      });

      setText("");
      setMediaUri(null);
      setMediaType(null);
      setLink("");
      onClose();
    } catch (err) {
      console.error("[NewPostModal] Submit error:", err);
      Alert.alert("Error", "Could not post. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const charCount = text.length;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>
              Post in{" "}
              <Text style={styles.hashtagText}>#{hashtag}</Text>
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close-circle" size={28} color={Colors.textMuted} />
            </Pressable>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="What's happening?"
            placeholderTextColor={Colors.textMuted}
            multiline
            value={text}
            onChangeText={setText}
            maxLength={280}
          />

          <Text
            style={[
              styles.charCount,
              charCount > 250 && { color: Colors.yellow },
              charCount >= 280 && { color: Colors.red },
            ]}
          >
            {charCount}/280
          </Text>

          {mediaUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: mediaUri }} style={styles.preview} />
              <Pressable style={styles.removeMedia} onPress={removeMedia}>
                <Ionicons name="close-circle" size={24} color={Colors.red} />
              </Pressable>
              {mediaType === "video" && (
                <View style={styles.videoBadge}>
                  <Ionicons name="videocam" size={14} color="#fff" />
                  <Text style={styles.videoBadgeText}>Video</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.mediaButtons}>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => pickMedia("image")}
            >
              <Ionicons name="image-outline" size={20} color={Colors.accent} />
              <Text style={styles.mediaBtnText}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mediaBtn}
              onPress={() => pickMedia("video")}
            >
              <Ionicons name="videocam-outline" size={20} color={Colors.green} />
              <Text style={styles.mediaBtnText}>Video</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.linkInput}
            placeholder="Add a link (optional)"
            placeholderTextColor={Colors.textMuted}
            value={link}
            onChangeText={setLink}
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.disabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} size="small" />
              ) : (
                <>
                  <Ionicons name="send" size={16} color={Colors.bg} />
                  <Text style={styles.submitText}>Post</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  dismissArea: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.bgCard,
    padding: 20,
    paddingBottom: Platform.OS === "web" ? 34 : 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 0,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: "center",
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
  },
  hashtagText: {
    color: Colors.accent,
  },
  textInput: {
    backgroundColor: Colors.bgSurface,
    color: Colors.text,
    padding: 14,
    borderRadius: 14,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: "right",
    marginTop: 4,
    marginBottom: 12,
  },
  previewContainer: {
    position: "relative",
    marginBottom: 12,
  },
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 14,
  },
  removeMedia: {
    position: "absolute",
    top: 8,
    right: 8,
  },
  videoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  videoBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  mediaButtons: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.bgSurface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mediaBtnText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  linkInput: {
    backgroundColor: Colors.bgSurface,
    color: Colors.text,
    padding: 12,
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  submitBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.accent,
    borderRadius: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  submitText: {
    color: Colors.bg,
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});

export default NewPostModal;
