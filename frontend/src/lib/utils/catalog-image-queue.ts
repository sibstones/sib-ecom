/** Limit concurrent remote image fetches — Chrome opens many parallel S3 connections and can timeout. */

export const CATALOG_IMAGE_MAX_CONCURRENT = 4;

type QueuePriority = 'high' | 'normal';

type QueueEntry = {
  priority: QueuePriority;
  resolve: () => void;
};

let activeCount = 0;
const waitQueue: QueueEntry[] = [];

function dequeueNext(): void {
  if (activeCount >= CATALOG_IMAGE_MAX_CONCURRENT || waitQueue.length === 0) {
    return;
  }

  const highIndex = waitQueue.findIndex((entry) => entry.priority === 'high');
  const nextIndex = highIndex >= 0 ? highIndex : 0;
  const [entry] = waitQueue.splice(nextIndex, 1);
  if (!entry) return;

  activeCount += 1;
  entry.resolve();
}

export function acquireCatalogImageSlot(priority: QueuePriority = 'normal'): Promise<void> {
  if (activeCount < CATALOG_IMAGE_MAX_CONCURRENT) {
    activeCount += 1;
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    waitQueue.push({ priority, resolve });
  });
}

export function releaseCatalogImageSlot(): void {
  activeCount = Math.max(0, activeCount - 1);
  dequeueNext();
}
