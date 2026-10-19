import { CameraView, useCameraPermissions } from "expo-camera";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../lib/auth";
import { t } from "../lib/i18n";

export default function DoorScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function redeem(value: string) {
    if (!value || busy) return;
    setBusy(true);
    try {
      const data = await api("/api/passes/redeem", {
        method: "POST",
        body: JSON.stringify({ code: value }),
      });
      setResult({ ok: true, text: `OK · ${data.product} · ${data.guest}` });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : "Error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.h1}>{t("door")}</Text>
      <Text style={styles.muted}>Solo personal autenticado del local. Online.</Text>
      {permission?.granted ? (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            if (data !== code) {
              setCode(data);
              void redeem(data);
            }
          }}
        />
      ) : (
        <Pressable style={styles.btn} onPress={() => requestPermission()}>
          <Text style={styles.btnText}>Activar cámara</Text>
        </Pressable>
      )}
      <TextInput
        style={styles.input}
        placeholder="o pega el código"
        placeholderTextColor="#9a9aa8"
        value={code}
        onChangeText={setCode}
        autoCapitalize="none"
      />
      <Pressable style={styles.btn} onPress={() => redeem(code)}>
        <Text style={styles.btnText}>{t("redeem")}</Text>
      </Pressable>
      {result ? (
        <View style={[styles.banner, result.ok ? styles.ok : styles.bad]}>
          <Text style={styles.bannerText}>{result.text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0e0e12", padding: 16 },
  h1: { color: "#f2f2f5", fontSize: 28, fontWeight: "700" },
  muted: { color: "#9a9aa8", marginBottom: 12 },
  camera: { height: 260, borderRadius: 12, overflow: "hidden", marginBottom: 12 },
  input: {
    borderColor: "#2a2a35",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: "#f2f2f5",
    marginBottom: 12,
  },
  btn: { backgroundColor: "#7c5cff", padding: 12, borderRadius: 8 },
  btnText: { color: "white", textAlign: "center", fontWeight: "700" },
  banner: { marginTop: 16, padding: 16, borderRadius: 12 },
  ok: { backgroundColor: "#123c2c" },
  bad: { backgroundColor: "#3c1218" },
  bannerText: { color: "#f2f2f5", fontSize: 18, fontWeight: "700" },
});
