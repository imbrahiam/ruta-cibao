import { writeFile } from "node:fs/promises";
import { OpenAPIGenerator } from "@orpc/openapi";
import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { contract } from "../src/index";

/**
 * Writes the OpenAPI document generated from the contract alone (no server, no
 * environment). The native clients are generated from this file, so it is
 * committed and CI fails when it drifts from the contract.
 */
const generator = new OpenAPIGenerator({
  converters: [new ZodToJsonSchemaConverter()],
});

const spec = await generator.generate(contract, {
  base: {
    info: { title: "Ruta Cibao API", version: "0.1.0" },
    servers: [{ url: "/api" }],
  },
});

const out = new URL("../generated/openapi.json", import.meta.url);
await writeFile(out, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`wrote ${out.pathname}`);
