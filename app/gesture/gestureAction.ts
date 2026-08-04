export type MediaAction = "togglePlay" | "volumeUp" | "volumeDown" | "nextTrack";

const GESTURE_TO_ACTION: Record<string, MediaAction> = {
  left: "togglePlay",
  up: "volumeUp",
  down: "volumeDown",
  right: "nextTrack",
};

export function resolveGestureAction(gesture: string): MediaAction | null {
  return GESTURE_TO_ACTION[gesture] ?? null;
}

export function isDebounced(
  lastGesture: string,
  lastTimestampMs: number,
  gesture: string,
  nowMs: number,
  debounceMs = 350
): boolean {
  return lastGesture === gesture && nowMs - lastTimestampMs < debounceMs;
}
