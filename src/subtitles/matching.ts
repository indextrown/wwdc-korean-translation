import type { SubtitleSegment } from "../shared/types";

export function findActiveSegment(segments: SubtitleSegment[], time: number): SubtitleSegment | undefined {
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const segment = segments[mid];
    if (!segment) return undefined;

    if (time < segment.start) {
      high = mid - 1;
    } else if (time > segment.end) {
      low = mid + 1;
    } else {
      return segment;
    }
  }

  return undefined;
}

