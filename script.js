const TIER_POINTS = { HT1:40, LT1:35, HT2:30, LT2:25, HT3:20, LT3:15, HT4:10, LT4:5, HT5:3, LT5:2 };
const rows = document.getElementById('leaderboardRows');
const modeSelect = document.getElementById('gamemode');
let players = [];
let lastSync = null;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function tierClass(tier) { return String(tier || '').toLowerCase(); }
function renderPlayers() {
  const mode = modeSelect.value;
  const filtered = players.filter(p => mode === 'All' || p.gamemode === mode)
    .sort((a,b) => b.points - a.points || a.username.localeCompare(b.username) || a.gamemode.localeCompare(b.gamemode));
  rows.innerHTML = filtered.length ? filtered.map((p,i) => `
    <tr>
      <td><span class="rank ${i<3 ? 'top-three' : ''}">#${String(i+1).padStart(2,'0')}</span></td>
      <td><div class="player-cell"><span class="avatar">${escapeHtml(p.username.slice(0,1).toUpperCase())}</span>${escapeHtml(p.username)}</div></td>
      <td><span class="mode-chip">${escapeHtml(p.gamemode)}</span></td>
      <td><span class="tier-pill ${tierClass(p.tier)}">${escapeHtml(p.tier)}</span></td>
      <td><span class="points">${Number(p.points).toLocaleString('en-US')}</span></td>
    </tr>`).join('') : `<tr><td colspan="5" class="empty-state">No verified Discord results${mode === 'All' ? '' : ` for ${escapeHtml(mode)}`} yet.</td></tr>`;
  document.getElementById('resultCount').textContent = `Showing ${filtered.length} verified entr${filtered.length === 1 ? 'y' : 'ies'}`;
  document.getElementById('playerCount').textContent = players.length.toLocaleString('en-US');
  document.getElementById('syncStatus').textContent = 'LIVE DATA';
  document.getElementById('lastUpdated').textContent = lastSync ? `Updated ${new Date(lastSync).toLocaleString()} ✦` : 'Synced from Discord ✦';
}
async function loadPlayers() {
  try {
    const response = await fetch('https://portal-tiers-backen.onrender.com', { cache: 'no-store' });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    players = Array.isArray(data.players) ? data.players : [];
    lastSync = data.updatedAt || null;
    renderPlayers();
  } catch (error) {
    document.getElementById('syncStatus').textContent = 'OFFLINE';
    rows.innerHTML = '<tr><td colspan="5" class="empty-state">Live rankings are unavailable. Please try again shortly.</td></tr>';
    document.getElementById('resultCount').textContent = 'Could not load verified results';
  }
}
modeSelect.addEventListener('change', renderPlayers);
loadPlayers();
// Server-sent events push updates as soon as Discord records a new result.
if ('EventSource' in window) {
  const events = new EventSource('/api/events');
  events.addEventListener('rankings', event => {
    try { const data = JSON.parse(event.data); players = data.players || []; lastSync = data.updatedAt || null; renderPlayers(); }
    catch { loadPlayers(); }
  });
  events.onerror = () => { /* EventSource retries automatically. */ };
}
// A light fallback refresh helps recover if the event stream is temporarily interrupted.
setInterval(loadPlayers, 60000);
const menuToggle = document.getElementById('menuToggle');
const navLinks = document.getElementById('navLinks');
menuToggle.addEventListener('click', () => { const open = navLinks.classList.toggle('open'); menuToggle.setAttribute('aria-expanded', String(open)); });
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { navLinks.classList.remove('open'); menuToggle.setAttribute('aria-expanded', 'false'); }));
