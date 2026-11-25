import {readGames, rankPlayers} from './scoring.mjs';
const FEED = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQclPBYI2T6mWIGTPUXEU3OMnBlf6a6bP6arGj3SlnG29Tj27YlhMvIj4tTc1jvorSGS0095vXay12o/pub?gid=1775395327&single=true&output=csv';
const $ = id => document.getElementById(id);
const examples = [
  ['Knightshift','Maple Rook','Win'], ['Bishop Bee','Quiet Pawn','Draw'],
  ['Maple Rook','Bishop Bee','Win'], ['Knightshift','Quiet Pawn','Win'],
  ['Castle Cat','Maple Rook','Draw'], ['Quiet Pawn','Castle Cat','Win'],
  ['Knightshift','Bishop Bee','Draw'], ['Knightshift','Castle Cat','Win']
].map(([a,b,result]) => ({a,b,result,time:'Sample game'}));
const palette=['#dbe8d5','#e7dfcf','#e4e4ed','#dbe7e7','#f0e0d0','#e8dfe1'];
let games = [], ready = false, online = false, busy = false, showSamples = true;
let view = location.hash === '#games' ? 'games' : 'standings';
function cell(tr, value, cls) {
  const td = tr.insertCell();
  if (cls) td.className = cls;
  if (value instanceof Node) td.append(value); else td.textContent = value;
}
function playerLabel(name) {
  const wrapper = document.createElement('span'); wrapper.className = 'player';
  const avatar = document.createElement('span');avatar.className='avatar';avatar.ariaHidden='true';
  avatar.textContent = name.split(/\s+/).slice(0,2).map(v => [...v][0]).join('').toUpperCase();
  avatar.style.setProperty('--av', palette[[...name].reduce((n,c) => n+c.codePointAt(0),0) % palette.length]);
  wrapper.append(avatar, document.createTextNode(name));
  return wrapper;
}
function dateLabel(value) {
  if (/^\d{5}(?:\.\d+)?$/.test(value)) {
    const date = new Date(Date.UTC(1899,11,30) + Number(value)*86400000);
    return date.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
  }
  return value;
}
function render() {
  const log = view === 'games';
  const sample = ready && !games.length && showSamples && !log;
  const display = sample ? examples : games;
  const players = rankPlayers(display);
  $('status').textContent = online ? 'Live feed' : busy ? 'Connecting' : 'Feed offline';
  $('status').classList.toggle('live', online);
  $('section-info').textContent = log ? 'Finished games, newest report first.' : 'Players ranked by total ladder points.';
  $('refresh').disabled = busy;
  $('refresh').setAttribute('aria-label', log ? 'Refresh game log' : 'Refresh standings');
  $('player-count').textContent = ready ? rankPlayers(games).length : '—';
  $('game-count').textContent = ready ? games.length : '—';
  $('section-title').textContent = log ? 'Game log' : 'Standings';
  document.querySelector('.card-head .section-label').lastChild.textContent = log ? ' CLUB GAMES' : ' CLUB RANKINGS';
  $('section-info').textContent = log ? 'Game reports, newest first.' : 'Players ranked by total ladder points.';
  $('status').textContent = busy && !ready ? 'Connecting' : online ? 'Live feed' : 'Feed offline';
  $('status').classList.toggle('live',online);
  $('refresh').disabled = busy;
  $('scores').hidden = log; $('games-table').hidden = !log;
  const note = [!online && ready ? 'Showing the last successful update.' : '', sample ? 'Sample standings · The club ladder starts with the first reported game.' : ''].filter(Boolean).join(' ');
  $('notice').textContent=note; $('notice').hidden=!note;
  const query = $('search').value.trim().toLowerCase();
  const tbody = (log ? $('games-table') : $('scores')).tBodies[0];
  tbody.replaceChildren();
  if (log) {
    for (const game of [...games].reverse().filter(g => [g.a,g.b].some(n => n.toLowerCase().includes(query)))) {
      const tr = tbody.insertRow(); cell(tr,game.a+' vs '+game.b);
      cell(tr,game.result === 'Draw' ? 'Draw' : (game.result === 'Win' ? game.a : game.b)+' won');
      cell(tr,dateLabel(game.time));
    }
  } else {
    for (const p of players.filter(p => p.name.toLowerCase().includes(query))) {
      const tr = tbody.insertRow();
      const rank = document.createElement('span');rank.className='rank '+(['gold','silver','bronze'][p.rank-1] || '');rank.textContent=p.rank;
      cell(tr,rank);cell(tr,playerLabel(p.name));cell(tr,p.played,'played');cell(tr,p.wins,'record');cell(tr,p.draws,'record');cell(tr,p.losses,'record');cell(tr,p.points,'points-value');
    }
  }
  $('empty').hidden = Boolean(tbody.rows.length);
  $('empty').textContent = !ready ? (busy ? 'Checking the game feed…' : 'The feed could not be loaded. Use refresh to try again.') : query ? 'No matching players. Try another nickname.' : log ? 'The first reported game will appear here.' : 'Report the first game to start the club ladder.';
  $('sample').hidden = log || !ready || !!games.length;
  $('sample').textContent = showSamples ? 'Hide sample' : 'View sample ladder';
  $('table-meta').textContent = !ready ? 'Checking for game reports' : sample ? 'Example ladder · '+players.length+' players' : log ? games.length+' reported '+(games.length===1?'game':'games') : players.length+' ranked '+(players.length===1?'player':'players');
  document.querySelectorAll('[data-view]').forEach(a => {a.classList.toggle('active',a.dataset.view===view); if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
async function refresh() {
  if (busy) return;
  busy=true;render();
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch(FEED+'&v='+Math.floor(Date.now()/15000),{cache:'no-store',credentials:'omit',signal:controller.signal});
    if (!response.ok) throw new Error('Feed unavailable');
    games=readGames(await response.text()); ready=true;online=true;
  } catch { online=false; }
  finally {clearTimeout(timer);busy=false;render();}
}
function applyView() {
  if (['#standings','#games','#top',''].includes(location.hash)) {
    view=location.hash==='#games'?'games':'standings';
    $('search').value='';render();
    if (view==='games') $('standings').scrollIntoView({block:'start'});
  }
}
window.addEventListener('hashchange',applyView);
document.querySelector('[href="#games"]').addEventListener('click',()=>{if(location.hash==='#games')$('standings').scrollIntoView();});
$('search').addEventListener('input',render);$('refresh').addEventListener('click',refresh);
$('sample').addEventListener('click',()=>{showSamples=!showSamples;render();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();setInterval(()=>{if(!document.hidden)refresh();},15000);
