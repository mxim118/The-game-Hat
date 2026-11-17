// Сохранение настроек и прогресса игры в localStorage.
const K = { setup: 'hat.setup.v1', game: 'hat.game.v1', muted: 'hat.muted.v1' };

const read = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хранилище недоступно */ } };

export const saveSetup = s => write(K.setup, s);
export const loadSetup = () => read(K.setup);
export const saveMuted = m => write(K.muted, !!m);
export const loadMuted = () => read(K.muted) === true;
export const saveGame = s => write(K.game, s);
export const clearGame = () => { try { localStorage.removeItem(K.game); } catch { /* ignore */ } };

/** Загружает сохранённую игру и проверяет, что структура корректна. */
export function loadGame() {
  const g = read(K.game);
  const ok = g && Array.isArray(g.teams) && g.teams.length === 2 && Array.isArray(g.words) &&
    Array.isArray(g.pool) && g.settings && typeof g.status === 'string' && g.status !== 'final';
  return ok ? g : null;
}
