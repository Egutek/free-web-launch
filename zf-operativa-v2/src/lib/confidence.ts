export enum ConfidenceLevel {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (!Number.isFinite(confidence)) return ConfidenceLevel.LOW;
  if (confidence >= 0.95) return ConfidenceLevel.HIGH;
  if (confidence >= 0.8) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

export function meetsMinimumConfidence(
  confidence: number,
  minimumLevel: ConfidenceLevel = ConfidenceLevel.MEDIUM
): boolean {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return false;
  switch (minimumLevel) {
    case ConfidenceLevel.HIGH:
      return confidence >= 0.95;
    case ConfidenceLevel.MEDIUM:
      return confidence >= 0.8;
    case ConfidenceLevel.LOW:
      return confidence >= 0;
    default:
      return false;
  }
}

export function combineConfidences(...confidences: number[]): number {
  const valid = confidences
    .filter((confidence) => Number.isFinite(confidence))
    .map((confidence) => Math.max(0, Math.min(1, confidence)));
  if (valid.length === 0 || valid.includes(0)) return 0;
  const product = valid.reduce((result, confidence) => result * confidence, 1);
  return Math.pow(product, 1 / valid.length);
}

export function boostConfidence(
  baseConfidence: number,
  factors: { exactMatch?: boolean; consistentPlacement?: boolean; highContrast?: boolean }
): number {
  let boosted = Math.max(0, Math.min(1, Number.isFinite(baseConfidence) ? baseConfidence : 0));
  if (factors.exactMatch) boosted = Math.min(1, boosted * 1.1);
  if (factors.consistentPlacement) boosted = Math.min(1, boosted * 1.08);
  if (factors.highContrast) boosted = Math.min(1, boosted * 1.05);
  return boosted;
}