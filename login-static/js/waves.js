(() => {
  'use strict';

  const canvas = document.getElementById('waves-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) return;

  const root = document.documentElement;
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');

  let width = 0;
  let height = 0;
  let dpr = 1;
  let animationFrame = 0;
  let resizeFrame = 0;
  let running = document.visibilityState === 'visible';
  let colors = { primary: [37, 99, 235], secondary: [34, 197, 94] };

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    active: false,
    strength: 0,
    targetStrength: 0
  };

  function parseRgbVariable(name, fallback) {
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    const values = raw.split(',').map((part) => Number(part.trim()));
    return values.length === 3 && values.every(Number.isFinite) ? values : fallback;
  }

  function refreshColors() {
    colors = {
      primary: parseRgbVariable('--primary-rgb', [37, 99, 235]),
      secondary: parseRgbVariable('--secondary-rgb', [34, 197, 94])
    };
  }

  function resizeCanvas() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function scheduleResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(resizeCanvas);
  }

  function mixColor(a, b, t, alpha) {
    const clamped = Math.min(1, Math.max(0, t));
    const r = Math.round(a[0] + (b[0] - a[0]) * clamped);
    const g = Math.round(a[1] + (b[1] - a[1]) * clamped);
    const blue = Math.round(a[2] + (b[2] - a[2]) * clamped);
    return `rgba(${r}, ${g}, ${blue}, ${alpha})`;
  }

  function drawWaveBundle(time, options) {
    const {
      lineCount,
      centerY,
      amplitude,
      frequency,
      phase,
      spread,
      thickness,
      alpha,
      direction,
      cursorInfluence
    } = options;

    const stepX = width < 600 ? 18 : 14;
    const reduced = reducedMotionQuery.matches;
    const timeScale = reduced ? 0.08 : 1;
    const t = time * 0.001 * timeScale;

    for (let line = 0; line < lineCount; line += 1) {
      const normalizedLine = line / Math.max(1, lineCount - 1);
      const offset = (normalizedLine - 0.5) * spread;
      const colorBlend = direction > 0 ? normalizedLine : 1 - normalizedLine;

      ctx.beginPath();
      ctx.strokeStyle = mixColor(colors.primary, colors.secondary, colorBlend, alpha);
      ctx.lineWidth = thickness;

      let firstPoint = true;
      for (let x = -stepX; x <= width + stepX; x += stepX) {
        const nx = x / Math.max(1, width);
        const waveA = Math.sin((nx * frequency + t * 0.38 * direction + phase) * Math.PI * 2);
        const waveB = Math.sin((nx * (frequency * 0.54) - t * 0.21 + phase * 1.7) * Math.PI * 2) * 0.42;
        const waveC = Math.cos((nx * 1.35 + t * 0.11 + normalizedLine) * Math.PI * 2) * 0.16;

        let y = centerY + offset + (waveA + waveB + waveC) * amplitude;

        if (cursorInfluence && pointer.strength > 0.001) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distanceSq = dx * dx + dy * dy;
          const radius = Math.min(width, height) * 0.31;
          const radiusSq = radius * radius;

          if (distanceSq < radiusSq) {
            const distance = Math.sqrt(distanceSq) || 1;
            const falloff = 1 - distance / radius;
            const displacement = falloff * falloff * pointer.strength * 24;
            y += (dy / distance) * displacement + Math.sin(dx * 0.014 + t * 2.2) * displacement * 0.12;
          }
        }

        if (firstPoint) {
          ctx.moveTo(x, y);
          firstPoint = false;
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    }
  }

  function draw(time) {
    if (!running) return;

    pointer.x += (pointer.targetX - pointer.x) * 0.055;
    pointer.y += (pointer.targetY - pointer.y) * 0.055;
    pointer.strength += (pointer.targetStrength - pointer.strength) * 0.05;

    ctx.clearRect(0, 0, width, height);

    const baseLines = reducedMotionQuery.matches
      ? 16
      : width < 480
        ? 26
        : width < 1024
          ? 38
          : 52;

    drawWaveBundle(time, {
      lineCount: baseLines,
      centerY: height * 0.67,
      amplitude: Math.min(115, height * 0.15),
      frequency: 1.1,
      phase: 0.04,
      spread: Math.min(390, height * 0.46),
      thickness: 0.82,
      alpha: root.dataset.theme === 'dark' ? 0.31 : 0.22,
      direction: 1,
      cursorInfluence: true
    });

    drawWaveBundle(time + 1900, {
      lineCount: Math.max(12, Math.round(baseLines * 0.72)),
      centerY: height * 0.34,
      amplitude: Math.min(96, height * 0.12),
      frequency: 0.86,
      phase: 0.31,
      spread: Math.min(260, height * 0.35),
      thickness: 0.72,
      alpha: root.dataset.theme === 'dark' ? 0.22 : 0.16,
      direction: -1,
      cursorInfluence: true
    });

    animationFrame = requestAnimationFrame(draw);
  }

  function start() {
    if (running && animationFrame) return;
    running = true;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(draw);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function onPointerMove(event) {
    if (!finePointerQuery.matches || reducedMotionQuery.matches) return;
    pointer.targetX = event.clientX;
    pointer.targetY = event.clientY;
    pointer.active = true;
    pointer.targetStrength = 1;
  }

  function onPointerLeave() {
    pointer.active = false;
    pointer.targetStrength = 0;
    pointer.targetX = width * 0.5;
    pointer.targetY = height * 0.5;
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      start();
    } else {
      stop();
    }
  }

  refreshColors();
  resizeCanvas();
  pointer.x = pointer.targetX = width * 0.5;
  pointer.y = pointer.targetY = height * 0.5;

  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('mouseleave', onPointerLeave, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('themechange', refreshColors);

  reducedMotionQuery.addEventListener?.('change', () => {
    pointer.targetStrength = 0;
  });

  if (running) {
    animationFrame = requestAnimationFrame(draw);
  }
})();
