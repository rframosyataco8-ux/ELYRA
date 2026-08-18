import { useEffect, useRef } from 'react';
import { detectFaceMesh, initFaceMesh, MESH_EDGES } from '@/lib/faceMesh';

/**
 * Superpone malla facial real (MediaPipe) o esquema de respaldo.
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
  const readyRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void initFaceMesh().then((ok) => {
      if (!cancelled) readyRef.current = ok;
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let cancelled = false;
    let detector: FaceDetector | null = null;

    try {
      const FD = window.FaceDetector;
      if (typeof FD === 'function') {
        detector = new FD({ fastMode: true, maxDetectedFaces: 1 });
      }
    } catch {
      /* sin FaceDetector */
    }

    const drawFallback = async (
      ctx: CanvasRenderingContext2D,
      video: HTMLVideoElement,
      w: number,
      h: number,
    ) => {
      let bx = w * 0.2;
      let by = h * 0.1;
      let bw = w * 0.6;
      let bh = h * 0.75;
      let found = !detector;

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
          /* skip */
        }
      }

      if (!found) return;

      const pts: [number, number][] = [
        [0.5, 0.08],
        [0.2, 0.18],
        [0.8, 0.18],
        [0.12, 0.32],
        [0.28, 0.3],
        [0.5, 0.33],
        [0.72, 0.3],
        [0.88, 0.32],
        [0.22, 0.45],
        [0.5, 0.5],
        [0.78, 0.45],
        [0.32, 0.58],
        [0.5, 0.62],
        [0.68, 0.58],
        [0.18, 0.7],
        [0.5, 0.8],
        [0.82, 0.7],
        [0.28, 0.88],
        [0.5, 0.94],
        [0.72, 0.88],
      ].map(([nx, ny]) => [bx + nx * bw, by + ny * bh]);

      const edges: [number, number][] = [
        [0, 1], [0, 2], [1, 3], [2, 7], [3, 4], [4, 5], [5, 6], [6, 7],
        [4, 8], [6, 10], [5, 9], [8, 9], [9, 10], [8, 11], [9, 12], [10, 13],
        [11, 12], [12, 13], [11, 14], [12, 15], [13, 16], [14, 15], [15, 16],
        [14, 17], [15, 18], [16, 19], [17, 18], [18, 19], [1, 14], [2, 16],
      ];

      ctx.strokeStyle = 'rgba(56,189,248,0.5)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.46, bh * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();

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
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.fillStyle = 'rgba(224,242,254,0.95)';
        ctx.arc(x, y, 1.9, 0, Math.PI * 2);
        ctx.fill();
      }
    };

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
      ctx.save();
      if (mirrored) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }

      const mesh = readyRef.current ? await detectFaceMesh(video) : null;

      if (mesh?.landmarks?.length) {
        const pts = mesh.landmarks.map((p) => [p.x * w, p.y * h] as [number, number]);

        ctx.strokeStyle = 'rgba(125,211,252,0.55)';
        ctx.lineWidth = 0.9;
        for (const [a, b] of MESH_EDGES) {
          const p1 = pts[a];
          const p2 = pts[b];
          if (!p1 || !p2) continue;
          ctx.beginPath();
          ctx.moveTo(p1[0], p1[1]);
          ctx.lineTo(p2[0], p2[1]);
          ctx.stroke();
        }

        // Nodos clave más visibles
        const key = [1, 33, 263, 61, 291, 152, 10, 234, 454];
        for (const i of key) {
          const p = pts[i];
          if (!p) continue;
          ctx.beginPath();
          ctx.fillStyle = 'rgba(224,242,254,0.95)';
          ctx.arc(p[0], p[1], 2.1, 0, Math.PI * 2);
          ctx.fill();
        }

        // Óvalo guía desde box
        const { x, y, w: bw, h: bh } = mesh.boxNorm;
        ctx.strokeStyle = 'rgba(56,189,248,0.45)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.ellipse((x + bw / 2) * w, (y + bh / 2) * h, (bw * w) * 0.55, (bh * h) * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Línea de escaneo
        const t = (performance.now() % 2000) / 2000;
        const scanY = (y + bh * t) * h;
        const grad = ctx.createLinearGradient(x * w, scanY, (x + bw) * w, scanY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, 'rgba(125,211,252,0.85)');
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x * w + 4, scanY);
        ctx.lineTo((x + bw) * w - 4, scanY);
        ctx.stroke();
      } else {
        await drawFallback(ctx, video, w, h);
      }

      ctx.restore();
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
