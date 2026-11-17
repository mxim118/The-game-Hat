// Игровая логика. Единственный источник истины — объект state.
// Модуль не знает про DOM: он только меняет state по правилам игры.
import { shuffle } from './utils.js';
import { turnInfo } from './teams.js';

export const TOTAL_ROUNDS = 3;

export const ROUNDS = {
  1: {
    name: 'Объяснение', short: 'Объясняйте словами',
    lead: 'Объясните слово своей команде любыми словами.',
    allow: ['Объяснять значение', 'Использовать синонимы', 'Описывать назначение предмета', 'Приводить примеры использования', 'Объяснять через ассоциации'],
    deny: ['Называть само слово и однокоренные', 'Называть перевод слова на другой язык', 'Подсказывать написание или буквы', 'Использовать жесты и показывать предметы вокруг'],
  },
  2: {
    name: 'Крокодил', short: 'Только жесты и мимика',
    lead: 'Покажите слово жестами, движениями и мимикой.',
    allow: ['Использовать мимику', 'Изображать действия', 'Показывать форму и характеристики', 'Двигаться всем телом'],
    deny: ['Говорить, шептать, напевать', 'Издавать любые звуки', 'Произносить слова губами', 'Рисовать буквы или слова в воздухе', 'Использовать телефон и посторонние предметы'],
  },
  3: {
    name: 'Ассоциации', short: 'Одно слово-подсказка',
    lead: 'Скажите только ОДНО слово-подсказку и замолчите. Например, для слова «Море» — «Волны».',
    allow: ['Произнести одно слово-подсказку', 'Команда пробует отвечать сколько угодно раз'],
    deny: ['Добавлять второе слово, жесты или пояснения', 'Называть само слово и однокоренные', 'Называть перевод слова на другой язык'],
  },
};

/** Создаёт новое состояние игры. words — неизменяемая база; pool — рабочий пул раунда. */
export function createGame({ settings, teams, words }) {
  const state = {
    settings: { ...settings },
    teams: teams.map(t => ({ id: t.id, name: t.name, players: t.players.map(p => ({ ...p })), score: 0 })),
    words,
    pool: shuffle(words.map(w => w.id)),
    round: 1,
    startTeam: Math.floor(Math.random() * 2),
    turnCounter: 0,
    turn: null,
    roundScores: { 1: [0, 0], 2: [0, 0], 3: [0, 0] },
    stats: {},
    status: 'roundIntro', // roundIntro → handoff → playing → turnResult → handoff | roundResult | final
  };
  state.teams.forEach(t => t.players.forEach(p => { state.stats[p.id] = { words: 0, turns: 0, successTurns: 0 }; }));
  return state;
}

export const wordById = (s, id) => s.words.find(w => w.id === id);

/** После перезагрузки страницы незавершённый ход начинается заново с экрана передачи. */
export function normalize(s) {
  if (s.status === 'playing' || s.status === 'countdown') { s.status = 'handoff'; s.turn = null; }
  return s;
}

export function acceptIntro(s) {
  if (s.status !== 'roundIntro') return false;
  s.status = 'handoff';
  return true;
}

export function beginTurn(s) {
  if (s.status !== 'handoff') return false;
  const { teamIdx, player } = turnInfo(s);
  s.turn = { teamIdx, playerId: player.id, playerName: player.name, log: [], skipped: [], current: null };
  s.status = 'playing';
  pickWord(s);
  return true;
}

/**
 * Выбор следующего слова. Слово остаётся в пуле, пока не отгадано.
 * Пропущенные в этом ходу слова не показываются снова, пока есть другие;
 * текущее слово не повторяется подряд, если есть альтернатива.
 */
function pickWord(s) {
  const t = s.turn, prev = t.current;
  if (!s.pool.length) { t.current = null; return null; }
  let c = s.pool.filter(id => id !== prev && !t.skipped.includes(id));
  if (!c.length) { t.skipped = []; c = s.pool.filter(id => id !== prev); } // все остальные уже пропускались — идём по кругу
  if (!c.length) c = [...s.pool];                                          // в пуле осталось единственное слово
  t.current = c[Math.floor(Math.random() * c.length)];
  // журнал хода: все показанные слова и их статус (нужен для проверки слов после хода)
  if (!t.log.some(e => e.id === t.current)) t.log.push({ id: t.current, ok: false });
  return t.current;
}

export const guessedCount = t => t.log.filter(e => e.ok).length;

/**
 * Ручная правка статуса слова после хода (например, не успели нажать «Отгадано»).
 * Пересчитывает пул, очки команды, очки раунда и личную статистику.
 */
export function setWordStatus(s, id, ok) {
  if (s.status !== 'turnResult') return false;
  const t = s.turn, e = t.log.find(x => x.id === id);
  if (!e || e.ok === ok) return false;
  const before = guessedCount(t), d = ok ? 1 : -1, st = s.stats[t.playerId];
  e.ok = ok;
  const i = s.pool.indexOf(id);
  if (ok && i !== -1) s.pool.splice(i, 1);       // отгадано — слово уходит из пула
  if (!ok && i === -1) s.pool.push(id);          // не отгадано — слово возвращается в пул
  s.teams[t.teamIdx].score += d;
  s.roundScores[s.round][t.teamIdx] += d;
  st.words += d;
  const after = before + d;
  if (before === 0 && after > 0) st.successTurns++;
  if (before > 0 && after === 0) st.successTurns--;
  return true;
}

/** «Отгадано». Возвращает 'next' | 'roundDone' | null (действие отклонено). */
export function guess(s) {
  if (s.status !== 'playing' || s.turn.current == null) return null;
  const t = s.turn, id = t.current, idx = s.pool.indexOf(id);
  if (idx === -1) return null;
  s.pool.splice(idx, 1);
  t.log.find(e => e.id === id).ok = true;
  s.teams[t.teamIdx].score++;
  s.roundScores[s.round][t.teamIdx]++;
  s.stats[t.playerId].words++;
  if (!s.pool.length) { t.current = null; return 'roundDone'; }
  pickWord(s);
  return 'next';
}

/** «Пропустить»: слово остаётся в пуле, очки не снимаются. */
export function skip(s) {
  if (s.status !== 'playing' || s.turn.current == null) return false;
  s.turn.skipped.push(s.turn.current);
  pickWord(s);
  return true;
}

/** Завершение хода. Идемпотентно: повторный вызов ничего не меняет. */
export function endTurn(s) {
  if (s.status !== 'playing') return false;
  const st = s.stats[s.turn.playerId];
  st.turns++;
  if (guessedCount(s.turn)) st.successTurns++;
  s.turn.current = null;     // неотгаданное слово не терялось: оно всё это время было в пуле
  s.turnCounter++;           // следующий ход — следующая команда/игрок
  s.status = 'turnResult';
  return true;
}

/** Кнопка «Далее» на экране результатов хода. */
export function afterTurn(s) {
  if (s.status !== 'turnResult') return false;
  if (s.pool.length) s.status = 'handoff';
  else s.status = s.round >= TOTAL_ROUNDS ? 'final' : 'roundResult';
  return true;
}

/** Следующий раунд: пул пересоздаётся из неизменяемой базы. */
export function nextRound(s) {
  if (s.status !== 'roundResult' || s.pool.length || s.round >= TOTAL_ROUNDS) return false;
  s.round++;
  s.pool = shuffle(s.words.map(w => w.id));
  s.turn = null;
  s.status = 'roundIntro';
  return true;
}

/** 0 или 1 — победившая команда, -1 — ничья. */
export function winner(s) {
  const [a, b] = s.teams;
  return a.score === b.score ? -1 : a.score > b.score ? 0 : 1;
}
