import { signal, Signal } from '@angular/core';

/**
 * Anima el conteo de un número desde 0 hasta `target` usando
 * requestAnimationFrame, sin depender de ninguna librería de animación
 * externa (Requirement 6.2). Si `durationMs` es 0 o negativo, muestra el
 * valor final de inmediato — usado cuando `prefers-reduced-motion` está
 * activo (Requirement 6.6).
 */
export function animateCount(target: number, durationMs: number): Signal<number> {
  const value = signal(0);
  if (durationMs <= 0) {
    value.set(target);
    return value.asReadonly();
  }

  const start = performance.now();
  function tick(now: number) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / durationMs, 1);
    value.set(Math.round(target * progress));
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }
  requestAnimationFrame(tick);

  return value.asReadonly();
}
