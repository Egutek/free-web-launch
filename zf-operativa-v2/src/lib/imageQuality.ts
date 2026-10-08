import type { ImageQuality } from '../types';

type PixelImage = Pick<ImageData, 'data' | 'width' | 'height'>;

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

function grayAt(data: Uint8ClampedArray, index: number): number {
  return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
}

export function assessImageQuality(image: PixelImage): ImageQuality {
  const { data, width, height } = image;
  if (width < 3 || height < 3 || data.length < width * height * 4) {
    return { blurScore: 0, contrastScore: 0, brightnessScore: 0, usable: false };
  }

  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 120_000)));
  let sampleCount = 0;
  let luminanceSum = 0;
  let luminanceSquaredSum = 0;
  let laplacianSum = 0;
  let laplacianSquaredSum = 0;

  for (let y = 1; y < height - 1; y += stride) {
    for (let x = 1; x < width - 1; x += stride) {
      const index = (y * width + x) * 4;
      const center = grayAt(data, index);
      const laplacian =
        grayAt(data, index - 4) +
        grayAt(data, index + 4) +
        grayAt(data, index - width * 4) +
        grayAt(data, index + width * 4) -
        4 * center;

      sampleCount += 1;
      luminanceSum += center;
      luminanceSquaredSum += center * center;
      laplacianSum += laplacian;
      laplacianSquaredSum += laplacian * laplacian;
    }
  }

  if (sampleCount === 0) {
    return { blurScore: 0, contrastScore: 0, brightnessScore: 0, usable: false };
  }

  const mean = luminanceSum / sampleCount;
  const luminanceVariance = Math.max(0, luminanceSquaredSum / sampleCount - mean * mean);
  const laplacianVariance = Math.max(0, laplacianSquaredSum / sampleCount - (laplacianSum / sampleCount) ** 2);
  const blurScore = Math.min(1, laplacianVariance / 1600);
  const contrastScore = Math.min(1, Math.sqrt(luminanceVariance) / 64);
  const brightnessScore = Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(mean - 127.5) - 45) / 82.5));

  return {
    blurScore: Number(blurScore.toFixed(3)),
    contrastScore: Number(contrastScore.toFixed(3)),
    brightnessScore: Number(brightnessScore.toFixed(3)),
    usable: blurScore >= 0.08 && contrastScore >= 0.08 && brightnessScore >= 0.15,
  };
}

export function normalizeGrayscale(image: PixelImage, denoise: boolean = true): Uint8Array {
  const { data, width, height } = image;
  const pixelCount = width * height;
  const gray = new Uint8Array(pixelCount);
  const histogram = new Uint32Array(256);

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const value = clampByte(grayAt(data, pixel * 4));
    gray[pixel] = value;
    histogram[value] += 1;
  }

  const lowTarget = Math.floor((pixelCount - 1) * 0.01);
  const highTarget = Math.floor((pixelCount - 1) * 0.99);
  let low = 0;
  let high = 255;
  let cumulative = 0;

  for (let value = 0; value < 256; value += 1) {
    cumulative += histogram[value];
    if (cumulative > lowTarget) {
      low = value;
      break;
    }
  }

  cumulative = 0;
  for (let value = 0; value < 256; value += 1) {
    cumulative += histogram[value];
    if (cumulative > highTarget) {
      high = value;
      break;
    }
  }

  const range = Math.max(1, high - low);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    gray[pixel] = clampByte(((gray[pixel] - low) * 255) / range);
  }

  if (!denoise) return gray;

  const denoised = new Uint8Array(pixelCount);
  const neighbors = new Uint8Array(9);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let neighborIndex = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const sampleX = Math.max(0, Math.min(width - 1, x + dx));
          const sampleY = Math.max(0, Math.min(height - 1, y + dy));
          neighbors[neighborIndex] = gray[sampleY * width + sampleX];
          neighborIndex += 1;
        }
      }
      neighbors.sort();
      denoised[y * width + x] = neighbors[4];
    }
  }

  return denoised;
}

export function adaptiveThreshold(
  grayscale: Uint8Array,
  width: number,
  height: number,
  windowSize: number = 15,
  offset: number = 10
): Uint8Array {
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowSum = 0;
    for (let x = 1; x <= width; x += 1) {
      rowSum += grayscale[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }

  const radius = Math.max(1, Math.floor(windowSize / 2));
  const output = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const top = Math.max(0, y - radius);
    const bottom = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const left = Math.max(0, x - radius);
      const right = Math.min(width, x + radius + 1);
      const stride = width + 1;
      const sum = integral[bottom * stride + right] - integral[top * stride + right] -
        integral[bottom * stride + left] + integral[top * stride + left];
      const localMean = sum / ((bottom - top) * (right - left));
      output[y * width + x] = grayscale[y * width + x] < localMean - offset ? 0 : 255;
    }
  }

  return output;
}