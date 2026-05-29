import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import { setConsentStatus } from "@/lib/analytics";
import Colors from "@/constants/colors";

const DEVICE_ID_KEY = "@trendpulse_device_id";
const CONSENT_CHECKED_KEY = "@trendpulse_consent_checked";

function generateDeviceId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

interface ConsentModalProps {
  onComplete: (consented: boolean) => void;
}

export function ConsentModal({ onComplete }: ConsentModalProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    checkConsent();
  }, []);

  async function checkConsent() {
    try {
      const checked = await AsyncStorage.getItem(CONSENT_CHECKED_KEY);
      if (checked === "true") return;

      const deviceId = await getDeviceId();
      const res = await apiRequest("GET", `/api/consent/${deviceId}`);
      const data = await res.json();

      if (data.needsPrompt) {
        setVisible(true);
      } else {
        await AsyncStorage.setItem(CONSENT_CHECKED_KEY, "true");
      }
    } catch {
      setVisible(false);
    }
  }

  async function handleChoice(consented: boolean) {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const deviceId = await getDeviceId();
      await apiRequest("POST", "/api/consent", { deviceId, consented });
      await AsyncStorage.setItem(CONSENT_CHECKED_KEY, "true");
      await setConsentStatus(consented);
    } catch {
    }
    setVisible(false);
    onComplete(consented);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Ionicons name="analytics-outline" size={32} color={Colors.accent} />
          </View>
          <Text style={styles.title}>Help Improve TrendPulse</Text>
          <Text style={styles.body}>
            We collect anonymous usage analytics to improve your experience. This includes which features you use and how you interact with trends. No personal data is shared.
          </Text>

          <View style={styles.bullets}>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
              <Text style={styles.bulletText}>Anonymous usage patterns</Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.green} />
              <Text style={styles.bulletText}>Feature interaction data</Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="close-circle" size={16} color={Colors.red} />
              <Text style={styles.bulletText}>No personal information</Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="close-circle" size={16} color={Colors.red} />
              <Text style={styles.bulletText}>No data sold to third parties</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => handleChoice(true)}
              style={({ pressed }) => [styles.acceptBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.acceptText}>Allow Analytics</Text>
            </Pressable>
            <Pressable
              onPress={() => handleChoice(false)}
              style={({ pressed }) => [styles.declineBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.declineText}>No Thanks</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 28,
    width: "100%",
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  iconRow: {
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: "center",
  },
  bullets: {
    gap: 8,
    paddingVertical: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  actions: {
    gap: 10,
    paddingTop: 4,
  },
  acceptBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  acceptText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.bg,
  },
  declineBtn: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
});
