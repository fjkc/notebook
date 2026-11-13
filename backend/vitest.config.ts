import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // server-only throws outside a React Server environment, so tests get an empty module instead.
    alias: { "server-only": new URL("./test/empty.ts", import.meta.url).pathname },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
