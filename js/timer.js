// Таймер хода: хранит время окончания (Date.now), а не считает тики,
// поэтому не «замирает» при сворачивании вкладки и не даёт лишнего времени.
export class Timer {
  constructor() { this.id = null; this.endAt = 0; this.running = false; this.onTick = null; this.onEnd = null; this._vis = () => this.tick(); }

  start(ms, onTick, onEnd) {
    this.stop();
    this.endAt = Date.now() + ms;
    this.onTick = onTick; this.onEnd = onEnd; this.running = true;
    this.id = setInterval(() => this.tick(), 100);
    document.addEventListener('visibilitychange', this._vis);
    this.tick();
  }

  left() { return this.running ? Math.max(0, this.endAt - Date.now()) : 0; }

  tick() {
    if (!this.running) return;
    const left = this.left();
    if (left > 0) { this.onTick?.(left); return; }
    const cb = this.onEnd;
    this.stop();            // сначала останавливаем — повторного завершения быть не может
    this.onTick?.(0);
    cb?.();
  }

  stop() {
    clearInterval(this.id);
    this.running = false;
    document.removeEventListener('visibilitychange', this._vis);
  }
}

/** Пошаговый показ (3, 2, 1, Начали!). Возвращает функцию отмены. */
export function runSteps(steps, ms, onStep, onDone) {
  let i = 0, id = null;
  const next = () => {
    if (i >= steps.length) { onDone(); return; }
    onStep(steps[i], i, steps.length);
    i++;
    id = setTimeout(next, ms);
  };
  next();
  return () => clearTimeout(id);
}
