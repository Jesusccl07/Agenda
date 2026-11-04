'use strict';
/* ════════════════════════════════════════════════════════════════════════
   Turnos DJ — PWA de turnos sincronizada con Google Calendar
   · Cada cuenta de Google tiene su propio calendario «turnos_dj» (la app lo crea si no existe;
     si encuentra el antiguo «Nexora» de esa cuenta, lo renombra a «turnos_dj»).
   · Los turnos de Two Generation's se copian en el «turnos_dj» del socio, si te lo ha compartido.
   · Inicio de sesión con Google (Client ID propio de la web en jesusccl07.github.io).
   · Google Calendar es la fuente de verdad; en el móvil se guarda una copia para
     verla sin conexión y los cambios hechos offline se envían al volver internet.
   ════════════════════════════════════════════════════════════════════════ */

/* El Client ID de Google no es secreto */
const GOOGLE_CLIENT_ID = '909664836499-v9ui1farksf9q6orqufl9ss055aqmfdq.apps.googleusercontent.com';
const CALENDAR_NAME = 'turnos_dj';
const LEGACY_NAMES = ['Nexora'];                    /* nombres antiguos que se renombran a turnos_dj */
const TZ = 'Europe/Madrid';
/* Permisos: gestionar tus calendarios (crear y renombrar «turnos_dj», escribir en el del socio) y tu nombre/correo */
const CAL_SCOPE = 'https://www.googleapis.com/auth/calendar';
const GOOGLE_SCOPES = CAL_SCOPE + ' openid email profile';
const SCOPE_VERSION = '2';                          /* sube si cambian los permisos: obliga a reconectar */
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
  calname: 'turnos.gcal.calendarName', last: 'turnos.gcal.lastSync', user: 'turnos.gcal.user',
  partner: 'turnos.gcal.partnerId', tomb: 'turnos.gcal.tgDeleted', scopev: 'turnos.gcal.scopeVersion' };

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
    date, start, end, startMs, endMs, allDay, rev: 0, tg: ev.extendedProperties?.shared?.tg || '' };
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
  /* Marca para emparejar la copia de Two Generation's del calendario del socio */
  if (it.dj === TWO_GEN && !it.tg) it.tg = 'tg' + uid();
  if (it.tg) body.extendedProperties = { shared: { tg: it.tg, kind: it.dj === TWO_GEN ? 'tg' : 'solo' } };
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
try { const t = JSON.parse(store.get(LS.tok, 'null')); if (t && t.exp > Date.now() && store.get(LS.scopev) === SCOPE_VERSION) { token = t.v; tokenExp = t.exp; } } catch (e) {}
const isConnected = () => store.get(LS.conn) === '1';

function initTokenClient() {
  if (tokenClient || !window.google?.accounts?.oauth2) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID, scope: GOOGLE_SCOPES,
    callback: r => {
      const res = pendingToken; pendingToken = null;
      if (r.error || !r.access_token) { res && res(null); return; }
      if (google.accounts.oauth2.hasGrantedAllScopes && !google.accounts.oauth2.hasGrantedAllScopes(r, CAL_SCOPE)) {
        toast('Falta el permiso de Google Calendar: vuelve a iniciar sesión y marca todas las casillas'); res && res(null); return;
      }
      token = r.access_token; tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
      store.set(LS.tok, JSON.stringify({ v: token, exp: tokenExp })); store.set(LS.scopev, SCOPE_VERSION); res && res(token);
    },
    error_callback: () => { const res = pendingToken; pendingToken = null; res && res(null); },
  });
}
/* Se llama SIN await previo para conservar el gesto del usuario (evita que bloqueen la ventana) */
/* chooseAccount: muestra siempre el selector de cuentas de Google (para usar otra cuenta, p. ej. la de tu padre).
   Al reconectar se pide la MISMA cuenta que ya estaba (login_hint), así no se cuela otra sesión de Google del móvil. */
function getToken(interactive, chooseAccount = false) {
  if (!chooseAccount && token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
  if (!interactive) return Promise.resolve(null);
  initTokenClient();
  if (!tokenClient) { toast('Google aún se está cargando, inténtalo de nuevo'); return Promise.resolve(null); }
  const email = currentUser()?.email, opts = {};
  if (chooseAccount || !isConnected()) opts.prompt = 'select_account';
  else { opts.prompt = ''; if (email) opts.login_hint = email; }
  return new Promise(res => { pendingToken = res; tokenClient.requestAccessToken(opts); });
}
const currentUser = () => { try { return JSON.parse(store.get(LS.user, 'null')); } catch (e) { return null; } };
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
    out.push(...(j.items || []).map(c => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, summary: c.summary || '', override: c.summaryOverride || '',
      primary: !!c.primary, owner: c.accessRole === 'owner' }))); pt = j.nextPageToken || '';
  } while (pt);
  return out;
}
const isNamed = (c, n) => normName(c.name) === normName(n) || normName(c.summary) === normName(n);
/* Tu calendario «turnos_dj» (el tuyo, no uno compartido): lo usa si existe, renombra el antiguo «Nexora» o lo crea.
   Además busca el «turnos_dj» que te haya compartido tu socio, para copiar ahí los turnos de Two Generation's. */
let partnerCal = null;
async function ensureCalendar() {
  const cals = await listCalendars(), cached = store.get(LS.cal);
  let own = cals.find(c => c.id === cached && c.owner) || cals.find(c => c.owner && isNamed(c, CALENDAR_NAME));
  if (!own) {
    const old = cals.find(c => c.owner && LEGACY_NAMES.some(n => isNamed(c, n)));
    if (old) {
      await gfetch(`${CAL_API}/calendars/${encodeURIComponent(old.id)}`, jsonOpts('PATCH', { summary: CALENDAR_NAME }));
      if (old.override) await gfetch(`${CAL_API}/users/me/calendarList/${encodeURIComponent(old.id)}`, jsonOpts('PATCH', { summaryOverride: null })).catch(() => {});
      own = { ...old, name: CALENDAR_NAME }; toast(`Tu calendario «${old.name}» ahora se llama «${CALENDAR_NAME}»`);
    } else {
      const c = await (await gfetch(`${CAL_API}/calendars`, jsonOpts('POST', { summary: CALENDAR_NAME, timeZone: TZ, description: 'Turnos DJ: creado por la app de turnos' }))).json();
      own = { id: c.id, name: CALENDAR_NAME, owner: true }; toast(`Creado tu calendario «${CALENDAR_NAME}» en Google Calendar`);
    }
  }
  if (own.id !== cached) store.set(LS.cal, own.id);
  store.set(LS.calname, own.name);
  partnerCal = cals.find(c => c.id !== own.id && !c.owner && isNamed(c, CALENDAR_NAME))
    || cals.find(c => c.id !== own.id && c.id === store.get(LS.partner)) || null;
  if (partnerCal) store.set(LS.partner, partnerCal.id); else store.del(LS.partner);
  return own.id;
}
async function listRaw(calId, extra = {}) {
  const out = []; let pt = '';
  const base = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeZone: TZ,
    timeMin: '2025-01-01T00:00:00Z', timeMax: new Date(Date.now() + 730 * 864e5).toISOString(), ...extra });
  do {
    const q = new URLSearchParams(base); if (pt) q.set('pageToken', pt);
    const j = await (await gfetch(`${CAL_API}/calendars/${encodeURIComponent(calId)}/events?${q}`)).json();
    out.push(...(j.items || []).filter(e => e.status !== 'cancelled')); pt = j.nextPageToken || '';
  } while (pt);
  return out;
}

/* ───── Two Generation's: copia en el calendario del socio ─────
   Cada turno de Two Generation's lleva una marca (tg). En cada sincronización se compara tu calendario con el
   del socio: lo nuevo se copia, lo editado se actualiza con la versión más reciente y lo borrado se borra. */
const tombs = () => { try { return JSON.parse(store.get(LS.tomb, '[]')); } catch (e) { return []; } };
const addTomb = k => { if (k) store.set(LS.tomb, JSON.stringify([k, ...tombs().filter(x => x !== k)].slice(0, 300))); };
const tgKey = e => e.extendedProperties?.shared?.tg || '';
const isTGEvent = e => parseDesc(e.description).dj === TWO_GEN;
const evTime = t => t ? (t.dateTime ? Date.parse(t.dateTime) : t.date) : '';
const sameContent = (a, b) => (a.summary || '') === (b.summary || '') && (a.location || '') === (b.location || '')
  && stripHtml(a.description).trim() === stripHtml(b.description).trim() && evTime(a.start) === evTime(b.start) && evTime(a.end) === evTime(b.end);
const copyBody = (e, k) => ({ summary: e.summary || '', location: e.location || '', description: e.description || '', start: e.start, end: e.end,
  extendedProperties: { shared: { tg: k, kind: 'tg' } } });
async function reconcileTG(ownId, ownEvents) {
  if (!partnerCal) return false;
  const pPath = id => `${CAL_API}/calendars/${encodeURIComponent(partnerCal.id)}/events${id ? '/' + encodeURIComponent(id) : ''}`;
  const oPath = id => `${CAL_API}/calendars/${encodeURIComponent(ownId)}/events${id ? '/' + encodeURIComponent(id) : ''}`;
  let pEv;
  try { pEv = await listRaw(partnerCal.id, { sharedExtendedProperty: 'kind=tg' }); }
  catch (e) { if (e.auth) throw e; console.warn('socio', e); return false; }
  let changed = false;
  const ownBy = new Map(), dead = new Set(tombs());
  for (const e of ownEvents) {
    let k = tgKey(e);
    if (!k && isTGEvent(e)) {                           /* turnos de Two Generation's antiguos, sin marca */
      k = 'tg' + uid(); await gfetch(oPath(e.id), jsonOpts('PATCH', { extendedProperties: { shared: { tg: k, kind: 'tg' } } }));
      e.extendedProperties = { shared: { tg: k, kind: 'tg' } };
    }
    if (k) ownBy.set(k, e);
  }
  const pBy = new Map(pEv.filter(tgKey).map(e => [tgKey(e), e]));
  for (const [k, e] of ownBy) {
    const p = pBy.get(k), tg = isTGEvent(e);
    if (tg && !p) await gfetch(pPath(), jsonOpts('POST', copyBody(e, k)));
    else if (!tg && p) await gfetch(pPath(p.id), { method: 'DELETE' }).catch(() => {});
    else if (tg && p && !sameContent(e, p)) {
      if (Date.parse(p.updated) > Date.parse(e.updated)) { await gfetch(oPath(e.id), jsonOpts('PATCH', copyBody(p, k))); changed = true; }
      else await gfetch(pPath(p.id), jsonOpts('PATCH', copyBody(e, k)));
    }
  }
  for (const [k, p] of pBy) {
    if (ownBy.has(k)) continue;
    if (dead.has(k)) await gfetch(pPath(p.id), { method: 'DELETE' }).catch(() => {});   /* lo borraste tú */
    else { await gfetch(oPath(), jsonOpts('POST', copyBody(p, k))); changed = true; }      /* lo añadió tu socio */
  }
  return changed;
}
/* Envía a Google lo que hiciste sin conexión (o antes de que terminara de sincronizar) */
async function flush(calId) {
  const evPath = id => `${CAL_API}/calendars/${encodeURIComponent(calId)}/events${id ? '/' + encodeURIComponent(id) : ''}`;
  for (const snap of items.filter(i => i.pending)) {
    const it = items.find(x => x.id === snap.id); if (!it || !it.pending) continue;
    const rev = it.rev || 0, op = it.pending;
    if (op === 'delete') {
      addTomb(it.tg);
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
  try { const j = await (await gfetch('https://www.googleapis.com/oauth2/v3/userinfo')).json(); store.set(LS.user, JSON.stringify({ name: j.name, email: j.email })); return j; } catch (e) { return null; }
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
    let raw = await listRaw(calId);
    try { if (await reconcileTG(calId, raw)) raw = await listRaw(calId); }
    catch (e) { if (e.auth) throw e; console.warn('Two Generation\'s', e); }
    const remote = raw.map(fromEvent), merged = mergeRemote(remote);
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
    else { setSync(navigator.onLine ? 'error' : 'offline'); if (e.status === 403) toast('Google ha rechazado el acceso: vuelve a iniciar sesión y acepta todos los permisos'); }
    console.warn('sync', e);
  } finally { syncing = false; if (again) { again = false; setTimeout(() => sync(false), 400); } }
}
function markDirty() {
  changeSeq++; saveLocal();
  if (!isConnected()) return;
  setSync(navigator.onLine ? 'pending' : 'offline');
  clearTimeout(syncTimer); syncTimer = setTimeout(() => sync(false), 900);
}
const LOGIN_FAIL = 'No se pudo iniciar sesión con Google. Si es otra cuenta, tiene que estar autorizada en la app (usuarios de prueba de Google Cloud).';
async function connectGoogle() {
  const tok = await getToken(true);                         /* primera instrucción: conserva el gesto del toque */
  if (!tok) { toast(LOGIN_FAIL); return; }
  store.set(LS.conn, '1'); const u = await loadUser(); await sync(false); renderSelFoot(); if (owner) render();
  if (u?.email) toast('Conectado como ' + u.email);
}
/* Cambiar de cuenta de Google sin perder lo que aún no se ha enviado */
async function switchAccount() {
  const prevEmail = currentUser()?.email, pend = items.filter(i => i.pending).length;
  const tok = await getToken(true, true);                   /* primera instrucción: conserva el gesto del toque */
  if (!tok) { toast(LOGIN_FAIL); return; }
  const u = await loadUser();
  if (u?.email && u.email === prevEmail) { closeSheet(); toast('Sigues conectado como ' + u.email); return; }
  /* Otra cuenta: se vuelve a buscar el calendario y se recargan los turnos desde ella */
  [LS.cal, LS.calname, LS.last, LS.partner, LS.tomb].forEach(k => store.del(k)); partnerCal = null;
  items = items.filter(i => i.pending); saveLocal();
  store.set(LS.conn, '1'); closeSheet(); await sync(false); renderSelFoot(); if (owner) render();
  toast((u?.email ? 'Conectado como ' + u.email : 'Cuenta cambiada') + (pend ? `. Se han enviado ${plural(pend, 'cambio pendiente', 'cambios pendientes')}` : ''));
}
function disconnectGoogle() {
  if (!confirm('¿Cerrar sesión de Google? Se borrará la copia de turnos de este móvil (en tu Google Calendar siguen igual).')) return;
  try { if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {}); } catch (e) {}
  token = null; [LS.conn, LS.tok, LS.cal, LS.calname, LS.last, LS.user, LS.data, LS.partner, LS.tomb].forEach(k => store.del(k)); items = []; partnerCal = null;
  closeSheet(); setSync('local'); renderSelFoot(); if (owner) render(); toast('Sesión cerrada');
}
const SYNC_TEXT = { local: 'Sin conectar', ok: 'Sincronizado', syncing: 'Sincronizando…', pending: 'Guardando…', offline: 'Sin conexión', reauth: 'Toca para reconectar', error: 'Error · toca para reintentar', nocal: 'Elige el calendario' };
function setSync(s) {
  syncState = s;
  $$('[data-sync]').forEach(el => { el.dataset.s = s; const t = $('.txt', el); if (t) t.textContent = SYNC_TEXT[s]; });
}
const syncPill = () => `<button class="sync" data-act="sync" data-sync data-s="${syncState}" aria-label="Estado de Google Calendar">${EQ}<span class="txt">${SYNC_TEXT[syncState]}</span></button>`;

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
const DISPLAY = { 'Clement': 'CLEMENT', 'DJ Bota': 'DJ BOTA', [TWO_GEN]: "Two Generation's" };
const ICON = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 16-3-3 3-3M4 13h13M17 8l3 3-3 3"/></svg>',
  left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 4l9 7v8a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  disc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>',
  euro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6.5A7 7 0 1 0 18 17.5M4 10h10M4 14h10"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  avg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 17 6-6 4 4 8-8M15 7h6v6"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
};
const EQ = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';
const djColor = dj => OWNER_COLOR[dj] || 'rgba(236,232,255,.5)';
const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
const cap = s => s.replace(/^./, c => c.toUpperCase());
const addMonths = (k, n) => { const [y, m] = k.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + n, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`; };
const where = i => `${esc(i.local)}${i.local && i.lugar ? ', ' : ''}${esc(i.lugar)}`;
const hoursOf = i => Math.max(0, i.endMs - i.startMs) / 36e5;
const SECTIONS = [['inicio', 'Inicio', 'home'], ['turnos', 'Turnos', 'list'], ['calendario', 'Calendario', 'cal'], ['ingresos', 'Ingresos', 'chart']];

let showAllPast = false, calMonth = null, selDay = null, animate = true;
let period = store.get('turnos.period', 'mes'), tableTab = 'proximos', tableQ = '', tableAll = false, activeSec = 'inicio';
const goalKey = () => 'turnos.goal.' + owner;

/* Estado de un turno para la tabla */
function statusOf(i, now) {
  if (i.pending) return { t: 'Sin sincronizar', c: 'var(--money)' };
  if (!i.dj || !KNOWN.includes(i.dj)) return { t: 'Sin DJ', c: 'var(--danger)' };
  if (i.startMs <= now && now < i.endMs) return { t: 'Sonando', c: 'var(--ok)' };
  if (i.endMs < now) return { t: 'Cobrado', c: 'rgba(236,232,255,.6)' };
  const d = dayDiff(todayStr(), i.date);
  return d <= 0 ? { t: 'Hoy', c: 'var(--danger)' } : d === 1 ? { t: 'Mañana', c: 'var(--money)' } : { t: `En ${d} días`, c: 'var(--accent)' };
}

/* ── Cuenta atrás del próximo turno (se actualiza cada segundo sin repintar) ── */
function countdownHTML(startMs, endMs) {
  const now = Date.now();
  if (startMs <= now && now < endMs) return `<div class="cd live">Sonando ahora</div>`;
  const s = Math.max(0, Math.floor((startMs - now) / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  const u = (v, l) => `<div class="u"><b>${pad(v)}</b><span>${l}</span></div>`;
  return `<div class="cd" role="timer" aria-label="Faltan ${d} días, ${h} horas y ${m} minutos">${d ? u(d, 'días') + u(h, 'horas') + u(m, 'min') : u(h, 'horas') + u(m, 'min') + u(sec, 'seg')}</div>`;
}
function tickCountdown() {
  const el = $('#cdBox'); if (!el) return;
  if (Date.now() >= +el.dataset.end) { render(); return; }
  el.innerHTML = countdownHTML(+el.dataset.start, +el.dataset.end);
}
setInterval(() => { if (document.visibilityState === 'visible') tickCountdown(); }, 1000);

/* ── Bloques del panel ── */
function sparkSVG(vals) {
  const max = Math.max(...vals, 1), n = vals.length;
  const pts = vals.map((v, i) => [i / (n - 1) * 100, 30 - v / max * 26]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--kc)" stop-opacity=".35"/><stop offset="1" stop-color="var(--kc)" stop-opacity="0"/></linearGradient></defs>
    <path class="ar" d="${d} L100 32 L0 32Z" fill="url(#${gid})"/><path class="ln" d="${d}" pathLength="1"/></svg>`;
}
function kpisHTML(list, now) {
  const curK = todayStr().slice(0, 7), curY = curK.slice(0, 4);
  const inP = period === 'mes' ? i => i.date.startsWith(curK) : period === 'año' ? i => i.date.startsWith(curY) : () => true;
  const inPrev = period === 'mes' ? i => i.date.startsWith(addMonths(curK, -1)) : period === 'año' ? i => i.date.startsWith(String(curY - 1)) : null;
  const agg = f => { const l = list.filter(f), money = l.reduce((s, i) => s + i.cache, 0), h = l.reduce((s, i) => s + hoursOf(i), 0); return { n: l.length, money, h, avg: l.length ? money / l.length : 0 }; };
  const a = agg(inP), b = inPrev ? agg(inPrev) : null;
  const months = Array.from({ length: 8 }, (_, k) => addMonths(curK, k - 6)), per = months.map(k => agg(i => i.date.startsWith(k)));
  const prevName = period === 'mes' ? 'el mes pasado' : 'el año pasado';
  const delta = (v, p) => {
    if (!b) return `<span class="delta">Histórico</span>`;
    if (!p) return v ? `<span class="delta up">Nuevo</span>` : `<span class="delta">Sin datos</span>`;
    const pc = Math.round((v - p) / p * 100);
    return `<span class="delta ${pc >= 0 ? 'up' : 'down'}" title="Frente a ${prevName}">${pc >= 0 ? '▲' : '▼'} ${Math.abs(pc)}%</span>`;
  };
  const card = (label, icon, color, val, fmt, d, series) => `<div class="glass lift kpi" style="--kc:${color}">
    <div class="kpi-h"><span class="kpi-ic">${ICON[icon]}</span>${label}</div>
    <div class="kpi-v" data-count="${val}" data-fmt="${fmt}">${fmt === 'euro' ? euro(val) : fmt === 'h' ? Math.round(val) + 'h' : val}</div>
    <div class="kpi-f">${d}${sparkSVG(series)}</div></div>`;
  return `<div class="kpis">
    ${card('Ingresos', 'euro', 'var(--money)', a.money, 'euro', delta(a.money, b?.money), per.map(x => x.money))}
    ${card('Turnos', 'disc', 'var(--accent)', a.n, 'int', delta(a.n, b?.n), per.map(x => x.n))}
    ${card('Horas en cabina', 'clock', '#B18CFF', a.h, 'h', delta(a.h, b?.h), per.map(x => x.h))}
    ${card('Caché medio', 'avg', 'var(--ok)', a.avg, 'euro', delta(a.avg, b?.avg), per.map(x => x.avg))}</div>`;
}
function passHTML(n, today, now) {
  if (!n) return `<section class="glass pass empty"><div class="pass-top"><span>Próximo turno</span></div><h2>Agenda libre</h2>No hay turnos próximos en esta agenda. Añade uno con el botón + o desde el calendario.</section>`;
  const live = n.startMs <= now, u = live ? { t: 'En curso', c: 'var(--ok)' } : urgency(dayDiff(today, n.date));
  return `<section class="glass lift pass" style="--pc:${djColor(n.dj)}" aria-label="Próximo turno">
    <div class="pass-main">
      <div class="pass-top"><span>Próximo turno</span><span class="tag" style="--tc:${u.c}">${live ? EQ : ''}${u.t}</span></div>
      <h2>${esc(n.title)}</h2>
      <p class="pass-where">${where(n)}</p>
      <dl class="pass-info"><div><dt>Día</dt><dd>${cap(dateLabel(n.date))}</dd></div>
        <div><dt>Horario</dt><dd>${n.allDay ? 'Todo el día' : `${n.start}–${n.end}`}</dd></div>
        ${n.llevar ? `<div><dt>Llevar</dt><dd>${esc(n.llevar)}</dd></div>` : ''}
        ${n.dj === TWO_GEN ? `<div><dt>Con</dt><dd style="color:var(--tg)">Two Generation's</dd></div>` : ''}</dl>
    </div>
    <div class="pass-stub"><div id="cdBox" data-start="${n.startMs}" data-end="${n.endMs}">${countdownHTML(n.startMs, n.endMs)}</div>
      <div class="pass-cache"><span>Caché</span><b>${euro(n.cache)}</b></div></div>
    <i class="foil" aria-hidden="true"></i></section>`;
}
function weekHTML(up, today) {
  const lim = addDays(today, 7), l = up.filter(i => i.date <= lim);
  return `<section class="glass panel"><div class="ph"><div><h3>Próximos 7 días</h3><p>${l.length ? plural(l.length, 'turno', 'turnos') + ' · ' + euro(l.reduce((s, i) => s + i.cache, 0)) : 'Semana libre'}</p></div></div>
    <div class="week">${l.length ? l.map(i => `<button class="wk" style="--dc:${djColor(i.dj)}" data-act="edit" data-id="${esc(i.id)}" aria-label="Modificar ${esc(i.title)}">
      <div class="wd"><b>${+i.date.slice(8)}</b><span>${DOW_S[dowOf(i.date)]}</span></div>
      <div class="wt"><b>${esc(i.title)}</b><span>${i.allDay ? 'Todo el día' : `${i.start}–${i.end}`} · ${where(i)}</span></div>
      <div class="wc">${euro(i.cache)}</div></button>`).join('') : `<div class="tbl-empty">Nada en los próximos 7 días.</div>`}</div></section>`;
}
function chartHTML(list, now) {
  const curK = todayStr().slice(0, 7), mm = monthly(list, now);
  const ks = Array.from({ length: 12 }, (_, k) => addMonths(curK, k - 8));
  const max = Math.max(1, ...ks.map(k => (mm[k]?.c || 0) + (mm[k]?.p || 0)));
  const y = curK.slice(0, 4), yTot = Object.keys(mm).filter(k => k.startsWith(y)).reduce((s, k) => s + mm[k].c + mm[k].p, 0);
  return `<section class="glass panel anchor" id="ingresos"><div class="ph"><div><h3>Ingresos por mes</h3><p>Total ${y}: <b style="color:var(--money)">${euro(yTot)}</b></p></div>
      <div class="legend"><span><i style="background:rgba(255,255,255,.7)"></i>Cobrado</span><span><i style="background:var(--money)"></i>Previsto</span><span><i style="background:var(--accent)"></i>Este mes</span></div></div>
    <div class="chart" role="list">${ks.map((k, n) => { const x = mm[k] || { c: 0, p: 0 }, t = x.c + x.p, cur = k === curK;
      return `<div class="col${cur && t ? ' cur' : ''}${cur ? ' now' : ''}" role="listitem" tabindex="0" aria-label="${MON_L[+k.slice(5) - 1]} ${k.slice(0, 4)}: ${euro(t)}">
        <div class="trk"><div class="fill" style="height:${t ? Math.max(4, t / max * 100) : 0}%;animation-delay:${.3 + n * .05}s">${x.c ? `<i class="c" style="flex:${x.c}"></i>` : ''}${x.p ? `<i class="p" style="flex:${x.p}"></i>` : ''}</div>
        <span class="tip">${euro(t)}</span></div><span class="ml">${MON_S[+k.slice(5) - 1]}</span></div>`; }).join('')}</div></section>`;
}
function tableRows(list, now) {
  const q = normName(tableQ);
  let l = tableTab === 'proximos' ? list.filter(i => i.endMs >= now).sort(byStart) : tableTab === 'pasados' ? list.filter(i => i.endMs < now).sort((a, b) => b.startMs - a.startMs) : [...list].sort((a, b) => b.startMs - a.startMs);
  if (q) l = l.filter(i => normName([i.title, i.local, i.lugar, i.llevar, DISPLAY[i.dj] || ''].join(' ')).includes(q));
  const shown = tableAll ? l : l.slice(0, 8);
  const rows = shown.map(i => { const s = statusOf(i, now); return `<tr class="${i.endMs < now ? 'past' : ''}" style="--dc:${djColor(i.dj)}">
    <td class="c-d"><div class="t-date"><b>${+i.date.slice(8)}</b><span>${DOW_S[dowOf(i.date)]}<br>${MON_S[+i.date.slice(5, 7) - 1]} ${i.date.slice(2, 4)}</span></div></td>
    <td class="c-n"><div class="t-name"><b>${esc(i.title)}</b><span>${where(i)}</span></div></td>
    <td class="c-h">${i.allDay ? 'Todo el día' : `${i.start}–${i.end}<br><span style="color:var(--text3);font-size:12.5px">${fmtDur(i.endMs - i.startMs)}</span>`}</td>
    <td class="c-c"><span class="t-cache">${euro(i.cache)}</span></td>
    <td class="c-s"><span class="st" style="--sc:${s.c}">${s.t}</span>${i.dj === TWO_GEN ? ` <span class="st" style="--sc:var(--tg)">Two Gen</span>` : ''}</td>
    <td class="c-a"><div class="act"><button data-act="edit" data-id="${esc(i.id)}" aria-label="Modificar ${esc(i.title)}">${ICON.edit}</button><button class="del" data-act="del" data-id="${esc(i.id)}" aria-label="Eliminar ${esc(i.title)}">${ICON.del}</button></div></td></tr>`; }).join('');
  return { html: l.length ? `<table class="tbl"><thead><tr><th>Fecha</th><th>Turno</th><th>Horario</th><th>Caché</th><th>Estado</th><th><span class="hidden">Acciones</span></th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="tbl-empty">${q ? `Ningún turno coincide con «${esc(tableQ)}».` : tableTab === 'proximos' ? 'No hay turnos próximos. Pulsa + para añadir uno.' : 'Todavía no hay turnos aquí.'}</div>`,
    foot: l.length ? `<span>${plural(l.length, 'turno', 'turnos')} · ${euro(l.reduce((s, i) => s + i.cache, 0))}</span>${l.length > 8 ? `<button class="btn small" data-act="tblMore">${tableAll ? 'Ver menos' : `Ver los ${l.length}`}</button>` : ''}` : '' };
}
function tableHTML(list, now) {
  const r = tableRows(list, now), tabs = [['proximos', 'Próximos'], ['pasados', 'Pasados'], ['todos', 'Todos']];
  return `<section class="glass panel anchor" id="turnos"><div class="ph"><div><h3>Turnos</h3><p>Toca el lápiz para modificar o la papelera para borrar.</p></div>
      <div class="tbar"><label class="search">${ICON.search}<input id="tblQ" type="search" placeholder="Buscar sala, pueblo…" value="${esc(tableQ)}" aria-label="Buscar turnos"></label>
      <div class="seg sm" role="tablist">${tabs.map(([k, t]) => `<button role="tab" aria-selected="${tableTab === k}" class="${tableTab === k ? 'on' : ''}" data-act="tblTab" data-k="${k}">${t}</button>`).join('')}</div></div></div>
    <div id="tblBody">${r.html}</div><div class="tfoot" id="tblFoot">${r.foot}</div></section>`;
}
function refreshTable() { const r = tableRows(panelItems(), Date.now()); $('#tblBody').innerHTML = r.html; $('#tblFoot').innerHTML = r.foot; }
function calendarHTML(list) {
  const byDay = {}; list.forEach(i => (byDay[i.date] = byDay[i.date] || []).push(i));
  const today = todayStr(), ms = calMonth, off = (dowOf(ms) + 6) % 7, gs = addDays(ms, -off), mIdx = +ms.slice(5, 7) - 1;
  let cells = '';
  for (let k = 0; k < 42; k++) {
    const d = addDays(gs, k), ev = byDay[d] || [], n = ev.length, cls = ['day']; if (+d.slice(5, 7) - 1 !== mIdx) cls.push('out'); if (d === today) cls.push('today'); if (n) cls.push('has'); if (d === selDay) cls.push('sel');
    cells += `<button class="${cls.join(' ')}" data-act="day" data-d="${d}" aria-pressed="${d === selDay}" aria-label="${dateLabel(d)}${n ? ', ' + plural(n, 'turno', 'turnos') : ''}">${+d.slice(8)}<span class="dots">${ev.slice(0, 3).map(i => `<i style="--dc:${djColor(i.dj)}"></i>`).join('')}</span></button>`;
  }
  let detail = '';
  if (selDay) {
    const ev = (byDay[selDay] || []).sort(byStart), dw = dowOf(selDay);
    detail = `<div class="detail"><h4>${cap(dateLabel(selDay))}</h4>
      ${ev.map(i => `<div class="drow" style="--dc:${djColor(i.dj)}"><div class="t-name"><b>${esc(i.title)}</b><span>${i.allDay ? 'Todo el día' : `${i.start}–${i.end}`} · ${where(i)}</span></div><span class="t-cache" style="font-size:20px">${euro(i.cache)}</span>
        <div class="act"><button data-act="edit" data-id="${esc(i.id)}" aria-label="Modificar ${esc(i.title)}">${ICON.edit}</button><button class="del" data-act="del" data-id="${esc(i.id)}" aria-label="Eliminar ${esc(i.title)}">${ICON.del}</button></div></div>`).join('') || `<div class="tbl-empty" style="padding:8px 0 4px;text-align:left">Sin turnos este día.</div>`}
      <div class="quick">${LACLUB.cache[dw] ? `<button class="btn small primary" data-act="quick" data-d="${selDay}">${ICON.bolt}Añadir ${LACLUB.title} (${LACLUB.cache[dw]}€)</button>` : ''}<button class="btn small" data-act="add" data-d="${selDay}">${ICON.plus}Turno a mano</button></div></div>`;
  }
  return `<section class="glass panel anchor" id="calendario"><div class="cal-h"><div class="ph" style="margin:0"><div><h3>${MON_L[mIdx]} ${ms.slice(0, 4)}</h3><p>Toca un día para ver o añadir turnos</p></div></div><div class="nav"><button class="iconbtn" data-act="prev" aria-label="Mes anterior">${ICON.left}</button><button class="iconbtn" data-act="next" aria-label="Mes siguiente">${ICON.right}</button></div></div>
    <div class="grid">${['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(x => `<div class="dow">${x}</div>`).join('')}${cells}</div>${detail}</section>`;
}
function venuesHTML(list) {
  const m = {};
  for (const i of list) { const k = (i.local || i.lugar || 'Sin local').trim(), x = m[k] || (m[k] = { n: 0, money: 0, lugar: i.lugar }); x.n++; x.money += i.cache; }
  const top = Object.entries(m).sort((a, b) => b[1].money - a[1].money).slice(0, 5), max = top[0]?.[1].money || 1;
  return `<section class="glass panel"><div class="ph"><div><h3>Locales que más pagan</h3><p>Ingresos totales por sala</p></div></div>
    ${top.length ? `<div class="rank">${top.map(([k, x], n) => `<div class="rk"><span class="pos">${n + 1}</span><div style="min-width:0"><div class="nm">${esc(k)}</div><div class="sub">${plural(x.n, 'turno', 'turnos')}${x.lugar && x.lugar !== k ? ' · ' + esc(x.lugar) : ''}</div></div><span class="val">${euro(x.money)}</span>
      <div class="meter"><i style="width:${x.money / max * 100}%;animation-delay:${.5 + n * .08}s"></i></div></div>`).join('')}</div>` : `<div class="tbl-empty">Aún no hay locales.</div>`}</section>`;
}
function goalHTML(list, now) {
  const curK = todayStr().slice(0, 7), mm = monthly(list, now), cm = mm[curK] || { c: 0, p: 0 }, got = cm.c + cm.p;
  let goal = parseFloat(store.get(goalKey(), ''));
  if (!(goal > 0)) { const prev = [1, 2, 3].map(n => mm[addMonths(curK, -n)]).filter(Boolean).map(x => x.c + x.p); goal = Math.max(100, Math.ceil((prev.length ? Math.max(...prev) : 400) / 50) * 50); }
  const pct = Math.min(1, got / goal), left = Math.max(0, goal - got);
  return `<section class="glass panel"><div class="ph"><div><h3>Objetivo de ${MON_L[+curK.slice(5) - 1].toLowerCase()}</h3><p>Cobrado y previsto este mes</p></div></div>
    <div class="goal"><div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="gGoal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent)"/><stop offset="1" stop-color="var(--money)"/></linearGradient></defs>
      <circle class="tr" cx="60" cy="60" r="50" fill="none"/><circle class="pr" cx="60" cy="60" r="50" fill="none" pathLength="1" stroke-dasharray="1" stroke-dashoffset="${(1 - pct).toFixed(4)}" style="${pct ? '' : 'opacity:0'}"/></svg>
      <div class="in"><div><b>${Math.round(got / goal * 100)}%</b><span>conseguido</span></div></div></div>
    <div class="goal-t"><b>${euro(got)}</b><p>de ${euro(goal)}${left ? `: faltan ${euro(left)}` : ': ¡objetivo cumplido!'}</p><button class="btn small" data-act="goal">Cambiar objetivo</button></div></div></section>`;
}
function greeting() {
  const h = +wall(Date.now()).time.slice(0, 2);
  return h >= 6 && h < 14 ? 'Buenos días' : h >= 14 && h < 21 ? 'Buenas tardes' : 'Buenas noches';
}
function viewPanel() {
  const list = panelItems(), now = Date.now(), today = todayStr();
  const up = list.filter(i => i.endMs >= now).sort(byStart);
  const who = owner === 'Clement' ? `<img class="wm" src="img/clement.png" alt="CLEMENT">` : `<img class="disc" src="img/bota.png" alt=""><span class="nm">DJ BOTA</span>`;
  const periods = [['mes', 'Este mes'], ['año', 'Este año'], ['todo', 'Todo']];
  return `<header class="glass topbar"><button class="who" data-act="switch" aria-label="Cambiar de agenda (ahora: ${DISPLAY[owner]})">${who}<span class="sw">${ICON.swap}</span></button>
      <nav class="tabs" aria-label="Secciones">${SECTIONS.map(([k, t, ic]) => `<button data-act="go" data-to="${k}" class="${activeSec === k ? 'on' : ''}">${ICON[ic]}${t}</button>`).join('')}</nav>
      <div class="tools">${syncPill()}<button class="btn primary small addtop" data-act="add">${ICON.plus}Añadir turno</button><button class="iconbtn" data-act="settings" aria-label="Ajustes">${ICON.gear}</button></div></header>
    <div class="board">
      <div class="hello anchor o-hello" id="inicio"><div><h1>${greeting()}, ${DISPLAY[owner]}</h1><p>${cap(dateLabel(today))}. ${up.length ? `Tienes ${plural(up.length, 'turno próximo', 'turnos próximos')}.` : 'No tienes turnos próximos.'}</p></div>
        <div class="glass seg" role="tablist" aria-label="Periodo de las cifras">${periods.map(([k, t]) => `<button role="tab" aria-selected="${period === k}" class="${period === k ? 'on' : ''}" data-act="period" data-k="${k}">${t}</button>`).join('')}</div></div>
      ${!isConnected() ? `<div class="glass connect o-connect"><div><b>Conecta tu Google Calendar</b><span>Inicia sesión: tus turnos se guardan en tu calendario «turnos_dj» (si no existe, se crea).</span></div><button class="btn primary" data-act="connect">Iniciar sesión con Google</button></div>` : ''}
      <div class="o-kpis">${kpisHTML(list, now)}</div>
      <div class="c-8 o-chart">${chartHTML(list, now)}</div>
      <div class="c-4 o-pass">${passHTML(up[0], today, now)}</div>
      <div class="c-7 o-table">${tableHTML(list, now)}</div>
      <div class="c-5 o-week">${weekHTML(up, today)}</div>
      <div class="c-5 c-half o-cal">${calendarHTML(list)}</div>
      <div class="c-4 c-half o-venues">${venuesHTML(list)}</div>
      <div class="c-3 c-half o-goal">${goalHTML(list, now)}</div>
    </div>`;
}
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
/* Las cifras suben desde cero la primera vez que se abre el panel */
function countUp(root) {
  if (reduceMotion()) return;
  $$('[data-count]', root).forEach(el => {
    const to = +el.dataset.count, f = el.dataset.fmt; if (!to) return;
    const fmt = v => f === 'euro' ? euro(Math.round(v)) : f === 'h' ? Math.round(v) + 'h' : String(Math.round(v)), fin = f === 'euro' ? euro(to) : f === 'h' ? Math.round(to) + 'h' : String(to);
    const t0 = performance.now() + 250, dur = 1300;
    const step = t => { const p = Math.max(0, Math.min(1, (t - t0) / dur)), e = 1 - Math.pow(1 - p, 4); el.textContent = p < 1 ? fmt(to * e) : fin; if (p < 1) requestAnimationFrame(step); };
    el.textContent = fmt(0); requestAnimationFrame(step);
  });
}
function renderDock() {
  $('#dock').innerHTML = SECTIONS.slice(0, 2).map(([k, t, ic]) => `<button data-act="go" data-to="${k}" class="${activeSec === k ? 'on' : ''}" aria-label="${t}">${ICON[ic]}<span class="lbl">${t}</span></button>`).join('')
    + `<button class="add" data-act="add" aria-label="Añadir turno">${ICON.plus}<span class="lbl">Añadir turno</span></button>`
    + SECTIONS.slice(2).map(([k, t, ic]) => `<button data-act="go" data-to="${k}" class="${activeSec === k ? 'on' : ''}" aria-label="${t}">${ICON[ic]}<span class="lbl">${t}</span></button>`).join('');
}
function setActive(k) { activeSec = k; $$('[data-act="go"]').forEach(b => b.classList.toggle('on', b.dataset.to === k)); }
let secObs = null;
function observeSections() {
  secObs?.disconnect(); if (!('IntersectionObserver' in window)) return;
  secObs = new IntersectionObserver(es => { const v = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]; if (v) setActive(v.target.id); }, { rootMargin: '-35% 0px -55% 0px' });
  SECTIONS.forEach(([k]) => { const el = document.getElementById(k); if (el) secObs.observe(el); });
}
function render() {
  if (!owner) return;
  const y = window.scrollY, first = animate, focusQ = document.activeElement?.id === 'tblQ';
  $('#view').innerHTML = `<div class="${first ? 'enter' : ''}">${viewPanel()}</div>`; animate = false; window.scrollTo(0, y);
  document.documentElement.style.setProperty('--accent', OWNER_COLOR[owner]);
  document.documentElement.dataset.owner = owner;
  setSync(syncState); renderDock(); observeSections();
  if (focusQ) { const q = $('#tblQ'); q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  if (first) countUp($('#view'));
}
function renderSelFoot() {
  const u = (() => { try { return JSON.parse(store.get(LS.user, 'null')); } catch (e) { return null; } })();
  $('#selFoot').innerHTML = isConnected()
    ? `${syncPill()}<span class="mail">${u?.email ? esc(u.email) : 'Conectado a Google Calendar'}</span><button class="btn small" data-act="account">Cambiar de cuenta</button>`
    : `<button class="btn primary" data-act="connect">Iniciar sesión con Google</button><span class="mail">Tus turnos se guardan en tu calendario «turnos_dj»</span>`;
  setSync(syncState);
}
function openGoal() {
  const cur = parseFloat(store.get(goalKey(), '')) || '';
  openSheet(`<h3>Objetivo del mes</h3><p class="ms">Cuánto quieres facturar cada mes en la agenda de ${DISPLAY[owner]}. Se guarda en este móvil.</p>
    <form id="goalForm"><div class="f"><label for="g_val">Objetivo (€)</label><input id="g_val" type="number" min="1" step="any" inputmode="decimal" value="${cur}" placeholder="600" required></div>
    <div class="mact"><button type="button" class="btn" data-act="closeSheet">Cancelar</button><button class="btn primary" type="submit">Guardar objetivo</button></div></form>`);
  setTimeout(() => $('#g_val')?.focus({ preventScroll: true }), 80);
}

/* Brillo del cristal y lámina del pase: siguen al dedo o al ratón */
document.addEventListener('pointermove', e => {
  if (reduceMotion()) return;
  const g = e.target.closest?.('.glass, .owner'); if (!g) return;
  const r = g.getBoundingClientRect();
  g.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); g.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
}, { passive: true });
document.addEventListener('input', e => {
  if (e.target.id === 'tblQ') { tableQ = e.target.value; tableAll = false; refreshTable(); }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'goalForm') return; e.preventDefault();
  const v = parseFloat(String($('#g_val').value).replace(',', '.'));
  if (!(v > 0)) { $('#g_val').focus(); return; }
  store.set(goalKey(), String(v)); closeSheet(); render(); toast('Objetivo guardado');
});

/* ───────────── formulario ───────────── */
let editingId = null;
function openForm(it, presetDate) {
  editingId = it ? it.id : null;
  $('#mTitle').textContent = it ? 'Modificar turno' : 'Nuevo turno';
  $('#mSub').textContent = it ? 'Puedes reasignarlo a otro DJ si hace falta.' : `Se añade a la agenda de ${DISPLAY[owner]}; puedes cambiarlo abajo.`;
  const dj = it ? (KNOWN.includes(it.dj) ? it.dj : owner) : owner;
  $('#f_dj').value = dj;
  $('#f_title').value = it ? it.title : ''; $('#f_lugar').value = it ? it.lugar : ''; $('#f_local').value = it ? it.local : '';
  $('#f_date').value = it ? it.date : (presetDate || todayStr()); $('#f_cache').value = it ? numStr(it.cache) : '';
  $('#f_start').value = it && !it.allDay ? it.start : ''; $('#f_end').value = it && !it.allDay ? it.end : ''; $('#f_llevar').value = it ? it.llevar : '';
  $('#ferr').classList.remove('show'); $('#modal').classList.add('show'); $('#modal').setAttribute('aria-hidden', 'false'); setTimeout(() => $('#f_title').focus({ preventScroll: true }), 80);
}
function openQuick(date) {
  openForm(null, date);
  $('#f_title').value = LACLUB.title; $('#f_lugar').value = LACLUB.lugar; $('#f_local').value = LACLUB.local;
  $('#f_start').value = LACLUB.start; $('#f_end').value = LACLUB.end; $('#f_llevar').value = LACLUB.llevar; $('#f_cache').value = LACLUB.cache[dowOf(date)] ?? '';
}
const closeModal = () => { $('#modal').classList.remove('show'); $('#modal').setAttribute('aria-hidden', 'true'); };
function submitForm(ev) {
  ev.preventDefault();
  const v = id => $('#' + id).value.trim(), err = $('#ferr');
  const date = v('f_date'), start = v('f_start'), end = v('f_end'), cache = parseFloat(String(v('f_cache')).replace(',', '.'));
  if (!v('f_title') || !v('f_lugar') || !v('f_local') || !date || !start || !end || !isFinite(cache) || cache < 0) { err.textContent = 'Rellena todos los campos obligatorios.'; err.classList.add('show'); return; }
  const endDate = end <= start ? addDays(date, 1) : date;
  const base = editingId ? items.find(x => x.id === editingId) : null;
  const it = { id: base ? base.id : 'tmp_' + uid(), tg: base?.tg || '', title: v('f_title'), dj: v('f_dj'), lugar: v('f_lugar'), local: v('f_local'), llevar: v('f_llevar'), cache,
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
const closeSheet = () => { $('#sheet').classList.remove('show'); $('#sheet').setAttribute('aria-hidden', 'true'); };
function openSheet(html) { $('#sheetBody').innerHTML = html; $('#sheet').classList.add('show'); $('#sheet').setAttribute('aria-hidden', 'false'); }
function openSettings() {
  const u = (() => { try { return JSON.parse(store.get(LS.user, 'null')); } catch (e) { return null; } })(), last = +store.get(LS.last, 0);
  openSheet(`<h3>Ajustes</h3><p class="ms">Los turnos se guardan en tu Google Calendar.</p>
    <div class="kv"><span>Cuenta</span><span>${esc(u?.email || (isConnected() ? 'Conectada' : 'Sin conectar'))}</span></div>
    <div class="kv"><span>Tu calendario</span><span>${esc(store.get(LS.calname) || CALENDAR_NAME)}</span></div>
    <div class="kv"><span>Calendario del socio</span><span>${store.get(LS.partner) ? 'Compartido: los turnos de Two Generation\'s se copian en los dos' : 'Sin compartir todavía'}</span></div>
    <div class="kv"><span>Última sincronización</span><span>${last ? new Intl.DateTimeFormat('es-ES', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(last) : '—'}</span></div>
    <p class="note">Cada cuenta de Google tiene su propio calendario «${CALENDAR_NAME}». Para que los turnos de Two Generation's salgan en los dos, cada uno comparte su «${CALENDAR_NAME}» con el otro con el permiso «Hacer cambios en eventos»; el resto de turnos se queda solo en el calendario de cada uno.</p>
    <p class="note">Se actualiza solo cada minuto con la app abierta y al volver a ella. Si no tienes internet puedes seguir añadiendo y editando turnos: se enviarán al reconectar. Cada hora Google pide reconectar: toca el indicador de estado.</p>
    <div class="mact" style="flex-wrap:wrap">${isConnected() ? `<button class="btn primary" data-act="syncnow">Sincronizar ahora</button><button class="btn" data-act="account">Cambiar de cuenta</button><button class="btn danger" data-act="logout">Cerrar sesión</button>` : `<button class="btn primary" data-act="connect">Iniciar sesión con Google</button>`}<button class="btn" data-act="closeSheet">Cerrar</button></div>`);
}
async function openPickCal(list) {
  if (!list) { if (!(await getToken(false))) { toast('Toca el indicador de estado para reconectar'); return; } try { list = await listCalendars(); } catch (e) { toast('No se pudo leer tu lista de calendarios'); return; } }
  openSheet(`<h3>Elige el calendario de turnos</h3><p class="ms">${list.length ? `No he encontrado uno llamado «${esc(CALENDAR_NAME)}» en ${esc(currentUser()?.email || 'esta cuenta')}. Elige dónde están tus turnos:` : `${esc(currentUser()?.email || 'Esta cuenta')} no tiene calendarios en los que se pueda escribir.`} Si «${esc(CALENDAR_NAME)}» es de otra cuenta, compártelo con esta con el permiso «Hacer cambios en eventos».</p>
    <div class="list-pick">${list.map(c => `<button class="btn" data-act="choosecal" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${esc(c.name)}${c.primary ? ' (principal)' : ''}</button>`).join('')}</div>
    <div class="mact"><button class="btn" data-act="account">Usar otra cuenta</button><button class="btn" data-act="closeSheet">Cancelar</button></div>`);
}

/* ───────────── eventos de la interfaz ───────────── */
/* Cambio de agenda con transición suave donde el navegador lo permite */
function transition(fn) { if (document.startViewTransition && !reduceMotion()) document.startViewTransition(fn); else fn(); }
function chooseOwner(o) {
  owner = o; selDay = null; tableQ = ''; tableAll = false; tableTab = 'proximos'; activeSec = 'inicio'; animate = true; calMonth = todayStr().slice(0, 7) + '-01';
  transition(() => { $('#selector').classList.add('hidden'); $('#dock').classList.remove('hidden'); render(); window.scrollTo(0, 0); });
  if (isConnected()) sync(false);
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) { if (e.target.classList?.contains('overlay')) { closeModal(); closeSheet(); } return; }
  const a = t.dataset.act, id = t.dataset.id, d = t.dataset.d;
  switch (a) {
    case 'own': chooseOwner(t.dataset.own); break;
    case 'switch': transition(() => { $('#selector').classList.remove('hidden'); $('#dock').classList.add('hidden'); renderSelFoot(); }); break;
    case 'connect': connectGoogle(); break;
    case 'sync': if (!isConnected()) connectGoogle(); else if (syncState === 'nocal') openPickCal(); else sync(true); break;
    case 'syncnow': closeSheet(); sync(true); break;
    case 'settings': openSettings(); break;
    case 'closeSheet': closeSheet(); break;
    case 'logout': disconnectGoogle(); break;
    case 'account': switchAccount(); break;
    case 'pickcal': openPickCal(); break;
    case 'choosecal': store.set(LS.cal, id); store.set(LS.calname, t.dataset.name); closeSheet(); toast('Calendario elegido'); sync(true); break;
    case 'add': openForm(null, d); break;
    case 'quick': openQuick(d); break;
    case 'edit': { const it = items.find(x => x.id === id); if (it) openForm(it); break; }
    case 'del': deleteItem(id); break;
    case 'day': selDay = selDay === d ? null : d; if (selDay && selDay.slice(0, 7) !== calMonth.slice(0, 7)) calMonth = selDay.slice(0, 7) + '-01'; render(); break;
    case 'prev': calMonth = addDays(calMonth, -1).slice(0, 7) + '-01'; render(); break;
    case 'next': calMonth = addDays(calMonth, 32).slice(0, 7) + '-01'; render(); break;
    case 'go': { const el = document.getElementById(t.dataset.to); if (el) { setActive(t.dataset.to); el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); } break; }
    case 'period': period = t.dataset.k; store.set('turnos.period', period); render(); countUp($('.kpis')); break;
    case 'tblTab': tableTab = t.dataset.k; tableAll = false; render(); break;
    case 'tblMore': tableAll = !tableAll; refreshTable(); break;
    case 'goal': openGoal(); break;
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
