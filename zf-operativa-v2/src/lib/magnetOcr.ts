import type { Rect } from '../types';
import { adaptiveThreshold, normalizeGrayscale } from './imageQuality';
import { filterMagnetCandidates } from './vision';
import { combineConfidences } from './confidence';
import { getOCRWorker, type OCRWorker } from './ocrWorker';

export type { Rect } from '../types';

/**
 * Result of OCR processing on a single magnet
 */
export interface MagnetOCR {
  id: string;
  rawText: string;
  confidence: number;
  rect: Rect;
  warning?: string;
  passCount: number;
  elapsedMs: number;
}

/**
 * Configuration for magnet OCR processing
 */
export interface MagnetOCRConfig {
  /** Padding to add around magnet ROI in pixels */
  padding: number;
  /** Upscale factor (e.g., 2 for 2x upscaling) */
  upscaleFactor: number;
  /** Minimum confidence threshold for OCR results (0-1) */
  minConfidence: number;
  /** Language for Tesseract OCR */
  language: string;
  /** Enable local contrast enhancement */
  enhanceContrast: boolean;
}

/**
 * Default configuration for magnet OCR
 */
export const DEFAULT_MAGNET_OCR_CONFIG: MagnetOCRConfig = {
  padding: 8,
  upscaleFactor: 2,
  minConfidence: 0.3,
  language: 'eng',
  enhanceContrast: true,
};

export type OCRPass = { text: string; confidence: number };
export type OCRPassDecision = { rawText: string; confidence: number; warning?: string; passCount: number };

function normalizeOCRText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

export function chooseOCRPass(first: OCRPass, second?: OCRPass): OCRPassDecision {
  if (!second) return { rawText: first.text, confidence: first.confidence, passCount: 1 };

  const firstText = normalizeOCRText(first.text);
  const secondText = normalizeOCRText(second.text);
  if (firstText && firstText === secondText) {
    return {
      rawText: second.confidence > first.confidence ? second.text : first.text,
      confidence: combineConfidences(first.confidence, second.confidence),
      passCount: 2,
    };
  }

  return {
    rawText: second.confidence > first.confidence ? second.text : first.text,
    confidence: Math.min(0.79, Math.max(first.confidence, second.confidence) * 0.85),
    warning: 'OCR passes disagree',
    passCount: 2,
  };
}

/**
 * Crop a region of interest from canvas with padding
 */
export function cropROI(
  source: HTMLCanvasElement,
  rect: Rect,
  padding: number
): HTMLCanvasElement {
  if (![rect.x, rect.y, rect.width, rect.height, padding].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || padding < 0) {
    throw new RangeError('Invalid OCR region');
  }
  const x = Math.max(0, Math.floor(rect.x - padding));
  const y = Math.max(0, Math.floor(rect.y - padding));
  const right = Math.min(source.width, Math.ceil(rect.x + rect.width + padding));
  const bottom = Math.min(source.height, Math.ceil(rect.y + rect.height + padding));
  const width = right - x;
  const height = bottom - y;
  if (width <= 0 || height <= 0) throw new RangeError('OCR region is outside the source image');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const dstCtx = canvas.getContext('2d');
  if (!dstCtx) throw new Error('Could not get destination canvas context');

  dstCtx.drawImage(source, x, y, width, height, 0, 0, width, height);
  return canvas;
}

/**
 * Upscale a canvas by the specified factor using high-quality interpolation
 */
export function upscaleCanvas(
  canvas: HTMLCanvasElement,
  factor: number
): HTMLCanvasElement {
  if (!Number.isFinite(factor) || factor > 4) throw new RangeError('Upscale factor must be between 1 and 4');
  if (factor <= 1) return canvas;

  const upscaled = document.createElement('canvas');
  upscaled.width = canvas.width * factor;
  upscaled.height = canvas.height * factor;

  const ctx = upscaled.getContext('2d');
  if (!ctx) throw new Error('Could not get upscaled canvas context');

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, upscaled.width, upscaled.height);

  return upscaled;
}

export function enhanceLocalContrast(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const grayscale = normalizeGrayscale(imageData, false);
  for (let pixel = 0; pixel < grayscale.length; pixel += 1) {
    const index = pixel * 4;
    imageData.data[index] = grayscale[pixel];
    imageData.data[index + 1] = grayscale[pixel];
    imageData.data[index + 2] = grayscale[pixel];
    imageData.data[index + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Process a single magnet ROI through OCR pipeline
 */
export async function processMagnetROI(
  canvas: HTMLCanvasElement,
  rect: Rect,
  magnetId: string,
  config: MagnetOCRConfig,
  worker: OCRWorker
): Promise<MagnetOCR> {
  const startedAt = performance.now();
  try {
    // Step 1: Crop ROI with padding
    const cropped = cropROI(canvas, rect, config.padding);

    // Step 2: Upscale 2x
    const upscaled = upscaleCanvas(cropped, config.upscaleFactor);

    // Step 3: Apply local contrast enhancement
    let processed = upscaled;
    if (config.enhanceContrast) {
      processed = enhanceLocalContrast(upscaled);
    }

    const firstPass = await worker.recognize(processed);
    const firstOCRPass = {
      text: firstPass.data.text.trim(),
      confidence: (firstPass.data.confidence ?? 0) / 100,
    };
    let decision = chooseOCRPass(firstOCRPass, undefined);

    if (decision.confidence < 0.8) {
      const sourceContext = processed.getContext('2d', { willReadFrequently: true });
      if (!sourceContext) throw new Error('Could not read ROI for adaptive OCR pass');
      const sourcePixels = sourceContext.getImageData(0, 0, processed.width, processed.height);
      const grayscale = normalizeGrayscale(sourcePixels, false);
      const binary = adaptiveThreshold(grayscale, processed.width, processed.height);
      const thresholdCanvas = document.createElement('canvas');
      thresholdCanvas.width = processed.width;
      thresholdCanvas.height = processed.height;
      const thresholdContext = thresholdCanvas.getContext('2d');
      if (!thresholdContext) throw new Error('Could not create adaptive OCR canvas');
      const thresholdPixels = thresholdContext.createImageData(processed.width, processed.height);
      for (let pixel = 0; pixel < binary.length; pixel += 1) {
        const index = pixel * 4;
        thresholdPixels.data[index] = binary[pixel];
        thresholdPixels.data[index + 1] = binary[pixel];
        thresholdPixels.data[index + 2] = binary[pixel];
        thresholdPixels.data[index + 3] = 255;
      }
      thresholdContext.putImageData(thresholdPixels, 0, 0);

      const secondPass = await worker.recognize(thresholdCanvas);
      decision = chooseOCRPass(firstOCRPass, {
        text: secondPass.data.text.trim(),
        confidence: (secondPass.data.confidence ?? 0) / 100,
      });
    }

    if (decision.confidence < config.minConfidence) decision.warning ??= 'Below minimum OCR confidence';

    return {
      id: magnetId,
      rawText: decision.rawText,
      confidence: decision.confidence,
      warning: decision.warning,
      passCount: decision.passCount,
      elapsedMs: performance.now() - startedAt,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        score: rect.score,
      },
    };
  } catch (error) {
    console.error(`Error processing magnet ${magnetId}:`, error);
    return {
      id: magnetId,
      rawText: '',
      confidence: 0,
      warning: 'OCR processing failed',
      passCount: 0,
      elapsedMs: performance.now() - startedAt,
      rect,
    };
  }
}

/**
 * Process all magnet candidates in an image
 * Falls back to board OCR only if no magnet candidates exist
 */
export async function readMagnets(
  canvas: HTMLCanvasElement,
  magnetRects: Rect[],
  config: MagnetOCRConfig = DEFAULT_MAGNET_OCR_CONFIG,
  progress?: (current: number, total: number) => void
): Promise<MagnetOCR[]> {
  // Fallback: if no magnet candidates, return empty (board OCR handled elsewhere)
  if (!magnetRects || magnetRects.length === 0) {
    return [];
  }

  const candidates = filterMagnetCandidates(magnetRects, 20, 0.45);
  if (candidates.length === 0) return [];

  const worker = await getOCRWorker(config.language);

  const results: MagnetOCR[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const rect = candidates[i];
    const magnetId = `magnet-${i}`;

    if (progress) {
      progress(i, candidates.length);
    }

    const result = await processMagnetROI(canvas, rect, magnetId, config, worker);
    results.push(result);
  }

  if (progress) {
    progress(candidates.length, candidates.length);
  }

  return results;
}

/**
 * Find magnet candidates that meet minimum size and confidence thresholds
 */
export { filterMagnetCandidates } from './vision';
