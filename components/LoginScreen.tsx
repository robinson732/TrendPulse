import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth, AUTH_ERROR_MESSAGES, type AuthError } from "@/contexts/AuthContext";

type Tab = "signin" | "signup";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { signInWithEmail, createAccount, signInWithGoogle, signInAnon, enterGuestMode } = useAuth();

  const [tab, setTab] = useState<Tab>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName("");
    setEmail("");
    setPassword("");
    setError(null);
    setLoading(false);
    setShowPassword(false);
  }, []);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!email.trim() || !password.trim()) {
      setError("Remplis tous les champs.");
      return;
    }
    if (tab === "signup" && !name.trim()) {
      setError("Entre ton prénom ou pseudo.");
      return;
    }
    setLoading(true);
    let err: AuthError | null;
    if (tab === "signin") {
      err = await signInWithEmail(email.trim(), password);
    } else {
      err = await createAccount(email.trim(), password, name.trim());
    }
    setLoading(false);
    if (err) setError(AUTH_ERROR_MESSAGES[err]);
    else reset();
  }, [tab, name, email, password, signInWithEmail, createAccount, reset]);

  const handleGoogle = useCallback(async () => {
    setError(null);
    setLoading(true);
    const err = await signInWithGoogle();
    setLoading(false);
    if (err) setError(AUTH_ERROR_MESSAGES[err]);
    else reset();
  }, [signInWithGoogle, reset]);

  const handleAnon = useCallback(async () => {
    setLoading(true);
    await signInAnon();
    setLoading(false);
    enterGuestMode();
    reset();
  }, [signInAnon, enterGuestMode, reset]);

  return (
    <View style={[styles.container, { paddingTop: topPad + 20, paddingBottom: bottomPad + 10 }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <Ionicons name="pulse" size={36} color={Colors.accent} />
        </View>
        <Text style={styles.brand}>TrendPulse</Text>
        <Text style={styles.greeting}>Hey, sign in</Text>
        <Text style={styles.subtitle}>Track trends. Join the conversation.</Text>

        {Platform.OS === "web" && (
          <Pressable
            style={[styles.googleBtn, loading && styles.btnDisabled]}
            onPress={handleGoogle}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#fff" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </Pressable>
        )}

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{Platform.OS === "web" ? "or use email" : "sign in with email"}</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.tabs}>
          {(["signin", "signup"] as Tab[]).map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => { setTab(t); setError(null); }}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "signin" ? "Sign In" : "Create Account"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "signup" && (
          <View style={styles.field}>
            <Text style={styles.label}>Name / Pseudo</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="TrendHunter42"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={password}
              onChangeText={setPassword}
              placeholder={tab === "signup" ? "6 characters minimum" : "••••••••"}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={Colors.textMuted}
              />
            </Pressable>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={Colors.red} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.btnText}>
              {tab === "signin" ? "Sign In" : "Create Account"}
            </Text>
          )}
        </Pressable>

        <View style={styles.anonSection}>
          <Text style={styles.anonLabel}>Just want to browse?</Text>
          <Pressable
            style={styles.anonBtn}
            onPress={handleAnon}
            disabled={loading}
          >
            <Ionicons name="eye-outline" size={16} color={Colors.accent} />
            <Text style={styles.anonText}>Continue as Guest</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 30,
  },
  logoRow: {
    alignItems: "center",
    marginBottom: 6,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Orbitron-Bold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    marginBottom: 28,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#4285F4",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 20,
    shadowColor: "#4285F4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  googleBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 3,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: Colors.bgSurface,
  },
  tabText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
    fontFamily: "Inter_600SemiBold",
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeBtn: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.red + "18",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.red,
    flex: 1,
  },
  btn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 14,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  anonSection: {
    alignItems: "center",
    gap: 8,
    paddingTop: 6,
  },
  anonLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  anonBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  anonText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },
});
