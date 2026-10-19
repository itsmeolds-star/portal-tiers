require('dotenv').config();
const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use(express.static(path.join(__dirname, 'public')));
const PORT = Number(process.env.PORT || 3000);
const TIER_POINTS = Object.freeze({ HT1:40, LT1:35, HT2:30, LT2:25, HT3:20, LT3:15, HT4:10, LT4:5, HT5:3, LT5:2 });
const required = ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_RESULTS_CHANNEL_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter(k => !process.env[k]);
const clients = new Set();
let lastUpdated = null;
let bot = null;

function dbHeaders(extra = {}) {
  return { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type':'application/json', ...extra };
}
async function supabase(pathname, options = {}) {
  const base = process.env.SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/rest/v1/${pathname}`, { ...options, headers: dbHeaders(options.headers || {}) });
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${body.slice(0, 400)}`);
  return body ? JSON.parse(body) : null;
}
function playerKey(username, gamemode) { return `${username.trim().toLowerCase()}::${gamemode.trim().toLowerCase()}`; }
function normalizeMode(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('crystal') || s.includes('cpvp')) return 'Crystal';
  if (s.includes('sword')) return 'Sword';
  if (s.includes('axe')) return 'Axe';
  if (s.includes('pot')) return 'Pot';
  return String(raw || '').trim().slice(0, 40) || 'Other';
}
function linesFromMessage(message) {
  const chunks = [message.content || ''];
  for (const embed of message.embeds || []) {
    chunks.push(embed.title || '', embed.description || '', embed.author?.name || '', embed.footer?.text || '');
    for (const field of embed.fields || []) chunks.push(`${field.name || ''}\n${field.value || ''}`);
  }
  return chunks.join('\n').replace(/\r/g, '').replace(/\u00a0/g, ' ');
}
function readLabel(text, labels) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/[*_`]/g, '');
    const label = labels.find(l => new RegExp(`^${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?::|-|：)*\\s*`, 'i').test(line));
    if (!label) continue;
    const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?::|-|：)*\\s*(.*)$`, 'i');
    const value = (line.match(re)?.[1] || '').replace(/^[-:：\s]+/, '').trim();
    if (value) return value;
    if (lines[i + 1] && !/^(IGN|USERNAME|GAME ?MODE|MODE|REGION|PREV(?:IOUS)?-?TIER|NEW-?TIER|TIER|TESTER)\s*(?::|-|：)/i.test(lines[i + 1])) return lines[i + 1].replace(/^[-:：\s]+/, '').trim();
  }
  return '';
}
function parseTierResult(message) {
  const text = linesFromMessage(message);
  // Only accept messages that look like test-result embeds and have a valid new tier.
  if (!/tier\s*test\s*result|new\s*-?\s*tier|new-tier/i.test(text)) return null;
  const username = readLabel(text, ['IGN', 'USERNAME', 'MINECRAFT USERNAME']);
  const rawMode = readLabel(text, ['GAMEMODE', 'GAME MODE', 'MODE']);
  const region = readLabel(text, ['REGION']);
  const tier = readLabel(text, ['NEW-TIER', 'NEW TIER', 'TIER']).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tester = readLabel(text, ['TESTER']);
  if (!username || username.length > 16 || !/^[A-Za-z0-9_]+$/.test(username)) return null;
  if (!Object.hasOwn(TIER_POINTS, tier)) return null;
  const gamemode = normalizeMode(rawMode);
  return { player_key: playerKey(username, gamemode), username, gamemode, region: region.slice(0, 30), tier, points: TIER_POINTS[tier], tester: tester.slice(0, 40), discord_message_id: message.id, discord_channel_id: message.channelId, updated_at: new Date(message.createdTimestamp || Date.now()).toISOString() };
}
async function getPlayers() {
  const rows = await supabase('players?select=username,gamemode,region,tier,points,tester,updated_at&order=points.desc,username.asc,gamemode.asc');
  return rows.map(p => ({ username:p.username, gamemode:p.gamemode, region:p.region, tier:p.tier, points:TIER_POINTS[p.tier] ?? p.points, tester:p.tester, updatedAt:p.updated_at }));
}
async function publishRankings() {
  const players = await getPlayers();
  lastUpdated = new Date().toISOString();
  const packet = `event: rankings\ndata: ${JSON.stringify({ players, updatedAt:lastUpdated })}\n\n`;
  for (const res of clients) res.write(packet);
}
async function saveResult(result) {
  await supabase('players?on_conflict=player_key', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates,return=minimal' }, body:JSON.stringify(result) });
  console.log(`[tier-sync] ${result.username} | ${result.gamemode} | ${result.tier} | ${result.points} pts`);
  await publishRankings();
}

app.get('/api/health', (_req, res) => res.json({ ok:true, discordReady:Boolean(bot?.isReady()), configured:missing.length === 0, missing }));
app.get('/api/players', async (_req, res) => {
  try { res.set('Cache-Control','no-store'); res.json({ players:await getPlayers(), updatedAt:lastUpdated }); }
  catch (e) { console.error(e.message); res.status(503).json({ error:'Rankings database unavailable' }); }
});
app.get('/api/events', async (req, res) => {
  res.set({ 'Content-Type':'text/event-stream', 'Cache-Control':'no-cache, no-transform', Connection:'keep-alive', 'X-Accel-Buffering':'no' });
  res.flushHeaders?.(); clients.add(res);
  try { res.write(`event: rankings\ndata: ${JSON.stringify({ players:await getPlayers(), updatedAt:lastUpdated })}\n\n`); }
  catch { res.write(`event: error\ndata: ${JSON.stringify({ error:'Rankings database unavailable' })}\n\n`); }
  req.on('close', () => clients.delete(res));
});

async function syncHistory(channel) {
  const limit = Math.max(0, Math.min(Number(process.env.SYNC_HISTORY_LIMIT || 500), 1000));
  if (!limit) return;
  let before; const all = [];
  while (all.length < limit) {
    const batch = await channel.messages.fetch({ limit:Math.min(100, limit - all.length), ...(before ? { before } : {}) });
    if (!batch.size) break;
    const messages = [...batch.values()]; all.push(...messages); before = messages[messages.length - 1].id;
    if (messages.length < 100) break;
  }
  all.sort((a,b) => a.createdTimestamp - b.createdTimestamp);
  let imported = 0;
  for (const message of all) {
    const result = parseTierResult(message);
    if (result) { await saveResult(result); imported++; }
  }
  console.log(`[tier-sync] Historical scan complete: ${imported} valid result(s) checked across ${all.length} message(s).`);
}
async function removePlayer(username, mode) {
  const key = playerKey(username, mode);
  await supabase(`players?player_key=eq.${encodeURIComponent(key)}`, { method:'DELETE', headers:{ Prefer:'return=minimal' } });
  await publishRankings();
}

async function startDiscord() {
  if (missing.length) { console.warn(`Discord sync not started. Missing environment variables: ${missing.join(', ')}`); return; }
  bot = new Client({ intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
  bot.on('messageCreate', async message => {
    if (message.channelId !== process.env.DISCORD_RESULTS_CHANNEL_ID) return;
    try { const result = parseTierResult(message); if (result) await saveResult(result); }
    catch (e) { console.error('[tier-sync] Could not save Discord result:', e.message); }
  });
  bot.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'tier-remove') return;
    const allowedRole = process.env.DISCORD_ADMIN_ROLE_ID;
    const memberRoles = interaction.member?.roles?.cache;
    const authorized = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || (allowedRole && memberRoles?.has(allowedRole));
    if (!authorized) { await interaction.reply({ content:'You need the configured Portal Tiers admin role to remove a ranking.', ephemeral:true }); return; }
    const username = interaction.options.getString('username', true);
    const mode = interaction.options.getString('gamemode', true);
    try { await removePlayer(username, mode); await interaction.reply({ content:`Removed ${username} (${mode}) from the live leaderboard.`, ephemeral:true }); }
    catch (e) { console.error(e); await interaction.reply({ content:'Could not remove this ranking. Check the backend logs.', ephemeral:true }); }
  });
  bot.once('ready', async () => {
    console.log(`Discord bot ready as ${bot.user.tag}`);
    try {
      const channel = await bot.channels.fetch(process.env.DISCORD_RESULTS_CHANNEL_ID);
      if (!channel?.isTextBased() || !channel.messages) throw new Error('Configured results channel is not a readable text channel.');
      await syncHistory(channel);
    } catch (e) { console.error('[tier-sync] Historical sync failed:', e.message); }
  });
  bot.on('error', e => console.error('[discord] Client error:', e.message));
  await bot.login(process.env.DISCORD_BOT_TOKEN);
  {
    const command = new SlashCommandBuilder().setName('tier-remove').setDescription('Remove a player/gamemode entry from Portal Tiers')
      .addStringOption(o => o.setName('username').setDescription('Exact Minecraft username').setRequired(true))
      .addStringOption(o => o.setName('gamemode').setDescription('Gamemode entry to remove').setRequired(true).addChoices({name:'Crystal',value:'Crystal'},{name:'Sword',value:'Sword'},{name:'Axe',value:'Axe'},{name:'Pot',value:'Pot'}));
    const rest = new REST({ version:'10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationGuildCommands(bot.user.id, process.env.DISCORD_GUILD_ID), { body:[command.toJSON()] });
    console.log('Registered /tier-remove for the configured Discord server.');
  }
}

app.listen(PORT, () => console.log(`Portal Tiers web server listening on ${PORT}`));
startDiscord().catch(e => { console.error('[startup] Discord bot failed:', e.message); });
