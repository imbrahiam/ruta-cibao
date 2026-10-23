import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient, phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { API_ORIGIN, APP_SCHEME } from "./config";

/**
 * Sessions live in the device keychain. Every API call forwards the session
 * cookie from here; nothing about the session is kept in plain storage.
 */
export const authClient = createAuthClient({
  baseURL: API_ORIGIN,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storagePrefix: "rutacibao",
      storage: SecureStore,
    }),
    phoneNumberClient(),
    emailOTPClient(),
  ],
});

/** The `Cookie` header to send with an API request, or nothing when signed out. */
export async function sessionHeaders(): Promise<Record<string, string>> {
  const cookie = await authClient.getCookie();
  return cookie ? { cookie } : {};
}
