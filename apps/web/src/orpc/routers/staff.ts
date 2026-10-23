import {
  verifyStaffRecoveryCode,
  verifyStaffTotp,
} from "@/modules/access/staff-session";
import { impl, member } from "../base";

export const staffRouter = {
  verifyTotp: impl.staff.verifyTotp
    .use(member)
    .handler(async ({ context, input }) =>
      verifyStaffTotp(context.headers, await context.getSession(), input),
    ),

  verifyRecoveryCode: impl.staff.verifyRecoveryCode
    .use(member)
    .handler(async ({ context, input }) =>
      verifyStaffRecoveryCode(
        context.headers,
        await context.getSession(),
        input,
      ),
    ),
};
