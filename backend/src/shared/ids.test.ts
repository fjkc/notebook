import { describe, expect, it } from "vitest";
import { isUuid } from "./ids";

describe("isUuid", () => {
  it("accepts crypto.randomUUID() values", () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
    expect(isUuid("0F8E2C4A-1111-4222-8333-444455556666")).toBe(true);
  });

  it.each([["abc"], [""], [undefined], [null], [42], ["0f8e2c4a-1111-4222-8333-44445555666"], ["0f8e2c4a-1111-4222-8333-444455556666 "], ["00000000-0000-0000-0000-000000000000"]])(
    "rejects %j",
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});
