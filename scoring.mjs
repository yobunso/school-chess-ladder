export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if (char === '\n' && !quoted) { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += char;
  }
  if (quoted) throw new Error('Incomplete feed');
  if (row.length || field) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
const clean = s => String(s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ');
const key = s => clean(s).toLowerCase();
export function readGames(csv) {
  const [headers, ...rows] = parseCsv(csv);
  const expected = ['Timestamp', 'Your club nickname', 'Opponent’s club nickname', 'Your result'];
  const indices = expected.map(name => headers?.indexOf(name) ?? -1);
  if (indices.includes(-1)) throw new Error('Unexpected game columns');
  return rows.flatMap(row => {
    const [time, a, b, result] = indices.map(i => clean(row[i]));
    if (!time || !a || !b || key(a) === key(b) || !['Win','Draw','Loss'].includes(result)) return [];
    return [{time, a, b, result}];
  });
}
// A reproducible lottery ticket lets every browser replay the same ladder.
function tieTicket(id, firstReportTime) {
  let hash = 2166136261;
  for (const char of firstReportTime + '/' + id) {
    hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

const outcomes = {Win: ['wins', 'losses'], Draw: ['draws', 'draws'], Loss: ['losses', 'wins']};
const pointsFor = {wins: 3, draws: 2, losses: 1};

export function rankPlayers(games) {
  const players = new Map();
  const ladder = [];
  function playerFor(name, time) {
    const id = key(name);
    if (!players.has(id)) {
      const player = {name, played: 0, wins: 0, draws: 0, losses: 0, points: 0,
        rank: 0, ticket: tieTicket(id, time)};
      players.set(id, player);
      ladder.push(player);
    }
    return players.get(id);
  }
  function award(player, outcome, doublePoints) {
    player.played++;
    player[outcome]++;
    player.points += pointsFor[outcome] * (doublePoints ? 2 : 1);
  }
  for (const game of games) {
    const a = playerFor(game.a, game.time);
    const b = playerFor(game.b, game.time);
    // Rank zero means this player had no row before this report.
    const gap = a.rank && b.rank ? a.rank - b.rank : 0;
    const [aOutcome, bOutcome] = outcomes[game.result];
    award(a, aOutcome, gap >= 3);
    award(b, bOutcome, gap <= -3);
    ladder.sort((left, right) => right.points - left.points || left.ticket - right.ticket);
    ladder.forEach((player, index) => { player.rank = index + 1; });
  }
  return ladder;
}
