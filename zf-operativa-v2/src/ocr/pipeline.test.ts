import { describe, expect, it } from 'vitest';
import {
  assignOperatorToArea,
  assignOperatorToAreaWithConfidence,
  buildBoardAnalysis,
  buildReviewResult,
  type AssignedOperator,
} from './pipeline';
import type { AreaHeader, Rect } from '../types';

describe('pipeline assignment and review', () => {
  it('assigns a magnet to the nearest valid workplace column', () => {
    const headers: AreaHeader[] = [
      { area: 'TRANSPORT', x: 0, y: 0, width: 150, height: 100, centerX: 75 },
      { area: 'OUTBOUND', x: 150, y: 0, width: 150, height: 100, centerX: 225 },
      { area: 'VNA', x: 300, y: 0, width: 150, height: 100, centerX: 375 },
    ];

    const magnet: Rect = { x: 320, y: 20, width: 30, height: 30, score: 0.9 };

    expect(assignOperatorToArea(magnet, headers)).toBe('VNA');
    expect(assignOperatorToAreaWithConfidence(magnet, headers).confidence).toBeCloseTo(0.47, 2);
  });

  it('blocks review when low-confidence or unknown input exists', () => {
    const review = buildReviewResult(
      [
        { raw: 'X', area: 'TRANSPORT', confidence: 0.2, warning: 'low' },
        { raw: 'NEW OP', area: 'TRANSPORT', confidence: 0.95 },
        { raw: 'NOVAK JAN', area: 'UNKNOWN', confidence: 1, matched: 'NOVAK JAN' },
      ],
      ['NOVAK JAN']
    );

    expect(review.hasBlockingIssues).toBe(true);
    expect(review.blockingIssues.some((issue) => issue.type === 'low-confidence')).toBe(true);
    expect(review.blockingIssues.some((issue) => issue.type === 'unknown-area')).toBe(true);
  });

  it('creates a shift only when all assigned operators are valid', () => {
    const assignments: AssignedOperator[] = [
      { name: 'NOVÁK JAN', area: 'TRANSPORT', raw: 'NOVÁK JAN', confidence: 0.97, matched: 'NOVÁK JAN', reviewStatus: 'confirmed' },
      { name: 'SVOBODA PETR', area: 'OUTBOUND', raw: 'SVOBODA PETR', confidence: 0.96, matched: 'SVOBODA PETR', reviewStatus: 'confirmed' },
    ];

    const result = buildBoardAnalysis({ assignedOperators: assignments, review: buildReviewResult([], []) });

    expect(result.shift).toBeDefined();
    expect(result.shift?.operators).toHaveLength(2);
    expect(result.shift?.operators[0].current).toBe('TRANSPORT');
  });

  it('starts the shift with confirmed operators while keeping uncertain cases in review', () => {
    const result = buildBoardAnalysis({
      assignedOperators: [
        { name: 'NOVÁK JAN', area: 'TRANSPORT', raw: 'NOVAK JAN', confidence: 0.95, matched: 'NOVÁK JAN', reviewStatus: 'confirmed' },
        { name: 'SVOBODA PETR', area: 'OUTBOUND', raw: 'SVOBODA PETR', confidence: 0.55, matched: 'SVOBODA PETR', reviewStatus: 'questionable' },
      ],
      review: buildReviewResult([
        { raw: 'NOVAK JAN', matched: 'NOVÁK JAN', area: 'TRANSPORT', confidence: 0.95 },
        { raw: 'SVOBODA PETR', matched: 'SVOBODA PETR', area: 'OUTBOUND', confidence: 0.55, warning: 'low confidence' },
      ]),
    });

    expect(result.review.hasBlockingIssues).toBe(true);
    expect(result.shift?.operators.map((operator) => operator.name)).toEqual(['NOVÁK JAN']);
  });

  it('builds a complete board analysis with assigned operators and review summary', () => {
    const operators: AssignedOperator[] = [
      { name: 'NOVÁK JAN', area: 'TRANSPORT', raw: 'NOVAK JAN', confidence: 0.98, matched: 'NOVÁK JAN', reviewStatus: 'confirmed' },
      { name: 'SVOBODA PETR', area: 'OUTBOUND', raw: 'SVOBODA PETR', confidence: 0.80, matched: 'SVOBODA PETR', reviewStatus: 'questionable' },
    ];

    const result = buildBoardAnalysis({
      assignedOperators: operators,
      review: buildReviewResult(
        [
          { raw: 'NOVAK JAN', area: 'TRANSPORT', confidence: 0.98, matched: 'NOVÁK JAN' },
          { raw: 'SVOBODA PETR', area: 'OUTBOUND', confidence: 0.8, matched: 'SVOBODA PETR', warning: 'low' },
        ],
        []
      ),
    });

    expect(result.assignedOperators).toHaveLength(2);
    expect(result.review.confirmed).toBeGreaterThanOrEqual(1);
    expect(result.review.questionable).toBeGreaterThanOrEqual(1);
  });
});
