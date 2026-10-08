# OCR Reliability Handover

## 1. Changed areas

- `src/lib/imageQuality.ts`, `src/lib/image.ts`, `src/lib/vision.ts`: image scoring, preprocessing, ROI filtering, and a separate visual overlay.
- `src/lib/ocrWorker.ts`, `src/lib/magnetOcr.ts`, `src/lib/ocr.ts`, `src/ocr/magnetOcr.ts`: shared OCR worker and consolidated ROI OCR.
- `src/lib/confidence.ts`, `src/lib/validation.ts`, `src/lib/board.ts`, `src/ocr/pipeline.ts`, `src/types.ts`: confidence composition, centralized review policy, area scoring, and analysis diagnostics.
- `src/App.tsx`, `src/main.tsx`, `src/style.css`, `src/ocr/overlay.ts`: pipeline-driven review and debug UI.
- `src/lib/storage.ts`, `src/lib/shifts.ts`: validated persistence, legacy-key migration, and duplicate-safe review additions.
- `src/ocr/benchmark.ts`, `src/ocr/benchmarkRunner.ts`, `benchmark/README.md`: golden-label scoring and sequential photo runner.

## 2. Refactors completed

- Replaced per-call Tesseract worker creation with a typed, language-keyed shared worker registry.
- Made the main app use the ROI pipeline instead of bypassing it with board-level OCR.
- Removed duplicate ROI OCR implementation and moved generic confidence math into the library layer.
- Centralized review qualification so the pipeline, shift gate, and UI use the same rules.
- Replaced the connected-component detector's per-component point allocations with typed-array storage.
- Removed unsafe confidence/geometry casts from production validation and metrics paths.
- Validated persisted shift data at runtime and migrated the former `shift` key.

## 3. OCR improvements

- Added image quality output for blur, contrast, and brightness; unusable images stop before OCR.
- Added percentile grayscale normalization, median noise reduction, and integral-image adaptive thresholding.
- Kept OCR pixels separate from debug overlay pixels.
- Added geometric size/aspect/density filtering before magnet ROI OCR.
- Low-confidence ROIs get one adaptive-threshold pass. Agreement combines confidence; disagreement is penalized and routed to review.
- Confidence now combines OCR recognition, employee match, and area placement scores.
- Added preprocessing/OCR/total timing and pass count diagnostics.
- Confirmed operators can start a partial shift; only uncertain detections enter manual review. Unknown workplaces require an explicit selection.

## 4. Benchmark improvements

- Added per-photo scoring and aggregate JSON reports for precision, recall, F1, false positives, misses, and area accuracy.
- Accuracy and false-positive rate are `null` unless manually labeled negative-candidate counts are provided; the scorer rejects inconsistent denominators.
- Added a sequential benchmark runner that reports progress and counts rejected-quality photos as misses.
- No real board photos or golden labels are present in this workspace, so no real-world accuracy result is claimed.

## 5. Remaining risks

- Quality and confidence thresholds are heuristic and have not been calibrated on the actual board/camera population.
- Area boundaries still use evenly spaced columns when explicit headers are unavailable; true header localization and homography remain unverified.
- The browser OCR worker remains memory-resident until explicitly terminated; long-lived sessions need lifecycle testing on target devices.
- FPR/accuracy remain unavailable until benchmark labels include negative candidate counts.
- The current test suite validates algorithmic contracts, not field accuracy or mobile-device performance.

## 6. Recommended next milestone

Collect a privacy-reviewed, representative set of real board photos with manually verified employee/area labels and negative-candidate counts. Run the benchmark unchanged, review overlays for missed/false regions, then tune quality thresholds, magnet geometry, and area boundaries against a held-out set.

## Verification

- `npm test -- --run`: 15 files, 65 tests passed.
- `npm run build`: TypeScript and production Vite build passed.