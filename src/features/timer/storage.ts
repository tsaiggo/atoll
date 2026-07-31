import { EMPTY_TIMER, reconcileTimer, type TimerStatus } from "../../domain";

const TIMER_STORAGE_KEY = "atoll.timer.v1";

export function loadTimer(): TimerStatus {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return { ...EMPTY_TIMER };
    const parsed = JSON.parse(raw) as Partial<TimerStatus>;
    if (!["idle", "running", "paused", "finished"].includes(parsed.phase ?? "")) {
      return { ...EMPTY_TIMER };
    }
    return reconcileTimer({
      phase: parsed.phase as TimerStatus["phase"],
      durationMs: validNumber(parsed.durationMs),
      endAt: parsed.endAt === null ? null : validNumber(parsed.endAt),
      pausedRemainingMs:
        parsed.pausedRemainingMs === null ? null : validNumber(parsed.pausedRemainingMs),
    });
  } catch {
    return { ...EMPTY_TIMER };
  }
}

export function saveTimer(timer: TimerStatus): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timer));
  } catch {
    // A storage failure must not stop an active timer.
  }
}

function validNumber(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
