import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

/**
 * Comments under a consultation, and experiences of a place.
 *
 * Anybody may read them; a signed-in member may write one, published at once
 * and reportable like any other content. The subject is named by its slug.
 */
export const commentSubjectKind = z.enum(["consultation", "place"]);
export type CommentSubjectKind = z.infer<typeof commentSubjectKind>;

export const MAX_COMMENT_LENGTH = 500;

export const listCommentsInput = z.object({
  kind: commentSubjectKind,
  ref: z.string().min(1),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const commentItem = z.object({
  id: z.uuid(),
  body: z.string(),
  /** Display name, never an account id. */
  author: z.string(),
  authorImage: z.string().nullable(),
  createdAt: z.iso.datetime(),
  /** The caller wrote it, so they may take it down. */
  isMine: z.boolean(),
});

export const listCommentsOutput = z.object({
  items: z.array(commentItem),
  total: z.number().int().nonnegative(),
});

export const createCommentInput = z.object({
  /** A retry with the same id returns the first comment instead of a second. */
  requestId: z.uuid(),
  kind: commentSubjectKind,
  ref: z.string().min(1),
  body: z.string().trim().min(1).max(MAX_COMMENT_LENGTH),
});

export const deleteCommentInput = z.object({ commentId: z.uuid() });

export const commentsContract = {
  list: oc
    .meta(
      openapi({
        method: "GET",
        path: "/comments",
        summary: "Comments on a consultation or experiences of a place",
      }),
    )
    .input(listCommentsInput)
    .output(listCommentsOutput),

  create: oc
    .meta(
      openapi({
        method: "POST",
        path: "/comments",
        successStatus: 201,
        summary: "Comment, or share an experience",
      }),
    )
    .input(createCommentInput)
    .output(commentItem),

  delete: oc
    .meta(
      openapi({
        method: "DELETE",
        path: "/comments/{commentId}",
        summary: "Take down your own comment",
      }),
    )
    .input(deleteCommentInput)
    .output(z.object({ status: z.literal("ok") })),
};
