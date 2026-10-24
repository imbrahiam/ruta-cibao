import { consumeRateLimit, getRequestClientKey } from "@/lib/rate-limit";
import { computeDirections } from "@/modules/directions/compute-directions";
import { impl } from "../base";

export const directionsRouter = {
  compute: impl.directions.compute.handler(
    async ({ context, input, errors }) => {
      const allowance = await consumeRateLimit(
        getRequestClientKey(context.headers),
        {
          scope: "directions-compute",
          limit: 30,
          windowMs: 60_000,
        },
      );
      if (!allowance.allowed)
        throw errors.TOO_MANY_REQUESTS({ data: { reason: "rate_limited" } });
      return computeDirections(input);
    },
  ),
};
