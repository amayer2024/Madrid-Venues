import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api, authClient } from "../lib/auth";
import { currentLocale, setLocale, t } from "../lib/i18n";

export default function AccountScreen() {
  const router = useRouter();
  const [locale, setLoc] = useState(currentLocale());

  async function logout() {
    await authClient.signOut();
    router.replace("/login");
  }

  async function del() {
    Alert.alert(t("deleteAccount"), "Esta acción es permanente.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: t("deleteAccount"),
        style: "destructive",
        onPress: async () => {
          await api("/api/account", { method: "DELETE" });
          await authClient.signOut();
          router.replace("/");
        },
      },
    ]);
  }

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>{t("account")}</Text>
      <Pressable style={styles.btn} onPress={() => router.push("/login")}>
        <Text style={styles.btnText}>{t("login")}</Text>
      </Pressable>
      <Pressable style={styles.btn} onPress={logout}>
        <Text style={styles.btnText}>{t("logout")}</Text>
      </Pressable>
      <Pressable
        style={styles.ghost}
        onPress={() => {
          const next = locale === "es" ? "en" : "es";
          setLocale(next);
          setLoc(next);
        }}
      >
        <Text style={styles.link}>Idioma: {locale}</Text>
      </Pressable>
      <Pressable style={styles.danger} onPress={del}>
        <Text style={styles.btnText}>{t("deleteAccount")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16, gap: 12 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700" },
  btn: { backgroundColor: "#7c5cff", padding: 12, borderRadius: 8 },
  ghost: { padding: 12 },
  danger: { backgroundColor: "#ff6b6b", padding: 12, borderRadius: 8, marginTop: 24 },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
  link: { color: "#7c5cff", textAlign: "center" },
});
