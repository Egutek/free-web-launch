export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
import type { Rect } from '../types';
export type { Rect } from '../types';

const gray = (data: Uint8ClampedArray, index: number): number =>
  0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];

export function detectBoardQuad(image: ImageData): Quad | null {
  const { width, height, data } = image;
  if (width < 20 || height < 20) return null;

  const step = Math.max(2, Math.floor(Math.min(width, height) / 600));
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let edgeHits = 0;

  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const index = (y * width + x) * 4;
      const horizontalEdge = Math.abs(gray(data, index + step * 4) - gray(data, index - step * 4));
      const verticalEdge = Math.abs(gray(data, index + step * width * 4) - gray(data, index - step * width * 4));
      if (horizontalEdge + verticalEdge > 120) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        edgeHits += 1;
      }
    }
  }

  if (edgeHits < 50 || maxX - minX < width * 0.35 || maxY - minY < height * 0.35) return null;

  const padding = Math.round(Math.min(width, height) * 0.015);
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);
  return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

export function cropQuadToCanvas(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const x = Math.floor(Math.min(...quad.map((point) => point.x)));
  const y = Math.floor(Math.min(...quad.map((point) => point.y)));
  const width = Math.ceil(Math.max(...quad.map((point) => point.x)) - x);
  const height = Math.ceil(Math.max(...quad.map((point) => point.y)) - y);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) throw new Error('Could not create board crop context');
  context.drawImage(source, x, y, width, height, 0, 0, width, height);
  return output;
}

export function detectMagnetRects(image: ImageData): Rect[] {
  const { width, height, data } = image;
  if (width < 1 || height < 1) return [];

  const cell = Math.max(8, Math.floor(Math.min(width, height) / 100));
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cellCount = columns * rows;
  const active = new Uint8Array(cellCount);
  const visited = new Uint8Array(cellCount);
  const queue = new Uint32Array(cellCount);

  for (let cellY = 0; cellY < rows; cellY += 1) {
    for (let cellX = 0; cellX < columns; cellX += 1) {
      let darkPixels = 0;
      let sampledPixels = 0;
      const endY = Math.min(height, (cellY + 1) * cell);
      const endX = Math.min(width, (cellX + 1) * cell);
      for (let y = cellY * cell; y < endY; y += 2) {
        for (let x = cellX * cell; x < endX; x += 2) {
          if (gray(data, (y * width + x) * 4) < 105) darkPixels += 1;
          sampledPixels += 1;
        }
      }
      if (sampledPixels > 0 && darkPixels / sampledPixels > 0.035) active[cellY * columns + cellX] = 1;
    }
  }

  const candidates: Rect[] = [];
  for (let start = 0; start < cellCount; start += 1) {
    if (!active[start] || visited[start]) continue;

    let queueStart = 0;
    let queueEnd = 0;
    let componentSize = 0;
    let minCellX = columns;
    let maxCellX = 0;
    let minCellY = rows;
    let maxCellY = 0;
    queue[queueEnd++] = start;
    visited[start] = 1;

    while (queueStart < queueEnd) {
      const index = queue[queueStart++];
      const cellX = index % columns;
      const cellY = Math.floor(index / columns);
      componentSize += 1;
      minCellX = Math.min(minCellX, cellX);
      maxCellX = Math.max(maxCellX, cellX);
      minCellY = Math.min(minCellY, cellY);
      maxCellY = Math.max(maxCellY, cellY);

      const neighbors = [
        cellX > 0 ? index - 1 : -1,
        cellX + 1 < columns ? index + 1 : -1,
        cellY > 0 ? index - columns : -1,
        cellY + 1 < rows ? index + columns : -1,
      ];
      for (const neighbor of neighbors) {
        if (neighbor >= 0 && active[neighbor] && !visited[neighbor]) {
          visited[neighbor] = 1;
          queue[queueEnd++] = neighbor;
        }
      }
    }

    const boxColumns = maxCellX - minCellX + 1;
    const boxRows = maxCellY - minCellY + 1;
    const x = minCellX * cell;
    const y = minCellY * cell;
    const boxWidth = Math.min(width - x, boxColumns * cell);
    const boxHeight = Math.min(height - y, boxRows * cell);
    const aspectRatio = boxWidth / Math.max(1, boxHeight);
    const density = componentSize / (boxColumns * boxRows);

    if (
      boxWidth > width * 0.035 && boxWidth < width * 0.45 &&
      boxHeight > height * 0.012 && boxHeight < height * 0.14 &&
      aspectRatio > 1.7 && aspectRatio < 12 && density >= 0.12
    ) {
      const sizeScore = Math.min(1, componentSize / 18);
      candidates.push({ x, y, width: boxWidth, height: boxHeight, score: 0.65 * sizeScore + 0.35 * density });
    }
  }

  return candidates;
}

export function filterMagnetCandidates(
  value: unknown,
  minSize: number = 20,
  minScore: number = 0.5
): Rect[] {
  if (!Array.isArray(value)) return [];
  return value.filter((candidate): candidate is Rect => {
    if (!candidate || typeof candidate !== 'object') return false;
    if (!('x' in candidate) || !('y' in candidate) || !('width' in candidate) || !('height' in candidate) || !('score' in candidate)) return false;
    const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
    if (!isFiniteNumber(candidate.x) || !isFiniteNumber(candidate.y) || !isFiniteNumber(candidate.width) ||
      !isFiniteNumber(candidate.height) || !isFiniteNumber(candidate.score)) return false;
    return candidate.width >= minSize && candidate.height > 0 &&
      candidate.width * candidate.height >= minSize * minSize && candidate.score >= minScore;
  });
}