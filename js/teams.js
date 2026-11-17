import { shuffle } from './utils.js';

/** Случайно делит игроков на две равные команды. */
export function randomTeams(names, teamNames = []) {
  const mixed = shuffle(names.map((name, i) => ({ id: i + 1, name })));
  const half = mixed.length / 2;
  return [mixed.slice(0, half), mixed.slice(half)].map((players, i) => ({
    id: i + 1, name: teamNames[i] || `Команда ${i + 1}`, players, score: 0,
  }));
}

/** Меняет местами двух игроков из разных команд (размеры команд не меняются). */
export function swapPlayers(teams, a, b) {
  const tmp = teams[a.t].players[a.i];
  teams[a.t].players[a.i] = teams[b.t].players[b.i];
  teams[b.t].players[b.i] = tmp;
}

/** Возвращает текст ошибки или пустую строку. */
export function validateTeams(teams) {
  const [a, b] = teams;
  if (!a.name.trim() || !b.name.trim()) return 'Введите названия обеих команд.';
  if (a.name.trim().toLowerCase() === b.name.trim().toLowerCase()) return 'Названия команд должны различаться.';
  if (a.players.length !== b.players.length || a.players.length < 2) return 'Команды должны быть одинакового размера (минимум по 2 игрока).';
  return '';
}

/**
 * Определяет, чей сейчас ход. Порядок целиком вычисляется из счётчика ходов:
 * команды строго чередуются, игроки внутри команды идут по кругу.
 * Счётчик не сбрасывается между раундами — порядок сохраняется все три раунда.
 */
export function turnInfo(state) {
  const n = state.turnCounter;
  const teamIdx = (state.startTeam + n) % 2;
  const team = state.teams[teamIdx];
  const player = team.players[Math.floor(n / 2) % team.players.length];
  return { teamIdx, player, team };
}
