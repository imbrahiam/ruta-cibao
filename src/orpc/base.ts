import { os } from "@orpc/server";
import type { AppContext } from "./context";

/** Root builder every procedure extends, carrying the request context type. */
export const pub = os.$context<AppContext>();
