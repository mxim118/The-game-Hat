// Загрузка словарей и формирование базы слов.
import { shuffle, rand } from './utils.js';

// Какие файлы используются в каком режиме (по категориям слов).
const SOURCES = {
  easy:      { normal: ['easy'] },
  medium:    { normal: ['normal', 'normal2'], celebrity: ['celebrities'], collocation: ['collocations'] },
  hard:      { normal: ['hard'], celebrity: ['celebrities'], collocation: ['collocations'] },
  very_hard: { normal: ['very_hard'] },
};

const cache = {};
const norm = s => s.toLowerCase().replace(/ё/g, 'е');

/** Очистка: убираем BOM, пустые строки, лишние пробелы и дубликаты. */
export function cleanLines(text) {
  const seen = new Set(), out = [];
  for (const raw of text.split(/\r?\n/)) {
    const s = raw.replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const k = norm(s);
    if (seen.has(k)) continue;
    seen.add(k); out.push(s);
  }
  return out;
}

export async function loadDict(name) {
  if (cache[name]) return cache[name];
  const path = `resources/${name}.txt`;
  let res;
  try { res = await fetch(path, { cache: 'no-cache' }); }
  catch { throw new Error(`Не удалось прочитать файл ${path}. Проверьте, что игра запущена через HTTP-сервер.`); }
  if (!res.ok) throw new Error(res.status === 404 ? `Файл ${path} не найден.` : `Ошибка чтения файла ${path} (код ${res.status}).`);
  let text;
  try { text = await res.text(); } catch { throw new Error(`Ошибка чтения файла ${path}.`); }
  const list = cleanLines(text);
  if (!list.length) throw new Error(`Файл ${path} пуст или не содержит корректных строк.`);
  return (cache[name] = list);
}

/** Загружает все файлы выбранной сложности; собирает все ошибки в одно сообщение. */
export async function loadForDifficulty(difficulty) {
  const names = [...new Set(Object.values(SOURCES[difficulty]).flat())];
  const results = await Promise.allSettled(names.map(loadDict));
  const errors = results.filter(r => r.status === 'rejected').map(r => r.reason.message);
  if (errors.length) throw new Error(errors.join('\n'));
  return Object.fromEntries(names.map((n, i) => [n, results[i].value]));
}

/**
 * Формирует неизменяемую базу слов: на каждые 10 слов — 1 знаменитость
 * и 1–2 словосочетания (в режимах medium/hard), остальное — обычные слова.
 * Все слова уникальны, в том числе между разными словарями.
 */
export function buildWords(difficulty, count, dicts) {
  if (!Number.isInteger(count) || count < 10 || count % 10) throw new Error('Количество слов должно быть кратно 10 (минимум 10).');
  const src = SOURCES[difficulty];
  const groups = count / 10;
  const need = { celebrity: 0, collocation: 0, normal: 0 };
  if (src.celebrity) {
    need.celebrity = groups;
    for (let i = 0; i < groups; i++) need.collocation += rand(1, 2);
  }
  need.normal = count - need.celebrity - need.collocation;

  const used = new Set(), words = [];
  for (const cat of ['celebrity', 'collocation', 'normal']) {
    if (!need[cat]) continue;
    const pool = shuffle(src[cat].flatMap(n => dicts[n]));
    const picked = [];
    for (const text of pool) {
      if (picked.length === need[cat]) break;
      const k = norm(text);
      if (used.has(k)) continue;          // слово уже есть в базе (в т.ч. из другого словаря)
      used.add(k); picked.push(text);
    }
    if (picked.length < need[cat]) {
      const files = src[cat].map(n => `${n}.txt`).join(' + ');
      throw new Error(`Недостаточно слов в словаре ${files}: нужно ${need[cat]}, доступно ${picked.length}. Уменьшите количество слов.`);
    }
    words.push(...picked.map(text => ({ text, category: cat })));
  }
  return shuffle(words).map((w, i) => ({ id: i + 1, ...w }));
}
