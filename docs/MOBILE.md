# Ruta Cibao on a phone

The mobile app is the web app. It is installable, it opens full screen, it
receives push notifications, it queues work while there is no signal, and — on
the MapLibre renderer — it can keep the province's map on the device. This
document covers what that means in practice and how the Google Play listing is
produced from it.

## What the installed app does

| Capability | Android (Chrome / Play) | iPhone, iPad (Safari) |
| --- | --- | --- |
| Home-screen icon, full screen, splash | Yes | Yes, via Share → *Añadir a pantalla de inicio* |
| Push notifications | Yes | Yes, once installed (iOS 16.4+) |
| Offline shell (`/offline`) | Yes | Yes |
| Reports queued without signal | Yes | Yes |
| Queue sent with the app closed (Background Sync) | Yes | No — sent on next open |
| Province basemap stored on the device | Yes, MapLibre renderer only | Yes, MapLibre renderer only |

Two pieces are deliberately renderer-dependent. Google's terms and the OSM standard tile usage policy
forbid storing their tiles, so the *Mapa sin señal* row in the layers panel only
appears when `NEXT_PUBLIC_MAP_RENDERER=maplibre` and
`NEXT_PUBLIC_BASEMAP_PMTILES_URL` points at a file this origin serves, and
hardware WebGL is available. Software rendering falls back to online raster
tiles, so the offline-download row is hidden on that device. Saving it
stores the whole PMTiles file in Cache Storage; the service worker then answers
the renderer's byte-range requests from that copy.

`bun run basemap` cuts two files at street level (z15), and the served one is
what the row downloads:

| File | Covers | Size |
| --- | --- | --- |
| `/basemap/santiago-rodriguez.pmtiles` | The province | ~9 MB |
| `/basemap/republica-dominicana.pmtiles` | The whole country | ~57 MB |

The country file exists so that adding a municipality elsewhere is a change of
environment variable, not a new build. The row shows the size before anything is
downloaded and suggests Wi-Fi above 25 MB. Nothing else in the app widens with
it: `PROVINCE_BOUNDS` still decides where a place or a report may be filed.

### Where the code lives

- `src/app/manifest.ts` — the web app manifest.
- `src/app/sw.ts` — the service worker: offline shell, push, the `sync` handler
  that replays the queue, the basemap cache with range support.
- `src/components/offline/install-splash.tsx` — the install offer on the map: a
  dismissible card, shown only after the person has done something useful
  (sent or queued a report, saved a place — `src/lib/install-moment.ts`), once
  Chrome fires
  `beforeinstallprompt` or on iOS, where it carries the Share-sheet steps.
  Dismissing snoozes it 30 days.
- `src/hooks/use-device.ts` — phone or tablet according to the user agent, not
  the viewport. A narrow window on a laptop has no home screen, so the install
  offer never appears there.
- `src/lib/offline/` — the IndexedDB queue (`queue.ts`), the shared drain
  (`drain.ts`), the page's flush (`flush.ts`), Background Sync registration
  (`background-sync.ts`) and the basemap store (`basemap.ts`).
- `src/app/.well-known/assetlinks.json/route.ts` — Digital Asset Links for the
  Android app, generated from environment variables.

## Publishing to Google Play (Trusted Web Activity)

A TWA is a small Android app that launches Chrome full screen on this origin.
There is no second codebase: the store listing ships whatever the site serves.

1. Deploy the site over HTTPS at its final origin. Asset links are verified
   against that exact origin, so a staging domain produces an app that opens
   with an address bar.
2. Install Bubblewrap: `npm i -g @bubblewrap/cli` (needs a JDK and the Android
   SDK; Bubblewrap offers to download both on first run).
3. Generate the project from the live manifest:

   ```bash
   bubblewrap init --manifest https://<origin>/manifest.webmanifest
   ```

   Accept the defaults it reads from the manifest (name, colours, icons,
   `start_url` `/mapa`). Choose a package name such as `do.rutacibao.app` and
   let it create a signing key; keep that keystore out of the repository.
4. Build: `bubblewrap build` produces an `.aab` for Play and an `.apk` for
   testing.
5. Publish the app's signature back on the site. Take the SHA-256 fingerprint
   from `bubblewrap fingerprint list`, and after the first Play upload also the
   one under *Play Console → Setup → App signing*. Set both on the server:

   ```bash
   ANDROID_PACKAGE_NAME=do.rutacibao.app
   ANDROID_SHA256_FINGERPRINTS=<upload key>,<Play signing key>
   ```

   `https://<origin>/.well-known/assetlinks.json` then serves the statement.
   Check it with `bubblewrap validate` or Google's
   [Statement List Generator and Tester](https://developers.google.com/digital-asset-links/tools/generator).
6. Upload the `.aab` to Play Console. The listing's screenshots come from the
   installed PWA; nothing else is needed from the app side.

After a change to the site, nothing needs to be republished: the TWA loads the
live origin. Republish only when the manifest's name, icons or colours change,
or when Bubblewrap itself needs updating (`bubblewrap update`).

## iPhone and iPad

Apple has no equivalent of the TWA short of the App Store, and thin wrappers are
routinely rejected under guideline 4.2. The path here is Safari's *Añadir a
pantalla de inicio*, which the install banner and `/instalar` explain. Once
installed the app is full screen and receives push; Background Sync is not
available, so anything queued without signal goes out the next time the app is
opened.

## Testing locally

- The service worker is only registered in production builds. Run
  `bun run build && bun run start`, or point a phone on the same Wi-Fi at the
  machine's LAN address (allowed by `allowedDevOrigins` in `next.config.ts`).
- **The location prompt needs https.** Geolocation is a secure-context API:
  over `http://<LAN address>:3000` Safari and Chrome refuse it without ever
  showing the permission sheet, which reads in the app as "I tapped *Estoy aquí
  ahora* and nothing happened". The app now names that case instead of blaming
  the permissions, but to actually see the prompt on a phone, reach the dev
  server over https — `bun run dev:https` (a self-signed certificate through
  `mkcert`, whose root CA the phone has to trust) or a tunnel such as
  `cloudflared tunnel --url http://localhost:3000`, adding the tunnel host to
  `DEV_ORIGINS`. In production the origin is https and the prompt appears
  normally.
- Chrome DevTools → *Application* → *Service workers* has a **Sync** button that
  fires the `sync` event by hand; queue a traffic report offline, go back online,
  press it, and watch `/pendientes` empty.
- To try the offline basemap, run with `NEXT_PUBLIC_MAP_RENDERER=maplibre` and
  `NEXT_PUBLIC_BASEMAP_PMTILES_URL=/basemap/santiago-rodriguez.pmtiles`, save
  the map from the layers panel, then tick *Offline* in DevTools → *Network* and
  pan around Sabaneta.
