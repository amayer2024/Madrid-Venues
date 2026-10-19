import Constants from "expo-constants";
import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { ComponentType, ReactNode } from "react";
import { t } from "../lib/i18n";

const stripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder";
const inExpoGo = Constants.appOwnership === "expo";

let StripeGate: ComponentType<{ children: ReactNode }> = ({ children }) => <>{children}</>;
if (!inExpoGo) {
  try {
    const { StripeProvider } = require("@stripe/stripe-react-native") as typeof import("@stripe/stripe-react-native");
    StripeGate = ({ children }) => (
      <StripeProvider publishableKey={stripeKey} merchantIdentifier="merchant.app.lineskip.madrid">
        {children}
      </StripeProvider>
    );
  } catch {
    // Native Stripe ships with an EAS/dev-client build, not Expo Go.
  }
}

export default function Layout() {
  return (
    <StripeGate>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: "#1a1a22" },
          headerTintColor: "#f2f2f5",
          tabBarStyle: { backgroundColor: "#1a1a22", borderTopColor: "#2a2a35" },
          tabBarActiveTintColor: "#7c5cff",
          tabBarInactiveTintColor: "#9a9aa8",
        }}
      >
        <Tabs.Screen name="index" options={{ title: t("venues") }} />
        <Tabs.Screen name="passes" options={{ title: t("myPasses") }} />
        <Tabs.Screen name="door" options={{ title: t("door") }} />
        <Tabs.Screen name="account" options={{ title: t("account") }} />
        <Tabs.Screen name="login" options={{ href: null, title: t("login") }} />
        <Tabs.Screen name="register" options={{ href: null, title: t("register") }} />
        <Tabs.Screen name="venue/[id]" options={{ href: null, title: "Local" }} />
      </Tabs>
    </StripeGate>
  );
}
