/**
 * Install the identity into the apps. The artwork itself is built by
 * `scripts/brand/export-logo.ts` into `brand/logo/`; this copies each export
 * to where its platform expects it.
 * Run: bun scripts/brand/export-logo.ts && bun scripts/brand/generate-brand-assets.ts
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "../..");
const LOGO = path.join(ROOT, "brand/logo");
const IOS_ASSETS = path.join(ROOT, "apps/ios/Resources/Illustrations.xcassets");
const ANDROID_RES = path.join(ROOT, "apps/android/src/main/res");
const WEB_APP = path.join(ROOT, "apps/web/src/app");

async function install(from: string, to: string) {
  await mkdir(path.dirname(to), { recursive: true });
  await copyFile(path.join(LOGO, from), to);
  console.log(`wrote ${path.relative(ROOT, to)}`);
}

// iOS: the app icon with its dark and tinted appearances, and the mark as a
// vector image set for the in-app BrandMark.
const appIcon = path.join(IOS_ASSETS, "AppIcon.appiconset");
await install("ios/AppIcon-1024.png", path.join(appIcon, "icon-1024.png"));
await install(
  "ios/AppIcon-1024-dark.png",
  path.join(appIcon, "icon-1024-dark.png"),
);
await install(
  "ios/AppIcon-1024-tinted.png",
  path.join(appIcon, "icon-1024-tinted.png"),
);
const icon = (filename: string, luminosity?: "dark" | "tinted") => ({
  ...(luminosity
    ? { appearances: [{ appearance: "luminosity", value: luminosity }] }
    : {}),
  filename,
  idiom: "universal",
  platform: "ios",
  size: "1024x1024",
});
await writeFile(
  path.join(appIcon, "Contents.json"),
  `${JSON.stringify(
    {
      images: [
        icon("icon-1024.png"),
        icon("icon-1024-dark.png", "dark"),
        icon("icon-1024-tinted.png", "tinted"),
      ],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  )}\n`,
);
// The in-app mark, as a vector image set (green reads on light and dark).
const brandMark = path.join(IOS_ASSETS, "BrandMark.imageset");
await install("mark.svg", path.join(brandMark, "mark.svg"));
await writeFile(
  path.join(brandMark, "Contents.json"),
  `${JSON.stringify(
    {
      images: [{ filename: "mark.svg", idiom: "universal" }],
      info: { author: "xcode", version: 1 },
      properties: { "preserves-vector-representation": true },
    },
    null,
    2,
  )}\n`,
);

// Android: adaptive icon layers, the themed (monochrome) layer and the
// notification glyph. The background colour lives in values/app.xml.
const drawable = path.join(ANDROID_RES, "drawable");
await install(
  "android/ic_launcher_foreground.xml",
  path.join(drawable, "ic_launcher_foreground.xml"),
);
await install(
  "android/ic_launcher_monochrome.xml",
  path.join(drawable, "ic_launcher_monochrome.xml"),
);
await install(
  "android/ic_notification.xml",
  path.join(drawable, "ic_notification.xml"),
);

// Web: favicon and Apple touch icon (Next.js picks both up from app/).
await install("web/icon.svg", path.join(WEB_APP, "icon.svg"));
await install("web/apple-icon.png", path.join(WEB_APP, "apple-icon.png"));
