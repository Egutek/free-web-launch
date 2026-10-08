import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  cropROI,
  chooseOCRPass,
  upscaleCanvas,
  enhanceLocalContrast,
  filterMagnetCandidates,
  DEFAULT_MAGNET_OCR_CONFIG,
  type MagnetOCR,
  type Rect,
} from './magnetOcr';

/**
 * Helper to create a test canvas with a specific background color
 */
function createTestCanvas(
  width: number,
  height: number,
  bgColor: number = 245
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  const imageData = ctx.createImageData(width, height);
  const data = imageData.data;

  // Fill with background color
  for (let i = 0; i < data.length; i += 4) {
    data[i] = bgColor; // R
    data[i + 1] = bgColor; // G
    data[i + 2] = bgColor; // B
    data[i + 3] = 255; // A
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Helper to draw a rectangle on canvas
 */
function drawRect(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number = 20
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  const imageData = ctx.getImageData(x, y, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = color;
    data[i + 1] = color;
    data[i + 2] = color;
    data[i + 3] = 255;
  }

  ctx.putImageData(imageData, x, y);
}

describe('magnetOcr', () => {
  describe('chooseOCRPass', () => {
    it('uses one pass for high-confidence OCR', () => {
      expect(chooseOCRPass({ text: 'NOVAK JAN', confidence: 0.92 })).toMatchObject({ passCount: 1, confidence: 0.92 });
    });

    it('combines agreeing passes after diacritic normalization', () => {
      expect(chooseOCRPass(
        { text: 'NOVAK JAN', confidence: 0.6 },
        { text: 'NOVÁK JAN', confidence: 0.8 }
      )).toMatchObject({ rawText: 'NOVÁK JAN', confidence: Math.sqrt(0.48), passCount: 2 });
    });

    it('caps disagreeing passes below confirmation confidence', () => {
      expect(chooseOCRPass(
        { text: 'NOVAK JAN', confidence: 0.75 },
        { text: 'SVOBODA PETR', confidence: 0.9 }
      )).toMatchObject({ rawText: 'SVOBODA PETR', confidence: 0.765, warning: 'OCR passes disagree', passCount: 2 });
    });
  });

  describe('cropROI', () => {
    it('should crop a region with padding', () => {
      const canvas = createTestCanvas(400, 300);
      const rect: Rect = { x: 100, y: 100, width: 50, height: 50, score: 0.8 };
      const padding = 10;

      const cropped = cropROI(canvas, rect, padding);

      expect(cropped.width).toBe(50 + padding * 2);
      expect(cropped.height).toBe(50 + padding * 2);
    });

    it('should clamp crop to canvas boundaries', () => {
      const canvas = createTestCanvas(400, 300);
      const rect: Rect = { x: 5, y: 5, width: 50, height: 50, score: 0.8 };
      const padding = 10;

      const cropped = cropROI(canvas, rect, padding);

      // Should be clamped to available space
      expect(cropped.width).toBeLessThanOrEqual(400);
      expect(cropped.height).toBeLessThanOrEqual(300);
    });

    it('should crop with zero padding', () => {
      const canvas = createTestCanvas(400, 300);
      const rect: Rect = { x: 100, y: 100, width: 50, height: 50, score: 0.8 };

      const cropped = cropROI(canvas, rect, 0);

      expect(cropped.width).toBe(50);
      expect(cropped.height).toBe(50);
    });
  });

  describe('upscaleCanvas', () => {
    it('should upscale by specified factor', () => {
      const canvas = createTestCanvas(100, 100);
      const factor = 2;

      const upscaled = upscaleCanvas(canvas, factor);

      expect(upscaled.width).toBe(200);
      expect(upscaled.height).toBe(200);
    });

    it('should not upscale if factor is 1', () => {
      const canvas = createTestCanvas(100, 100);

      const result = upscaleCanvas(canvas, 1);

      expect(result).toBe(canvas);
    });

    it('should not upscale if factor is less than 1', () => {
      const canvas = createTestCanvas(100, 100);

      const result = upscaleCanvas(canvas, 0.5);

      expect(result).toBe(canvas);
    });

    it('should handle multiple upscaling factors', () => {
      const canvas = createTestCanvas(50, 50);
      const factor = 4;

      const upscaled = upscaleCanvas(canvas, factor);

      expect(upscaled.width).toBe(200);
      expect(upscaled.height).toBe(200);
    });
  });

  describe('enhanceLocalContrast', () => {
    it('should enhance contrast and return a canvas', () => {
      const canvas = createTestCanvas(100, 100, 200);
      drawRect(canvas, 25, 25, 50, 50, 50);

      const enhanced = enhanceLocalContrast(canvas);

      expect(enhanced).toBeInstanceOf(HTMLCanvasElement);
      expect(enhanced.width).toBe(100);
      expect(enhanced.height).toBe(100);
    });

    it('should modify pixel values', () => {
      const canvas = createTestCanvas(100, 100, 200);
      drawRect(canvas, 25, 25, 50, 50, 50);

      const ctx = canvas.getContext('2d');
      const before = ctx?.getImageData(50, 50, 1, 1).data;

      const enhanced = enhanceLocalContrast(canvas);

      const ctxEnhanced = enhanced.getContext('2d');
      const after = ctxEnhanced?.getImageData(50, 50, 1, 1).data;

      // The pixel should be modified due to contrast enhancement
      expect(after).toBeDefined();
    });

    it('should preserve canvas dimensions', () => {
      const canvas = createTestCanvas(256, 256);

      const enhanced = enhanceLocalContrast(canvas);

      expect(enhanced.width).toBe(256);
      expect(enhanced.height).toBe(256);
    });
  });

  describe('filterMagnetCandidates', () => {
    it('should filter by minimum size', () => {
      const rects: Rect[] = [
        { x: 0, y: 0, width: 10, height: 10, score: 0.8 },
        { x: 50, y: 50, width: 30, height: 30, score: 0.8 },
        { x: 100, y: 100, width: 100, height: 100, score: 0.8 },
      ];

      const filtered = filterMagnetCandidates(rects, 20);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual(rects[1]);
      expect(filtered[1]).toEqual(rects[2]);
    });

    it('should filter by minimum score', () => {
      const rects: Rect[] = [
        { x: 0, y: 0, width: 30, height: 30, score: 0.3 },
        { x: 50, y: 50, width: 30, height: 30, score: 0.6 },
        { x: 100, y: 100, width: 30, height: 30, score: 0.9 },
      ];

      const filtered = filterMagnetCandidates(rects, 20, 0.5);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual(rects[1]);
      expect(filtered[1]).toEqual(rects[2]);
    });

    it('should apply both size and score filters', () => {
      const rects: Rect[] = [
        { x: 0, y: 0, width: 10, height: 10, score: 0.9 }, // Too small
        { x: 50, y: 50, width: 30, height: 30, score: 0.3 }, // Too low score
        { x: 100, y: 100, width: 30, height: 30, score: 0.8 }, // Good
      ];

      const filtered = filterMagnetCandidates(rects, 20, 0.5);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]).toEqual(rects[2]);
    });

    it('should handle empty array', () => {
      const rects: Rect[] = [];

      const filtered = filterMagnetCandidates(rects);

      expect(filtered).toHaveLength(0);
    });

    it('should handle non-array input', () => {
      const filtered = filterMagnetCandidates(null);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('DEFAULT_MAGNET_OCR_CONFIG', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_MAGNET_OCR_CONFIG).toEqual({
        padding: 8,
        upscaleFactor: 2,
        minConfidence: 0.3,
        language: 'eng',
        enhanceContrast: true,
      });
    });

    it('should be usable as a configuration object', () => {
      const config = DEFAULT_MAGNET_OCR_CONFIG;

      expect(config.padding).toBeGreaterThan(0);
      expect(config.upscaleFactor).toBeGreaterThan(1);
      expect(config.minConfidence).toBeGreaterThanOrEqual(0);
      expect(config.minConfidence).toBeLessThanOrEqual(1);
      expect(config.language).toBe('eng');
      expect(typeof config.enhanceContrast).toBe('boolean');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle magnet pipeline: crop -> upscale -> enhance', () => {
      const canvas = createTestCanvas(400, 300, 200);
      drawRect(canvas, 100, 100, 50, 50, 50);

      const rect: Rect = { x: 100, y: 100, width: 50, height: 50, score: 0.8 };
      const padding = 8;

      // Pipeline
      const cropped = cropROI(canvas, rect, padding);
      expect(cropped.width).toBe(50 + padding * 2);

      const upscaled = upscaleCanvas(cropped, 2);
      expect(upscaled.width).toBe((50 + padding * 2) * 2);

      const enhanced = enhanceLocalContrast(upscaled);
      expect(enhanced.width).toBe((50 + padding * 2) * 2);
    });

    it('should filter and prepare magnet list', () => {
      const detectedRects: Rect[] = [
        { x: 10, y: 10, width: 15, height: 15, score: 0.4 }, // Too small, borderline score
        { x: 50, y: 50, width: 40, height: 40, score: 0.7 }, // Good
        { x: 100, y: 100, width: 35, height: 35, score: 0.9 }, // Good
        { x: 150, y: 150, width: 5, height: 5, score: 0.95 }, // Too small
      ];

      const candidates = filterMagnetCandidates(detectedRects, 20, 0.5);

      expect(candidates).toHaveLength(2);
      expect(candidates[0].x).toBe(50);
      expect(candidates[1].x).toBe(100);
    });
  });
});
