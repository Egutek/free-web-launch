import type { Area, Detection } from '../types';

export type ExpectedAssignment = {
  name: string;
  area: Area;
};

export type BenchmarkMetrics = {
  expectedCount: number;
  detectionCount: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number | null;
  missed: number;
  wrongArea: number;
  accuracy: number | null;
  precision: number;
  recall: number;
  f1: number;
  falsePositiveRate: number | null;
  falseNegativeRate: number;
  areaAccuracy: number;
};

export type BenchmarkSample = {
  photo: string;
  expected: ExpectedAssignment[];
  detections: Detection[];
  nonEmployeeCandidates?: number;
  status?: 'processed' | 'unusable';
};

export type BenchmarkReport = {
  generatedAt: string;
  photos: Array<{ photo: string; status: 'processed' | 'unusable'; metrics: BenchmarkMetrics }>;
  aggregate: BenchmarkMetrics;
};

function normalizeName(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase().replace(/\s+/g, ' ').trim();
}

export function evaluateBenchmarkPhoto(
  expected: ExpectedAssignment[],
  detections: Detection[],
  nonEmployeeCandidates?: number
): BenchmarkMetrics {
  if (nonEmployeeCandidates !== undefined && (!Number.isInteger(nonEmployeeCandidates) || nonEmployeeCandidates < 0)) {
    throw new RangeError('nonEmployeeCandidates must be a non-negative integer');
  }
  const unmatchedExpected = expected.map((assignment) => ({
    ...assignment,
    normalizedName: normalizeName(assignment.name),
  }));
  let truePositives = 0;
  let falsePositives = 0;
  let wrongArea = 0;

  for (const detection of detections) {
    const detectedName = detection.matched ? normalizeName(detection.matched) : '';
    const expectedIndex = unmatchedExpected.findIndex((assignment) => assignment.normalizedName === detectedName);

    if (expectedIndex === -1) {
      falsePositives += 1;
      continue;
    }

    const [assignment] = unmatchedExpected.splice(expectedIndex, 1);
    truePositives += 1;
    if (detection.area !== assignment.area) wrongArea += 1;
  }

  if (nonEmployeeCandidates !== undefined && falsePositives > nonEmployeeCandidates) {
    throw new RangeError('False-positive detections exceed labeled non-employee candidates');
  }

  const missed = unmatchedExpected.length;
  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;
  const recall = expected.length > 0 ? truePositives / expected.length : 0;
  const falseNegativeRate = expected.length > 0 ? missed / expected.length : 0;
  const trueNegatives = nonEmployeeCandidates === undefined ? null : Math.max(0, nonEmployeeCandidates - falsePositives);
  const accuracy = trueNegatives === null ? null :
    (truePositives + trueNegatives) / Math.max(1, truePositives + falsePositives + missed + trueNegatives);
  const falsePositiveRate = nonEmployeeCandidates !== undefined && nonEmployeeCandidates > 0
    ? falsePositives / nonEmployeeCandidates
    : nonEmployeeCandidates === 0 && falsePositives === 0 ? 0 : null;

  return {
    expectedCount: expected.length,
    detectionCount: detections.length,
    truePositives,
    falsePositives,
    trueNegatives,
    missed,
    wrongArea,
    accuracy,
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    falsePositiveRate,
    falseNegativeRate,
    areaAccuracy: truePositives > 0 ? (truePositives - wrongArea) / truePositives : 0,
  };
}

export function createBenchmarkReport(
  samples: BenchmarkSample[],
  generatedAt: string = new Date().toISOString()
): BenchmarkReport {
  const photos = samples.map((sample) => ({
    photo: sample.photo,
    status: sample.status ?? 'processed' as const,
    metrics: evaluateBenchmarkPhoto(sample.expected, sample.detections, sample.nonEmployeeCandidates),
  }));
  const totals = photos.reduce((sum, photo) => ({
    expectedCount: sum.expectedCount + photo.metrics.expectedCount,
    detectionCount: sum.detectionCount + photo.metrics.detectionCount,
    truePositives: sum.truePositives + photo.metrics.truePositives,
    falsePositives: sum.falsePositives + photo.metrics.falsePositives,
    trueNegatives: sum.trueNegatives + (photo.metrics.trueNegatives ?? 0),
    missed: sum.missed + photo.metrics.missed,
    wrongArea: sum.wrongArea + photo.metrics.wrongArea,
  }), { expectedCount: 0, detectionCount: 0, truePositives: 0, falsePositives: 0, trueNegatives: 0, missed: 0, wrongArea: 0 });
  const allNegativeCountsKnown = samples.every((sample) => sample.nonEmployeeCandidates !== undefined);
  const negativeCandidateCount = allNegativeCountsKnown
    ? samples.reduce((sum, sample) => sum + (sample.nonEmployeeCandidates ?? 0), 0)
    : undefined;

  return {
    generatedAt,
    photos,
    aggregate: metricsFromCounts(totals, negativeCandidateCount),
  };
}

function metricsFromCounts(
  counts: Pick<BenchmarkMetrics, 'expectedCount' | 'detectionCount' | 'truePositives' | 'falsePositives' | 'missed' | 'wrongArea'> & { trueNegatives: number },
  negativeCandidateCount?: number
): BenchmarkMetrics {
  const precision = counts.detectionCount > 0 ? counts.truePositives / counts.detectionCount : 0;
  const recall = counts.expectedCount > 0 ? counts.truePositives / counts.expectedCount : 0;
  return {
    ...counts,
    trueNegatives: negativeCandidateCount === undefined ? null : Math.max(0, negativeCandidateCount - counts.falsePositives),
    accuracy: negativeCandidateCount === undefined ? null :
      (counts.truePositives + Math.max(0, negativeCandidateCount - counts.falsePositives)) /
      Math.max(1, counts.truePositives + counts.falsePositives + counts.missed + Math.max(0, negativeCandidateCount - counts.falsePositives)),
    precision,
    recall,
    f1: precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0,
    falsePositiveRate: negativeCandidateCount !== undefined && negativeCandidateCount > 0
      ? counts.falsePositives / negativeCandidateCount
      : negativeCandidateCount === 0 && counts.falsePositives === 0 ? 0 : null,
    falseNegativeRate: counts.expectedCount > 0 ? counts.missed / counts.expectedCount : 0,
    areaAccuracy: counts.truePositives > 0 ? (counts.truePositives - counts.wrongArea) / counts.truePositives : 0,
  };
}

export function exportBenchmarkReport(report: BenchmarkReport): Blob {
  return new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
}