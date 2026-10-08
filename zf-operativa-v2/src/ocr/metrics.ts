import type { AssignedOperator, Detection } from '../types';

export interface OCRMetrics {
  magnetCount: number;
  assignedCount: number;
  unmatchedCount: number;
  averageConfidence: number;
  lowConfidenceCount: number;
}

export function calculateOCRMetrics(
  assignedOperators: AssignedOperator[] = [],
  detections: Detection[] = []
): OCRMetrics {
  const source = detections.length > 0 ? detections : assignedOperators;
  const magnetCount = Math.max(source.length, assignedOperators.length);
  const assignedCount = assignedOperators.length;
  const unmatchedCount = Math.max(0, magnetCount - assignedCount);

  const allConfidenceValues = source
    .map((item) => item.confidence)
    .filter((value) => Number.isFinite(value));

  const averageConfidence = allConfidenceValues.length
    ? Number((allConfidenceValues.reduce((sum, value) => sum + value, 0) / allConfidenceValues.length).toFixed(2))
    : 0;

  const lowConfidenceCount = allConfidenceValues.filter((value) => value < 0.8).length;

  return {
    magnetCount,
    assignedCount,
    unmatchedCount,
    averageConfidence,
    lowConfidenceCount,
  };
}
