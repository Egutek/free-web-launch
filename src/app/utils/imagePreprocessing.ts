export interface ImageAdjustments {
  grayscale: boolean;
  contrast: number; // -100 to 100, default 0
  brightness: number; // -100 to 100, default 0
  whiteboardBoost: boolean; // Cleans background, enhances dark markers
  sharpen: boolean; // Edge enhancement
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
  whiteboardBoost: false,
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
  brightness: 10,
  whiteboardBoost: true,
  sharpen: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export const HIGH_CONTRAST_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 60,
  brightness: 5,
  whiteboardBoost: false,
  sharpen: true,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

export const GRAYSCALE_PRESET: ImageAdjustments = {
  grayscale: true,
  contrast: 15,
  brightness: 0,
  whiteboardBoost: false,
  sharpen: false,
  rotation: 0,
  crop: { x: 0, y: 0, width: 100, height: 100 },
};

/**
 * Applies adjustments to an image source data URL and returns the enhanced data URL.
 */
export async function applyImageAdjustments(
  sourceDataUrl: string,
  adjustments: ImageAdjustments,
  maxDimension: number = 2600,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // Step 1: Calculate dimensions with rotation
        const isRotated90or270 = adjustments.rotation === 90 || adjustments.rotation === 270;
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;

        // Crop coordinates in source image space
        const cropX = Math.max(0, (adjustments.crop.x / 100) * srcW);
        const cropY = Math.max(0, (adjustments.crop.y / 100) * srcH);
        const cropW = Math.min(srcW - cropX, (adjustments.crop.width / 100) * srcW);
        const cropH = Math.min(srcH - cropY, (adjustments.crop.height / 100) * srcH);

        // Target unrotated dimensions after crop
        let targetW = cropW;
        let targetH = cropH;

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

        // Step 2: Pixel-level enhancement (Grayscale, Contrast, Brightness, Whiteboard curve)
        const needsPixelProcessing =
          adjustments.grayscale ||
          adjustments.contrast !== 0 ||
          adjustments.brightness !== 0 ||
          adjustments.whiteboardBoost ||
          adjustments.sharpen;

        if (needsPixelProcessing) {
          const imageData = ctx.getImageData(0, 0, finalCanvasW, finalCanvasH);
          const data = imageData.data;
          const len = data.length;

          // Contrast lookup / factor
          const contrast = adjustments.contrast;
          const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
          const brightness = adjustments.brightness * 1.5;

          for (let i = 0; i < len; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // 1. Grayscale luminance (Rec. 709)
            if (adjustments.grayscale || adjustments.whiteboardBoost) {
              const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              r = lum;
              g = lum;
              b = lum;
            }

            // 2. Brightness adjustment
            if (brightness !== 0) {
              r += brightness;
              g += brightness;
              b += brightness;
            }

            // 3. Contrast adjustment
            if (contrast !== 0) {
              r = factor * (r - 128) + 128;
              g = factor * (g - 128) + 128;
              b = factor * (b - 128) + 128;
            }

            // 4. Whiteboard boost (whiten dirty grey/yellow board background while keeping dark marker lines sharp)
            if (adjustments.whiteboardBoost) {
              // Non-linear gamma curve that expands light tones to pure white
              if (r > 140) {
                const boost = (r - 140) / 115; // 0 to 1
                r = r + (255 - r) * (boost * 0.75);
                g = r;
                b = r;
              } else if (r < 100) {
                // Darken dark marker strokes
                r = r * 0.82;
                g = r;
                b = r;
              }
            }

            // Clamp 0-255
            data[i] = r < 0 ? 0 : r > 255 ? 255 : r;
            data[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
            data[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
          }

          // 5. Sharpening filter convolution (3x3 Laplacian / Unsharp mask)
          if (adjustments.sharpen && finalCanvasW > 10 && finalCanvasH > 10) {
            const originalPixels = new Uint8ClampedArray(data);
            const w = finalCanvasW;
            const h = finalCanvasH;

            // Simple fast unsharp convolution
            // Kernel:
            //  0  -0.5   0
            // -0.5   3  -0.5
            //  0  -0.5   0
            for (let y = 1; y < h - 1; y++) {
              for (let x = 1; x < w - 1; x++) {
                const idx = (y * w + x) * 4;
                const top = ((y - 1) * w + x) * 4;
                const bottom = ((y + 1) * w + x) * 4;
                const left = (y * w + (x - 1)) * 4;
                const right = (y * w + (x + 1)) * 4;

                for (let c = 0; c < 3; c++) {
                  const val =
                    3 * originalPixels[idx + c] -
                    0.5 * originalPixels[top + c] -
                    0.5 * originalPixels[bottom + c] -
                    0.5 * originalPixels[left + c] -
                    0.5 * originalPixels[right + c];
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
