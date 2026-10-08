import { describe, expect, it } from 'vitest';
import { canStartShift, reviewStats } from './board';

describe('review gate', () => {
	it('starts a partial shift while leaving low-confidence detections in review', () => {
		const stats = reviewStats([
			{ raw: 'A', matched: 'A', area: 'TRANSPORT', confidence: 0.96 },
			{ raw: 'X', area: 'OUTBOUND', confidence: 0.4, warning: 'low' },
		], []);

		expect(stats.verified).toBe(1);
		expect(stats.uncertain).toBe(1);
		expect(canStartShift(stats)).toBe(true);
	});

	it('allows a fully verified board', () => {
		const stats = reviewStats([{ raw: 'A', matched: 'A', area: 'TRANSPORT', confidence: 1 }], []);
		expect(canStartShift(stats)).toBe(true);
	});

	it('does not promote unknown workplace assignments', () => {
		const stats = reviewStats([{ raw: 'A', matched: 'A', area: 'UNKNOWN', confidence: 1 }], []);
		expect(stats.unknownArea).toBe(1);
		expect(canStartShift(stats)).toBe(false);
	});

	it('keeps duplicate employee detections out of automatic confirmation', () => {
		const stats = reviewStats([
			{ raw: 'A', matched: 'A', area: 'TRANSPORT', confidence: 1 },
			{ raw: 'A', matched: 'A', area: 'OUTBOUND', confidence: 1 },
		], ['A']);

		expect(stats.verified).toBe(0);
		expect(stats.uncertain).toBe(2);
		expect(canStartShift(stats)).toBe(false);
	});
});
