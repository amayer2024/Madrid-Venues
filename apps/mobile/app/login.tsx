import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { authClient } from "../lib/auth";
import { t } from "../lib/i18n";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const { error: err } = await authClient.signIn.email({ email, password });
    if (err) {
      setError(err.message ?? "Error");
      return;
    }
    router.replace("/");
  }

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>{t("login")}</Text>
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="email" placeholderTextColor="#9a9aa8" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} secureTextEntry placeholder="password" placeholderTextColor="#9a9aa8" value={password} onChangeText={setPassword} />
      <Pressable style={styles.btn} onPress={submit}><Text style={styles.btnText}>{t("login")}</Text></Pressable>
      <Pressable onPress={() => router.push("/register")}><Text style={styles.link}>{t("register")}</Text></Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700", marginBottom: 16 },
  input: { borderColor: "#2a2a35", borderWidth: 1, borderRadius: 8, padding: 12, color: "#f2f2f5", marginBottom: 12 },
  btn: { backgroundColor: "#7c5cff", padding: 12, borderRadius: 8 },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
  link: { color: "#7c5cff", marginTop: 16, textAlign: "center" },
  err: { color: "#ff6b6b", marginTop: 12 },
});
