import "@/i18n/polyfills";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import es from "@ruta/shared/messages/es.json";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  DarkTheme,
  DefaultTheme,
  type ErrorBoundaryProps,
  Stack,
  ThemeProvider,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { loadTheme } from "@/features/appearance/theme-store";
import { NotificationResponseListener } from "@/features/notifications/response-listener";
import { I18nProvider } from "@/i18n/provider";
import { forgetPreviousInstall } from "@/lib/install-guard";
import { queryClient, wireQueryLifecycle } from "@/lib/query";
import { reportError } from "@/lib/report-error";
import { palettes, useScheme } from "@/ui/theme";
import { ToastProvider } from "@/ui/toast";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });
wireQueryLifecycle();

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * Catches a render failure the app survives and puts it in the server log.
 *
 * Without this the screen closes to a red box in development and to a blank
 * screen in a release build, with nothing anywhere a maintainer can read. The
 * copy comes from the catalogue because this renders above the providers.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    reportError(error, "root");
  }, [error]);

  return (
    <View style={styles.errorRoot}>
      <Text style={styles.errorTitle}>{es.common.errorTitle}</Text>
      <Text style={styles.errorBody}>{es.common.errorBody}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={retry}
        style={styles.errorButton}
      >
        <Text style={styles.errorButtonText}>{es.common.retry}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  errorRoot: {
    flex: 1,
    justifyContent: "center",
    gap: 12,
    padding: 32,
    backgroundColor: palettes.light.background,
  },
  errorTitle: { fontSize: 22, fontWeight: "600", color: palettes.light.text },
  errorBody: {
    fontSize: 16,
    lineHeight: 22,
    color: palettes.light.textSecondary,
  },
  errorButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palettes.light.accent,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: palettes.light.onAccent,
  },
});

function navigationTheme(scheme: "light" | "dark") {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const colors = palettes[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.separator,
      notification: colors.danger,
    },
  };
}

function RootStack() {
  return (
    <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="search" />
      <Stack.Screen
        name="map-layers"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.6, 0.9],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen name="place/[slug]" options={{ headerShown: false }} />
      <Stack.Screen
        name="place/report"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen
        name="safety/report"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen name="place/claim" options={{ presentation: "modal" }} />
      <Stack.Screen name="route/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="consultation/[slug]"
        options={{ headerTransparent: true }}
      />
      <Stack.Screen
        name="consultation/new"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="contribute"
        options={{
          presentation: "formSheet",
          headerShown: false,
          sheetAllowedDetents: "fitToContents",
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen
        name="contribute/place"
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="contribute/traffic"
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen name="s/[kind]/[ref]" options={{ headerShown: false }} />
      <Stack.Screen
        name="directions"
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="pick-location"
        options={{ presentation: "fullScreenModal", headerShown: false }}
      />
      <Stack.Screen
        name="sign-in"
        options={{
          presentation: "modal",
          headerShown: false,
          gestureEnabled: true,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([forgetPreviousInstall(), loadTheme()])
      .catch(() => undefined) // expected: startup must continue even if local state is unreadable.
      .finally(() => {
        setReady(true);
        SplashScreen.hideAsync();
      });
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <I18nProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={navigationTheme(scheme)}>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <StatusBar style="auto" />
                  <RootStack />
                  <NotificationResponseListener />
                </ToastProvider>
              </BottomSheetModalProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </I18nProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
