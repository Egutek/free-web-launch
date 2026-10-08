import { createWorker } from 'tesseract.js';

export type OCRWorker = Pick<Awaited<ReturnType<typeof createWorker>>, 'recognize'>;

const workers = new Map<string, Promise<Awaited<ReturnType<typeof createWorker>>>>();
const progressListeners = new Map<string, (progress: number, status: string) => void>();

export function getOCRWorker(
  language: string,
  onProgress?: (progress: number, status: string) => void
): Promise<Awaited<ReturnType<typeof createWorker>>> {
  if (onProgress) progressListeners.set(language, onProgress);
  else progressListeners.delete(language);

  let worker = workers.get(language);
  if (!worker) {
    worker = createWorker(language, 1, {
      logger: (message) => progressListeners.get(language)?.(message.progress, message.status),
    }).catch((error: unknown) => {
      workers.delete(language);
      throw error;
    });
    workers.set(language, worker);
  }

  return worker;
}

export async function terminateOCRWorkers(): Promise<void> {
  const activeWorkers = [...workers.values()];
  workers.clear();
  progressListeners.clear();
  const resolvedWorkers = await Promise.allSettled(activeWorkers);
  await Promise.allSettled(
    resolvedWorkers
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof createWorker>>> => result.status === 'fulfilled')
      .map((result) => result.value.terminate())
  );
}