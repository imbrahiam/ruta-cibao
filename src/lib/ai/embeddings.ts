/**
 * Turning Spanish sentences into vectors, on this machine.
 *
 * The model runs in the Node process rather than behind an API, which is the
 * same bargain the rest of this project keeps: a municipality inherits a
 * platform that costs nothing per query and keeps citizen searches off a third
 * party's servers. It also means semantic search still works on the demo
 * laptop with no network.
 *
 * `multilingual-e5-small` because the content is Spanish and the questions are
 * Dominican Spanish — an English-only model would rank "dónde hay agua" against
 * "río" by luck. 384 dimensions keeps the index cheap, and the weights are a
 * ~120 MB download cached on disk after the first run.
 *
 * e5 was trained with two prefixes and is noticeably worse without them: a
 * stored place is a `passage`, a citizen's question is a `query`. That is the
 * only asymmetry here and the reason for two exported functions rather than one.
 */
import {
  type FeatureExtractionPipeline,
  pipeline,
} from "@huggingface/transformers";
import { EMBEDDING_MODEL } from "./config";

export { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config";

let extractor: Promise<FeatureExtractionPipeline> | undefined;

/**
 * Loaded once per process, on first use.
 *
 * Not at import: `next build` imports every route module, and pulling 120 MB of
 * weights during a build that will never run a search is the kind of thing that
 * turns a deploy into an incident.
 */
function embedder(): Promise<FeatureExtractionPipeline> {
  extractor ??= pipeline("feature-extraction", EMBEDDING_MODEL, {
    dtype: "fp32",
  });
  return extractor;
}

async function embed(inputs: string[]): Promise<number[][]> {
  const extract = await embedder();
  // Mean pooling and L2 normalisation are what e5 expects; normalised vectors
  // also make pgvector's cosine distance a plain inner product.
  const output = await extract(inputs, { pooling: "mean", normalize: true });

  return output.tolist() as number[][];
}

/** Places, as they are stored and matched against. */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  return embed(texts.map((text) => `passage: ${text}`));
}

/** What somebody typed. */
export async function embedQuery(text: string): Promise<number[]> {
  const [vector] = await embed([`query: ${text}`]);
  if (!vector) throw new Error("The embedding model returned nothing.");
  return vector;
}

/**
 * Everything about a place worth matching against, as one string.
 *
 * The category and the municipality are in here on purpose: somebody asking
 * "dónde hay una clínica en Monción" is asking about all three fields at once,
 * and a vector built from the name alone cannot answer that.
 */
export function placeDocument(place: {
  name: string;
  description: string | null;
  address: string | null;
  categoryName: string;
  municipalityName: string;
}): string {
  return [
    place.name,
    place.categoryName,
    place.municipalityName,
    place.address,
    place.description,
  ]
    .filter(Boolean)
    .join(". ");
}
