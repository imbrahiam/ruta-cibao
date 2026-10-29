import { BRAND_COLORS } from "@ruta/shared/brand";
import es from "@ruta/shared/messages/es.json" with { type: "json" };
import type { ConfigContext, ExpoConfig } from "expo/config";
import { type ConfigPlugin, withEntitlementsPlist } from "expo/config-plugins";

/**
 * One codebase, three installable variants that can live side by side on a
 * phone: a development client, the internal preview, and the store build.
 * Each has its own identifier and URL scheme so a session, a deep link or a
 * push token can never cross from one to another.
 */
const VARIANTS = {
  development: {
    name: "Ruta Cibao (dev)",
    identifier: "do.rutacibao.app.dev",
    scheme: "rutacibao-dev",
  },
  preview: {
    name: "Ruta Cibao (preview)",
    identifier: "do.rutacibao.app.preview",
    scheme: "rutacibao-preview",
  },
  production: {
    name: "Ruta Cibao",
    identifier: "do.rutacibao.app",
    scheme: "rutacibao",
  },
} as const;

type Variant = keyof typeof VARIANTS;

function variant(): Variant {
  const value = process.env.APP_VARIANT ?? "development";
  if (value in VARIANTS) return value as Variant;
  throw new Error(`APP_VARIANT must be one of ${Object.keys(VARIANTS)}`);
}

/** Permission prompts are user-facing text, so they come from the catalogue. */
const permissions = es.permissions;

const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig => {
  const current = VARIANTS[variant()];
  const provider =
    process.env.EXPO_PUBLIC_MAP_PROVIDER === "apple" ? "apple" : "google";

  // A build that points at localhost, or draws a keyless Google map, installs
  // and signs without complaint and is useless in the field. Fail the build
  // instead, where the person who can fix it is already looking.
  if (current === VARIANTS.production) {
    const origin = process.env.EXPO_PUBLIC_API_ORIGIN;
    if (!origin?.startsWith("https://")) {
      throw new Error(
        "Production builds require EXPO_PUBLIC_API_ORIGIN set to the public https origin.",
      );
    }
  }
  if (
    provider === "apple" &&
    current.identifier === VARIANTS.production.identifier
  ) {
    // Apple Maps is iOS-only; an Android build with it would render nothing.
    if (process.env.EXPO_OS === "android") {
      throw new Error("EXPO_PUBLIC_MAP_PROVIDER=apple is iOS-only.");
    }
  }
  if (provider === "google" && !process.env.GOOGLE_MAPS_MOBILE_API_KEY) {
    throw new Error(
      "Google Maps needs GOOGLE_MAPS_MOBILE_API_KEY at build time, or set EXPO_PUBLIC_MAP_PROVIDER=apple on iOS.",
    );
  }

  const expo: ExpoConfig = {
    ...config,
    name: current.name,
    slug: "ruta-cibao",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: current.scheme,
    userInterfaceStyle: "automatic",
    backgroundColor: "#FAFAF7",
    ios: {
      bundleIdentifier: current.identifier,
      // The signing team for local device builds; EAS supplies its own.
      ...(process.env.APPLE_TEAM_ID
        ? { appleTeamId: process.env.APPLE_TEAM_ID }
        : {}),
      supportsTablet: false,
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        CADisableMinimumFrameDurationOnPhone: true,
        NSLocationWhenInUseUsageDescription: permissions.location,
        NSCameraUsageDescription: permissions.camera,
        NSPhotoLibraryUsageDescription: permissions.photos,
      },
    },
    android: {
      package: current.identifier,
      adaptiveIcon: {
        backgroundColor: BRAND_COLORS.iris,
        foregroundImage: "./assets/images/android-icon-foreground.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.CAMERA",
      ],
      predictiveBackGestureEnabled: true,
    },
    plugins: [
      "expo-router",
      "expo-localization",
      "expo-secure-store",
      ["expo-sqlite", { useSQLCipher: true }],
      [
        "react-native-maps",
        {
          // Client-visible by design; restrict it to the app bundle ids and the
          // Maps SDKs in Google Cloud.
          iosGoogleMapsApiKey: process.env.GOOGLE_MAPS_MOBILE_API_KEY,
          androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_MOBILE_API_KEY,
        },
      ],
      ["expo-location", { locationWhenInUsePermission: permissions.location }],
      [
        "expo-image-picker",
        {
          photosPermission: permissions.photos,
          cameraPermission: permissions.camera,
          microphonePermission: false,
        },
      ],
      ["expo-notifications", { color: "#000000", defaultChannel: "default" }],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 96,
          backgroundColor: "#FFFFFF",
          dark: {
            image: "./assets/images/splash-icon.png",
            backgroundColor: "#000000",
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...config.extra,
      variant: variant(),
      eas: {
        ...config.extra?.eas,
        ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
          ? { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID }
          : {}),
      },
    },
  };
  // A free (personal) Apple team cannot sign the Push Notifications
  // capability, so a local device build on one drops it; push simply stays
  // unavailable on that build.
  return process.env.APPLE_PERSONAL_TEAM === "1"
    ? withoutPushEntitlement(expo)
    : expo;
};
