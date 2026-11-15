import "server-only";
import { embed, embedMany } from "ai";
import { toAiError } from "../ai/errors";
import { AI_MAX_RETRIES, getGemini } from "../ai/gemini";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "../ai/models";
import { EMBED_BATCH_SIZE } from "../shared/limits";

type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

function providerOptions(taskType: TaskType) {
  return { google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType } };
}

/** A wrong length would fail the vector(768) insert with an unclear error; fail here instead (→ INTERNAL). */
function checkDimensions(vector: number[]): number[] {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Embedding has ${vector.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return vector;
}

/** Embeds document chunks in sequential batches of EMBED_BATCH_SIZE. Gemini 429 → RATE_LIMITED. */
export async function embedDocuments(texts: string[], signal?: AbortSignal): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    try {
      const { embeddings } = await embedMany({
        model: getGemini().embedding(EMBEDDING_MODEL),
        values: texts.slice(start, start + EMBED_BATCH_SIZE),
        providerOptions: providerOptions("RETRIEVAL_DOCUMENT"),
        maxRetries: AI_MAX_RETRIES,
        abortSignal: signal,
      });
      vectors.push(...embeddings.map(checkDimensions));
    } catch (error) {
      throw toAiError(error);
    }
  }
  return vectors;
}

/** Embeds a chat question for retrieval (used from NB-009). */
export async function embedQuery(text: string, signal?: AbortSignal): Promise<number[]> {
  try {
    const { embedding } = await embed({
      model: getGemini().embedding(EMBEDDING_MODEL),
      value: text,
      providerOptions: providerOptions("RETRIEVAL_QUERY"),
      maxRetries: AI_MAX_RETRIES,
      abortSignal: signal,
    });
    return checkDimensions(embedding);
  } catch (error) {
    throw toAiError(error);
  }
}
