import { mkdir, rm, writeFile } from "node:fs/promises";

/**
 * openapi.json -> Kotlin Multiplatform client for the native apps.
 *
 * Off-the-shelf generators turn this spec (inline schemas everywhere) into
 * `InlineObject123` names and their own HTTP wrappers. This one is small and
 * shaped for the contract: one input and one output type per operation, named
 * after the operationId, with inline objects nested under their owner.
 *
 * Mapping:
 * - `T | null` (anyOf or type array)    -> `T?`
 * - string enum                         -> nested `enum class` with @SerialName
 * - const                               -> its primitive type
 * - date-time                           -> kotlin.time.Instant
 * - integer bounded by Int              -> Int, otherwise Long
 * - unions of objects                   -> one merged class (variant-only fields nullable)
 * - unions of the same primitive        -> that primitive
 * - anything else                       -> JsonElement
 *
 * Staff-only groups are left out: the native apps are for residents.
 */

type Schema = {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  anyOf?: Schema[];
  oneOf?: Schema[];
  additionalProperties?: boolean | Schema;
  maximum?: number;
  minimum?: number;
  $ref?: string;
};

type Parameter = {
  in: "path" | "query";
  name: string;
  required?: boolean;
  schema: Schema;
};
type Operation = {
  operationId: string;
  summary?: string;
  parameters?: Parameter[];
  requestBody?: {
    required?: boolean;
    content: Record<string, { schema: Schema }>;
  };
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
};
type Spec = {
  paths: Record<string, Record<string, Operation>>;
  components?: { schemas?: Record<string, Schema> };
};

const EXCLUDED_GROUPS = new Set(["moderation", "staff", "catalog", "reports"]);
const PACKAGE = "rutacibao.api";
const INT_MAX = 2_147_483_647;
const KOTLIN_KEYWORDS = new Set([
  "as",
  "break",
  "class",
  "continue",
  "do",
  "else",
  "false",
  "for",
  "fun",
  "if",
  "in",
  "interface",
  "is",
  "null",
  "object",
  "package",
  "return",
  "super",
  "this",
  "throw",
  "true",
  "try",
  "typealias",
  "typeof",
  "val",
  "var",
  "when",
  "while",
]);

const root = new URL("..", import.meta.url);
const spec: Spec = await Bun.file(
  new URL("generated/openapi.json", root),
).json();
const outDir = new URL(
  "../kmp/api/src/commonMain/kotlin/rutacibao/api/generated/",
  root,
);

// ---------------------------------------------------------------- naming

const pascal = (s: string) =>
  s
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) =>
      c ? c.toUpperCase() : "",
    )
    .replace(/^./, (c) => c.toUpperCase());

const camel = (s: string) => pascal(s).replace(/^./, (c) => c.toLowerCase());

function singular(s: string): string {
  if (s.endsWith("ies")) return `${s.slice(0, -3)}y`;
  if (s.endsWith("sses")) return s.slice(0, -2);
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return `${s}Item`;
}

function propName(key: string): string {
  let name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : camel(key);
  if (/^[0-9]/.test(name)) name = `_${name}`;
  if (KOTLIN_KEYWORDS.has(name)) name = `${name}_`;
  return name;
}

function enumEntry(value: string): string {
  const name = pascal(value) || "Empty";
  return /^[0-9]/.test(name) ? `V${name}` : name;
}

// ---------------------------------------------------------------- schema helpers

const resolve = (s: Schema): Schema => {
  if (!s.$ref) return s;
  const key = s.$ref.replace("#/components/schemas/", "");
  const target = spec.components?.schemas?.[key];
  if (!target) throw new Error(`unresolved $ref ${s.$ref}`);
  return target;
};

const isNull = (s: Schema) =>
  s.type === "null" || (s.const === null && s.type === undefined);

/** Splits `T | null` into T plus a nullability flag. */
function unwrapNullable(input: Schema): { schema: Schema; nullable: boolean } {
  const s = resolve(input);
  if (Array.isArray(s.type) && s.type.includes("null")) {
    const rest = s.type.filter((t) => t !== "null");
    return {
      schema: { ...s, type: rest.length === 1 ? rest[0] : rest },
      nullable: true,
    };
  }
  const members = s.anyOf ?? s.oneOf;
  if (members?.some(isNull)) {
    const rest = members.filter((m) => !isNull(m));
    const schema =
      rest.length === 1
        ? (rest[0] as Schema)
        : { [s.anyOf ? "anyOf" : "oneOf"]: rest };
    const inner = unwrapNullable(schema);
    return { schema: inner.schema, nullable: true };
  }
  return { schema: s, nullable: false };
}

const isStringSet = (s: Schema) =>
  typeof s.const === "string" ||
  (Array.isArray(s.enum) && s.enum.every((v) => typeof v === "string"));

const stringValues = (s: Schema): string[] =>
  typeof s.const === "string"
    ? [s.const]
    : ((s.enum as string[] | undefined) ?? []);

const isObject = (s: Schema) =>
  s.type === "object" || (s.type === undefined && !!s.properties);

/** Merges the variants of an object union into one shape that decodes all of them. */
function mergeObjects(variants: Schema[]): Schema {
  const keys = [
    ...new Set(variants.flatMap((v) => Object.keys(v.properties ?? {}))),
  ];
  const properties: Record<string, Schema> = {};
  for (const key of keys) {
    const seen = variants
      .map((v) => v.properties?.[key])
      .filter((p): p is Schema => !!p);
    const nonNull = seen.filter((p) => !isNull(p));
    const nullable = seen.some(isNull) || seen.length < variants.length;
    let merged: Schema;
    if (nonNull.length > 0 && nonNull.every(isStringSet)) {
      merged = {
        type: "string",
        enum: [...new Set(nonNull.flatMap(stringValues))],
      };
    } else {
      merged = nonNull[0] ?? {};
    }
    properties[key] = nullable ? { anyOf: [merged, { type: "null" }] } : merged;
  }
  const required = keys.filter((k) =>
    variants.every((v) => v.required?.includes(k)),
  );
  return { type: "object", properties, required };
}

// ---------------------------------------------------------------- emission

/**
 * A class being emitted. Nested declarations (objects, enums) found while
 * typing its properties are collected here and printed inside its body.
 */
class Scope {
  readonly nested: string[] = [];
  private readonly used = new Set<string>();
  constructor(readonly qualified: string) {}
  claim(base: string): string {
    let name = base;
    for (let i = 2; this.used.has(name); i++) name = `${base}${i}`;
    this.used.add(name);
    return name;
  }
}

const indent = (text: string, by = "    ") =>
  text
    .split("\n")
    .map((l) => (l ? by + l : l))
    .join("\n");

function primitive(s: Schema): string | undefined {
  const type = Array.isArray(s.type) ? undefined : s.type;
  if (s.const !== undefined && s.const !== null) {
    if (typeof s.const === "string") return "String";
    if (typeof s.const === "boolean") return "Boolean";
    if (typeof s.const === "number")
      return Number.isInteger(s.const) ? "Int" : "Double";
  }
  switch (type) {
    case "string":
      return s.format === "date-time" ? "Instant" : "String";
    case "boolean":
      return "Boolean";
    case "number":
      return "Double";
    case "integer":
      return (s.maximum ?? Number.POSITIVE_INFINITY) <= INT_MAX &&
        (s.minimum ?? Number.NEGATIVE_INFINITY) >= -INT_MAX - 1
        ? "Int"
        : "Long";
    default:
      return undefined;
  }
}

/** Returns the Kotlin type for a schema, emitting nested declarations into `scope`. */
function typeOf(input: Schema, hint: string, scope: Scope): string {
  const { schema: s, nullable } = unwrapNullable(input);
  const base = nonNullType(s, hint, scope);
  return nullable && !base.endsWith("?") ? `${base}?` : base;
}

function nonNullType(s: Schema, hint: string, scope: Scope): string {
  // String enums (but not single consts) become enum classes.
  if (
    Array.isArray(s.enum) &&
    s.enum.length > 0 &&
    s.enum.every((v) => typeof v === "string")
  ) {
    const name = scope.claim(pascal(hint));
    scope.nested.push(emitEnum(name, s.enum as string[]));
    return `${scope.qualified}.${name}`;
  }
  const prim = primitive(s);
  if (prim) return prim;

  if (s.type === "array") {
    const item = s.items
      ? typeOf(s.items, singular(hint), scope)
      : "JsonElement";
    return `List<${item}>`;
  }

  const members = s.anyOf ?? s.oneOf;
  if (members && members.length > 0) {
    const resolved = members.map(resolve);
    if (resolved.every(isObject))
      return nonNullType(mergeObjects(resolved), hint, scope);
    if (resolved.every(isStringSet)) {
      return nonNullType(
        { type: "string", enum: [...new Set(resolved.flatMap(stringValues))] },
        hint,
        scope,
      );
    }
    const prims = new Set(resolved.map(primitive));
    if (prims.size === 1 && !prims.has(undefined))
      return [...prims][0] as string;
    if ([...prims].every((p) => p === "Int" || p === "Long" || p === "Double"))
      return "Double";
    return "JsonElement";
  }

  if (isObject(s)) {
    if (!s.properties || Object.keys(s.properties).length === 0) {
      if (typeof s.additionalProperties === "object") {
        return `Map<String, ${typeOf(s.additionalProperties, `${hint}Value`, scope)}>`;
      }
      return "JsonObject";
    }
    const name = scope.claim(pascal(hint));
    scope.nested.push(emitClass(name, s, `${scope.qualified}.${name}`));
    return `${scope.qualified}.${name}`;
  }
  return "JsonElement";
}

function emitEnum(name: string, values: string[]): string {
  const entries = values.map(
    (v) => `@SerialName(${JSON.stringify(v)}) ${enumEntry(v)}`,
  );
  return `@Serializable\npublic enum class ${name} {\n${indent(entries.join(",\n"))};\n}`;
}

function emitClass(name: string, s: Schema, qualified: string): string {
  const scope = new Scope(qualified);
  const required = new Set(s.required ?? []);
  const fields = Object.entries(s.properties ?? {}).map(([key, prop]) => {
    const kName = propName(key);
    let type = typeOf(prop, key, scope);
    const optional = !required.has(key) || type.endsWith("?");
    if (optional && !type.endsWith("?")) type += "?";
    const serial = kName === key ? "" : `@SerialName(${JSON.stringify(key)}) `;
    return `${serial}val ${kName}: ${type}${optional ? " = null" : ""},`;
  });
  const body = scope.nested.length
    ? ` {\n${indent(scope.nested.join("\n\n"))}\n}`
    : "";
  return `@Serializable\npublic data class ${name}(\n${indent(fields.join("\n"))}\n)${body}`;
}

/** Emits a top-level type for `schema` named `name`; returns the Kotlin type to use. */
function topLevel(name: string, schema: Schema, out: string[]): string {
  const { schema: s, nullable } = unwrapNullable(schema);
  const holder = new Scope(name);
  let type: string;
  if (isObject(s) && s.properties && Object.keys(s.properties).length > 0) {
    out.push(emitClass(name, s, name));
    type = name;
  } else if (s.type === "array" && s.items) {
    // Arrays get their item class at top level: `PlacesNearbyOutput` = List<PlacesNearbyItem>.
    const itemName = `${name.replace(/Output$/, "")}Item`;
    const item = topLevel(itemName, s.items, out);
    type = `List<${item}>`;
  } else {
    type = typeOf(s, name, holder);
    if (holder.nested.length) {
      // An enum or merged object at the top: emit it un-nested under its own name.
      out.push(...holder.nested.map((d) => d.replaceAll(`${name}.`, "")));
      type = type.replace(`${name}.`, "");
    }
  }
  return nullable ? `${type}?` : type;
}

// ---------------------------------------------------------------- operations

type Op = {
  group: string | null;
  method: string;
  http: string;
  path: string;
  summary?: string;
  input?: {
    type: string;
    pathKeys: string[];
    queryKeys: string[];
    hasBody: boolean;
    required: boolean;
  };
  output: string;
};

const files = new Map<string, string[]>();
const ops: Op[] = [];

for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [http, op] of Object.entries(methods)) {
    const [first, ...rest] = op.operationId.split(".");
    const group = rest.length ? (first as string) : null;
    if (group && EXCLUDED_GROUPS.has(group)) continue;
    const method = camel(rest.length ? rest.join("-") : (first as string));
    const typeBase = pascal(op.operationId);
    const fileKey = group ?? "root";
    const out = files.get(fileKey) ?? [];
    files.set(fileKey, out);

    // Input: path + query parameters and the JSON body, merged into one object
    // exactly like the oRPC input it came from.
    const params = op.parameters ?? [];
    const bodySchema = op.requestBody?.content["application/json"]?.schema;
    const body = bodySchema ? resolve(bodySchema) : undefined;
    let input: Op["input"];
    if (params.length || body) {
      const properties: Record<string, Schema> = {};
      const required: string[] = [];
      for (const p of params) {
        properties[p.name] = p.schema;
        if (p.required || p.in === "path") required.push(p.name);
      }
      if (body) {
        if (!isObject(body))
          throw new Error(`${op.operationId}: non-object body`);
        Object.assign(properties, body.properties ?? {});
        required.push(...(body.required ?? []));
      }
      const name = `${typeBase}Input`;
      out.push(emitClass(name, { type: "object", properties, required }, name));
      input = {
        type: name,
        pathKeys: params.filter((p) => p.in === "path").map((p) => p.name),
        queryKeys: params.filter((p) => p.in === "query").map((p) => p.name),
        hasBody: !!body,
        required: required.length > 0,
      };
    }

    const success = Object.entries(op.responses).find(([code]) =>
      code.startsWith("2"),
    );
    const outSchema = success?.[1].content?.["application/json"]?.schema;
    const output = outSchema
      ? topLevel(`${typeBase}Output`, outSchema, out)
      : "Unit";

    ops.push({
      group,
      method,
      http: http.toUpperCase(),
      path,
      summary: op.summary,
      input,
      output,
    });
  }
}

// ---------------------------------------------------------------- files

const header = `// Generated by packages/contracts/scripts/kotlin.ts from openapi.json. Do not edit.
@file:OptIn(ExperimentalTime::class)
@file:UseSerializers(InstantIsoSerializer::class)
@file:Suppress("ktlint", "detekt:all")

package ${PACKAGE}.generated

import kotlin.time.ExperimentalTime
import kotlin.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.UseSerializers
import kotlinx.serialization.serializer
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import ${PACKAGE}.InstantIsoSerializer
`;

const kotlinString = (s: string) => JSON.stringify(s).replaceAll("$", "\\$");

function emitOp(op: Op): string {
  const doc = op.summary
    ? `/** ${op.summary.replaceAll("*/", "*\\/")} */\n`
    : "";
  const param = op.input
    ? `input: ${op.input.type}${op.input.required ? "" : ` = ${op.input.type}()`}`
    : "";
  const args = [
    `method = ${kotlinString(op.http)}`,
    `path = ${kotlinString(op.path)}`,
    op.input
      ? `input = transport.encode(${op.input.type}.serializer(), input)`
      : "input = null",
    `pathKeys = ${op.input?.pathKeys.length ? `setOf(${op.input.pathKeys.map(kotlinString).join(", ")})` : "emptySet()"}`,
    `queryKeys = ${op.input?.queryKeys.length ? `setOf(${op.input.queryKeys.map(kotlinString).join(", ")})` : "emptySet()"}`,
    `hasBody = ${op.input?.hasBody ?? false}`,
    `output = ${serializerFor(op.output)}`,
  ];
  return `${doc}public suspend fun ${op.method}(${param}): ${op.output} =\n    transport.call(\n${indent(args.join(",\n"), "        ")},\n    )`;
}

function serializerFor(type: string): string {
  return `serializer<${type}>()`;
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const [key, decls] of files) {
  if (!decls.length) continue;
  await writeFile(
    new URL(`${pascal(key)}Models.kt`, outDir),
    `${header}\n${decls.join("\n\n")}\n`,
  );
}

const groups = [
  ...new Set(ops.map((o) => o.group).filter((g): g is string => !!g)),
];
const groupClasses = groups.map((g) => {
  const body = ops
    .filter((o) => o.group === g)
    .map(emitOp)
    .join("\n\n");
  return `public class ${pascal(g)}Api internal constructor(private val transport: ApiTransport) {\n${indent(body)}\n}`;
});
const rootOps = ops
  .filter((o) => !o.group)
  .map(emitOp)
  .join("\n\n");
const api = `${header}import ${PACKAGE}.ApiTransport

/** The Ruta Cibao API, one property per contract group. */
public class RutaApi(private val transport: ApiTransport) {
${indent(groups.map((g) => `public val ${camel(g)}: ${pascal(g)}Api = ${pascal(g)}Api(transport)`).join("\n"))}

${indent(rootOps)}
}

${groupClasses.join("\n\n")}
`;
await writeFile(new URL("RutaApi.kt", outDir), api);

console.log(
  `kotlin: ${ops.length} operations, ${files.size} model files -> ${outDir.pathname}`,
);
