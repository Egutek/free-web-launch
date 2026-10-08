import { DEFAULT_MAGNET_OCR_CONFIG, readMagnets, type MagnetOCRConfig } from '../lib/magnetOcr';
import type { Rect } from '../types';

export async function runMagnetOCR(
  source: HTMLCanvasElement,
  magnetRects: Rect[],
  config: MagnetOCRConfig = DEFAULT_MAGNET_OCR_CONFIG,
  progress?: (current: number, total: number) => void
): ReturnType<typeof readMagnets> {
  return readMagnets(source, magnetRects, config, progress);
}
