import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { centsToEuros } from "@lineskip/shared";
import { api, authClient } from "../../lib/auth";
import { t } from "../../lib/i18n";

type Product = {
  id: string;
  name: string;
  type: string;
  price_cents: number;
  remaining: number;
  quantity_total: number;
  sold_out: boolean;
};

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [venue, setVenue] = useState<{
    name: string;
    address: string;
    city: string;
    lat?: number;
    lng?: number;
    products: Product[];
  } | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api(`/api/venues/${id}`).then(setVenue).catch((err: Error) => setMsg(err.message));
  }, [id]);

  async function buy(productId: string) {
    const session = await authClient.getSession();
    if (!session.data) {
      router.push("/login");
      return;
    }
    try {
      setMsg("");
      const data = await api("/api/checkout", {
        method: "POST",
        body: JSON.stringify({ pass_product_id: productId }),
      });
      if (data.mode === "stripe" && data.client_secret) {
        const { initPaymentSheet, presentPaymentSheet } = await import(
          "@stripe/stripe-react-native"
        );
        const init = await initPaymentSheet({
          merchantDisplayName: "LineSkip",
          paymentIntentClientSecret: data.client_secret,
        });
        if (init.error) throw new Error(init.error.message);
        const pay = await presentPaymentSheet();
        if (pay.error) throw new Error(pay.error.message);
      }
      router.push("/passes");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Error");
    }
  }

  if (!venue) return <Text style={styles.muted}>{msg || "…"}</Text>;

  return (
    <ScrollView style={styles.page}>
      <Text style={styles.h1}>{venue.name}</Text>
      <Text style={styles.muted}>{venue.address}, {venue.city}</Text>
      {venue.lat && venue.lng ? (
        <Pressable onPress={() => Linking.openURL(`https://www.google.com/maps?q=${venue.lat},${venue.lng}`)}>
          <Text style={styles.link}>Abrir en Maps</Text>
        </Pressable>
      ) : null}
      {venue.products.map((p) => (
        <View style={styles.card} key={p.id}>
          <Text style={styles.h2}>{p.name}</Text>
          <Text style={styles.muted}>{p.type.replace("_", " ")}</Text>
          <Text style={styles.price}>{centsToEuros(p.price_cents)}</Text>
          <Text style={styles.muted}>{p.remaining} / {p.quantity_total}</Text>
          <Pressable
            style={[styles.btn, p.sold_out && styles.disabled]}
            disabled={p.sold_out}
            onPress={() => buy(p.id)}
          >
            <Text style={styles.btnText}>{p.sold_out ? t("soldOut") : t("buy")}</Text>
          </Pressable>
        </View>
      ))}
      {msg ? <Text style={styles.err}>{msg}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700" },
  h2: { color: "#f2f2f5", fontSize: 18, fontWeight: "700" },
  muted: { color: "#9a9aa8", marginBottom: 8 },
  link: { color: "#7c5cff", marginBottom: 12 },
  err: { color: "#ff6b6b" },
  card: {
    backgroundColor: "#1a1a22",
    borderColor: "#2a2a35",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  price: { color: "#f2f2f5", fontWeight: "700", fontSize: 18 },
  btn: { backgroundColor: "#7c5cff", padding: 12, borderRadius: 8, marginTop: 8 },
  disabled: { backgroundColor: "#44445a" },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
});
