// Вспомогательные функции общего назначения.
export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

/** Перемешивание Фишера–Йейтса. Возвращает новый массив, исходный не меняется. */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Склонение: plural(5, ['слово','слова','слов']) → 'слов'. */
export function plural(n, forms) {
  const m = Math.abs(n) % 100, d = m % 10;
  if (m > 10 && m < 20) return forms[2];
  if (d === 1) return forms[0];
  if (d >= 2 && d <= 4) return forms[1];
  return forms[2];
}
