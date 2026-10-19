import { useCallback, useState } from "react";
import { useRouter } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { centsToEuros } from "@lineskip/shared";
import { api, authClient } from "../lib/auth";
import { t } from "../lib/i18n";

type Pass = {
  id: string;
  status: string;
  redemption_code: string | null;
  price_cents_paid: number;
  venue: { name: string; address: string };
  product: { name: string };
};

export default function PassesScreen() {
  const router = useRouter();
  const [passes, setPasses] = useState<Pass[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const session = await authClient.getSession();
    if (!session.data) {
      router.push("/login");
      return;
    }
    try {
      setPasses(await api("/api/passes/mine"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, [router]);

  return (
    <ScrollView
      style={styles.page}
      onLayout={() => void load()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />
      }
    >
      <Text style={styles.h1}>{t("myPasses")}</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {passes.map((p) => (
        <View style={styles.card} key={p.id}>
          <Text style={styles.h2}>{p.product.name}</Text>
          <Text style={styles.muted}>{p.venue.name}</Text>
          <Text style={styles.muted}>{p.status} · {centsToEuros(p.price_cents_paid)}</Text>
          {p.redemption_code && p.status === "active" ? (
            <View style={styles.qr}>
              <QRCode value={p.redemption_code} size={180} />
              <Text style={styles.code}>{p.redemption_code}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700", marginBottom: 12 },
  h2: { color: "#f2f2f5", fontSize: 18, fontWeight: "700" },
  muted: { color: "#9a9aa8" },
  err: { color: "#ff6b6b" },
  card: {
    backgroundColor: "#1a1a22",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  qr: { backgroundColor: "white", padding: 16, marginTop: 12, alignItems: "center", borderRadius: 8 },
  code: { marginTop: 8, fontSize: 11 },
});
