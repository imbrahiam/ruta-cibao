import "@/i18n/polyfills";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { loadTheme } from "@/features/appearance/theme-store";
import { NotificationResponseListener } from "@/features/notifications/response-listener";
import { I18nProvider } from "@/i18n/provider";
import { forgetPreviousInstall } from "@/lib/install-guard";
import { queryClient, wireQueryLifecycle } from "@/lib/query";
import { palettes, useScheme } from "@/ui/theme";
import { ToastProvider } from "@/ui/toast";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 250, fade: true });
wireQueryLifecycle();

export const unstable_settings = {
  anchor: "(tabs)",
};

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
      .catch(() => undefined)
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
