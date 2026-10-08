import { describe, expect, it } from 'vitest';
import { createBenchmarkReport, evaluateBenchmarkPhoto, exportBenchmarkReport } from './benchmark';

describe('OCR photo benchmark scoring', () => {
  it('normalizes case and diacritics when matching employee identities', () => {
    const result = evaluateBenchmarkPhoto(
      [{ name: 'NOVÁK JAN', area: 'TRANSPORT' }],
      [{ raw: 'NOVAK JAN', matched: 'Novak Jan', area: 'TRANSPORT', confidence: 0.61 }],
      0
    );

    expect(result.truePositives).toBe(1);
    expect(result.falsePositives).toBe(0);
    expect(result.missed).toBe(0);
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.areaAccuracy).toBe(1);
    expect(result.falsePositiveRate).toBe(0);
    expect(result.falseNegativeRate).toBe(0);
  });

  it('reports wrong areas, false positives, and missed assignments separately', () => {
    const result = evaluateBenchmarkPhoto(
      [
        { name: 'NOVÁK JAN', area: 'TRANSPORT' },
        { name: 'SVOBODA PETR', area: 'OUTBOUND' },
      ],
      [
        { raw: 'NOVAK JAN', matched: 'NOVAK JAN', area: 'OUTBOUND', confidence: 0.98 },
        { raw: 'UNKNOWN NAME', matched: 'UNKNOWN NAME', area: 'VNA', confidence: 0.9 },
      ],
      5
    );

    expect(result.truePositives).toBe(1);
    expect(result.falsePositives).toBe(1);
    expect(result.missed).toBe(1);
    expect(result.wrongArea).toBe(1);
    expect(result.precision).toBe(0.5);
    expect(result.recall).toBe(0.5);
    expect(result.areaAccuracy).toBe(0);
    expect(result.falsePositiveRate).toBe(0.2);
    expect(result.falseNegativeRate).toBe(0.5);
    expect(result.trueNegatives).toBe(4);
    expect(result.accuracy).toBeCloseTo(5 / 7, 10);
  });

  it('aggregates counts into a reproducible JSON report and leaves unknown FPR undefined', async () => {
    const report = createBenchmarkReport([
      {
        photo: 'shift-a.jpg',
        expected: [{ name: 'NOVÁK JAN', area: 'TRANSPORT' }],
        detections: [{ raw: 'NOVAK JAN', matched: 'NOVÁK JAN', area: 'TRANSPORT', confidence: 0.9 }],
      },
    ], '2026-10-02T00:00:00.000Z');
    const json = await exportBenchmarkReport(report).text();

    expect(report.aggregate.truePositives).toBe(1);
    expect(report.aggregate.falsePositiveRate).toBeNull();
    expect(report.aggregate.accuracy).toBeNull();
    expect(JSON.parse(json).generatedAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('rejects inconsistent negative-candidate labels', () => {
    expect(() => evaluateBenchmarkPhoto([], [
      { raw: 'UNKNOWN', matched: 'UNKNOWN', area: 'TRANSPORT', confidence: 0.9 },
    ], 0)).toThrow(RangeError);
  });
});