import type { Area, Detection } from '../types';
import { getOCRWorker } from './ocrWorker';
import { validate } from './validation';

const AREAS: Area[] = ['VNAS', 'VNAC', 'PUTAWAY', 'OUTBOUND', 'VAS', 'OBWI', 'HAZMAT', 'OBWF', 'HOVS/ML', 'TRANSPORT', 'VNA'];

export async function readBoard(
	url: string,
	roster: string[],
	progress: (percent: number) => void
): Promise<Detection[]> {
	const worker = await getOCRWorker('eng', (value, status) => {
		if (status === 'recognizing text') progress(Math.round(value * 100));
	});
	const result = await worker.recognize(url);
	const lines = result.data.text.split('\n').map((line) => line.trim()).filter(Boolean);
	let area: Area = 'UNKNOWN';
	const detections: Detection[] = [];

	for (const line of lines) {
		const normalizedLine = line.toUpperCase().replace(/\s/g, '');
		const detectedArea = AREAS.find((candidate) => normalizedLine.includes(candidate.replace('/', '')));
		if (detectedArea) {
			area = detectedArea;
			continue;
		}
		if (line.length >= 4 && /[A-Za-zÁČĎÉĚÍŇÓŘŠŤÚŮÝŽáčďéěíňóřšťúůýž]/.test(line)) {
			detections.push(validate(line, roster, (result.data.confidence ?? 0) / 100, area));
		}
	}

	return detections;
}
