import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

const baseURL =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  "http://localhost:8000";

export const API_URL = baseURL;

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    expoClient({
      scheme: "lineskip",
      storagePrefix: "lineskip",
      storage: SecureStore,
    }),
  ],
});

export async function api(path: string, init: RequestInit = {}) {
  const cookie = authClient.getCookie();
  const res = await fetch(`${baseURL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}
