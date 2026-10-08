import { describe, expect, it } from 'vitest';
import { renderAnalysisOverlay } from './overlay';

describe('analysis overlays', () => {
  it('renders diagnostics on a separate canvas', () => {
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 60;
    const context = source.getContext('2d');
    if (!context) throw new Error('Canvas unavailable in test environment');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, source.width, source.height);

    const overlayUrl = renderAnalysisOverlay(source, [], [
      {
        raw: 'NOVAK JAN',
        matched: 'NOVÁK JAN',
        area: 'TRANSPORT',
        confidence: 0.95,
        rect: { x: 10, y: 20, width: 40, height: 12, score: 0.9 },
      },
    ], true);

    expect(overlayUrl).toMatch(/^data:image\/png/);
    expect(context.getImageData(0, 0, 1, 1).data[0]).toBe(255);
  });
});