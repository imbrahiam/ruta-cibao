import {
  CircleCheck,
  CircleDot,
  CircleX,
  type LucideIcon,
  MessageSquareReply,
  Search,
} from "lucide-react-native";
import type { BadgeTone } from "@/ui/tags";

export type ConsultationStatus =
  | "open"
  | "in_review"
  | "answered"
  | "resolved"
  | "rejected";

/** Every status reads with an icon and a word, never by colour alone. */
export const STATUS_STYLE: Record<
  ConsultationStatus,
  { tone: BadgeTone; icon: LucideIcon }
> = {
  open: { tone: "neutral", icon: CircleDot },
  in_review: { tone: "warning", icon: Search },
  answered: { tone: "accent", icon: MessageSquareReply },
  resolved: { tone: "success", icon: CircleCheck },
  rejected: { tone: "danger", icon: CircleX },
};

export const STATUSES = Object.keys(STATUS_STYLE) as ConsultationStatus[];
