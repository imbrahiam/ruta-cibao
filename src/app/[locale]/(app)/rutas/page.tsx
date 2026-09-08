import { Suspense } from "react";
import { RouteDirectory } from "@/components/routes/route-directory";
export default function Page() {
  return (
    <Suspense>
      <RouteDirectory />
    </Suspense>
  );
}
