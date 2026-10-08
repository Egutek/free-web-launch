export type Area = string;

export interface ImageQuality {
  blurScore: number;
  contrastScore: number;
  brightnessScore: number;
  usable: boolean;
}

export const AREA_ORDER: Area[] = [
  'TRANSPORT',
  'OUTBOUND',
  'HOVS/ML',
  'VNA',
  'VNAS',
  'VNAC',
  'PUTAWAY',
  'VAS',
  'OBWI',
  'HAZMAT',
  'OBWF',
  'UNKNOWN',
];

export type Detection = {
  raw: string;
  matched?: string;
  area: Area;
  confidence: number;
  warning?: string;
  ocrConfidence?: number;
  matchConfidence?: number;
  areaConfidence?: number;
  rect?: Rect;
  passCount?: number;
  elapsedMs?: number;
};

export type Movement = {
  person: string;
  from: Area;
  to: Area;
  at: string;
};

export type Operator = {
  name: string;
  home: Area;
  start: Area;
  current: Area;
};

export type ProblemSolver = { name: string; area: 'TRANSPORT' | 'HOVS/ML' };

export type ShiftState = {
  startedAt: string;
  operators: Operator[];
  movements: Movement[];
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
};

export type AreaHeader = {
  area: Area;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
};

export type ReviewStatus = 'confirmed' | 'questionable' | 'blocked';

export type AssignedOperator = {
  name: string;
  area: Area;
  raw: string;
  confidence: number;
  matched?: string;
  reviewStatus: ReviewStatus;
  rect?: Rect;
  ocrConfidence?: number;
  matchConfidence?: number;
  areaConfidence?: number;
};

export type ReviewIssue = {
  type: 'low-confidence' | 'unknown-employee' | 'unknown-area' | 'duplicate' | 'blocked';
  message: string;
  count: number;
};

export type ReviewResult = {
  confirmed: number;
  questionable: number;
  blockingIssues: ReviewIssue[];
  hasBlockingIssues: boolean;
  lowConfidence: number;
  unknownEmployees: number;
  unknownAreas: number;
  duplicates: string[];
};

export type BoardAnalysisResult = {
  assignedOperators: AssignedOperator[];
  review: ReviewResult;
  shift?: ShiftState;
  detections?: Detection[];
  imageQuality?: ImageQuality;
  boardDetected?: boolean;
  imageUrl?: string;
  overlayUrl?: string;
  timingsMs?: {
    preprocess: number;
    ocr: number;
    analysis: number;
  };
};
