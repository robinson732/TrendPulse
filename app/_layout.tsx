import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useCallback, useRef, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ConsentModal } from "@/components/ConsentModal";
import { queryClient } from "@/lib/query-client";
import { TrendsProvider } from "@/contexts/TrendsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { loadConsentStatus, setConsentStatus } from "@/lib/analytics";
import { fetchRemoteConfig } from "@/lib/remoteConfig";
import AuthSheet from "@/components/AuthSheet";
import LoginScreen from "@/components/LoginScreen";
import { initPushNotifications, onForegroundMessage } from "@/lib/pushNotifications";
import Toast from "react-native-toast-message";
import Colors from "@/constants/colors";
import { SplashOverlay } from "@/components/SplashOverlay";

SplashScreen.preventAutoHideAsync();

function GlobalAuthSheet() {
  const { showAuthSheet, closeAuthSheet } = useAuth();
  return <AuthSheet visible={showAuthSheet} onClose={closeAuthSheet} />;
}

function PushNotificationHandler() {
  const { user } = useAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "web" || initialized.current) return;

    const setup = async () => {
      const token = await initPushNotifications(user?.uid);
      if (token) initialized.current = true;
    };
    setup();
  }, [user]);

  useEffect(() => {
    if (Platform.OS !== "web") return;

    const unsub = onForegroundMessage((payload: any) => {
      const title = payload?.notification?.title || "TrendPulse";
      const body = payload?.notification?.body || "";
      Toast.show({ type: "info", text1: title, text2: body, visibilityTime: 5000 });
    });
    return unsub;
  }, []);

  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, guestMode } = useAuth();

  if (isLoading) return null;
  if (!user && !guestMode) return <LoginScreen />;
  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <AuthGate>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="trend/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="pulse/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="brand/[id]"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="interactions"
          options={{
            headerShown: false,
            presentation: "card",
          }}
        />
      </Stack>
    </AuthGate>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    "Orbitron-Bold": require("@/assets/fonts/Orbitron-Bold.ttf"),
    "Rajdhani-Medium": require("@/assets/fonts/Rajdhani-Medium.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    loadConsentStatus();
    fetchRemoteConfig();
  }, []);

  const [showSplash, setShowSplash] = useState(true);

  if (!fontsLoaded && !fontError) return null;

  const handleConsent = useCallback((consented: boolean) => {
    setConsentStatus(consented);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <LanguageProvider>
        <AuthProvider>
          <TrendsProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
                <ConsentModal onComplete={handleConsent} />
                <GlobalAuthSheet />
                <PushNotificationHandler />
                <Toast />
                {showSplash && <SplashOverlay onFinish={() => setShowSplash(false)} duration={3000} />}
              </KeyboardProvider>
            </GestureHandlerRootView>
          </TrendsProvider>
        </AuthProvider>
        </LanguageProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
