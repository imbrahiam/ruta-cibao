import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { z } from "zod";

export const verifyTotpInput = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export type VerifyTotpInput = z.infer<typeof verifyTotpInput>;

export const verifyRecoveryCodeInput = z.object({
  code: z.string().trim().min(6).max(32),
});

export type VerifyRecoveryCodeInput = z.infer<typeof verifyRecoveryCodeInput>;

export const staffSessionGrantOutput = z.object({
  verifiedUntil: z.iso.datetime(),
});

export type StaffSessionGrantOutput = z.infer<typeof staffSessionGrantOutput>;

export const staffContract = {
  verifyTotp: oc
    .meta(
      openapi({
        method: "POST",
        path: "/staff/verify-totp",
        summary: "Step up a staff session with a TOTP code",
      }),
    )
    .input(verifyTotpInput)
    .output(staffSessionGrantOutput),

  verifyRecoveryCode: oc
    .meta(
      openapi({
        method: "POST",
        path: "/staff/verify-recovery-code",
        summary: "Step up a staff session with a one-time recovery code",
      }),
    )
    .input(verifyRecoveryCodeInput)
    .output(staffSessionGrantOutput),
};
