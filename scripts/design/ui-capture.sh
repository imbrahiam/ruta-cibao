#!/usr/bin/env bash
# Captures the same screens on the iOS simulator and the Android emulator, light and dark,
# so a design review compares like with like. Needs both debug apps installed and signed in
# (see docs/NATIVE.md "Local testing"). Usage: scripts/design/ui-capture.sh <out-dir> [screen...]
set -euo pipefail

OUT=${1:?out dir}; shift || true
ADB=${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}
IOS_ID=${IOS_ID:-booted}
BUNDLE=do.rutacibao.app.dev
ACTIVITY=do.rutacibao.app.dev/rutacibao.android.MainActivity
PLACE=${PLACE:-colmado-la-esquina-sabaneta}
CASE=${CASE:-hoyos-en-el-camino-a-la-presa-demo}
SETTLE=${SETTLE:-9}
PLATFORMS=${PLATFORMS:-ios android} # e.g. PLATFORMS=android to redo one side
MODES=${MODES:-light dark}           # e.g. MODES=dark
mkdir -p "$OUT"
# Reports expire, so pick whatever is live now. Seed one through the app if this comes back empty.
TRAFFIC=${TRAFFIC:-$(curl -s "http://localhost:3000/api/traffic?west=-71.6&south=19.2&east=-71.1&north=19.6" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)}
[[ -n $TRAFFIC ]] || echo "warning: no live traffic report; the traffic screen will show the bare map" >&2

ALL=(map place traffic consultas detail aportes avisos cuenta gestion new-consultation new-traffic new-place)
SCREENS=("${@:-${ALL[@]}}")

# screen -> "<ios env>|<ios url>|<android extras>|<android url>"
spec() {
  case $1 in
    map)              echo "RUTA_DEBUG_TAB=map||--es ruta_debug_tab map|" ;;
    place)            echo "RUTA_DEBUG_TAB=map|rutacibao-dev://s/place/$PLACE||rutacibao-dev://s/place/$PLACE" ;;
    traffic)          echo "RUTA_DEBUG_TAB=map|rutacibao-dev://s/traffic/$TRAFFIC||rutacibao-dev://s/traffic/$TRAFFIC" ;;
    consultas)        echo "RUTA_DEBUG_TAB=consultations||--es ruta_debug_tab consultations|" ;;
    detail)           echo "RUTA_DEBUG_TAB=consultations RUTA_DEBUG_SLUG=$CASE||--es ruta_debug_slug $CASE|" ;;
    aportes)          echo "RUTA_DEBUG_TAB=contributions||--es ruta_debug_tab contributions|" ;;
    avisos)           echo "RUTA_DEBUG_TAB=contributions RUTA_DEBUG_COMPOSE=inbox||--es ruta_debug_compose inbox|" ;;
    cuenta)           echo "RUTA_DEBUG_TAB=account||--es ruta_debug_tab account|" ;;
    gestion)          echo "RUTA_DEBUG_TAB=gestion||--es ruta_debug_tab gestion|" ;;
    new-consultation) echo "RUTA_DEBUG_TAB=contributions RUTA_DEBUG_COMPOSE=consultation||--es ruta_debug_compose consultation|" ;;
    new-traffic)      echo "RUTA_DEBUG_TAB=contributions RUTA_DEBUG_COMPOSE=traffic||--es ruta_debug_compose traffic|" ;;
    new-place)        echo "RUTA_DEBUG_TAB=contributions RUTA_DEBUG_COMPOSE=place||--es ruta_debug_compose place|" ;;
    *) echo "unknown screen $1" >&2; return 1 ;;
  esac
}

ios() { # env url out
  xcrun simctl terminate "$IOS_ID" "$BUNDLE" >/dev/null 2>&1 || true
  xcrun simctl ui "$IOS_ID" appearance "$mode" # re-assert: it has drifted back mid-run before
  local args=()
  for kv in $1; do args+=("SIMCTL_CHILD_$kv"); done
  env "${args[@]}" xcrun simctl launch "$IOS_ID" "$BUNDLE" >/dev/null
  if [[ -n $2 ]]; then sleep 3; xcrun simctl openurl "$IOS_ID" "$2"; fi
  sleep "$SETTLE"
  xcrun simctl io "$IOS_ID" screenshot "$3" >/dev/null 2>&1
}

android() { # extras url out
  "$ADB" shell am force-stop "$BUNDLE"
  # shellcheck disable=SC2086
  "$ADB" shell am start -n "$ACTIVITY" $1 >/dev/null
  # Past the splash: the activity has focus and its first frame is drawn.
  for _ in $(seq 1 30); do
    "$ADB" shell dumpsys window 2>/dev/null | grep -q "mCurrentFocus.*MainActivity" && break
    sleep 1
  done
  if [[ -n $2 ]]; then sleep 3; "$ADB" shell am start -a android.intent.action.VIEW -d "$2" "$BUNDLE" >/dev/null; fi
  sleep "$SETTLE"
  "$ADB" exec-out screencap -p > "$3"
}

for mode in $MODES; do
  xcrun simctl ui "$IOS_ID" appearance "$mode"
  "$ADB" shell cmd uimode night "$([[ $mode == dark ]] && echo yes || echo no)" >/dev/null
  for s in "${SCREENS[@]}"; do
    IFS='|' read -r ienv iurl aext aurl <<<"$(spec "$s")"
    [[ $PLATFORMS == *ios* ]] && ios "$ienv" "$iurl" "$OUT/$s-$mode-ios.png"
    [[ $PLATFORMS == *android* ]] && android "$aext" "$aurl" "$OUT/$s-$mode-android.png"
    echo "captured $s $mode"
  done
done
xcrun simctl ui "$IOS_ID" appearance light
"$ADB" shell cmd uimode night no >/dev/null
echo "screens=${#SCREENS[@]} files=$(ls "$OUT"/*.png | wc -l | tr -d ' ')"
