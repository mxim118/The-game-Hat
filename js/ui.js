// Отрисовка экранов. Модуль только строит разметку из переданных данных.
import { ROUNDS, TOTAL_ROUNDS, wordById, winner } from './game.js';
import { turnInfo } from './teams.js';
import { plural } from './utils.js';

const $ = s => document.querySelector(s);
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const err = e => (e ? `<div class="err">${esc(e)}</div>` : '');
const W = n => `${n} ${plural(n, ['слово', 'слова', 'слов'])}`;

export const DIFFS = [
  { id: 'easy', title: 'Простой', desc: 'Только простые слова из одного словаря.' },
  { id: 'medium', title: 'Средний', desc: 'Обычные слова. На каждые 10 слов — 1 знаменитость и 1–2 словосочетания.' },
  { id: 'hard', title: 'Сложный', desc: 'Трудные слова, знаменитости (1 на 10) и словосочетания (1–2 на 10).' },
  { id: 'very_hard', title: 'Очень сложный', desc: 'Только самые редкие и непростые слова.' },
];
export const diffTitle = id => DIFFS.find(d => d.id === id)?.title || id;

export function show(html, cls = '') {
  const a = $('#app');
  a.className = 'screen ' + cls;
  a.innerHTML = html;
  window.scrollTo(0, 0);
}
export function setChrome(inGame, muted) {
  $('#exitBtn').hidden = !inGame;
  $('#soundBtn').textContent = muted ? '🔇' : '🔊';
}
export function modal(html) { $('#modal').innerHTML = html ? `<div class="overlay"><div class="dialog">${html}</div></div>` : ''; }
export const confirmExit = () => modal(`<h2>Завершить игру?</h2><p>Вы действительно хотите завершить игру? Весь текущий прогресс будет потерян.</p>
  <button class="btn primary" data-action="cancel-modal">Продолжить игру</button><button class="btn danger" data-action="confirm-exit">Выйти</button>`);
export const alertModal = msg => modal(`<h2>Не удалось начать</h2><div class="err">${esc(msg)}</div><button class="btn primary" data-action="cancel-modal">Понятно</button>`);

const board = (s, cur = -1) => `<div class="board">${s.teams.map((t, i) =>
  `<div class="tcard t${i} ${i === cur ? 'cur' : ''}"><span>${esc(t.name)}</span><b>${t.score}</b></div>`).join('')}</div>`;
const pill = (s, i) => `<span class="pill t${i}">${esc(s.teams[i].name)}</span>`;
const stepper = (dec, inc, v) => `<div class="stepper"><button data-action="${dec}" aria-label="Меньше">−</button><output>${v}</output><button data-action="${inc}" aria-label="Больше">+</button></div>`;

// ---------- Главная и настройка ----------
export function home(saved) {
  const cont = saved ? `<button class="btn primary big" data-action="continue">Продолжить игру<small>Раунд ${saved.round} из 3 · счёт ${saved.teams[0].score}:${saved.teams[1].score}</small></button>` : '';
  return `<div class="hero"><div class="logo">🎩</div><h1>Шляпа</h1>
    <p class="lead">Три раунда с одними и теми же словами: объясняйте, показывайте, ассоциируйте.</p></div>
    <div class="actions">${cont}<button class="btn ${saved ? '' : 'primary big'}" data-action="new-game">Новая игра</button></div>`;
}

export function setup1(d) {
  return `<h1>Новая игра</h1>
  <section class="card"><h2>Сложность</h2><div class="diffs">${DIFFS.map(x =>
    `<button class="diff ${d.difficulty === x.id ? 'on' : ''}" data-action="diff" data-v="${x.id}"><b>${x.title}</b><small>${x.desc}</small></button>`).join('')}</div></section>
  <section class="card row"><div><h2>Слов в шляпе</h2><small>Кратно 10, от 10 до 200</small></div>${stepper('words-dec', 'words-inc', d.wordsCount)}</section>
  <section class="card"><h2>Время хода</h2><div class="chips">${[30, 45, 60, 90, 120].map(v =>
    `<button class="chip ${d.turnDuration === v ? 'on' : ''}" data-action="dur" data-v="${v}">${v} с</button>`).join('')}</div></section>
  <section class="card row"><div><h2>Игроков</h2><small>Чётное число, от 4 до 20</small></div>${stepper('pl-dec', 'pl-inc', d.playerCount)}</section>
  <section class="card"><h2>Имена игроков</h2><div class="names">${d.names.slice(0, d.playerCount).map((n, i) =>
    `<input class="input" data-name="${i}" maxlength="20" value="${esc(n)}" placeholder="Игрок ${i + 1}" autocomplete="off" aria-label="Имя игрока ${i + 1}">`).join('')}</div></section>
  ${err(d.error)}
  <div class="actions"><button class="btn primary" data-action="setup-next1" ${d.busy ? 'disabled' : ''}>${d.busy ? 'Проверяем словари…' : 'Далее'}</button><button class="btn ghost" data-action="to-home">Назад</button></div>`;
}

export function setup2(d) {
  return `<h1>Команды</h1>
  <p class="hint">Чтобы поменять игроков местами, нажмите на игрока из одной команды, а затем на игрока из другой.</p>
  <div class="teams2">${d.teams.map((t, ti) => `<section class="card tcol t${ti}">
    <input class="input teamname" data-teamname="${ti}" maxlength="20" value="${esc(t.name)}" aria-label="Название команды ${ti + 1}">
    <div class="plist">${t.players.map((p, pi) => `<button class="pchip t${ti} ${d.sel && d.sel.t === ti && d.sel.i === pi ? 'sel' : ''}" data-action="pick" data-t="${ti}" data-i="${pi}">${esc(p.name)}</button>`).join('')}</div>
  </section>`).join('')}</div>
  ${err(d.error)}
  <div class="actions"><button class="btn primary" data-action="setup-next2">Далее</button>
  <button class="btn" data-action="shuffle-teams">🔀 Перемешать случайно</button><button class="btn ghost" data-action="setup-back">Назад</button></div>`;
}

export function setup3(d) {
  const [a, b] = d.teams;
  return `<h1>Всё готово?</h1>
  <section class="card sumlist">
    <div><span>Игроков</span><b>${d.playerCount}</b></div>
    <div><span>Сложность</span><b>${diffTitle(d.difficulty)}</b></div>
    <div><span>Слов в шляпе</span><b>${d.wordsCount}</b></div>
    <div><span>Время хода</span><b>${d.turnDuration} с</b></div>
  </section>
  ${[a, b].map((t, i) => `<section class="card tcol t${i}"><h2>${esc(t.name)}</h2><div>${t.players.map(p => esc(p.name)).join(', ')}</div></section>`).join('')}
  ${err(d.error)}
  <div class="actions"><button class="btn primary big" data-action="start-game" ${d.busy ? 'disabled' : ''}>${d.busy ? 'Готовим слова…' : 'Начать игру'}</button><button class="btn ghost" data-action="setup-back">Назад</button></div>`;
}

// ---------- Игра ----------
export function roundIntro(s) {
  const r = ROUNDS[s.round], li = a => a.map(x => `<li>${x}</li>`).join('');
  return `<div class="badge">Раунд ${s.round} из ${TOTAL_ROUNDS}</div><h1>${r.name}</h1><p class="lead">${r.lead}</p>
  <div class="rules"><div class="card ok"><h3>Можно</h3><ul>${li(r.allow)}</ul></div><div class="card no"><h3>Нельзя</h3><ul>${li(r.deny)}</ul></div></div>
  <p class="hint">В шляпе ${W(s.words.length)} — те же, что и в прошлых раундах.</p>
  <div class="actions"><button class="btn primary" data-action="intro-ok">Понятно</button></div>`;
}

export function handoff(s) {
  const { teamIdx, player } = turnInfo(s);
  return `<div class="badge center">Раунд ${s.round} из ${TOTAL_ROUNDS} · ${ROUNDS[s.round].name}</div>
  <p class="lead center">Передайте телефон игроку: <b>${esc(player.name)}</b></p>
  <section class="card handcard t${teamIdx}"><small>Сейчас объясняет</small><div class="bigname">${esc(player.name)}</div>${pill(s, teamIdx)}
  <small>${ROUNDS[s.round].short} · осталось слов: ${s.pool.length}</small></section>
  ${board(s, teamIdx)}
  <div class="actions"><button class="btn primary big" data-action="begin">Начать</button></div>`;
}

export const countdown = (label, last) => show(`<div class="count ${last ? 'go' : ''}" key="${label}">${label}</div>`, 'play');

export function playing(s) {
  const t = s.turn, w = wordById(s, t.current);
  return `<div class="phead"><div><div class="mini">Раунд ${s.round} из ${TOTAL_ROUNDS} · ${ROUNDS[s.round].name} — ${ROUNDS[s.round].short.toLowerCase()}</div>
    <div><b>${esc(t.playerName)}</b>${pill(s, t.teamIdx)}</div></div><div class="timer" id="timer"><span id="tnum">${s.settings.turnDuration}</span></div></div>
  <div class="bar" id="tbarwrap"><i id="tbar"></i></div>
  <div class="wordwrap"><div class="word">${esc(w.text)}</div></div>
  ${board(s, t.teamIdx)}
  <div class="pactions"><button class="btn good" data-action="guess">Отгадано</button><button class="btn ghost" data-action="skip">Пропустить</button></div>`;
}

/** Обновляет только таймер (без перерисовки экрана). */
export function updateTimer(ms, total) {
  const sec = Math.ceil(ms / 1000), cls = sec <= 5 ? 'danger' : sec <= 10 ? 'warn' : '';
  const n = $('#tnum'), tm = $('#timer'), bar = $('#tbar'), bw = $('#tbarwrap');
  if (!n) return;
  n.textContent = sec;
  tm.className = 'timer ' + cls; bw.className = 'bar ' + cls;
  bar.style.width = (Math.max(0, ms) / total * 100) + '%';
}

export function turnResult(s) {
  const t = s.turn;
  return `<div class="badge center">Ход завершён</div>
  <section class="card handcard t${t.teamIdx}"><div class="bigname">${esc(t.playerName)}</div>${pill(s, t.teamIdx)}
  <div class="bignum">${t.guessed.length}</div><p>${plural(t.guessed.length, ['слово отгадано', 'слова отгадано', 'слов отгадано'])} за ход</p></section>
  ${board(s, t.teamIdx)}
  <div class="actions"><button class="btn primary" data-action="turn-next">Далее</button></div>`;
}

function roundTable(s) {
  const [a, b] = s.teams;
  let h = `<table class="tbl"><thead><tr><th></th><th class="t0">${esc(a.name)}</th><th class="t1">${esc(b.name)}</th></tr></thead><tbody>`;
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const shown = r <= s.round, sc = s.roundScores[r];
    h += `<tr class="${r === s.round ? 'cur' : ''}"><td>Раунд ${r}</td><td>${shown ? sc[0] : '—'}</td><td>${shown ? sc[1] : '—'}</td></tr>`;
  }
  return h + `<tr class="total"><td>Всего</td><td>${a.score}</td><td>${b.score}</td></tr></tbody></table>`;
}

export function roundResult(s) {
  const sc = s.roundScores[s.round];
  return `<div class="badge">Раунд ${s.round} завершён</div><h1>${ROUNDS[s.round].name}</h1>
  <p class="lead">Все слова отгаданы. Очки за раунд:</p>
  <div class="board">${s.teams.map((t, i) => `<div class="tcard t${i}"><span>${esc(t.name)}</span><b>+${sc[i]}</b></div>`).join('')}</div>
  <h2>Общий счёт</h2>${board(s)}${roundTable(s)}
  <div class="actions"><button class="btn primary" data-action="next-round">Следующий раунд</button></div>`;
}

export function final(s) {
  const w = winner(s), [a, b] = s.teams;
  const head = w === -1 ? `<div class="trophy">🤝</div><div class="winner">Ничья!</div>`
    : `<div class="trophy">🏆</div><div class="winner t${w}">Победила команда «${esc(s.teams[w].name)}»!</div>`;
  const pts = n => `${n} ${plural(n, ['очко', 'очка', 'очков'])}`;
  const rows = s.teams.map((t, i) => t.players.map(p => { const st = s.stats[p.id];
    return `<tr><td>${esc(p.name)} <small class="t${i}" style="color:var(--team)">${esc(t.name)}</small></td><td>${st.words}</td><td>${st.successTurns}/${st.turns}</td></tr>`; }).join('')).join('');
  return `${head}<p class="lead center">${esc(a.name)}: ${pts(a.score)} · ${esc(b.name)}: ${pts(b.score)}</p>
  ${roundTable(s)}
  <section class="card"><h2>Личная статистика</h2><table class="tbl"><thead><tr><th>Игрок</th><th>Слов</th><th>Удачных ходов</th></tr></thead><tbody>${rows}</tbody></table></section>
  <div class="actions"><button class="btn primary" data-action="replay">Сыграть ещё раз</button><button class="btn ghost" data-action="to-home">В главное меню</button></div>`;
}
