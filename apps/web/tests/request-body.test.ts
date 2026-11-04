import { expect, test } from "bun:test";
import { RequestBodyTooLarge, readBoundedBody } from "@/lib/request-body";

test("chunked uploads cannot bypass the actual body limit", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(6));
        controller.enqueue(new Uint8Array(6));
        controller.close();
      },
    }),
  });
  await expect(readBoundedBody(request, 10)).rejects.toBeInstanceOf(
    RequestBodyTooLarge,
  );
});
test("a false content-length does not bypass the body limit", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "content-length": "1" },
    body: "oversized",
  });
  await expect(readBoundedBody(request, 3)).rejects.toBeInstanceOf(
    RequestBodyTooLarge,
  );
});
test("bodies at the limit remain intact", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: "hello",
  });
  expect(new TextDecoder().decode(await readBoundedBody(request, 5))).toBe(
    "hello",
  );
});
