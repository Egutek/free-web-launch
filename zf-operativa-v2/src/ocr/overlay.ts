import type { AreaHeader, Detection } from '../types';

export function renderAnalysisOverlay(
  source: HTMLCanvasElement,
  areaHeaders: AreaHeader[],
  detections: Detection[],
  boardDetected: boolean
): string {
  const overlay = document.createElement('canvas');
  overlay.width = source.width;
  overlay.height = source.height;
  const context = overlay.getContext('2d');
  if (!context) throw new Error('Could not create analysis overlay context');

  context.drawImage(source, 0, 0);
  context.strokeStyle = boardDetected ? '#00a56a' : '#d28a00';
  context.lineWidth = Math.max(2, source.width / 900);
  context.strokeRect(0, 0, source.width, source.height);

  context.font = `${Math.max(12, source.width / 90)}px sans-serif`;
  context.textBaseline = 'top';
  for (const header of areaHeaders) {
    context.strokeStyle = '#2775a8';
    context.beginPath();
    context.moveTo(header.x, 0);
    context.lineTo(header.x, source.height);
    context.stroke();
    context.fillStyle = '#164766';
    context.fillText(header.area, header.x + 4, 4, Math.max(10, header.width - 8));
  }

  for (const detection of detections) {
    if (!detection.rect) continue;
    const confirmed = Boolean(detection.matched && !detection.warning && detection.confidence >= 0.8);
    context.strokeStyle = confirmed ? '#00a56a' : '#d28a00';
    context.strokeRect(detection.rect.x, detection.rect.y, detection.rect.width, detection.rect.height);
    context.fillStyle = confirmed ? '#006b43' : '#8a5700';
    context.fillText(detection.matched ?? detection.raw, detection.rect.x, Math.max(0, detection.rect.y - 18));
  }

  return overlay.toDataURL('image/png');
}