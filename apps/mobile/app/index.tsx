import { useCallback, useState } from "react";
import { Link } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/auth";
import { t } from "../lib/i18n";
import { centsToEuros } from "@lineskip/shared";

type Venue = {
  id: string;
  name: string;
  address: string;
  city: string;
  products: { price_cents: number }[];
};

export default function VenuesScreen() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      setVenues(await api("/api/venues"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  return (
    <ScrollView
      style={styles.page}
      onLayout={() => { if (venues.length === 0) void load(); }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={async () => {
          setRefreshing(true);
          await load();
          setRefreshing(false);
        }} />
      }
    >
      <Text style={styles.h1}>{t("venues")}</Text>
      <Text style={styles.muted}>{t("tagline")}</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
      {venues.map((v) => (
        <Link key={v.id} href={`/venue/${v.id}`} asChild>
          <Pressable style={styles.card}>
            <Text style={styles.h2}>{v.name}</Text>
            <Text style={styles.muted}>{v.address}, {v.city}</Text>
            {v.products[0] ? (
              <Text style={styles.price}>desde {centsToEuros(v.products[0].price_cents)}</Text>
            ) : null}
          </Pressable>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700" },
  h2: { color: "#f2f2f5", fontSize: 18, fontWeight: "700" },
  muted: { color: "#9a9aa8", marginBottom: 12 },
  err: { color: "#ff6b6b" },
  card: {
    backgroundColor: "#1a1a22",
    borderColor: "#2a2a35",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  price: { color: "#7c5cff", marginTop: 8, fontWeight: "700" },
});
