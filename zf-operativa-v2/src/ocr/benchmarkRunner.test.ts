import { describe, expect, it, vi } from 'vitest';
import { UnusableImageError } from '../lib/image';
import type { BoardAnalysisResult } from '../types';
import { runOCRBenchmark, type BenchmarkFixture } from './benchmarkRunner';
import type { AnalyzeBoardPhotoFn } from './pipeline';

function fixture(): BenchmarkFixture {
  return {
    photo: 'shift-a.jpg',
    image: new File(['photo'], 'shift-a.jpg', { type: 'image/jpeg' }),
    roster: ['NOVÁK JAN'],
    expected: [{ name: 'NOVÁK JAN', area: 'TRANSPORT' }],
    nonEmployeeCandidates: 0,
  };
}

describe('OCR benchmark runner', () => {
  it('processes fixture photos and emits final progress', async () => {
    const analyze: AnalyzeBoardPhotoFn = vi.fn(async () => ({
      detections: [{ raw: 'NOVAK JAN', matched: 'NOVÁK JAN', area: 'TRANSPORT', confidence: 0.9 }],
      assignedOperators: [],
      review: {
        confirmed: 1,
        questionable: 0,
        blockingIssues: [],
        hasBlockingIssues: false,
        lowConfidence: 0,
        unknownEmployees: 0,
        unknownAreas: 0,
        duplicates: [],
      },
    } satisfies BoardAnalysisResult)),
    progress = vi.fn();

    const report = await runOCRBenchmark([fixture()], progress, analyze);

    expect(report.aggregate.truePositives).toBe(1);
    expect(report.photos[0].status).toBe('processed');
    expect(progress).toHaveBeenLastCalledWith(1, 1, 'shift-a.jpg');
  });

  it('records unusable photos as missed labels and propagates other failures', async () => {
    const unusable: AnalyzeBoardPhotoFn = async () => {
      throw new UnusableImageError({ blurScore: 0, contrastScore: 0.2, brightnessScore: 0.6, usable: false });
    };
    const report = await runOCRBenchmark([fixture()], undefined, unusable);
    expect(report.photos[0].status).toBe('unusable');
    expect(report.aggregate.missed).toBe(1);

    const failed: AnalyzeBoardPhotoFn = async () => { throw new Error('OCR worker failed'); };
    await expect(runOCRBenchmark([fixture()], undefined, failed)).rejects.toThrow('OCR worker failed');
  });
});