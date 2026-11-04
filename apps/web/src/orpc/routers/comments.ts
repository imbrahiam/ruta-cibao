import { ORPCError } from "@orpc/server";
import {
  CommentError,
  createComment,
  deleteComment,
  listComments,
} from "@/modules/comments/service";
import { impl, member } from "../base";

/**
 * Comments and place experiences. Reading is public; writing needs a member,
 * and the middleware on each entry is that check.
 */
function asCommentError(error: unknown): never {
  if (!(error instanceof CommentError)) throw error;
  if (error.reason === "too_many") {
    throw new ORPCError("TOO_MANY_REQUESTS", {
      message: "Too many comments; try again later.",
      data: { reason: error.reason },
    });
  }
  throw new ORPCError("NOT_FOUND", {
    message: "That does not exist.",
    data: { reason: error.reason },
  });
}

export const commentsRouter = {
  list: impl.comments.list.handler(async ({ context, input }) =>
    listComments(context.db, await context.getViewer(), input).catch(
      asCommentError,
    ),
  ),

  create: impl.comments.create
    .use(member)
    .handler(({ context, input }) =>
      createComment(context.db, context.viewer, input).catch(asCommentError),
    ),

  delete: impl.comments.delete
    .use(member)
    .handler(({ context, input }) =>
      deleteComment(context.db, context.viewer, input.commentId).catch(
        asCommentError,
      ),
    ),
};
