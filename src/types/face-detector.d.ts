/** Tipos mínimos del Face Detection API (Chromium) — opcional en runtime. */

interface FaceDetectorOptions {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: Array<{ locations: Array<{ x: number; y: number }> }>;
}

declare class FaceDetector {
  constructor(options?: FaceDetectorOptions);
  detect(image: ImageBitmapSource): Promise<DetectedFace[]>;
}

interface Window {
  FaceDetector?: typeof FaceDetector;
}
