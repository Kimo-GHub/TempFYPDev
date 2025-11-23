// src/components/InteractiveBackground.jsx
import React, { useEffect, useRef } from "react";

const GRID_SPACING = 70;         // distance between dots
const BASE_RADIUS = 1.8;         // default dot size (bigger than before)
const ACTIVE_RADIUS = 6;         // size when near the cursor
const MAX_DIST = 180;            // range of interaction
const LINE_DIST = 130;           // max distance for connecting lines

const PALETTES = {
  admin: {
    bgInner: "rgba(209, 250, 229, 0.6)", // emerald-100-ish
    bgOuter: "rgba(255, 255, 255, 0)",
    dot: "rgba(22, 163, 74, ALPHA)",      // emerald-600
    line: "rgba(45, 212, 191, ALPHA)",    // teal-400
  },
  user: {
    bgInner: "rgba(224, 231, 255, 0.6)", // indigo-100-ish
    bgOuter: "rgba(255, 255, 255, 0)",
    dot: "rgba(99, 102, 241, ALPHA)",    // indigo-500
    line: "rgba(129, 140, 248, ALPHA)",  // indigo-400
  },
};

const paletteFromVariant = (variant) => {
  if (variant === "user") return PALETTES.user;
  return PALETTES.admin;
};

export default function InteractiveBackground({ variant = "admin" }) {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const palette = paletteFromVariant(variant);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let frameId;
    const resize = () => {
      canvas.width = window.innerWidth * window.devicePixelRatio;
      canvas.height = window.innerHeight * window.devicePixelRatio;
      ctx.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / GRID_SPACING);
      const rows = Math.ceil(height / GRID_SPACING);
      const mouse = mouseRef.current;

      // soft background gradient so the pattern pops more
      const g = ctx.createRadialGradient(
        width / 2,
        height / 3,
        0,
        width / 2,
        height / 2,
        Math.max(width, height)
      );
      g.addColorStop(0, palette.bgInner);
      g.addColorStop(1, palette.bgOuter);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);

      const points = [];

      // draw dots
      for (let y = 0; y <= rows; y++) {
        for (let x = 0; x <= cols; x++) {
          const px = x * GRID_SPACING + (y % 2 === 0 ? GRID_SPACING / 2 : 0); // slight offset pattern
          const py = y * GRID_SPACING;

          const dx = px - mouse.x;
          const dy = py - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let radius = BASE_RADIUS;
          let alpha = 0.35;

          if (dist < MAX_DIST) {
            const t = 1 - dist / MAX_DIST;
            radius = BASE_RADIUS + (ACTIVE_RADIUS - BASE_RADIUS) * t;
            alpha = 0.4 + 0.6 * t; // 0.4–1.0
          }

          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          // teal → emerald mix for more visible color
          ctx.fillStyle = palette.dot.replace("ALPHA", alpha.toFixed(3));
          ctx.fill();

          points.push({ x: px, y: py, alpha });
        }
      }

      // connecting lines between nearby points (subtle but visible)
      ctx.lineWidth = 1;
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > LINE_DIST) continue;

          const strength = 1 - d / LINE_DIST;
          const lineAlpha = 0.25 * strength; // stronger than before

          ctx.strokeStyle = palette.line.replace("ALPHA", lineAlpha.toFixed(3));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
