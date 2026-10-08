import type { Area, AssignedOperator, Detection } from '../types';

export const AREAS: Area[] = ['TRANSPORT', 'OUTBOUND', 'HOVS/ML', 'VNA', 'VNAS', 'VNAC', 'PUTAWAY', 'VAS', 'OBWI', 'HAZMAT', 'OBWF'];

export type ReviewStats = {
  total: number;
  verified: number;
  uncertain: number;
  duplicates: string[];
  unknownArea: number;
};

export function isReviewRequired(row: Detection, duplicateNames: readonly string[] | ReadonlySet<string> = []): boolean {
  const duplicate = row.matched && ('has' in duplicateNames
    ? duplicateNames.has(row.matched)
    : duplicateNames.includes(row.matched));
  return Boolean(row.warning || !row.matched || row.area === 'UNKNOWN' || row.confidence < 0.8 ||
    duplicate);
}

export function isAutomaticallyConfirmed(operator: AssignedOperator, duplicateNames: string[] = []): boolean {
  return operator.reviewStatus === 'confirmed' && operator.confidence >= 0.8 && operator.area !== 'UNKNOWN' &&
    !duplicateNames.includes(operator.name);
}

export function reviewStats(rows: Detection[], duplicateNames: string[]): ReviewStats {
  const duplicateSet = new Set(duplicateNames);
  const verified = rows.filter((row) => row.matched && !isReviewRequired(row, duplicateSet)).length;
  const uncertain = rows.filter((row) => isReviewRequired(row, duplicateSet)).length;

  return {
    total: rows.length,
    verified,
    uncertain,
    duplicates: [...duplicateSet],
    unknownArea: rows.filter((row) => row.area === 'UNKNOWN').length,
  };
}

export function canStartShift(stats: ReviewStats): boolean {
  return stats.verified > 0;
}