'use strict';
/* ════════════════════════════════════════════════════════════════════════
   Turnos DJ — PWA de turnos sincronizada con Google Calendar (calendario «Nexora»)
   · Mismo inicio de sesión de Google que la app de Exámenes (mismo Client ID).
   · Google Calendar es la fuente de verdad; en el móvil se guarda una copia para
     verla sin conexión y los cambios hechos offline se envían al volver internet.
   ════════════════════════════════════════════════════════════════════════ */

/* El Client ID de Google no es secreto (es el mismo de la app de Exámenes) */
const GOOGLE_CLIENT_ID = '909664836499-v9ui1farksf9q6orqufl9ss055aqmfdq.apps.googleusercontent.com';
const CALENDAR_NAME = 'Nexora';
const TZ = 'Europe/Madrid';
/* Permisos: ver/editar eventos (hace falta para escribir en Nexora, que no creó la app),
   ver la lista de calendarios (para encontrar «Nexora») y tu nombre/correo */
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly openid email profile';
const CAL_API = 'https://www.googleapis.com/calendar/v3';

const PANELS = ['Clement', 'DJ Bota'];
const TWO_GEN = "Two Generation's";
const OWNER_COLOR = { 'Clement': 'var(--clement)', 'DJ Bota': 'var(--bota)', [TWO_GEN]: 'var(--tg)' };
/* Alta rápida «DJ LA CLUB»: viernes 80 €, sábado 100 € */
const LACLUB = { title: 'DJ LA CLUB', lugar: 'Ciudad Real', local: 'La Antigua', start: '23:30', end: '06:00', llevar: 'Cascos y USB', cache: { 5: 80, 6: 100 } };

/* ───────────── utilidades ───────────── */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const DOW_S = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_L = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MON_S = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MON_L = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const LS = { data: 'turnos.data.v1', conn: 'turnos.gcal.connected', tok: 'turnos.gcal.token', cal: 'turnos.gcal.calendarId',
  calname: 'turnos.gcal.calendarName', last: 'turnos.gcal.lastSync', user: 'turnos.gcal.user' };

/* Fechas: todo se calcula en hora de Madrid, vengas de donde vengas */
const tzFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function wall(ms) { const o = {}; for (const p of tzFmt.formatToParts(new Date(ms))) o[p.type] = p.value; return { date: `${o.year}-${o.month}-${o.day}`, time: `${o.hour}:${o.minute}` }; }
const todayStr = () => wall(Date.now()).date;
const parseYMD = s => { const [a, b, c] = s.split('-').map(Number); return new Date(Date.UTC(a, b - 1, c)); };
const fmtYMD = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (s, n) => { const d = parseYMD(s); d.setUTCDate(d.getUTCDate() + n); return fmtYMD(d); };
const dayDiff = (a, b) => Math.round((parseYMD(b) - parseYMD(a)) / 864e5);
const dowOf = s => parseYMD(s).getUTCDay();
const dateLabel = s => { const d = parseYMD(s); return `${DOW_L[d.getUTCDay()].toLowerCase()} ${d.getUTCDate()} de ${MON_L[d.getUTCMonth()].toLowerCase()}`; };
function zonedToMs(dateStr, timeStr) {         /* «hora de pared» de Madrid → milisegundos reales */
  const [y, m, d] = dateStr.split('-').map(Number), [h, mi] = timeStr.split(':').map(Number);
  const target = Date.UTC(y, m - 1, d, h, mi); let guess = target;
  for (let i = 0; i < 3; i++) { const w = wall(guess), [py, pm, pd] = w.date.split('-').map(Number), [ph, pmi] = w.time.split(':').map(Number); guess += target - Date.UTC(py, pm - 1, pd, ph, pmi); }
  return guess;
}
function fmtDur(ms) { const t = Math.max(0, Math.round(ms / 60000)), h = Math.floor(t / 60), m = t % 60; return m ? `${h}h${pad(m)}` : `${h}h`; }
const euro = n => (Math.round(n * 100) / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 }) + '€';
const numStr = n => String(Math.round(n * 100) / 100);
function parseMoney(s) {
  let t = String(s || '').replace(/[^\d.,]/g, ''); if (!t) return 0;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); else t = t.replace(',', '.');
  const n = parseFloat(t); return isFinite(n) ? n : 0;
}
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800); }

/* ───────────── lectura / escritura de la descripción de cada turno ─────────────
   🎤 DJ: Clement / 📍 Lugar / 🏢 Local / 💰 Caché / ⏰ Horario / 🕐 Duración / 🎒 Llevar  */
function stripHtml(s) {
  return String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|ul|ol)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function normDJ(s) {
  const t = String(s || '').toLowerCase().replace(/[’'`´]/g, '');
  if (!t.trim()) return '';
  if (t.includes('two gen')) return TWO_GEN;
  if (t.includes('clement')) return 'Clement';
  if (t.includes('bota')) return 'DJ Bota';
  return '';
}
function parseDesc(desc) {
  const o = { dj: '', lugar: '', local: '', cache: 0, llevar: '', extra: [] };
  const take = (line, re) => { const m = line.match(re); return m ? m[1].trim() : null; };
  for (const raw of stripHtml(desc).split(/\r?\n/)) {
    const line = raw.trim(); let v;
    if ((v = take(line, /^🎤[️\s]*DJ\s*:\s*(.*)$/i)) !== null) o.dj = normDJ(v);
    else if ((v = take(line, /^📍[️\s]*Lugar\s*:\s*(.*)$/i)) !== null) o.lugar = v;
    else if ((v = take(line, /^🏢[️\s]*Local\s*:\s*(.*)$/i)) !== null) o.local = v;
    else if ((v = take(line, /^💰[️\s]*Cach[eé]\s*:\s*(.*)$/i)) !== null) o.cache = parseMoney(v);
    else if (/^⏰[️\s]*Horario\s*:/i.test(line) || /^🕐[️\s]*Duraci[oó]n\s*:/i.test(line)) { /* se calculan solos */ }
    else if ((v = take(line, /^🎒[️\s]*Llevar\s*:\s*(.*)$/i)) !== null) o.llevar = v === '-' ? '' : v;
    else if (line) o.extra.push(line);
  }
  return o;
}
function fromEvent(ev) {
  const s = ev.start || {}, e = ev.end || {}; let date, start, end, startMs, endMs, allDay = false;
  if (s.dateTime) {
    startMs = Date.parse(s.dateTime); endMs = Date.parse(e.dateTime || s.dateTime);
    const a = wall(startMs), b = wall(endMs); date = a.date; start = a.time; end = b.time;
  } else {
    allDay = true; date = s.date || todayStr(); start = '00:00'; end = '23:59';
    startMs = zonedToMs(date, '00:00'); endMs = zonedToMs(e.date ? addDays(e.date, -1) : date, '23:59');
  }
  const d = parseDesc(ev.description);
  let lugar = d.lugar, local = d.local;
  if ((!lugar || !local) && ev.location) { const p = ev.location.split(','); if (!local) local = p[0].trim(); if (!lugar) lugar = p.slice(1).join(',').trim() || p[0].trim(); }
  return { id: ev.id, title: ev.summary || 'Turno', dj: d.dj, lugar, local, llevar: d.llevar, cache: d.cache, extra: d.extra,
    date, start, end, startMs, endMs, allDay, rev: 0 };
}
function descOf(it) {
  const lines = [`🎤 DJ: ${it.dj}`, `📍 Lugar: ${it.lugar}`, `🏢 Local: ${it.local}`, `💰 Caché: ${numStr(it.cache)}€`,
    `⏰ Horario: ${it.start} - ${it.end}`, `🕐 Duración: ${fmtDur(it.endMs - it.startMs)}`, `🎒 Llevar: ${it.llevar || '-'}`];
  if (it.extra && it.extra.length) lines.push('', ...it.extra);
  return lines.join('\n');
}
function bodyOf(it) {
  const endDate = it.end <= it.start ? addDays(it.date, 1) : it.date;
  const body = { summary: it.title, location: [it.local, it.lugar].filter(Boolean).join(', '), description: descOf(it),
    start: { dateTime: `${it.date}T${it.start}:00`, timeZone: TZ }, end: { dateTime: `${endDate}T${it.end}:00`, timeZone: TZ } };
  if (it.allDay) { body.start.date = null; body.end.date = null; }
  return body;
}

/* ───────────── datos locales ───────────── */
let items = [];
try { items = (JSON.parse(store.get(LS.data, '{"items":[]}')).items || []).filter(i => i && i.id); } catch (e) { items = []; }
let changeSeq = 0;
const saveLocal = () => store.set(LS.data, JSON.stringify({ version: 1, items }));
const byStart = (a, b) => a.startMs - b.startMs;
const KNOWN = ['Clement', 'DJ Bota', TWO_GEN];
let owner = null;
/* Un turno sale en el panel de su DJ; los de Two Generation's salen en los dos; sin DJ, en los dos (con aviso) */
const inPanel = i => i.pending !== 'delete' && (!i.dj || !KNOWN.includes(i.dj) || i.dj === TWO_GEN || i.dj === owner);
const panelItems = () => items.filter(inPanel);

/* ───────────── Google Calendar ───────────── */
let syncState = 'local', tokenClient = null, pendingToken = null, token = null, tokenExp = 0, syncing = false, again = false, syncTimer;
try { const t = JSON.parse(store.get(LS.tok, 'null')); if (t && t.exp > Date.now()) { token = t.v; tokenExp = t.exp; } } catch (e) {}
const isConnected = () => store.get(LS.conn) === '1';

function initTokenClient() {
  if (tokenClient || !window.google?.accounts?.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPES,
    callback: r => {
      const res = pendingToken; pendingToken = null;
      if (r.error || !r.access_token) { res && res(null); return; }
      if (google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/calendar.events')) {
        toast('Falta el permiso de Google Calendar: vuelve a iniciar sesión y marca todas las casillas'); res && res(null); return;
      }
      token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
      store.set(LS.tok, JSON.stringify({ v: token, exp: tokenExp })); res && res(token);
    },
    error_callback: () => { const res = pendingToken; pendingToken = null; res && res(null); },
  });
}
/* Se llama SIN await previo para conservar el gesto del usuario (evita que bloqueen la ventana) */
function getToken(interactive) {
  if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
  if (!interactive) return Promise.resolve(null);
  initTokenClient();
  if (!tokenClient) { toast('Google aún se está cargando, inténtalo de nuevo'); return Promise.resolve(null); }
  return new Promise(res => { pendingToken = res; tokenClient.requestAccessToken(isConnected() ? { prompt: '' } : {}); });
}
async function gfetch(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  if (r.status === 401) { token = null; store.del(LS.tok); const e = new Error('auth'); e.auth = true; throw e; }
  if (!r.ok) { const e = new Error('Google ' + r.status); e.status = r.status; throw e; }
  return r;
}
const jsonOpts = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const normName = s => String(s || '').trim().toLowerCase();

async function listCalendars() {
  const out = []; let pt = '';
  do {
    const j = await (await gfetch(`${CAL_API}/users/me/calendarList?minAccessRole=writer&maxResults=250${pt ? '&pageToken=' + encodeURIComponent(pt) : ''}`)).json();
    out.push(...(j.items || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, primary: !!c.primary }))); pt = j.nextPageToken || '';
  } while (pt);
  return out;
}
/* Busca el calendario «Nexora»; si hay varios candidatos o ninguno, te deja elegir */
async function ensureCalendar() {
  const cached = store.get(LS.cal);
  if (cached) {
    try { await gfetch(`${CAL_API}/users/me/calendarList/${encodeURIComponent(cached)}`); return cached; }
    catch (e) { if (e.auth || e.status !== 404) throw e; store.del(LS.cal); }
  }
  const cals = await listCalendars();
  const m = cals.find(c => normName(c.name) === normName(CALENDAR_NAME));
  if (m) { store.set(LS.cal, m.id); store.set(LS.calname, m.name); return m.id; }
  const err = new Error('nocal'); err.nocal = true; err.list = cals; throw err;
}
async function listEvents(calId) {
  const out = []; let pt = '';
  const base = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeZone: TZ,
    timeMin: '2025-01-01T00:00:00Z', timeMax: new Date(Date.now() + 730 * 864e5).toISOString() });
  do {
    const q = new URLSearchParams(base); if (pt) q.set('pageToken', pt);
    const j = await (await gfetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events?${q}`)).json();
    out.push(...(j.items || []).filter(e => e.status !== 'cancelled').map(fromEvent)); pt = j.nextPageToken || '';
  } while (pt);
  return out;
}
/* Envía a Google lo que hiciste sin conexión (o antes de que terminara de sincronizar) */
async function flush(calId) {
  const evPath = id => `${CAL_API}/calendars/${encodeURIComponent(calId)}/events${id ? '/' + encodeURIComponent(id) : ''}`;
  for (const snap of items.filter(i => i.pending)) {
    const it = items.find(x => x.id === snap.id); if (!it || !it.pending) continue;
    const rev = it.rev || 0, op = it.pending;
    if (op === 'delete') {
      if (!String(it.id).startsWith('tmp_')) { try { await gfetch(evPath(it.id), { method: 'DELETE' }); } catch (e) { if (e.auth || (e.status !== 404 && e.status !== 410)) throw e; } }
      items = items.filter(x => x.id !== it.id);
    } else {
      let newId = it.id;
      if (op === 'create' || String(it.id).startsWith('tmp_')) newId = (await (await gfetch(evPath(), jsonOpts('POST', bodyOf(it)))).json()).id;
      else {
        try { await gfetch(evPath(it.id), jsonOpts('PATCH', bodyOf(it))); }
        catch (e) { if (e.auth || (e.status !== 404 && e.status !== 410)) throw e; newId = (await (await gfetch(evPath(), jsonOpts('POST', bodyOf(it)))).json()).id; }
      }
      it.id = newId; if ((it.rev || 0) === rev) delete it.pending; else it.pending = 'update';
    }
    saveLocal();
  }
}
/* Lo que viene de Google manda, salvo los cambios locales que aún no se han enviado (esos se conservan) */
function mergeRemote(remote) {
  const local = new Map(items.map(i => [i.id, i])), seen = new Set();
  const out = [];
  for (const r of remote) {
    const l = local.get(r.id); seen.add(r.id);
    if (l && l.pending) { if (l.pending !== 'delete') out.push(l); } else out.push(r);
  }
  for (const l of items) if (l.pending && l.pending !== 'delete' && !seen.has(l.id)) out.push(l);
  return out;
}
async function loadUser() {
  try { const j = await (await gfetch('https://www.googleapis.com/oauth2/v3/userinfo')).json(); store.set(LS.user, JSON.stringify({ name: j.name, email: j.email })); } catch (e) {}
}
async function sync(interactive = false) {
  if (!isConnected()) { setSync('local'); return; }
  if (!navigator.onLine) { setSync('offline'); return; }
  if (syncing) { again = true; return; }
  const tok = await getToken(interactive);
  if (!tok) { setSync('reauth'); return; }
  syncing = true; setSync('syncing');
  try {
    const calId = await ensureCalendar();
    await flush(calId);
    const remote = await listEvents(calId), merged = mergeRemote(remote);
    if (items.some(i => i.pending)) again = true;             /* algo se editó mientras sincronizaba: se envía en la siguiente vuelta */
    const before = JSON.stringify(items.map(({ rev, ...r }) => r)), after = JSON.stringify(merged.map(({ rev, ...r }) => r));
    items = merged; saveLocal(); store.set(LS.last, String(Date.now()));
    if (!store.get(LS.user)) loadUser();
    setSync('ok');
    if (before !== after) render();
  } catch (e) {
    saveLocal();
    if (e.nocal) { setSync('nocal'); openPickCal(e.list); }
    else if (e.auth) setSync('reauth');
    else { setSync(navigator.onLine ? 'error' : 'offline'); if (e.status === 403) toast('Google ha rechazado el acceso: vuelve a iniciar sesión y acepta los permisos'); }
    console.warn('sync', e);
  } finally { syncing = false; if (again) { again = false; setTimeout(() => sync(false), 400); } }
}
function markDirty() {
  changeSeq++; saveLocal();
  if (!isConnected()) return;
  setSync(navigator.onLine ? 'pending' : 'offline');
  clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), 900);
}
async function connectGoogle() {
  const tok = await getToken(true);                         /* primera instrucción: conserva el gesto del toque */
  if (!tok) { toast('No se pudo iniciar sesión con Google'); return; }
  store.set(LS.conn, '1'); await loadUser(); await sync(false); renderSelFoot(); if (owner) render();
}
function disconnectGoogle() {
  if (!confirm('¿Cerrar sesión de Google? Se borrará la copia de turnos de este móvil (en tu Google Calendar siguen igual).')) return;
  try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
  token = null; [LS.conn, LS.tok, LS.cal, LS.calname, LS.last, LS.user, LS.data].forEach(k => store.del(k)); items = [];
  closeSheet(); setSync('local'); renderSelFoot(); if (owner) render(); toast('Sesión cerrada');
}
const SYNC_TEXT = { local: 'Sin conectar', ok: 'Sincronizado', syncing: 'Sincronizando…', pending: 'Guardando…', offline: 'Sin conexión', reauth: 'Toca para reconectar', error: 'Error · toca para reintentar', nocal: 'Elige el calendario' };
function setSync(s) {
  syncState = s;
  $$('[data-sync]').forEach(el => { el.dataset.s = s; const t = $('.txt', el); if (t) t.textContent = SYNC_TEXT[s]; });
}
const syncPill = () => `<button class="pill btn" data-act="sync" data-sync data-s="${syncState}"><i class="dot"></i><span class="txt">${SYNC_TEXT[syncState]}</span></button>`;

/* ───────────── estadísticas ───────────── */
function urgency(days) {
  if (days <= 0) return { t: 'Hoy', c: 'var(--danger)' };
  if (days === 1) return { t: 'Mañana', c: 'var(--money)' };
  if (days <= 3) return { t: `En ${days} días`, c: 'var(--money)' };
  return { t: `En ${days} días`, c: 'var(--ok)' };
}
function monthly(list, now) {
  const m = {};
  for (const i of list) { const k = i.date.slice(0, 7); const x = m[k] || (m[k] = { c: 0, p: 0 }); if (i.endMs < now) x.c += i.cache; else x.p += i.cache; }
  return m;
}

/* ───────────── vistas ───────────── */
const OWNER_CLASS = { 'Clement': 'clement', 'DJ Bota': 'bota' };
function turnoCard(i, o = {}) {
  const tg = i.dj === TWO_GEN, free = !i.dj || !KNOWN.includes(i.dj);
  return `<div class="turno${o.past ? ' past' : ''}${o.sm ? ' sm' : ''}">
    <div class="l"><div class="date"><div class="w">${DOW_S[dowOf(i.date)]}</div><div class="d">${+i.date.slice(8)}</div><div class="m">${MON_S[+i.date.slice(5, 7) - 1]}</div></div>
    <div style="min-width:0"><h4>${esc(i.title)}</h4>
      <div class="where">${esc(i.local)}${i.local && i.lugar ? ' · ' : ''}${esc(i.lugar)}</div>
      <div class="chips"><span class="chip">${i.allDay ? 'Todo el día' : `${i.start}–${i.end}`}</span>${i.allDay ? '' : `<span class="chip">${fmtDur(i.endMs - i.startMs)}</span>`}
        <span class="chip cache">${euro(i.cache)}</span>${i.llevar ? `<span class="chip">🎒 ${esc(i.llevar)}</span>` : ''}
        ${tg ? `<span class="chip tg">🤝 Two Generation's</span>` : ''}${free ? `<span class="chip warn">❓ Sin asignar · edítalo para elegir DJ</span>` : ''}
        ${i.pending ? `<span class="chip wait">⏳ Pendiente de sincronizar</span>` : ''}</div></div></div>
    <div class="act"><button class="btn icon" data-act="edit" data-id="${esc(i.id)}" aria-label="Modificar turno">✏️</button><button class="btn icon danger" data-act="del" data-id="${esc(i.id)}" aria-label="Eliminar turno">🗑️</button></div></div>`;
}
let showAllPast = false, calMonth = null, selDay = null, animate = true;
function viewPanel() {
  const list = panelItems(), now = Date.now(), today = todayStr();
  const up = list.filter(i => i.endMs >= now).sort(byStart), past = list.filter(i => i.endMs < now).sort((a, b) => b.startMs - a.startMs);
  const cobrado = past.reduce((s, i) => s + i.cache, 0), pend = up.reduce((s, i) => s + i.cache, 0), total = cobrado + pend;
  const hours = list.reduce((s, i) => s + Math.max(0, i.endMs - i.startMs), 0) / 36e5;
  const mm = monthly(list, now), keys = Object.keys(mm).sort(), curK = today.slice(0, 7), max = Math.max(1, ...keys.map(k => mm[k].c + mm[k].p)), cm = mm[curK] || { c: 0, p: 0 };
  let hero;
  if (up.length) {
    const n = up[0], live = n.startMs <= now, u = live ? { t: 'En curso ahora', c: 'var(--ok)' } : urgency(dayDiff(today, n.date));
    hero = `<div class="hero"><div class="eyebrow">PRÓXIMO TURNO · <span style="color:${u.c}">${u.t}</span></div><h2>${esc(n.title)} — ${esc(n.lugar || n.local)}</h2>
      <div class="meta"><span>${dateLabel(n.date)}</span><span><b>${n.allDay ? 'Todo el día' : `${n.start}–${n.end}`}</b></span><span>${esc(n.local)}</span><span class="chip cache">${euro(n.cache)}</span>${n.llevar ? `<span>Llevar: ${esc(n.llevar)}</span>` : ''}${n.dj === TWO_GEN ? `<span style="color:var(--tg)">🤝 Two Generation's</span>` : ''}</div></div>`;
  } else hero = `<div class="hero empty">No hay turnos próximos en este panel.</div>`;
  const pastShown = showAllPast ? past : past.slice(0, 8);
  return `<div class="head"><div class="ttl"><div class="badge ${OWNER_CLASS[owner]}"><img src="img/${OWNER_CLASS[owner]}.png" alt=""></div><div><h1>${esc(owner.toUpperCase())}</h1><div class="sub">Calendario Nexora · cachés, horarios y logística</div></div></div>
      <div class="tools"><button class="pill btn" data-act="switch">Cambiar panel</button>${syncPill()}<button class="pill btn" data-act="settings" aria-label="Ajustes">⚙️</button></div></div>
    ${!isConnected() ? `<div class="connect"><div><b>Conecta tu Google Calendar</b><span>Inicia sesión para ver y editar tus turnos del calendario Nexora.</span></div><button class="btn primary" data-act="connect">Iniciar sesión con Google</button></div>` : ''}
    <div class="stats">
      <div class="stat"><div class="l">Turnos totales</div><div class="v">${list.length}</div></div>
      <div class="stat"><div class="l">Próximos</div><div class="v">${up.length}</div></div>
      <div class="stat money"><div class="l">Caché pendiente</div><div class="v">${euro(pend)}</div></div>
      <div class="stat money"><div class="l">Caché cobrado</div><div class="v">${euro(cobrado)}</div></div>
      <div class="stat"><div class="l">Horas totales</div><div class="v">${Math.round(hours)}h</div></div>
      <div class="stat money"><div class="l">Caché medio/turno</div><div class="v">${euro(list.length ? total / list.length : 0)}</div></div></div>
    ${hero}
    <div class="sec"><h3>Próximos turnos</h3><span class="n">${up.length ? up.length + (up.length > 1 ? ' turnos' : ' turno') : ''}</span></div>
    ${up.length ? up.map(i => turnoCard(i)).join('') : `<div class="empty-box">No hay turnos programados. Pulsa «Añadir turno» o usa el calendario de abajo.</div>`}
    <div class="sec"><h3>Turnos pasados</h3><span class="n">${past.length ? past.length + (past.length > 1 ? ' turnos' : ' turno') : ''}</span></div>
    ${past.length ? pastShown.map(i => turnoCard(i, { past: true })).join('') + (past.length > 8 ? `<button class="btn block" style="width:100%" data-act="morePast">${showAllPast ? 'Ver menos' : `Ver los ${past.length} turnos pasados`}</button>` : '') : `<div class="empty-box">Todavía no hay turnos pasados.</div>`}
    <div class="sec"><h3>Ingresos por mes</h3><span class="n"></span></div>
    <div class="card">${keys.length ? `<div class="thism"><div><span>${MON_L[+curK.slice(5) - 1]} (este mes)</span><br><b>${euro(cm.c + cm.p)}</b></div><span>Cobrado ${euro(cm.c)} · Previsto ${euro(cm.p)}</span></div>
      <div class="legend"><span><i style="background:var(--ok)"></i>Cobrado (turnos pasados)</span><span><i style="background:var(--money)"></i>Previsto (turnos próximos)</span></div>
      ${keys.map(k => { const x = mm[k]; return `<div class="mrow${k === curK ? ' cur' : ''}"><div class="ml">${MON_L[+k.slice(5) - 1]} ${k.slice(0, 4)}</div><div class="bar"><i class="c" style="width:${x.c / max * 100}%"></i><i class="p" style="width:${x.p / max * 100}%"></i></div><div class="mt">${euro(x.c + x.p)}</div></div>`; }).join('')}`
      : `<div class="empty-box" style="border:0">Aún no hay datos para calcular ingresos por mes.</div>`}</div>
    <div class="sec"><h3>Calendario</h3><span class="n"></span></div>
    <div class="card">${calendarHTML(list)}</div>`;
}
function calendarHTML(list) {
  const byDay = {}; list.forEach(i => (byDay[i.date] = byDay[i.date] || []).push(i));
  const today = todayStr(), ms = calMonth, off = (dowOf(ms) + 6) % 7, gs = addDays(ms, -off), mIdx = +ms.slice(5, 7) - 1;
  let cells = '';
  for (let k = 0; k < 42; k++) {
    const d = addDays(gs, k), n = (byDay[d] || []).length, cls = ['day']; if (+d.slice(5, 7) - 1 !== mIdx) cls.push('out'); if (d === today) cls.push('today'); if (n) cls.push('has'); if (d === selDay) cls.push('sel');
    cells += `<button class="${cls.join(' ')}" data-act="day" data-d="${d}" aria-label="${dateLabel(d)}${n ? ', ' + n + ' turno(s)' : ''}">${+d.slice(8)}${n ? `<span class="c">${n}</span>` : ''}</button>`;
  }
  let detail = '';
  if (selDay) {
    const ev = (byDay[selDay] || []).sort(byStart), dw = dowOf(selDay);
    detail = `<div class="detail"><h4>${dateLabel(selDay).replace(/^./, c => c.toUpperCase())}</h4>
      ${ev.length ? ev.map(i => turnoCard(i, { sm: true, past: i.endMs < Date.now() })).join('') : `<div class="empty-box">Sin turnos este día.</div>`}
      <div class="quick">${LACLUB.cache[dw] ? `<button class="btn small primary" data-act="quick" data-d="${selDay}">⚡ Añadir «${LACLUB.title}» (${LACLUB.cache[dw]}€)</button>` : ''}<button class="btn small" data-act="add" data-d="${selDay}">+ Turno manual</button></div></div>`;
  }
  return `<div class="cal-h"><h3>${MON_L[mIdx]} ${ms.slice(0, 4)}</h3><div class="nav"><button class="btn icon small" data-act="prev" aria-label="Mes anterior">‹</button><button class="btn icon small" data-act="next" aria-label="Mes siguiente">›</button></div></div>
    <div class="grid">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>${detail}`;
}
function render() {
  if (!owner) return;
  const y = window.scrollY; $('#view').innerHTML = `<div class="${animate ? 'view' : ''}">${viewPanel()}</div>`; animate = false; window.scrollTo(0, y);
  document.documentElement.style.setProperty('--accent', OWNER_COLOR[owner]);
  setSync(syncState);
}
function renderSelFoot() {
  const u = (() => { try { return JSON.parse(store.get(LS.user, 'null')); } catch (e) { return null; } })();
  $('#selFoot').innerHTML = isConnected()
    ? `${syncPill()}<span style="font-size:12.5px;color:#9AA3B5">${u?.email ? esc(u.email) : 'Conectado a Google Calendar'}</span>`
    : `<button class="pill btn" data-act="connect">🔑 Iniciar sesión con Google</button><span style="font-size:12.5px;color:#9AA3B5">Para ver y editar tus turnos de Nexora</span>`;
  setSync(syncState);
}

/* ───────────── formulario ───────────── */
let editingId = null;
function openForm(it, presetDate) {
  editingId = it ? it.id : null;
  $('#mTitle').textContent = it ? 'Modificar turno' : 'Nuevo turno';
  $('#mSub').textContent = it ? 'Puedes reasignarlo a otro DJ si hace falta.' : `Por defecto se añade a ${owner}; puedes cambiarlo abajo.`;
  const dj = it ? (KNOWN.includes(it.dj) ? it.dj : owner) : owner;
  $('#f_dj').value = dj;
  $('#f_title').value = it ? it.title : ''; $('#f_lugar').value = it ? it.lugar : ''; $('#f_local').value = it ? it.local : '';
  $('#f_date').value = it ? it.date : (presetDate || todayStr()); $('#f_cache').value = it ? numStr(it.cache) : '';
  $('#f_start').value = it && !it.allDay ? it.start : ''; $('#f_end').value = it && !it.allDay ? it.end : ''; $('#f_llevar').value = it ? it.llevar : '';
  $('#ferr').classList.remove('show'); $('#modal').classList.add('show'); setTimeout(() => $('#f_title').focus(), 50);
}
function openQuick(date) {
  openForm(null, date);
  $('#f_title').value = LACLUB.title; $('#f_lugar').value = LACLUB.lugar; $('#f_local').value = LACLUB.local;
  $('#f_start').value = LACLUB.start; $('#f_end').value = LACLUB.end; $('#f_llevar').value = LACLUB.llevar; $('#f_cache').value = LACLUB.cache[dowOf(date)] ?? '';
}
const closeModal = () => $('#modal').classList.remove('show');
function submitForm(ev) {
  ev.preventDefault();
  const v = id => $('#' + id).value.trim(), err = $('#ferr');
  const date = v('f_date'), start = v('f_start'), end = v('f_end'), cache = parseFloat(String(v('f_cache')).replace(',', '.'));
  if (!v('f_title') || !v('f_lugar') || !v('f_local') || !date || !start || !end || !isFinite(cache) || cache < 0) { err.textContent = 'Rellena todos los campos obligatorios.'; err.classList.add('show'); return; }
  const endDate = end <= start ? addDays(date, 1) : date;
  const base = editingId ? items.find(x => x.id === editingId) : null;
  const it = { id: base ? base.id : 'tmp_' + uid(), title: v('f_title'), dj: v('f_dj'), lugar: v('f_lugar'), local: v('f_local'), llevar: v('f_llevar'), cache,
    extra: base ? base.extra || [] : [], date, start, end, startMs: zonedToMs(date, start), endMs: zonedToMs(endDate, end), allDay: false,
    rev: (base?.rev || 0) + 1, pending: base ? (base.pending === 'create' || String(base.id).startsWith('tmp_') ? 'create' : 'update') : 'create' };
  if (base) items[items.indexOf(base)] = it; else items.push(it);
  closeModal(); markDirty(); render(); toast(base ? 'Cambios guardados' : 'Turno añadido');
}
function deleteItem(id) {
  const it = items.find(x => x.id === id); if (!it) return;
  if (!confirm(`¿Eliminar «${it.title}» del ${dateLabel(it.date)}?\nTambién se borrará de tu Google Calendar.`)) return;
  if (it.pending === 'create' || String(it.id).startsWith('tmp_')) items = items.filter(x => x.id !== id); else { it.pending = 'delete'; it.rev = (it.rev || 0) + 1; }
  markDirty(); render(); toast('Turno eliminado');
}

/* ───────────── hojas: ajustes y elegir calendario ───────────── */
const closeSheet = () => $('#sheet').classList.remove('show');
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('show'); }
function openSettings() {
  const u = (() => { try { return JSON.parse(store.get(LS.user, 'null')); } catch (e) { return null; } })(), last = +store.get(LS.last, 0);
  openSheet(`<h3>Ajustes</h3><p class="ms">Los turnos se guardan en tu Google Calendar.</p>
    <div class="kv"><span>Cuenta</span><span>${esc(u?.email || (isConnected() ? 'Conectada' : 'Sin conectar'))}</span></div>
    <div class="kv"><span>Calendario</span><span>${esc(store.get(LS.calname) || CALENDAR_NAME)}</span></div>
    <div class="kv"><span>Última sincronización</span><span>${last ? new Intl.DateTimeFormat('es-ES', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(last) : '—'}</span></div>
    <p class="note">Se actualiza solo cada minuto con la app abierta y al volver a ella. Si no tienes internet puedes seguir añadiendo y editando turnos: se enviarán al reconectar. Cada hora Google pide reconectar: toca el indicador de estado.</p>
    <div class="mact" style="flex-wrap:wrap">${isConnected() ? `<button class="btn primary" data-act="syncnow">Sincronizar ahora</button><button class="btn" data-act="pickcal">Cambiar calendario</button><button class="btn danger" data-act="logout">Cerrar sesión</button>` : `<button class="btn primary" data-act="connect">Iniciar sesión con Google</button>`}<button class="btn" data-act="closeSheet">Cerrar</button></div>`);
}
async function openPickCal(list) {
  if (!list) { if (!(await getToken(false))) { toast('Toca el indicador de estado para reconectar'); return; } try { list = await listCalendars(); } catch (e) { toast('No se pudo leer tu lista de calendarios'); return; } }
  openSheet(`<h3>Elige el calendario de turnos</h3><p class="ms">${list.length ? `No he encontrado uno llamado «${esc(CALENDAR_NAME)}». Elige dónde están tus turnos:` : 'No tienes calendarios en los que se pueda escribir.'}</p>
    <div class="list-pick">${list.map(c => `<button class="btn" data-act="choosecal" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${esc(c.name)}${c.primary ? ' (principal)' : ''}</button>`).join('')}</div>
    <div class="mact"><button class="btn" data-act="closeSheet">Cancelar</button></div>`);
}

/* ───────────── eventos de la interfaz ───────────── */
function chooseOwner(o) {
  owner = o; selDay = null; showAllPast = false; animate = true; calMonth = todayStr().slice(0, 7) + '-01';
  $('#selector').classList.add('hidden'); $('#fab').classList.remove('hidden'); render(); window.scrollTo(0, 0);
  if (isConnected()) sync(false);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) { if (e.target.classList?.contains('overlay')) { closeModal(); closeSheet(); } return; }
  const a = t.dataset.act, id = t.dataset.id, d = t.dataset.d;
  switch (a) {
    case 'own': chooseOwner(t.dataset.own); break;
    case 'switch': $('#selector').classList.remove('hidden'); $('#fab').classList.add('hidden'); renderSelFoot(); break;
    case 'connect': connectGoogle(); break;
    case 'sync': if (!isConnected()) connectGoogle(); else if (syncState === 'nocal') openPickCal(); else sync(true); break;
    case 'syncnow': closeSheet(); sync(true); break;
    case 'settings': openSettings(); break;
    case 'closeSheet': closeSheet(); break;
    case 'logout': disconnectGoogle(); break;
    case 'pickcal': openPickCal(); break;
    case 'choosecal': store.set(LS.cal, id); store.set(LS.calname, t.dataset.name); closeSheet(); toast('Calendario elegido'); sync(true); break;
    case 'add': openForm(null, d); break;
    case 'quick': openQuick(d); break;
    case 'edit': { const it = items.find(x => x.id === id); if (it) openForm(it); break; }
    case 'del': deleteItem(id); break;
    case 'day': selDay = selDay === d ? null : d; if (selDay && selDay.slice(0, 7) !== calMonth.slice(0, 7)) calMonth = selDay.slice(0, 7) + '-01'; render(); break;
    case 'prev': calMonth = addDays(calMonth, -1).slice(0, 7) + '-01'; render(); break;
    case 'next': calMonth = addDays(calMonth, 32).slice(0, 7) + '-01'; render(); break;
    case 'morePast': showAllPast = !showAllPast; render(); break;
    case 'closeModal': closeModal(); break;
  }
});
$('#form').addEventListener('submit', submitForm);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeSheet(); } });

/* ───────────── arranque ───────────── */
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
syncState = isConnected() ? 'pending' : 'local';
renderSelFoot();
window.addEventListener('online', () => { if (isConnected()) sync(false); });
window.addEventListener('offline', () => { if (isConnected()) setSync('offline'); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && isConnected()) { sync(false); if (owner) render(); } });
/* Se actualiza solo cada minuto; además cambia de día a medianoche */
let lastDay = todayStr();
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  if (isConnected()) sync(false);
  if (owner && todayStr() !== lastDay) { lastDay = todayStr(); render(); }
}, 60000);
(function waitGIS(n = 0) { if (window.google?.accounts?.oauth2) initTokenClient(); else if (n < 80) setTimeout(() => waitGIS(n + 1), 150); })();
if (isConnected()) sync(false);
