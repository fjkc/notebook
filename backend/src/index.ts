import "server-only";

// Server entry of @repo/backend. Services are re-exported here as they're added.
export { AppError, describeError, toErrorBody, toUserMessage, type ErrorSummary } from "./errors";
export { logOperation, type LogFields } from "./log";
export { streamChatAnswer } from "./ai/chat";
export { toAiError } from "./ai/errors";
export { clearChat, getHistory, saveAnswer, startChat, type ChatMessage, type StartedChat } from "./services/chat";
export { isEmptyAnswer } from "./services/chat-history";
export { checkDatabase } from "./services/health";
export {
  createNotebook,
  deleteNotebook,
  getNotebook,
  listNotebooks,
  renameNotebook,
  type Notebook,
  type NotebookListItem,
} from "./services/notebooks";
export { assertNotebookOwner, assertSourceOwner } from "./services/ownership";
export {
  createPdfUpload,
  createTextSource,
  createUrlSource,
  deleteSource,
  listSources,
  processSource,
  type SourceListItem,
  type SourceStatus,
  type SourceType,
} from "./services/sources";
export * from "./shared";
