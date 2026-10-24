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
import { router } from "expo-router";
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
  const tc = useTranslations("common");
  const toast = useToast();
  const { colors, scheme } = useTheme();
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
    router.push({
      pathname: "/safety/report",
      params: { kind: target.kind, ref: target.ref },
    });

  const confirmBlock = () =>
    Alert.alert(t("block.title"), t("block.body"), [
      { text: tc("cancel"), style: "cancel" },
      {
        text: t("block.confirm"),
        style: "destructive",
        onPress: () => block.mutate({ requestId: requestId(), target }),
      },
    ]);

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
            disabled(block.isPending),
          ]}
        >
          <NativeButton
            label={t("report.action")}
            systemImage="flag"
            onPress={() => asMember(report)}
          />
          {/* biome-ignore lint/a11y/useValidAriaRole: SwiftUI ButtonRole, not a DOM ARIA role. */}
          <NativeButton
            label={t("block.action")}
            systemImage="person.crop.circle.badge.minus"
            role="destructive"
            onPress={() => asMember(confirmBlock)}
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
          <DropdownMenuItem
            enabled={!block.isPending}
            onClick={() => asMember(report)}
          >
            <DropdownMenuItem.Text>
              <ComposeText>{t("report.action")}</ComposeText>
            </DropdownMenuItem.Text>
          </DropdownMenuItem>
          <DropdownMenuItem
            enabled={!block.isPending}
            elementColors={{ textColor: colors.danger }}
            onClick={() => asMember(confirmBlock)}
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
