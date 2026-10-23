import type { ContentTarget } from "@ruta/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Ellipsis } from "lucide-react-native";
import { ActionSheetIOS, Alert, Platform } from "react-native";
import { useTranslations } from "use-intl";
import { useMemberAction } from "@/features/auth/session";
import { orpc } from "@/lib/api";
import { requestId } from "@/lib/ids";
import { IconButton, type IconButtonProps } from "@/ui/surfaces";
import { useToast } from "@/ui/toast";
import { safetyErrorKey } from "./errors";
import { refreshHiddenTargets } from "./hidden-targets";

/**
 * The "more" control on content someone else wrote: report it, or hide its
 * author. Members only; signed out, it opens sign-in first. Hiding an author
 * asks for confirmation, then `onHidden` lets the screen leave content that has
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

  const open = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t("report.action"), t("block.action"), tc("cancel")],
          cancelButtonIndex: 2,
          title: tu("menuTitle"),
        },
        (index) => {
          if (index === 0) report();
          if (index === 1) confirmBlock();
        },
      );
      return;
    }
    Alert.alert(tu("menuTitle"), undefined, [
      { text: t("report.action"), onPress: report },
      { text: t("block.action"), onPress: confirmBlock },
      { text: tc("cancel"), style: "cancel" },
    ]);
  };

  return (
    <IconButton
      icon={Ellipsis}
      label={tu("menuLabel")}
      variant={variant}
      size={size}
      haptic="light"
      disabled={block.isPending}
      onPress={() => asMember(open)}
      testID="content-menu"
    />
  );
}
