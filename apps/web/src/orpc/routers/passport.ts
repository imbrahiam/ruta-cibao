import {
  passportStatus,
  readPassport,
  stampVisit,
} from "@/modules/passport/service";
import { impl, member } from "../base";

export const passportRouter = {
  list: impl.passport.list
    .use(member)
    .handler(({ context, input }) =>
      readPassport(context.db, context.viewer, input),
    ),
  status: impl.passport.status
    .use(member)
    .handler(({ context, input }) =>
      passportStatus(context.db, context.viewer, input.placeId),
    ),
  stamp: impl.passport.stamp
    .use(member)
    .handler(({ context, input }) => stampVisit(context.viewer, input)),
};
