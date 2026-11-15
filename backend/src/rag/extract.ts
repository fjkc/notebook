import "server-only";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import * as storage from "../db/storage";
import { AppError } from "../errors";
import { MAX_PDF_BYTES, MAX_PDF_PAGES, MIN_PDF_TEXT_CHARS, MIN_URL_TEXT_CHARS } from "../shared/limits";
import type { PageText } from "./chunk";
import { fetchPage } from "./fetch-page";
import { htmlToText } from "./html-text";
import { parsePublicUrl } from "./url-guard";

// One extractor per source type (docs/ARCHITECTURE.md §6 step 3).

/** What every extractor returns (NB-008 R6). `pageCount` counts blank PDF pages too. */
export type Extracted = { pages: PageText[]; title?: string; pageCount?: number };

export const PDF_PAGE_LIMIT_MESSAGE = `PDFs can have up to ${MAX_PDF_PAGES} pages.`;

/** Pasted text: one page without a page number. */
export function extractText(inputText: string): Extracted {
  return { pages: [{ page: null, text: inputText }] };
}

/** A web page: guarded fetch → linkedom → Readability → htmlToText (NB-008 R5). */
export async function extractUrl(link: string): Promise<Extracted> {
  // Checked again here: the stored link went through the same check when it was created.
  let url: URL;
  try {
    url = parsePublicUrl(link);
  } catch (error) {
    throw new AppError("URL_FETCH_FAILED", { cause: error });
  }
  const html = await fetchPage(url);

  let article: ReturnType<Readability["parse"]>;
  try {
    const { document } = parseHTML(html);
    // linkedom's Document is close enough to the DOM for Readability; the types differ (no DOM lib here).
    article = new Readability(document as unknown as ConstructorParameters<typeof Readability>[0]).parse();
  } catch (error) {
    throw new AppError("URL_FETCH_FAILED", { cause: error });
  }
  if (!article?.content) throw new AppError("URL_FETCH_FAILED", { cause: new Error("No article found") });

  const text = htmlToText(article.content);
  if (text.length < MIN_URL_TEXT_CHARS) {
    throw new AppError("URL_FETCH_FAILED", { cause: new Error(`Only ${text.length} characters of text`) });
  }
  const title = article.title?.replace(/\s+/g, " ").trim();
  return { pages: [{ page: null, text }], ...(title ? { title } : {}) };
}

// The exceptions PDF.js throws for a document it can't read (their `name` is the class name).
const PDF_DOCUMENT_ERRORS = new Set([
  "InvalidPDFException",
  "PasswordException",
  "FormatError",
  "MissingPDFException",
  "UnknownErrorException",
]);

function isPdfDocumentError(error: unknown): boolean {
  return error instanceof Error && PDF_DOCUMENT_ERRORS.has(error.name);
}

/** A PDF from the private bucket, one page of text per PDF page (NB-008 R11). */
export async function extractPdf(storagePath: string, ownerId: string): Promise<Extracted> {
  if (!storagePath.startsWith(`${ownerId}/`)) throw new Error("Storage path outside the owner's folder");

  const buffer = await storage.download(storagePath);
  if (!buffer) throw new AppError("UPLOAD_INCOMPLETE");
  if (buffer.byteLength > MAX_PDF_BYTES) throw new AppError("FILE_TOO_LARGE");

  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  let pageTexts: string[];
  let pageCount: number;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer));
    pageCount = pdf.numPages;
    if (pageCount > MAX_PDF_PAGES) throw new AppError("LIMIT_REACHED", PDF_PAGE_LIMIT_MESSAGE);
    pageTexts = (await extractPdfText(pdf, { mergePages: false })).text;
  } catch (error) {
    // Only the document's own errors (encrypted, corrupt) mean "nothing we can read". Anything else,
    // e.g. PDF.js failing to load in the bundle, stays INTERNAL so the real cause shows in the log.
    if (isPdfDocumentError(error)) throw new AppError("NO_TEXT_FOUND", { cause: error });
    throw error;
  } finally {
    // unpdf leaves a proxy we created to us; release it so a warm instance doesn't keep it.
    await pdf?.loadingTask.destroy().catch(() => {});
  }

  const pages = pageTexts.map((text, i) => ({ page: i + 1, text }));
  const total = pages.reduce((sum, page) => sum + page.text.trim().length, 0);
  if (total < MIN_PDF_TEXT_CHARS) throw new AppError("NO_TEXT_FOUND");
  return { pages, pageCount };
}
