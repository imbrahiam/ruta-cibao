/**
 * Entry point for the Better Auth CLI (`bun run auth:generate`), which needs an
 * eagerly constructed instance to read the schema from. It runs from a shell
 * with a real .env, so building the instance here is safe.
 *
 * Nothing in the application imports this file — that is the point. Application
 * code uses `getAuth()` so the production build never constructs an instance.
 */
import { getAuth } from "./auth";

export const auth = getAuth();
