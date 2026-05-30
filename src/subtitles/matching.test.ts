import { describe, expect, it } from "vitest";
import { findActiveSegment } from "./matching";

describe("findActiveSegment", () => {
  const segments = [
    { id: "a", start: 0, end: 2, text: "A" },
    { id: "b", start: 2.1, end: 5, text: "B" }
  ];

  it("returns the segment containing the given time", () => {
    expect(findActiveSegment(segments, 3)?.id).toBe("b");
  });

  it("returns undefined outside segment ranges", () => {
    expect(findActiveSegment(segments, 2.05)).toBeUndefined();
  });
});

