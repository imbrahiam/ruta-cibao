import es from "@ruta/shared/messages/es.json" with { type: "json" };
import type { ConfigContext, ExpoConfig } from "expo/config";

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

export default ({ config }: ConfigContext): ExpoConfig => {
  const current = VARIANTS[variant()];

  return {
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
        backgroundColor: "#183F32",
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
      ["@rnmapbox/maps", { RNMapboxMapsImpl: "mapbox" }],
      ["expo-location", { locationWhenInUsePermission: permissions.location }],
      [
        "expo-image-picker",
        {
          photosPermission: permissions.photos,
          cameraPermission: permissions.camera,
          microphonePermission: false,
        },
      ],
      ["expo-notifications", { color: "#1F6B52", defaultChannel: "default" }],
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 96,
          backgroundColor: "#FAFAF7",
          dark: {
            image: "./assets/images/splash-icon.png",
            backgroundColor: "#121211",
          },
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      variant: variant(),
    },
  };
};
