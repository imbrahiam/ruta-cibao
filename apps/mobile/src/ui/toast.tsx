import {
  CircleAlert,
  CircleCheck,
  Info,
  type LucideIcon,
} from "lucide-react-native";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutUp,
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "./icon";
import { haptic } from "./pressable";
import { Text } from "./text";
import { floating, radius, space, useTheme } from "./theme";

type ToastTone = "success" | "error" | "info";

type Toast = { id: number; title: string; body?: string; tone: ToastTone };

type ToastApi = {
  show: (toast: { title: string; body?: string; tone?: ToastTone }) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const ICONS: Record<ToastTone, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const ENTER = SlideInUp.duration(280).easing(Easing.bezier(0.23, 1, 0.32, 1));
const EXIT = SlideOutUp.duration(200).easing(Easing.bezier(0.23, 1, 0.32, 1));
const ENTER_REDUCED = FadeIn.duration(150);
const EXIT_REDUCED = FadeOut.duration(150);

/**
 * Transient confirmation. Enters and leaves from the top (where it came from),
 * one at a time, announced to VoiceOver, paired with a haptic on the same frame.
 * Never the only record of something important.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const reduced = useReducedMotion();

  const show = useCallback<ToastApi["show"]>(
    ({ title, body, tone = "success" }) => {
      counter.current += 1;
      setCurrent({ id: counter.current, title, body, tone });
      haptic(
        tone === "error" ? "medium" : tone === "success" ? "success" : "none",
      );
      AccessibilityInfo.announceForAccessibility(
        body ? `${title}. ${body}` : title,
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCurrent(null), 3500);
    },
    [],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.host, { top: insets.top + space.sm }]}
      >
        {current ? (
          <Animated.View
            key={current.id}
            entering={reduced ? ENTER_REDUCED : ENTER}
            exiting={reduced ? EXIT_REDUCED : EXIT}
            style={[
              styles.toast,
              floating(scheme),
              { backgroundColor: colors.text },
            ]}
          >
            <Icon
              as={ICONS[current.tone]}
              size={20}
              color={
                current.tone === "error"
                  ? colors.danger
                  : current.tone === "success"
                    ? colors.success
                    : colors.background
              }
            />
            <View style={styles.copy}>
              <Text
                variant="subhead"
                weight="600"
                style={{ color: colors.background }}
              >
                {current.title}
              </Text>
              {current.body ? (
                <Text
                  variant="footnote"
                  style={{ color: colors.background, opacity: 0.8 }}
                >
                  {current.body}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast outside ToastProvider");
  return api;
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: space.md,
    right: space.md,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm + 2,
    paddingVertical: space.sm + 4,
    paddingHorizontal: space.md,
    borderRadius: radius.panel,
    borderCurve: "continuous",
    maxWidth: 480,
  },
  copy: { flexShrink: 1, gap: 1 },
});
