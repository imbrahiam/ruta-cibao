# Building and publishing the phone app

The native app in `apps/mobile` is the primary way residents use Ruta Cibao. The
web app is the admin panel, the landing page and the share pages; it does not
serve the phone app and has no map.

## Variants

One codebase builds three installable apps that can live side by side on a
phone. Each has its own bundle identifier and URL scheme, so a session, a deep
link or a push token can never cross from one to another.

| `APP_VARIANT` | Name | Identifier | Scheme |
| --- | --- | --- | --- |
| `development` | Ruta Cibao (dev) | `do.rutacibao.app.dev` | `rutacibao-dev` |
| `preview` | Ruta Cibao (preview) | `do.rutacibao.app.preview` | `rutacibao-preview` |
| `production` | Ruta Cibao | `do.rutacibao.app` | `rutacibao` |

`APP_VARIANT` defaults to `development`. EAS sets it per profile; set it
yourself for `expo run:ios` or `expo run:android`.

## Build-time configuration

These values are baked into the signed build. None of them is a secret, but a
wrong one produces an app that installs and is useless in the field.

| Variable | Required | What it does |
| --- | --- | --- |
| `EXPO_PUBLIC_API_ORIGIN` | Production | Origin of the API, for example `https://rutacibao.com`. A production build refuses to start without an `https://` value. |
| `EXPO_PUBLIC_MAP_PROVIDER` | No | `google` (default) or `apple`. Apple Maps is iOS-only and needs no key. |
| `GOOGLE_MAPS_MOBILE_API_KEY` | With Google | Maps SDK key, restricted to the bundle identifiers. A build with Google selected and no key fails at config time. |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | For push | EAS project id; push notifications need it in a store build. |
| `EXPO_PUBLIC_SOURCE_URL` | No | Public repository linked from About. |
| `APPLE_TEAM_ID` | Local device builds | Signing team. EAS supplies its own. |
| `APPLE_PERSONAL_TEAM` | No | `1` drops the Push Notifications entitlement for a free Apple team; push stays unavailable on that build. |

Put these in the EAS environment (or `eas.json` for a demo profile), not in the
server's `.env`. The server never reads them.

## Local development

```bash
bun install
bun run mobile          # Expo dev server against http://localhost:3000
bun run mobile:ios      # native build on the simulator
bun run mobile:android  # native build on an emulator or device
bun run mobile:doctor   # expo-doctor
```

The default `EXPO_PUBLIC_API_ORIGIN` is `http://localhost:3000`, which the iOS
simulator reaches directly. A physical phone needs the machine's LAN address;
`next dev` blocks cross-origin assets unless the host is allowlisted, so add it
to `DEV_ORIGINS` in `.env`.

## EAS builds

The profiles are in `apps/mobile/eas.json`.

```bash
cd apps/mobile

bunx eas build --profile development --platform ios      # development client
bunx eas build --profile demo --platform ios             # preview, demo server
bunx eas build --profile demo --platform android         # installable APK
bunx eas build --profile production --platform all       # store builds
```

`production` auto-increments the build number and reads `APP_VARIANT` from the
profile. `demo` sets `EXPO_PUBLIC_API_ORIGIN=https://demo.rutacibao.com` and the
preview variant. A demo build for iOS can set `EXPO_PUBLIC_MAP_PROVIDER=apple`
to avoid a Google key entirely.

Submit an iOS build with `bunx eas submit --platform ios`; Android is uploaded
through the Play Console or `bunx eas submit --platform android`.

## Store checklist

Before the first production submission:

- [ ] `EXPO_PUBLIC_API_ORIGIN` is the public HTTPS origin, not localhost.
- [ ] `GOOGLE_MAPS_MOBILE_API_KEY` is restricted to `do.rutacibao.app` on both
      platforms and to the Maps SDKs only. Billing is enabled.
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` is set and push credentials are uploaded.
- [ ] The privacy policy and account deletion path are reachable from the app.
      Both are in the account screen; deletion works without contacting staff.
- [ ] Location, camera and photo-library prompts use the Spanish catalogue
      copy (`packages/shared/messages/es.json`), not placeholders.
- [ ] The app opens on the map with no signal, using the last offline snapshot.
- [ ] Sign-in works with a real Dominican number over SMS and with email.
- [ ] The build has no development menu, no `localhost` origin and no test
      account seeded into it.

Apple requires a privacy nutrition label and a demo account for review. Use a
seeded demo phone from `scripts/seed-demo.ts` on the demo server, never a real
resident's account.

## Offline behaviour

The app keeps an encrypted SQLite database (SQLCipher) for the published
snapshot and the contribution outbox.

- Published places, routes, consultations and the offline map snapshot are
  stored locally and refreshed when the app reaches the API.
- A contribution made without signal is queued in the outbox, encrypted at
  rest, and sent when connectivity returns. The queue survives a restart.
- A queued item is removed only after the server accepts it. A rejected item
  stays visible in the app with the reason, so a person can correct it.
- Signing out or deleting the account clears the outbox as well as the keychain
  entries. The public snapshot is not private and stays.
- If the encrypted database cannot be opened with the stored key, it is
  replaced and the failure is reported to `/api/client-errors`. That path is a
  last resort: a readable file with the wrong key cannot be recovered.

## Error reporting

A render failure the app survives is caught by the root `ErrorBoundary` and sent
to `/api/client-errors` with the message, stack, platform and app variant. It
carries no identity, coordinates or screen content. The endpoint rate-limits
and stores nothing; the line appears in the server log as `client.error`.

## Offline map and basemap provider

The map is `react-native-maps`. Google Maps is the default on both platforms;
`EXPO_PUBLIC_MAP_PROVIDER=apple` switches iOS to Apple Maps. The basemap is the
provider's; places, routes and traffic are first-party GeoJSON and vector tiles
from this API, so switching providers does not change the data or the offline
snapshot.

Google requires billing on the key's project. Without it the SDK draws an empty
grid; the app still runs, but the map is unusable. That is why the build fails
when Google is selected without a key.
