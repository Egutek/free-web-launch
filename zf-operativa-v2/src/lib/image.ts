import { assessImageQuality, normalizeGrayscale } from './imageQuality';
import { cropQuadToCanvas, detectBoardQuad, detectMagnetRects, filterMagnetCandidates, type Rect } from './vision';
import type { ImageQuality } from '../types';

export type PreprocessResult = {
	url: string;
	overlayUrl: string;
	canvas: HTMLCanvasElement;
	boardDetected: boolean;
	magnets: Rect[];
	quality: ImageQuality;
	width: number;
	height: number;
};

export class UnusableImageError extends Error {
	constructor(readonly quality: ImageQuality, readonly previewUrl?: string, readonly overlayUrl?: string) {
		super('Fotografie má příliš nízkou kvalitu pro bezpečné OCR.');
		this.name = 'UnusableImageError';
	}
}

export async function preprocess(file: File): Promise<PreprocessResult> {
	const bitmap = await createImageBitmap(file);

	try {
		const maxDimension = 2400;
		const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
		const source = document.createElement('canvas');
		source.width = Math.max(1, Math.round(bitmap.width * scale));
		source.height = Math.max(1, Math.round(bitmap.height * scale));

		const sourceContext = source.getContext('2d', { willReadFrequently: true });
		if (!sourceContext) throw new Error('Could not create source image context');
		sourceContext.drawImage(bitmap, 0, 0, source.width, source.height);

		const boardQuad = detectBoardQuad(sourceContext.getImageData(0, 0, source.width, source.height));
		const board = boardQuad ? cropQuadToCanvas(source, boardQuad) : source;
		const boardContext = board.getContext('2d', { willReadFrequently: true });
		if (!boardContext) throw new Error('Could not create board image context');

		const originalPixels = boardContext.getImageData(0, 0, board.width, board.height);
		const quality = assessImageQuality(originalPixels);
		const normalizedPixels = normalizeGrayscale(originalPixels);
		for (let pixel = 0; pixel < normalizedPixels.length; pixel += 1) {
			const index = pixel * 4;
			const value = normalizedPixels[pixel];
			originalPixels.data[index] = value;
			originalPixels.data[index + 1] = value;
			originalPixels.data[index + 2] = value;
		}
		boardContext.putImageData(originalPixels, 0, 0);

		const magnets = filterMagnetCandidates(
			detectMagnetRects(boardContext.getImageData(0, 0, board.width, board.height)),
			Math.max(20, Math.round(Math.min(board.width, board.height) * 0.012)),
			0.45
		);
		const overlay = document.createElement('canvas');
		overlay.width = board.width;
		overlay.height = board.height;
		const overlayContext = overlay.getContext('2d');
		if (!overlayContext) throw new Error('Could not create overlay image context');
		overlayContext.drawImage(board, 0, 0);
		overlayContext.strokeStyle = '#24b36b';
		overlayContext.lineWidth = Math.max(2, board.width / 900);
		for (const rect of magnets) {
			overlayContext.strokeRect(rect.x, rect.y, rect.width, rect.height);
		}

		return {
			url: board.toDataURL('image/jpeg', 0.92),
			overlayUrl: overlay.toDataURL('image/jpeg', 0.92),
			canvas: board,
			boardDetected: Boolean(boardQuad),
			magnets,
			quality,
			width: board.width,
			height: board.height,
		};
	} finally {
		bitmap.close();
	}
}
