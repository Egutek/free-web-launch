import { createShift } from '../lib/shifts';
import { readBoard } from '../lib/ocr';
import { preprocess, UnusableImageError } from '../lib/image';
import { duplicates, validate } from '../lib/validation';
import type { Area, AreaHeader, AssignedOperator, BoardAnalysisResult, Detection, Rect, ReviewIssue, ReviewResult, ShiftState } from '../types';
import { DEFAULT_MAGNET_OCR_CONFIG, type MagnetOCRConfig } from '../lib/magnetOcr';
import { runMagnetOCR } from './magnetOcr';
import { combineConfidences } from '../lib/confidence';
import { renderAnalysisOverlay } from './overlay';
import { isAutomaticallyConfirmed, isReviewRequired } from '../lib/board';

export const DEFAULT_AREA_HEADERS: AreaHeader[] = [
  { area: 'TRANSPORT', x: 0, y: 0, width: 120, height: 100, centerX: 60 },
  { area: 'OUTBOUND', x: 120, y: 0, width: 120, height: 100, centerX: 180 },
  { area: 'HOVS/ML', x: 240, y: 0, width: 120, height: 100, centerX: 300 },
  { area: 'VNA', x: 360, y: 0, width: 120, height: 100, centerX: 420 },
  { area: 'VNAS', x: 480, y: 0, width: 120, height: 100, centerX: 540 },
  { area: 'VNAC', x: 600, y: 0, width: 120, height: 100, centerX: 660 },
  { area: 'PUTAWAY', x: 720, y: 0, width: 120, height: 100, centerX: 780 },
  { area: 'VAS', x: 840, y: 0, width: 120, height: 100, centerX: 900 },
  { area: 'OBWI', x: 960, y: 0, width: 120, height: 100, centerX: 1020 },
  { area: 'HAZMAT', x: 1080, y: 0, width: 120, height: 100, centerX: 1140 },
  { area: 'OBWF', x: 1200, y: 0, width: 120, height: 100, centerX: 1260 },
];

export function assignOperatorToArea(magnetRect: Rect, areaHeaders: AreaHeader[]): Area {
  return assignOperatorToAreaWithConfidence(magnetRect, areaHeaders).area;
}

export function assignOperatorToAreaWithConfidence(
  magnetRect: Rect,
  areaHeaders: AreaHeader[]
): { area: Area; confidence: number } {
  if (!areaHeaders?.length) return { area: 'UNKNOWN', confidence: 0 };

  const centerX = magnetRect.x + magnetRect.width / 2;
  let nearest = areaHeaders[0];
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const header of areaHeaders) {
    const distance = Math.abs(centerX - header.centerX);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = header;
    }
  }

  const halfWidth = Math.max(1, nearest.width / 2);
  const confidence = Math.max(0, Math.min(1, 1 - nearestDistance / halfWidth));
  return { area: nearest.area, confidence };
}

export function buildReviewResult(rows: Detection[], duplicateNames: string[] = []): ReviewResult {
  const duplicateSet = new Set(duplicateNames);
  const confirmed = rows.filter((row) => row.matched && !isReviewRequired(row, duplicateSet)).length;
  const questionable = rows.filter((row) => isReviewRequired(row, duplicateSet)).length;
  const lowConfidence = rows.filter((row) => row.confidence < 0.8 || row.warning === 'low').length;
  const unknownEmployees = rows.filter((row) => !row.matched).length;
  const unknownAreas = rows.filter((row) => row.area === 'UNKNOWN').length;
  const uniqueDuplicateNames = Array.from(new Set(duplicateNames));

  const blockingIssues: ReviewIssue[] = [];

  if (lowConfidence > 0) {
    blockingIssues.push({ type: 'low-confidence', message: 'Low-confidencg^t⁄⁄$z{-ÆÈ‹j◊ùws, duplicates(detectionRows));
  const result = buildBoardAnalysis({ assignedOperators, review });
  const overlayUrl = renderAnalysisOverlay(canvas, normalizedHeaders, detectionRows, prep.boardDetected);

  return {
    ...result,
    detections: detectionRows,
    imageQuality: prep.quality,
    boardDetected: prep.boardDetected,
    imageUrl: prep.url,
    overlayUrl,
    timingsMs: {
      preprocess: preprocessMs,
      ocr: ocrMs,
      analysis: performance.now() - startedAt,
    },
  };
}

export type AnalyzeBoardPhotoFn = typeof analyzeBoardPhoto;
export type { AssignedOperator, AreaHeader, BoardAnalysisResult, Detection, Rect, ReviewResult, ShiftState, Area } from '../types';
