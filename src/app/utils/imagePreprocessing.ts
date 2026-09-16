export interface ImageAdjustments {
  grayscale: boolean;
  contrast: number; // -100 to 100, default 0
  brightness: number; // -100 to 100, default 0
  autoLevels: boolean; // Dynamic histogram stretch for low-contrast/dark images
  whiteboardBoost: boolean; // Cleans background, enhances dark markers
  shadowRemoval: boolean; // Local background normalization for uneven lighting & shadows
  sharpen: boolean; // Edge enhancement for fuzzy handwriting
  rotation: number; // 0, 90, 180, 270
  crop: {
    x: number; // 0-100 percentage
    y: number; // 0-100 percentage
    width: number; // 0-100 percentage
    height: number; // 0-100 percentage
  };
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  grayscale: false,
  contrast: 0,
  brightness: 0,
  autoLevels: false,
  whiteboardBoost: false,
  shadowRemoval: false,
  sharpen: false,
  rotation: 0,
  crop: {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  },
};

export const WHITEBOARD_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 45,
  brightness: 12,
  autoLevels: true,
  whiteboardBoost: true,
  shadowRemoval: true,
  sharpen: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export const LOW_QUALITY_DARK_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 65,
  brightness: 25,
  autoLevels: true,
  whiteboardBoost: true,
  shadowRemoval: true,
  sharpen: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export const HIGH_CONTRAST_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 60,
  brightness: 5,
  autoLevels: true,
  whiteboardBoost: false,
  shadowRemoval: false,
  sharpen: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export const GRAYSCALE_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 20,
  brightness: 0,
  autoLevels: false,
  whiteboardBoost: false,
  shadowRemoval: false,
  sharpen: false,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

/**
 * Fast estimation of background illumination field to normalize uneven shadows
 */
function applyShadowRemoval(
  luminanceData: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const result = new Float32Array(width * height);
  // Downscale step to compute local background average quickly
  const blockSize = Math.max(16, Math.min(64, Math.floor(Math.min(width, height) / 20)));

  // Integral image for fast O(1) area sums
  const integral = new Float64Array((width + 1) * (height + 1));
  const intW = width + 1;

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const rowOffset = y * width;
    const intRowOffset = (y + 1) * intW;
    const prevIntRowOffset = y * intW;

    for (let x = 0; x < width; x++) {
      rowSum += luminanceData[rowOffset + x];
      integral[intRowOffset + x + 1] = integral[prevIntRowOffset + x + 1] + rowSum;
    }
  }

  // Normalize each pixel against its local window average
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - blockSize);
    const y1 = Math.min(height - 1, y + blockSize);
    const hCount = y1 - y0 + 1;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - blockSize);
      const x1 = Math.min(width - 1, x + blockSize);
      const wCount = x1 - x0 + 1;
      const count = wCount * hCount;

      // Area sum using 2D integral table
      const sum =
        integral[(y1 + 1) * intW + (x1 + 1)] -
        integral[y0 * intW + (x1 + 1)] -
        integral[(y1 + 1) * intW + x0] +
        integral[y0 * intW + x0];

      const localBg = Math.max(1, sum / count);
      const current = luminanceData[y * width + x];

      // Normalized ratio mapped to 0-255 range
      // If pixel is darker than local background (text stroke), it stays dark; background is lifted to ~220-255
      const normalized = Math.min(255, Math.max(0, (current / localBg) * 230));
      result[y * width + x] = normalized;
    }
  }

  return result;
}

/**
 * Applies canvas-based adjustments to an image source data URL and returns the enhanced data URL.
 */
export async function applyImageAdjustments(
  sourceDataUrl: string,
  adjustments: ImageAdjustments,
  maxDimension: number = 2600,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // Step 1: Calculate dimensions with rotation & crop
        const isRotated90or270 = adjustments.rotation === 90 || adjustments.rotation === 270;
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // Crop coordinates in source image space
        const cropX = Math.max(0, (adjustments.crop.x / 100) * srcW);
        const cropY = Math.max(0, (adjustments.crop.y / 100) * srcH);
        const cropW = Math.min(srcW - cropX, (adjustments.crop.width / 100) * srcW);
        const cropH = Math.min(srcH - cropY, (adjustments.crop.height / 100) * srcH);

        // Target unrotated dimensions after crop
        let targetW = Math.max(10, cropW);
        let targetH = Math.max(10, cropH);

        // Scale down if exceeds max dimension
        const maxCurrent = Math.max(targetW, targetH);
        if (maxCurrent > maxDimension) {
          const scale = maxDimension / maxCurrent;
          targetW = Math.round(targetW * scale);
          targetH = Math.round(targetH * scale);
        }

        // Final canvas dimensions (accounting for rotation)
        const finalCanvasW = isRotated90or270 ? targetH : targetW;
        const finalCanvasH = isRotated90or270 ? targetW : targetH;

        const canvas = document.createElement("canvas");
        canvas.width = finalCanvasW;
        canvas.height = finalCanvasH;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          resolve(sourceDataUrl);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        // Setup transformation for rotation
        ctx.save();
        ctx.translate(finalCanvasW / 2, finalCanvasH / 2);
        ctx.rotate((adjustments.rotation * Math.PI) / 180);

        // Draw cropped source image centered
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropW,
          cropH,
          -targetW / 2,
          -targetH / 2,
          targetW,
          targetH,
        );
        ctx.restore();

        // Step 2: Pixel-level enhancement (Grayscale, Contrast, Auto-levels, Whiteboard curve, Shadow removal)
        const needsPixelProcessing =
          adjustments.grayscale ||
          adjustments.contrast !== 0 ||
          adjustments.brightness !== 0 ||
          adjustments.autoLevels ||
          adjustments.whiteboardBoost ||
          adjustments.shadowRemoval ||
          adjustments.sharpen;

        if (needsPixelProcessing) {
          const imageData = ctx.getImageData(0, 0, finalCanvasW, finalCanvasH);
          const data = imageData.data;
          const pixelCount = finalCanvasW * finalCanvasH;

          // 1. Convert to Grayscale Luminance buffer
          const luminance = new Float32Array(pixelCount);
          for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            // ITU-R BT.709 luminance
            luminance[i] = 0.2126 * data[idx] + 0.7152 * data[idx + 1] + 0.0722 * data[idx + 2];
          }

          // 2. Optional: Shadow removal & background illumination normalization
          let processedLum = luminance;
          if (adjustments.shadowRemoval && finalCanvasW > 20 && finalCanvasH > 20) {
            processedLum = applyShadowRemoval(luminance, finalCanvasW, finalCanvasH);
          }

          // 3. Auto Levels (Histogram stretch between 1st and 99th percentile) for low-quality / faded shots
          let minLum = 0;
          let maxLum = 255;
          if (adjustments.autoLevels) {
            const hist = new Int32Array(256);
            for (let i = 0; i < pixelCount; i++) {
              const v = Math.min(255, Math.max(0, Math.round(processedLum[i])));
              hist[v]++;
            }

            const p1 = Math.floor(pixelCount * 0.015);
            const p99 = Math.floor(pixelCount * 0.985);

            let acc = 0;
            for (let i = 0; i < 256; i++) {
              acc += hist[i];
              if (acc >= p1 && minLum === 0) {
                minLum = i;
              }
              if (acc >= p99) {
                maxLum = Math.max(minLum + 10, i);
                break;
              }
            }
          }

          const lumRange = Math.max(1, maxLum - minLum);

          // 4. Contrast Factor Formula: factor = (259 * (contrast + 255)) / (255 * (259 - contrast))
          const contrast = Math.min(100, Math.max(-100, adjustments.contrast));
          const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const brightnessShift = adjustments.brightness * 1.5;

          for (let i = 0; i < pixelCount; i++) {
            const idx = i * 4;
            let val = processedLum[i];

            // Stretch histogram if auto-levels enabled
            if (adjustments.autoLevels) {
              val = ((val - minLum) / lumRange) * 255;
            }

            // Brightness
            if (brightnessShift !== 0) {
              val += brightnessShift;
            }

            // Contrast
            if (contrast !== 0) {
              val = contrastFactor * (val - 128) + 128;
            }

            // Whiteboard non-linear gamma boost (whiten dirty board backgrounds & darken marker strokes)
            if (adjustments.whiteboardBoost) {
              if (val > 140) {
                const boost = (val - 140) / 115;
                val = val + (255 - val) * Math.min(1, boost * 0.85);
              } else if (val < 100) {
                val = val * 0.78;
              }
            }

            // Clamp 0-255
            const finalVal = val < 0 ? 0 : val > 255 ? 255 : val;

            if (adjustments.grayscale || adjustments.whiteboardBoost || adjustments.shadowRemoval) {
              data[idx] = finalVal;
              data[idx + 1] = finalVal;
              data[idx + 2] = finalVal;
            } else {
              // Color mode with contrast/brightness applied
              const ratio = processedLum[i] > 0 ? finalVal / processedLum[i] : 1;
              data[idx] = Math.min(255, Math.max(0, data[idx] * ratio));
              data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] * ratio));
              data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] * ratio));
            }
          }

          // 5. Sharpening filter convolution (3x3 Laplacian / High-pass kernel)
          if (adjustments.sharpen && finalCanvasW > 10 && finalCanvasH > 10) {
            const originalPixels = new Uint8ClampedArray(data);
            const w = finalCanvasW;
            const h = finalCanvasH;

            for (let y = 1; y < h - 1; y++) {
              const yOffset = y * w;
              const topOffset = (y - 1) * w;
              const bottomOffset = (y + 1) * w;

              for (let x = 1; x < w - 1; x++) {
                const idx = (yOffset + x) * 4;
                const top = (topOffset + x) * 4;
                const bottom = (bottomOffset + x) * 4;
                const left = (yOffset + (x - 1)) * 4;
                const right = (yOffset + (x + 1)) * 4;

                for (let c = 0; c < 3; c++) {
                  const val =
                    3.2 * originalPixels[idx + c] -
                    0.55 * originalPixels[top + c] -
                    0.55 * originalPixels[bottom + c] -
                    0.55 * originalPixels[left + c] -
                    0.55 * originalPixels[right + c];
                  data[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
                }
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);
        }

        const outputDataUrl = canvas.toDataURL("image/jpeg", 0.92);
        resolve(outputDataUrl);
      } catch (err) {
        console.error("Image adjustment error:", err);
        resolve(sourceDataUrl);
      }
    };
    img.onerror = () => resolve(sourceDataUrl);
    img.src = sourceDataUrl;
  });
}
