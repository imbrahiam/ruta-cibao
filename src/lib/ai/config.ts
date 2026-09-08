/**
 * Facts about the embedding model that other modules need without loading it.
 *
 * The database schema needs the dimension count, and importing it from
 * `embeddings.ts` would drag 120 MB of ONNX runtime into drizzle-kit, the
 * migration runner, and every module that touches a table definition. Numbers
 * and strings live here; the model lives there.
 */
export const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";
export const EMBEDDING_DIMENSIONS = 384;
