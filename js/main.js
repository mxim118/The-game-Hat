// Точка входа: связывает состояние, интерфейс, таймер и хранилище.
import * as G from './game.js';
import * as UI from './ui.js';
import * as S from './storage.js';
import { Timer, runSteps } from './timer.js';
import { randomTeams, swapPlayers, validateTeams } from './teams.js';
import { loadForDifficulty, buildWords } from './words.js';
import { sfx, setMuted, isMuted, soundAvailable, initSounds, hooks } from './sound.js';

let state = null;          // единый источник истины игры
let draft = null;          // черновик настройки (до начала игры)
let counting = false;      // идёт обратный отсчёт 3-2-1
let cancelCount = null;
let lockUntil = 0;         // защита от случайных двойных нажатий
const timer = new Timer();

const persist = () => { if (!state) return; state.status === 'final' ? S.clearGame() : S.saveGame(state); };
const guard = ms => { const n = Date.now(); if (n < lockUntil) return false; lockUntil = n + ms; return true; };
const chrome = () => UI.setChrome(!!state && state.status !== 'final', isMuted(), soundAvailable());

// ---------- Настройка ----------
function initDraft() {
  const s = S.loadSetup() || {};
  const pc = Number.isInteger(s.playerCount) && s.playerCount >= 4 && s.playerCount <= 20 && s.playerCount % 2 === 0 ? s.playerCount : 4;
  return {
    step: 1, error: '', busy: false, sel: null, teams: null,
    difficulty: UI.DIFFS.some(d => d.id === s.difficulty) ? s.difficulty : 'medium',
    wordsCount: Number.isInteger(s.wordsCount) && s.wordsCount >= 10 && s.wordsCount <= 200 && s.wordsCount % 10 === 0 ? s.wordsCount : 30,
    turnDuration: [30, 45, 60, 90, 120].includes(s.turnDuration) ? s.turnDuration : 60,
    playerCount: pc,
    names: Array.from({ length: 20 }, (_, i) => (s.names && s.names[i]) || `Игрок ${i + 1}`),
    teamNames: s.teamNames || ['Команда 1', 'Команда 2'],
  };
}

function renderSetup() {
  chrome();
  if (draft.step === 1) UI.show(UI.setup1(draft), '', 'setup1');
  else if (draft.step === 2) UI.show(UI.setup2(draft), '', 'setup2');
  else UI.show(UI.setup3(draft), '', 'setup3');
}

async function setup1Next() {
  const names = draft.names.slice(0, draft.playerCount).map(n => n.trim());
  if (names.some(n => !n)) return fail('Введите имя каждого участника.');
  if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return fail('Имена игроков не должны повторяться.');
  draft.names.splice(0, names.length, ...names);
  draft.busy = true; draft.error = ''; renderSetup();
  try { buildWords(draft.difficulty, draft.wordsCount, await loadForDifficulty(draft.difficulty)); } // пробная проверка словарей
  catch (e) { draft.busy = false; return fail(e.message); }
  draft.busy = false; draft.error = '';
  draft.teams = randomTeams(names, draft.teamNames); draft.sel = null; draft.step = 2;
  renderSetup();
}
function fail(msg) { draft.error = msg; renderSetup(); }

async function startGame() {
  if (draft.busy) return;
  draft.busy = true; draft.error = ''; renderSetup();
  try {
    const words = buildWords(draft.difficulty, draft.wordsCount, await loadForDifficulty(draft.difficulty));
    S.saveSetup({ difficulty: draft.difficulty, wordsCount: draft.wordsCount, turnDuration: draft.turnDuration, playerCount: draft.playerCount, names: draft.names, teamNames: draft.teams.map(t => t.name) });
    state = G.createGame({ settings: { difficulty: draft.difficulty, wordsCount: draft.wordsCount, turnDuration: draft.turnDuration }, teams: draft.teams, words });
    draft = null; persist(); render();
  } catch (e) { draft.busy = false; fail(e.message); }
}

async function replay() {
  if (!state || state.status !== 'final' || !guard(600)) return;
  try {
    const words = buildWords(state.settings.difficulty, state.settings.wordsCount, await loadForDifficulty(state.settings.difficulty));
    state = G.createGame({ settings: state.settings, teams: state.teams, words }); // команды и настройки сохраняются, слова — новые
    persist(); render();
  } catch (e) { UI.alertModal(e.message); }
}

// ---------- Отрисовка игры ----------
function render() {
  chrome();
  if (!state) return UI.show(UI.home(S.loadGame()), '', 'home');
  switch (state.status) {
    case 'roundIntro': return UI.show(UI.roundIntro(state), '', 'intro' + state.round);
    case 'handoff': return UI.show(UI.handoff(state), '', 'handoff' + state.turnCounter);
    case 'playing': {
      UI.show(UI.playing(state), 'play t' + state.turn.teamIdx, 'play');
      return UI.updateTimer(timer.left(), state.settings.turnDuration * 1000);
    }
    case 'turnResult': return UI.show(UI.turnResult(state), '', 'result' + state.turnCounter);
    case 'roundResult': return UI.show(UI.roundResult(state), '', 'roundres' + state.round);
    case 'final': return UI.show(UI.final(state), '', 'final');
  }
}

function startCountdown() {
  if (counting || state.status !== 'handoff') return;
  counting = true;
  cancelCount = runSteps(['3', '2', '1', 'Начали!'], 800, (label, i, n) => {
    UI.countdown(label, i === n - 1);
    document.getElementById('app').classList.add('t' + ((state.startTeam + state.turnCounter) % 2));
    i === n - 1 ? sfx.go() : sfx.count();
  }, () => {
    counting = false; cancelCount = null;
    if (!G.beginTurn(state)) return render();
    persist(); render(); startTimer();
  });
}

function startTimer() {
  const total = state.settings.turnDuration * 1000;
  let lastSec = null;
  timer.start(total, ms => {
    UI.updateTimer(ms, total);
    const sec = Math.ceil(ms / 1000);
    if (sec !== lastSec) { lastSec = sec; if (sec <= 10 && sec > 0) sfx.tick(); } // звук на последних секундах
  }, finishTurn);
}

/** Единая точка завершения хода (по таймеру, по последнему слову). Повторный вызов безопасен. */
function finishTurn() {
  if (!state || !G.endTurn(state)) return;
  timer.stop();
  if (state.pool.length) sfx.end();   // звук конца раунда играет при нажатии «Далее»
  persist(); render();
}

function leaveGame() {
  timer.stop(); cancelCount?.(); counting = false;
  S.clearGame(); state = null; draft = null; UI.modal('');
  render();
}

// ---------- События ----------
const A = {
  'new-game': () => { draft = initDraft(); renderSetup(); },
  'continue': () => { const g = S.loadGame(); if (!g) return render(); state = G.normalize(g); persist(); render(); },
  'to-home': () => { state = null; draft = null; render(); },
  'toggle-sound': () => { setMuted(!isMuted()); S.saveMuted(isMuted()); chrome(); },
  'exit': () => UI.confirmExit(),
  'cancel-modal': () => UI.modal(''),
  'confirm-exit': leaveGame,

  // настройка
  'diff': b => { draft.difficulty = b.dataset.v; draft.error = ''; renderSetup(); },
  'dur': b => { draft.turnDuration = +b.dataset.v; renderSetup(); },
  'words-dec': () => { draft.wordsCount = Math.max(10, draft.wordsCount - 10); draft.error = ''; renderSetup(); },
  'words-inc': () => { draft.wordsCount = Math.min(200, draft.wordsCount + 10); draft.error = ''; renderSetup(); },
  'pl-dec': () => { draft.playerCount = Math.max(4, draft.playerCount - 2); renderSetup(); },
  'pl-inc': () => { draft.playerCount = Math.min(20, draft.playerCount + 2); renderSetup(); },
  'setup-next1': () => { if (!draft.busy) setup1Next(); },
  'setup-back': () => { draft.step--; draft.error = ''; renderSetup(); },
  'shuffle-teams': () => { draft.teams = randomTeams(draft.names.slice(0, draft.playerCount), draft.teams.map(t => t.name)); draft.sel = null; renderSetup(); },
  'pick': b => {
    const p = { t: +b.dataset.t, i: +b.dataset.i };
    if (!draft.sel || draft.sel.t === p.t) draft.sel = draft.sel && draft.sel.t === p.t && draft.sel.i === p.i ? null : p;
    else { swapPlayers(draft.teams, draft.sel, p); draft.sel = null; }
    renderSetup();
  },
  'setup-next2': () => { const e = validateTeams(draft.teams); if (e) return fail(e); draft.teamNames = draft.teams.map(t => t.name.trim()); draft.teams.forEach((t, i) => { t.name = draft.teamNames[i]; }); draft.step = 3; draft.error = ''; renderSetup(); },
  'start-game': startGame,

  // игра
  'intro-ok': () => { if (state && G.acceptIntro(state)) { persist(); render(); } },
  'begin': () => { if (!state || state.status !== 'handoff' || counting) return; startCountdown(); },
  'guess': () => {
    if (!state || state.status !== 'playing' || !guard(250)) return;
    if (timer.left() <= 0) return finishTurn();       // время вышло одновременно с нажатием — очко не начисляется
    const r = G.guess(state);
    if (!r) return;
    sfx.guess(); persist();
    r === 'roundDone' ? finishTurn() : render();
  },
  'skip': () => {
    if (!state || state.status !== 'playing' || !guard(250)) return;
    if (timer.left() <= 0) return finishTurn();
    if (G.skip(state)) { sfx.skip(); persist(); render(); }
  },
  'turn-next': () => {
    if (!state || !G.afterTurn(state)) return;
    if (state.status === 'final') sfx.win(); else if (state.status === 'roundResult') sfx.round();
    persist(); render();
  },
  'review': () => { if (state && state.status === 'turnResult') UI.reviewModal(state); },
  'toggle-word': b => {
    if (!state || state.status !== 'turnResult') return;
    const e = state.turn.log.find(x => x.id === +b.dataset.id);
    if (e && G.setWordStatus(state, e.id, !e.ok)) { persist(); UI.reviewModal(state); render(); }
  },
  'close-review': () => UI.modal(''),
  'next-round': () => { if (state && G.nextRound(state)) { persist(); render(); } },
  'replay': replay,
};

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  A[b.dataset.action]?.(b);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (!draft) return;
  if (t.dataset.name !== undefined) draft.names[+t.dataset.name] = t.value;
  if (t.dataset.teamname !== undefined) { const i = +t.dataset.teamname; draft.teamNames[i] = t.value; if (draft.teams) draft.teams[i].name = t.value; }
});

// ---------- Запуск ----------
setMuted(S.loadMuted());
initSounds();
hooks.change = chrome;   // скрыть кнопку звука, если папки sounds/ нет
render();
