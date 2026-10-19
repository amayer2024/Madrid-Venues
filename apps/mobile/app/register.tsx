import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { authClient } from "../lib/auth";
import { t } from "../lib/i18n";

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("1995-01-15");
  const [error, setError] = useState("");

  async function submit() {
    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name,
      dateOfBirth,
    } as never);
    if (err) {
      setError(err.message ?? t("ageGate"));
      return;
    }
    router.replace("/");
  }

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>{t("register")}</Text>
      <Text style={styles.muted}>{t("ageGate")}</Text>
      <TextInput style={styles.input} placeholder="nombre" placeholderTextColor="#9a9aa8" value={name} onChangeText={setName} />
      <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder="email" placeholderTextColor="#9a9aa8" value={email} onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#9a9aa8" value={dateOfBirth} onChangeText={setDateOfBirth} />
      <TextInput style={styles.input} secureTextEntry placeholder="password (8+)" placeholderTextColor="#9a9aa8" value={password} onChangeText={setPassword} />
      <Pressable style={styles.btn} onPress={submit}><Text style={styles.btnText}>{t("register")}</Text></Pressable>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700" },
  muted: { color: "#9a9aa8", marginBottom: 12 },
  input: { borderColor: "#2a2a35", borderWidth: 1, borderRadius: 8, padding: 12, color: "#f2f2f5", marginBottom: 12 },
  btn: { backgroundColor: "#7c5cff", padding: 12, borderRadius: 8 },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
  err: { color: "#ff6b6b", marginTop: 12 },
});
