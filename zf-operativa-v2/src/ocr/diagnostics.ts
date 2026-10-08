import type { AssignedOperator, BoardAnalysisResult, Detection } from '../types';
import { calculateOCRMetrics } from './metrics';

export interface BoardDiagnostics {
  boardDetected: boolean;
  detectedAreas: string[];
  detectedMagnets: number;
  ocrResults: Detection[];
  confidence: number;
  assignment: AssignedOperator[];
  reviewState: BoardAnalysisResult['review'];
  metrics: ReturnType<typeof calculateOCRMetrics>;
}

export function buildBoardDiagnostics(
  detectedAreas: string[],
  ocrResults: Detection[],
  assignment: AssignedOperator[],
  review: BoardAnalysisResult['review'],
  boardDetected: boolean = true
): BoardDiagnostics {
  return {
    boardDetected,
    detectedAreas: detectedAreas,
    detectedMagnets: ocrResults.length,
    ocrResults,
    confidence: assignment.length
      ? assignment.reduce((sum, item) => sum + item.confidence, 0) / assignment.length
      : 0,
    assignment,
    reviewState: review,
    metrics: calculateOCRMetrics(assignment, ocrResults),
  };
}

export function exportDiagnosticsJson(payload: BoardDiagnostics): Blob {
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}
