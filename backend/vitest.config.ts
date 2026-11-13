import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // server-only throws outside a React Server environment, so tests get an empty module instead.
    alias: { "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
