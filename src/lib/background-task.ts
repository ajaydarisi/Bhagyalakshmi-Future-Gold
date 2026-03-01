import { Capacitor } from "@capacitor/core";

export async function startBackgroundTask(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { BackgroundTask } = await import(
      "@capawesome/capacitor-background-task"
    );

    const taskId = await BackgroundTask.beforeExit(async () => {
      try {
        // 1. Replay queued offline operations
        const { replayQueue } = await import("./operation-queue");
        await replayQueue();

        // 2. Prefetch essential data for next launch
        const { prefetchEssentialData } = await import("./prefetch");
        await prefetchEssentialData();
      } finally {
        BackgroundTask.finish({ taskId });
      }
    });
  } catch {
    // Background task plugin not available — skip
  }
}
