import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  color: string;
  cross: boolean;
};

// mực nâu · đất nung · ghi chú lề
const BUNIK_COLORS = ["43,39,34", "194,96,63", "148,128,106"];

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    size: 1.1 + Math.random() * 2,
    phase: Math.random() * Math.PI * 2,
    color: BUNIK_COLORS[Math.floor(Math.random() * BUNIK_COLORS.length)],
    cross: Math.random() < 0.24,
  };
}

function createParticleInBand(width: number, minY: number, maxY: number): Particle {
  const p = createParticle(width, Math.max(1, maxY - minY));
  p.y += minY;
  return p;
}

export function PlayfulCursorField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canUseFinePointer =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    if (!canUseFinePointer) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pointer = { x: -9999, y: -9999, active: false };
    const particles: Particle[] = [];
    let rafId = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;

    const getWorldHeight = () =>
      Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        window.innerHeight,
      );

    const getVisibleBand = () => {
      const buffer = Math.max(240, viewportHeight * 0.5);
      const worldHeight = getWorldHeight();
      const minY = Math.max(0, window.scrollY - buffer);
      const maxY = Math.min(worldHeight, window.scrollY + viewportHeight + buffer);
      return { minY, maxY };
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      viewportWidth = window.innerWidth;
      viewportHeight = window.innerHeight;
      canvas.width = Math.floor(viewportWidth * dpr);
      canvas.height = Math.floor(viewportHeight * dpr);
      canvas.style.width = `${viewportWidth}px`;
      canvas.style.height = `${viewportHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const targetCount = Math.max(90, Math.floor((viewportWidth * viewportHeight) / 12000));
      const { minY, maxY } = getVisibleBand();
      if (particles.length < targetCount) {
        while (particles.length < targetCount) particles.push(createParticleInBand(viewportWidth, minY, maxY));
      } else if (particles.length > targetCount) {
        particles.length = targetCount;
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY + window.scrollY;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const tick = () => {
      const width = viewportWidth;
      const height = getWorldHeight();
      const scrollY = window.scrollY;
      const { minY, maxY } = getVisibleBand();

      ctx.clearRect(0, 0, viewportWidth, viewportHeight);

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        p.phase += 0.02;

        if (pointer.active) {
          const dx = pointer.x - p.x;
          const dy = pointer.y - p.y;
          const distSq = dx * dx + dy * dy;
          const influence = 190;
          const influenceSq = influence * influence;

          if (distSq < influenceSq && distSq > 0.1) {
            const dist = Math.sqrt(distSq);
            const force = (1 - dist / influence) * 0.06;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx += (Math.random() - 0.5) * 0.01;
        p.vy += (Math.random() - 0.5) * 0.01;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        if (p.y < minY || p.y > maxY) {
          const replacement = createParticleInBand(width, minY, maxY);
          p.x = replacement.x;
          p.y = replacement.y;
          p.vx = replacement.vx;
          p.vy = replacement.vy;
          p.size = replacement.size;
          p.phase = replacement.phase;
          p.color = replacement.color;
          p.cross = replacement.cross;
        }

        const screenY = p.y - scrollY;
        if (screenY < -10 || screenY > viewportHeight + 10) continue;

        const alpha = (0.16 + (Math.sin(p.phase) + 1) * 0.11).toFixed(3);
        ctx.strokeStyle = ctx.fillStyle = `rgba(${p.color},${alpha})`;
        if (p.cross) {
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, screenY);
          ctx.lineTo(p.x + p.size, screenY);
          ctx.moveTo(p.x, screenY - p.size);
          ctx.lineTo(p.x, screenY + p.size);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, screenY, p.size * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    resize();
    tick();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="playful-particle-layer" />;
}
