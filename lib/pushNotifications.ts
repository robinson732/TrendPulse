import { Platform } from "react-native";
import { getDb } from "./firebaseConfig";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

const VAPID_KEY = process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY || "";

let _messaging: any = null;
let _currentToken: string | null = null;

async function getMessagingInstance() {
  if (Platform.OS !== "web") return null;
  if (_messaging) return _messaging;
  try {
    const { getMessaging } = await import("firebase/messaging");
    const { initializeApp, getApps, getApp } = await import("firebase/app");

    const config = {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "",
    };

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    _messaging = getMessaging(app);
    return _messaging;
  } catch (e) {
    console.warn("[Push] Failed to init messaging:", e);
    return null;
  }
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  if (!("Notification" in globalThis)) return false;

  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

export function getPushPermissionStatus(): string {
  if (Platform.OS !== "web") return "unsupported";
  if (!("Notification" in globalThis)) return "unsupported";
  return Notification.permission;
}

export async function getFcmToken(): Promise<string | null> {
  if (_currentToken) return _currentToken;
  if (Platform.OS !== "web") return null;

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const { getToken } = await import("firebase/messaging");

    const reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    _currentToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg,
    });

    return _currentToken;
  } catch (e) {
    console.warn("[Push] Failed to get FCM token:", e);
    return null;
  }
}

export async function saveFcmTokenToFirestore(userId: string): Promise<void> {
  const token = await getFcmToken();
  if (!token) return;

  const db = getDb();
  if (!db) return;

  try {
    await setDoc(
      doc(db, "fcmTokens", userId),
      {
        token,
        platform: "web",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn("[Push] Failed to save token:", e);
  }
}

export function onForegroundMessage(callback: (payload: any) => void): () => void {
  if (Platform.OS !== "web") return () => {};

  let unsubscribe: (() => void) | null = null;

  getMessagingInstance().then(async (messaging) => {
    if (!messaging) return;
    const { onMessage } = await import("firebase/messaging");
    unsubscribe = onMessage(messaging, callback);
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

export async function initPushNotifications(userId?: string): Promise<string | null> {
  if (Platform.OS !== "web") return null;

  const granted = await requestPushPermission();
  if (!granted) {
    console.log("[Push] Permission not granted");
    return null;
  }

  const token = await getFcmToken();
  if (!token) return null;

  console.log("[Push] FCM token obtained");

  if (userId) {
    await saveFcmTokenToFirestore(userId);
  }

  return token;
}
