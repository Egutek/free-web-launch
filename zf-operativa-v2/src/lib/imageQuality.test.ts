import { describe, expect, it } from 'vitest';
import { adaptiveThreshold, assessImageQuality, normalizeGrayscale } from './imageQuality';

function createImage(width: number, height: number, colorAt: (x: number, y: number) => number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const value = colorAt(x, y);
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height } as ImageData;
}

describe('image quality preprocessing', () => {
  it('rejects a flat, unusable image', () => {
    const quality = assessImageQuality(createImage(32, 32, () => 235));

    expect(quality.usable).toBe(false);
    expect(quality.blurScore).toBe(0);
    expect(quality.contrastScore).toBe(0);
  });

  it('scores a sharp, high-contrast image as usable', () => {
    const quality = assessImageQuality(createImage(64, 64, (x, y) => ((x + y) % 2 ? 20 : 230)));

    expect(quality.usable).toBe(true);
    expect(quality.blurScore).toBeGreaterThan(0.08);
    expect(quality.contrastScore).toBeGreaterThan(0.8);
  });

  it('rejects a smooth, low-detail image even when brightness and contrast are acceptable', () => {
    const quality = assessImageQuality(createImage(64, 64, (x) => 70 + x * 2));

    expect(quality.blurScore).toBeLessThan(0.08);
    expect(quality.usable).toBe(false);
  });

  it('normalizes grayscale range and applies local adaptive thresholding', () => {
    const image = createImage(9, 9, (x, y) => (x >= 3 && x <= 5 && y >= 3 && y <= 5 ? 80 : 160));
    const normalized = normalizeGrayscale(image);
    const thresholded = adaptiveThreshold(normalized, image.width, image.height, 5, 8);

    expect(Math.min(...normalized)).toBe(0);
    expect(Math.max(...normalized)).toBe(255);
    expect(thresholded[4 * image.width + 4]).toBe(0);
    expect(thresholded[0]).toBe(255);
  });
});