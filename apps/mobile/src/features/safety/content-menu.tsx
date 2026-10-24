import {
  Host as ComposeHost,
  Text as ComposeText,
  DropdownMenu,
  DropdownMenuItem,
  RNHostView,
} from "@expo/ui/jetpack-compose";
import { semantics, testID } from "@expo/ui/jetpack-compose/modifiers";
import { Host, Label, Menu, Button as NativeButton } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  disabled,
  frame,
  labelStyle,
} from "@expo/ui/swift-ui/modifiers";
import type { ContentTarget } from "@ruta/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { Alert, Platform, View } from "react-native";
import { useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { Icon } from "@/ui/icon";
import type { IconButtonProps } from "@/ui/surfaces";
import { useTheme } from "@/ui/theme";
import { useToast } from "@/ui/toast";
import { safetyErrorKey } from "./errors";
import { refreshHiddenTargets } from "./hidden-targets";

/** Report and hide-author actions for content someone else wrote. */
function useContentActions(target: ContentTarget, onHidden?: () => void) {
  const t = useTranslations("safety");
  const tc = useTranslations("common");
  const toast = useToast();
  const queryClient = useQueryClient();
  const asMember = useMemberAction();

  const block = useMutation(
    orpc.safety.blockAuthor.mutationOptions({
      onSuccess: async () => {
        await refreshHiddenTargets(queryClient);
        toast.show({ title: t("block.done") });
        onHidden?.();
        // Left to run after the screen has moved on, so the content that just
        // went away is not refetched under the person's eyes.
        for (const key of [
          orpc.places.key(),
          orpc.traffic.key(),
          orpc.routes.key(),
          orpc.consultations.key(),
          orpc.safety.blocks.key(),
        ]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      },
      onError: (error) =>
        toast.show({
          title: t(`errors.${safetyErrorKey(error)}`),
          tone: "error",
        }),
    }),
  );

  const report = () =>
    asMember(() =>
      router.push({
        pathname: "/safety/report",
        params: { kind: target.kind, ref: target.ref },
      }),
    );

  const confirmBlock = () =>
    asMember(() =>
      Alert.alert(t("block.title"), t("block.body"), [
        { text: tc("cancel"), style: "cancel" },
        {
          text: t("block.confirm"),
          style: "destructive",
          onPress: () => block.mutate({ requestId: requestId(), target }),
        },
      ]),
    );

  return { report, confirmBlock, pending: block.isPending };
}

/**
 * The same actions as a system bar menu, for screens with a native header:
 * on iOS 26 it is a Liquid Glass bar button like the system back button.
 */
export function ContentHeaderMenu({
  target,
  onHidden,
}: {
  target: ContentTarget;
  onHidden?: () => void;
}) {
  const t = useTranslations("safety");
  const tu = useTranslations("safetyUi");
  const { report, confirmBlock } = useContentActions(target, onHidden);
  return (
    <Stack.Toolbar placement="right">
      <Stack.Toolbar.Menu
        icon={Platform.OS === "ios" ? "ellipsis" : undefined}
        accessibilityLabel={tu("menuLabel")}
        title={tu("menuLabel")}
      >
        <Stack.Toolbar.MenuAction
          icon={Platform.OS === "ios" ? "flag" : undefined}
          onPress={report}
        >
          {t("report.action")}
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon={
            Platform.OS === "ios" ? "person.crop.circle.badge.minus" : undefined
          }
          destructive
          onPress={confirmBlock}
        >
          {t("block.action")}
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    </Stack.Toolbar>
  );
}

/**
 * The "more" control on content someone else wrote: report it, or hide its
 * author. Actions require membership; signed out, they open sign-in first.
 * Hiding an author asks for confirmation, then `onHidden` leaves content that has
 * just disappeared from the person's own views.
 */
export function ContentMenu({
  target,
  onHidden,
  variant = "plain",
  size,
}: {
  target: ContentTarget;
  onHidden?: () => void;
  variant?: IconButtonProps["variant"];
  size?: number;
}) {
  const t = useTranslations("safety");
  const tu = useTranslations("safetyUi");
  const { colors, scheme } = useTheme();
  const { report, confirmBlock, pending } = useContentActions(target, onHidden);
  const controlSize = Math.max(size ?? 44, Platform.OS === "android" ? 48 : 44);
  if (Platform.OS === "ios") {
    return (
      <Host matchContents colorScheme={scheme} seedColor={colors.accent}>
        <Menu
          label={
            <Label
              title={tu("menuLabel")}
              systemImage="ellipsis"
              modifiers={[
                labelStyle("iconOnly"),
                frame({ minWidth: controlSize, minHeight: controlSize }),
              ]}
            />
          }
          testID="content-menu"
          modifiers={[
            buttonStyle(variant === "glass" ? "glass" : "borderless"),
            disabled(pending),
          ]}
        >
          <NativeButton
            label={t("report.action")}
            systemImage="flag"
            onPress={report}
          />
          {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI ButtonRole, not a DOM ARIA role. */}
          <NativeButton
            label={t("block.action")}
            systemImage="person.crop.circle.badge.minus"
            role="destructive"
            onPress={confirmBlock}
          />
        </Menu>
      </Host>
    );
  }
  return (
    <ComposeHost matchContents colorScheme={scheme} seedColor={colors.accent}>
      <DropdownMenu>
        <DropdownMenu.Trigger>
          <RNHostView
            matchContents
            modifiers={[
              semantics({ contentDescription: tu("menuLabel") }),
              testID("content-menu"),
            ]}
          >
            <View
              pointerEvents="none"
              style={{
                width: controlSize,
                height: controlSize,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: controlSize / 2,
                backgroundColor:
                  variant === "glass" ? colors.surface : undefined,
              }}
            >
              <Icon as={Ellipsis} size={22} />
            </View>
          </RNHostView>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          <DropdownMenuItem enabled={!pending} onClick={report}>
            <DropdownMenuItem.Text>
              <ComposeText>{t("report.action")}</ComposeText>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
          <DropdownMenuItem
            enabled={!pending}
            elementColors={{ textColor: colors.danger }}
            onClick={confirmBlock}
          >
            <DropdownMenuItem.Text>
              <ComposeText>{t("block.action")}</ComposeText>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
        </DropdownMenu.Items>
      </DropdownMenu>
    </ComposeHost>
  );
}
