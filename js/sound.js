// Звуки берутся из папки sounds/. Нет папки или файла — этот звук (или все звуки) просто не играют.
const FILES = {
  count: 'countdown',   // каждая цифра отсчёта 3, 2, 1
  go: 'start',          // «Начали!» — старт хода
  tick: 'tick',         // каждая из последних 10 секунд
  end: 'time-up',       // время хода вышло
  guess: 'guess',       // «Отгадано»
  skip: 'skip',         // «Пропустить»
  round: 'round-end',   // раунд завершён
  win: 'game-end',      // игра завершена
};
const EXT = 'mp3';

let muted = false;
const audios = {};
export const hooks = { change: null };   // вызывается, когда выяснилось, что файл недоступен

export const setMuted = m => { muted = m; };
export const isMuted = () => muted;
/** false, если ни одного звукового файла нет (тогда кнопку звука можно скрыть). */
export const soundAvailable = () => Object.keys(FILES).some(n => !audios[n]?.dead);

function get(name) {
  if (!audios[name]) {
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('error', () => { a.dead = true; hooks.change?.(); }, { once: true });
    a.src = `sounds/${FILES[name]}.${EXT}`;
    audios[name] = a;
  }
  return audios[name];
}

function play(name) {
  const a = get(name);
  if (muted || a.dead) return;
  try { a.currentTime = 0; const p = a.play(); p?.catch(() => {}); } catch { /* звук не критичен */ }
}

/** Мобильные браузеры разрешают звук только после первого касания — «разблокируем» все файлы. */
function unlock() {
  for (const a of Object.values(audios)) {
    if (a.dead) continue;
    a.muted = true;
    a.play().then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
  }
}

export function initSounds() {
  Object.keys(FILES).forEach(get);
  document.addEventListener('pointerdown', unlock, { once: true });
}

export const sfx = Object.fromEntries(Object.keys(FILES).map(n => [n, () => play(n)]));
