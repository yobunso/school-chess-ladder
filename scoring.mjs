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
export function rankPlayers(games) {
  const players = new Map();
  function award(name, outcome) {
    const id = key(name);
    const p = players.get(id) ?? {name, played:0, wins:0, draws:0, losses:0, points:0};
    p.played++;
    p[outcome]++;
    p.points += {wins:3, draws:2, losses:1}[outcome];
    players.set(id, p);
  }
  for (const {a,b,result} of games) {
    award(a, result === 'Win' ? 'wins' : result === 'Draw' ? 'draws' : 'losses');
    award(b, result === 'Win' ? 'losses' : result === 'Draw' ? 'draws' : 'wins');
  }
  const ordered = [...players.values()].sort((a,b) => b.points-a.points || a.name.localeCompare(b.name));
  ordered.forEach((p,i) => { p.rank = i && p.points === ordered[i-1].points ? ordered[i-1].rank : i+1; });
  return ordered;
}
