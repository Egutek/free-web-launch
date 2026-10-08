import { UnusableImageError } from '../lib/image';
import { analyzeBoardPhoto, type AnalyzeBoardPhotoFn } from './pipeline';
import { createBenchmarkReport, type BenchmarkReport, type BenchmarkSample } from './benchmark';
import type { ExpectedAssignment } from './benchmark';

export type BenchmarkFixture = {
  photo: string;
  image: File;
  roster: string[];
  expected: ExpectedAssignment[];
  nonEmployeeCandidates?: number;
};

export type BenchmarkProgress = (completed: number, total: number, photo: string) => void;

export async function runOCRBenchmark(
  fixtures: BenchmarkFixture[],
  progress?: BenchmarkProgress,
  analyze: AnalyzeBoardPhotoFn = analyzeBoardPhoto
): Promise<BenchmarkReport> {
  const samples: BenchmarkSample[] = [];

  for (let index = 0; index < fixtures.length; index += 1) {
    const fixture = fixtures[index];
    try {
      const result = await analyze(fixture.image, fixture.roster, undefined, [], (current, total) => {
        progress?.(index + current / Math.max(1, total), fixtures.length, fixture.photo);
      });
      samples.push({
        photo: fixture.photo,
        expected: fixture.expected,
        detections: result.detections ?? [],
        nonEmployeeCandidates: fixture.nonEmployeeCandidates,
      });
    } catch (error) {
      if (!(error instanceof UnusableImageError)) throw error;
      samples.push({
        photo: fixture.photo,
        expected: fixture.expected,
        detections: [],
        nonEmployeeCandidates: fixture.nonEmployeeCandidates,
        status: 'unusable',
      });
    }
    progress?.(index + 1, fixtures.length, fixture.photo);
  }

  return createBenchmarkReport(samples);
}