import { useEffect, useRef } from 'react';

/**
 * Malla tipo landmarks en vivo sobre el vídeo.
 * FaceDetector (Chromium/Electron) + esquema facial de referencia.
 */
export function FaceMeshOverlay({
  videoRef,
  active = true,
  mirrored = true,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  active?: boolean;
  mirrored?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let detector: any = null;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const FD = (window as any).FaceDetector;
      if (typeof FD === 'function') {
        detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
      }
    } catch {
      /* sin FaceDetector */
    }

    const draw = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const w = video.clientWidth;
      const h = video.clientHeight;
      if (w < 8 || h < 8) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      let bx = w * 0.2;
      let by = h * 0.1;
      let bw = w * 0.6;
      let bh = h * 0.75;
      let found = false;

      if (detector) {
        try {
          const faces = await detector.detect(video);
          if (faces?.length) {
            const b = faces[0].boundingBox;
            const sx = w / (video.videoWidth || w);
            const sy = h / (video.videoHeight || h);
            bx = b.x * sx;
            by = b.y * sy;
            bw = b.width * sx;
            bh = b.height * sy;
            found = true;
          }
        } catch {
          /* frame skip */
        }
      } else {
        found = true;
      }

      if (found) {
        const pts: [number, number][] = [
          [0.5, 0.08],
          [0.2, 0.18], [0.8, 0.18],
          [0.12, 0.32], [0.28, 0.3], [0.4, 0.32], [0.5, 0.33], [0.6, 0.32], [0.72, 0.3], [0.88, 0.32],
          [0.22, 0.45], [0.38, 0.48], [0.5, 0.5], [0.62, 0.48], [0.78, 0.45],
          [0.32, 0.58], [0.5, 0.62], [0.68, 0.58],
          [0.18, 0.7], [0.35, 0.76], [0.5, 0.8], [0.65, 0.76], [0.82, 0.7],
          [0.28, 0.88], [0.5, 0.94], [0.72, 0.88],
        ].map(([nx, ny]) => [bx + nx * bw, by + ny * bh]);

        const edges: [number, number][] = [
          [0, 1], [0, 2], [1, 3], [2, 9],
          [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
          [4, 10], [8, 14], [6, 12],
          [10, 11], [11, 12], [12, 13], [13, 14],
          [11, 15], [12, 16], [13, 17],
          [15, 16], [16, 17],
          [15, 19], [16, 20], [17, 21],
          [18, 19], [19, 20], [20, 21], [21, 22],
          [18, 23], [20, 24], [22, 25],
          [23, 24], [24, 25],
          [1, 18], [2, 22],
          [10, 18], [14, 22],
        ];

        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }

        // Óvalo guía
        ctx.strokeStyle = 'rgba(56,189,248,0.5)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.46, bh * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Aristas
        ctx.strokeStyle = 'rgba(125,211,252,0.72)';
        ctx.lineWidth = 1;
        for (const [a, bIdx] of edges) {
          const p1 = pts[a];
          const p2 = pts[bIdx];
          if (!p1 || !p2) continue;
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        }

        // Nodos
        for (const [x, y] of pts) {
          ctx.beginPath();
          ctx.fillStyle = 'rgba(224,242,254,0.95)';
          ctx.arc(x, y, 1.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.fillStyle = 'rgba(56,189,248,0.35)';
          ctx.arc(x, y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Línea de escaneo
        const t = (performance.now() % 2000) / 2000;
        const scanY = by + bh * t;
        const grad = ctx.createLinearGradient(bx, scanY, bx + bw, scanY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, 'rgba(125,211,252,0.9)');
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(bx + 6, scanY);
        ctx.lineTo(bx + bw - 6, scanY);
        ctx.stroke();

        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [videoRef, active, mirrored]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden
    />
  );
}
