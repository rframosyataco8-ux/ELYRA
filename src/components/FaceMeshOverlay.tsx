import { useEffect, useRef } from 'react';

/**
 * Superpone una malla tipo landmarks sobre el vídeo de la cámara.
 * Usa FaceDetector (Chromium) cuando existe; si no, región central.
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
      /* no FaceDetector */
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

      let bx = w * 0.22;
      let by = h * 0.12;
      let bw = w * 0.56;
      let bh = h * 0.72;
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
          /* ignore frame errors */
        }
      } else {
        found = true; // fallback región
      }

      if (found) {
        // Landmarks relativos al bounding box (esquema frontal tipo mesh de referencia)
        const pts: [number, number][] = [
          [0.5, 0.12], // frente
          [0.22, 0.22], [0.78, 0.22], // sienes
          [0.18, 0.38], [0.35, 0.36], [0.5, 0.38], [0.65, 0.36], [0.82, 0.38], // ojos
          [0.28, 0.48], [0.5, 0.52], [0.72, 0.48], // puente / mejillas
          [0.38, 0.62], [0.5, 0.65], [0.62, 0.62], // nariz
          [0.22, 0.72], [0.38, 0.78], [0.5, 0.82], [0.62, 0.78], [0.78, 0.72], // boca / mandíbula
          [0.3, 0.9], [0.5, 0.95], [0.7, 0.9], // mentón
        ].map(([nx, ny]) => [bx + nx * bw, by + ny * bh]);

        const edges: [number, number][] = [
          [0, 1], [0, 2], [1, 3], [2, 7],
          [3, 4], [4, 5], [5, 6], [6, 7],
          [4, 8], [6, 10], [5, 9],
          [8, 9], [9, 10],
          [8, 11], [9, 12], [10, 13],
          [11, 12], [12, 13],
          [11, 15], [12, 16], [13, 17],
          [14, 15], [15, 16], [16, 17], [17, 18],
          [14, 19], [16, 20], [18, 21],
          [19, 20], [20, 21],
          [1, 14], [2, 18],
        ];

        ctx.save();
        if (mirrored) {
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
        }

        // Óvalo guía
        ctx.strokeStyle = found ? 'rgba(56,189,248,0.55)' : 'rgba(56,189,248,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(bx + bw / 2, by + bh / 2, bw * 0.48, bh * 0.48, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Aristas
        ctx.strokeStyle = 'rgba(125,211,252,0.75)';
        ctx.lineWidth = 1.1;
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
          ctx.arc(x, y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Línea de barrido
        const t = (performance.now() % 2200) / 2200;
        const scanY = by + bh * t;
        const grad = ctx.createLinearGradient(bx, scanY, bx + bw, scanY);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(0.5, 'rgba(56,189,248,0.85)');
        grad.addColorStop(1, 'transparent');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx + 4, scanY);
        ctx.lineTo(bx + bw - 4, scanY);
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
