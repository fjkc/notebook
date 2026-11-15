import "server-only";
import type { ChatPassage } from "../ai/prompts";
import * as chunks from "../db/chunks";
import * as sources from "../db/sources";
import { cutExcerpt, type Citation } from "../shared/citations";
import { CITATION_EXCERPT_CHARS, RETRIEVAL_MATCH_COUNT } from "../shared/limits";
import { embedQuery } from "./embed";

export type Retrieved = { citations: Citation[]; passages: ChatPassage[] };

/**
 * The question's nearest passages, numbered 1…n in match order: the citation map for the client and
 * the full passages for the prompt. Call only after assertNotebookOwner (match_chunks is notebook-scoped).
 * A Gemini 429 on the query embedding becomes RATE_LIMITED (embedQuery).
 */
export async function retrieve(
  ownerId: string,
  notebookId: string,
  question: string,
  sourceIds: string[] | null,
): Promise<Retrieved> {
  const embedding = await embedQuery(question);
  const matches = await chunks.matchChunks(notebookId, embedding, RETRIEVAL_MATCH_COUNT, sourceIds);
  if (matches.length === 0) return { citations: [], passages: [] };

  const titles = await sources.titlesByIds(ownerId, [...new Set(matches.map((m) => m.sourceId))]);
  // A source deleted between the two queries has no title any more; its chunks are left out.
  const found = matches.filter((m) => titles.has(m.sourceId));

  const citations: Citation[] = [];
  const passages: ChatPassage[] = [];
  found.forEach((match, index) => {
    const n = index + 1;
    const sourceTitle = titles.get(match.sourceId)!;
    citations.push({
      n,
      chunkId: match.id,
      sourceId: match.sourceId,
      sourceTitle,
      page: match.page,
      excerpt: cutExcerpt(match.content, CITATION_EXCERPT_CHARS),
    });
    passages.push({ n, sourceTitle, page: match.page, content: match.content });
  });
  return { citations, passages };
}
