'use strict';

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const stC = s => ({ 'Bloqueado': 's-bloq', 'En progreso': 's-prog', 'En revisión': 's-rev', 'Completado': 's-ok', 'Por hacer': 's-todo' }[s] || 's-todo');
const COLS = ['Por hacer', 'En progreso', 'Bloqueado', 'Completado'];
const TZ = 'America/Mexico_City';
const TIPO_LBL = { drive: 'Drive', excel: 'Excel', miro: 'Miro', otro: 'Enlace' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const initials = n => String(n || '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
const primer = n => String(n || '').split(' ')[0];
const toDM = iso => { if (!iso) return '—'; const [, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}`; };
const plural = (n, uno, varios) => (n === 1 ? uno : varios);
const corto = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'enlace'; } };

const HOME = { lider: 'inicio', sublider: 'inicio', dev: 'dinicio' };
const VISTAS_EQUIPO = ['inicio', 'proyectos', 'revisar', 'bloqueos', 'persona'];
const VISTAS_MIAS = ['dinicio', 'misact', 'misblk'];
const ALLOWED = { lider: [...VISTAS_EQUIPO, 'admin'], sublider: [...VISTAS_EQUIPO, ...VISTAS_MIAS], dev: VISTAS_MIAS };
const ROL_LBL = { lider: 'Líder del equipo', sublider: 'Sublíder', dev: 'Colaborador' };

let S = null;      // estado que devuelve /api/estado
let role = null;
let me = null;
let focus = 0;     // id del colaborador en revisión (líder)
let EDIT = null;   // { id, titulo } de la actividad en edición (colaborador)

/* ---------- API ---------- */
async function api(url, opt = {}) {
  let r;
  try {
    r = await fetch(url, {
      method: opt.method || 'GET',
      headers: opt.body ? { 'Content-Type': 'application/json' } : {},
      body: opt.body ? JSON.stringify(opt.body) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new Error('No hay conexión con el servidor.');
  }
  let d = {};
  try { d = await r.json(); } catch { /* respuesta vacía */ }
  if (r.status === 401 && !opt.sinRedireccion && role) mostrarLogin();
  if (!r.ok) throw new Error(d.error || 'Ocurrió un error. Inténtalo de nuevo.');
  return d;
}

function toast(m) {
  const t = $('toast');
  // Con una ventana abierta, el aviso va dentro de la de más arriba para quedar por encima del fondo oscuro.
  const arriba = ['msg', 'dlg'].map($).find(d => d && d.open);
  (arriba || document.body).append(t);
  t.textContent = m;
  t.hidden = false;
  clearTimeout(toast.h);
  toast.h = setTimeout(() => (t.hidden = true), 2800);
}

// Ejecuta una acción contra la API, recarga el estado y avisa.
async function accion(fn, msg, btn, recargar = true) {
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (recargar) await cargar();
    if (msg) toast(msg);
  } catch (err) {
    toast(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function cargar() {
  S = await api('/api/estado');
  renderAll();
}

// Actualización automática: cada 30 s con la pestaña visible, y al volver a ella.
const REFRESCO_MS = 30_000;
let refrescando = false;
async function refrescar() {
  if (!role || !S || refrescando || document.hidden) return;
  refrescando = true;
  $('ppl-upd').classList.add('sync');
  try {
    await cargar();
  } catch {
    /* se reintenta en el siguiente ciclo */
  } finally {
    refrescando = false;
    $('ppl-upd').classList.remove('sync');
  }
}
setInterval(refrescar, REFRESCO_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refrescar(); });

/* ---------- consultas sobre el estado ---------- */
const P = id => S.proyectos.find(p => p.id === +id);
// Alcance según rol: "equipo" = lo que supervisa (líder: todo; sublíder: su equipo) · "mío" = lo que registra
const supervisaR = () => role === 'lider' || role === 'sublider';
const registraR = () => role === 'dev' || role === 'sublider';
const esMia = x => !!me && x.responsable_id === me.id;
const AE = () => (role === 'lider' ? S.actividades : S.actividades.filter(a => !esMia(a)));
const BE = () => (role === 'lider' ? S.bloqueos : S.bloqueos.filter(b => !esMia(b)));
const FE = () => (role === 'lider' ? S.feed : S.feed.filter(f => f.usuario_id !== me.id));
const AM = () => S.actividades.filter(esMia);
const BM = () => S.bloqueos.filter(esMia);
const misProyectos = () => S.proyectos.filter(p => p.soy_miembro || AM().some(a => a.proyecto_id === p.id));
const actsDe = pid => AE().filter(a => a.proyecto_id === pid);
const vencida = a => a.estatus !== 'Completado' && a.fecha_vencimiento && a.fecha_vencimiento < S.hoy;
const persona = id => (S.personas || []).find(p => p.id === +id);
const linkChips = ls => ls.map(l => `<a class="lk" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.titulo || l.url)}">${esc(TIPO_LBL[l.tipo] || l.tipo)}</a>`).join('');
function projLinks(p) {
  const vistos = new Set();
  return [...p.enlaces, ...actsDe(p.id).flatMap(a => a.enlaces)].filter(l => !vistos.has(l.url) && vistos.add(l.url));
}
const barColor = st => (st === 'Bloqueado' ? 'var(--crit)' : st === 'Completado' ? 'var(--ok)' : 'var(--accent)');
const barMini = a => (a.avance_pct && a.avance_pct < 100 ? `<div class="bar" style="min-width:0"><i><span style="width:${a.avance_pct}%"></span></i><em>${a.avance_pct}%</em></div>` : '');
function revPill(a) {
  if (a.estatus !== 'Completado') return '';
  return a.revisada ? '<span class="pill s-ok" style="justify-self:start">Revisada</span>' : '<span class="pill s-rev" style="justify-self:start">Pendiente de revisión</span>';
}
function hora(ts) {
  const d = new Date(ts);
  const dia = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const h = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return dia === S.hoy ? h : `${toDM(dia)} ${h}`;
}
const resumen = f => `${f.cliente.toUpperCase()} · ${f.titulo} | ${f.avance_pct}% | ${f.estatus}`;
const nombreLider = () => (S && S.lider) || 'tu líder';

/* ---------- líder: panel general ---------- */
const projsFor = () => S.proyectos.filter(p => (role === 'lider' || p.del_equipo) && (!focus || AE().some(a => a.proyecto_id === p.id && a.responsable_id === focus)));

function fillCli() {
  const cur = $('fcli').value;
  const cs = [...new Set(projsFor().map(p => p.cliente))].sort((a, b) => a.localeCompare(b, 'es'));
  $('fcli').innerHTML = '<option value="">Todos los clientes</option>' + cs.map(c => `<option>${esc(c)}</option>`).join('');
  if (cs.includes(cur)) $('fcli').value = cur;
}

function renderProj() {
  const f = $('fcli').value;
  const rows = projsFor().filter(p => !f || p.cliente === f);
  $('tproj').innerHTML = rows.length
    ? '<table><thead><tr><th>Proyecto</th><th>Responsable</th><th>Avance</th><th>Estatus</th><th>Compromiso</th><th>Enlaces</th></tr></thead><tbody>' +
      rows.map(p => `<tr><td><button type="button" class="linkbtn" data-kb="${p.id}"><b>${esc(p.cliente)}</b></button><br><span class="muted" style="font-size:.8rem">${esc(p.nombre)}</span></td><td>${esc(p.responsable || '—')}</td>
      <td><div class="bar"><i><span style="width:${p.pct}%;background:${barColor(p.estatus)}"></span></i><em>${p.pct}%</em></div></td>
      <td><span class="pill ${stC(p.estatus)}">${p.estatus}</span></td><td class="num">${toDM(p.fecha_compromiso)}</td><td><div class="links">${linkChips(projLinks(p))}</div></td></tr>`).join('') +
      '</tbody></table>'
    : '<p class="muted">Sin proyectos. Crea uno desde Administración.</p>';
}

function renderFeed() {
  const it = FE().filter(x => !focus || x.usuario_id === focus).slice(0, 8);
  $('feed').innerHTML = it.length
    ? it.map(f => `<li><span class="avatar">${esc(initials(f.usuario))}</span><span class="sumline">${esc(resumen(f))}</span><span class="meta"><b style="color:var(--ink)">${esc(f.usuario)}</b> · ${hora(f.creado_en)}</span></li>`).join('')
    : '<li style="grid-template-columns:1fr"><p class="muted">Sin avances registrados.</p></li>';
}

const clientesDe = uid => [...new Set(S.proyectos.filter(x => x.miembros.includes(uid) || AE().some(a => a.proyecto_id === x.id && a.responsable_id === uid)).map(x => x.cliente))];

function renderPeople() {
  const ps = S.personas.filter(p => !focus || p.id === focus);
  const hab = S.semana.habiles;
  $('tppl').innerHTML = ps.length
    ? '<table><thead><tr><th>Persona</th><th>Días con registro</th><th>Actividades cerradas</th><th>Bloqueos abiertos</th><th>Proyectos</th></tr></thead><tbody>' +
      ps.map(p => `<tr><td><b>${esc(p.nombre)}</b></td><td class="num" style="${p.dias < hab ? 'color:var(--crit)' : ''}">${p.dias}/${hab}</td><td class="num">${p.cerradas}</td><td class="num">${p.bloqueos}</td><td>${esc(clientesDe(p.id).join(', '))}</td></tr>`).join('') +
      '</tbody></table>'
    : '<p class="muted">Aún no hay colaboradores. Crea sus cuentas desde Administración.</p>';
  const hms = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
  $('ppl-upd').textContent = `Lun–Vie · actualizado ${hms}`;
}

// "21 al 27 sep 2026" · "28 sep al 4 oct 2026" · "28 dic 2026 al 3 ene 2027"
function rangoFechas(ini, fin) {
  const [y1, m1, d1] = ini.split('-').map(Number);
  const [y2, m2, d2] = fin.split('-').map(Number);
  if (y1 !== y2) return `${d1} ${MESES[m1 - 1]} ${y1} al ${d2} ${MESES[m2 - 1]} ${y2}`;
  if (m1 !== m2) return `${d1} ${MESES[m1 - 1]} al ${d2} ${MESES[m2 - 1]} ${y2}`;
  return `${d1} al ${d2} ${MESES[m2 - 1]} ${y2}`;
}
const rangoSemana = () => rangoFechas(S.semana.ini, S.semana.fin);

function renderKpis() {
  const k = S.kpis;
  const hab = S.semana.habiles;
  $('wk-lbl').textContent = `Semana ${S.semana.num} · ${rangoSemana()}`;
  $('k-av').textContent = k.avances;
  $('k-av-d').textContent = `de ${k.esperados} esperados (${S.personas.length} × ${hab} ${plural(hab, 'día', 'días')})`;
  $('k-ce').textContent = k.cerradas;
  const dif = k.cerradas - k.cerradas_prev;
  $('k-ce-d').textContent = `${dif >= 0 ? '+' : ''}${dif} vs semana ${k.semana_prev}`;
  $('k-ce-d').style.color = dif > 0 ? 'var(--ok)' : dif < 0 ? 'var(--crit)' : '';
  const bl = BE();
  $('k-bl').textContent = bl.length;
  $('k-bl-d').textContent = bl.length ? `Más antiguo: ${Math.max(...bl.map(b => b.dias))} días` : 'Sin bloqueos';
  const venc = AE().filter(vencida);
  $('k-ve').textContent = venc.length;
  $('k-ve-d').textContent = venc.length ? [...new Set(venc.map(a => (P(a.proyecto_id) || {}).cliente))].join(', ') : 'Todo al día';
  $('res-media').innerHTML = k.resolucion_dias == null
    ? 'Sin bloqueos resueltos este mes'
    : `Tiempo medio de resolución este mes: <b class="mono">${k.resolucion_dias} ${plural(k.resolucion_dias, 'día', 'días')}</b>`;
}

function renderAlerts() {
  $('alerts').innerHTML = S.alertas.length
    ? S.alertas.map(a => `<li><span class="sv ${a.sev === 'Crítico' ? 'c' : ''}"></span><div><b>${esc(a.titulo)}</b><p>${esc(a.detalle)}</p></div><span class="pill ${a.sev === 'Crítico' ? 's-bloq' : 's-rev'}">${a.sev}</span></li>`).join('')
    : '<li style="grid-template-columns:1fr"><p>Sin alertas. Todo en orden.</p></li>';
}

/* ---------- bloqueos ---------- */
function blkTable(list, modo) {
  if (!list.length) return '<p class="muted">Sin bloqueos abiertos.</p>';
  const dev = modo === 'resolver';
  return '<table><thead><tr><th>Proyecto / actividad</th><th>Tipo</th><th>Descripción</th><th>Lo destraba</th>' + (dev ? '' : '<th>Responsable</th>') + '<th>Días abierto</th><th></th></tr></thead><tbody>' +
    list.map(b => `<tr><td><b>${esc(b.cliente)}</b><br><span class="muted" style="font-size:.8rem">${esc(b.actividad)}</span></td><td><span class="pill s-bloq">${esc(b.tipo)}</span></td><td>${esc(b.descripcion)}</td><td>${esc(b.responsable_externo || '—')}</td>${dev ? '' : `<td>${esc(b.responsable)}</td>`}
    <td class="num" style="${b.dias >= 5 ? 'color:var(--crit);font-weight:600' : ''}">${b.dias}</td><td>${dev ? `<button class="btn sm" data-r="${b.id}">Marcar resuelto</button>` : `<button class="btn ghost sm" data-ping="${b.responsable_id}" data-act="${b.actividad_id}">Pedir actualización</button>`}</td></tr>`).join('') +
    '</tbody></table>';
}

function renderBlk() {
  if (supervisaR()) {
    const be = BE();
    $('tblk').innerHTML = blkTable(be.filter(b => !focus || b.responsable_id === focus), 'ping');
    $('nblk').textContent = be.length;
    $('nblk').hidden = !be.length;
  }
  if (registraR()) {
    const bm = BM();
    $('tmblk').innerHTML = blkTable(bm, 'resolver');
    $('nmblk').textContent = bm.length;
    $('nmblk').hidden = !bm.length;
  }
}

/* ---------- líder: tablero ---------- */
function renderKanban(id) {
  const p = id && P(id);
  if (!p) {
    $('kb-title').textContent = 'Sin proyectos';
    $('kb-meta').innerHTML = '';
    $('kanban').innerHTML = '';
    return;
  }
  $('kb-title').textContent = `${p.cliente} · ${p.nombre}`;
  $('kb-meta').innerHTML = `<span class="pill ${stC(p.estatus)}">${p.estatus}</span><span class="muted" style="font-size:.86rem">Avance ${p.pct}% · Compromiso ${toDM(p.fecha_compromiso)} · Responsable ${esc(p.responsable || '—')}</span><div class="links">${linkChips(projLinks(p))}</div>`;
  $('kanban').innerHTML = columnas(actsDe(p.id).filter(a => !focus || a.responsable_id === focus), { agregar: false, conCliente: false });
}

function fillKb() {
  const ps = projsFor();
  const cur = +$('kb-proj').value;
  $('kb-proj').innerHTML = ps.map(p => `<option value="${p.id}">${esc(p.cliente)} · ${esc(p.nombre)}</option>`).join('');
  const sel = ps.some(p => p.id === cur) ? cur : ps[0] && ps[0].id;
  if (sel) $('kb-proj').value = sel;
  renderKanban(sel);
}

/* ---------- líder: revisión ---------- */
function renderReview() {
  const todas = AE().filter(a => a.estatus === 'Completado' && !a.revisada);
  $('nrev').textContent = todas.length;
  $('nrev').hidden = !todas.length;
  const r = todas.filter(a => !focus || a.responsable_id === focus);
  $('trev').innerHTML = r.length
    ? '<table><thead><tr><th>Actividad</th><th>Colaborador</th><th>Inicio → fin</th><th>Descripción</th><th></th></tr></thead><tbody>' +
      r.map(a => { const p = P(a.proyecto_id) || {}; return `<tr><td><button type="button" class="linkbtn" data-card="${a.id}" title="Ver lo que realizó"><b>${esc(a.titulo)}</b></button><br><span class="muted" style="font-size:.8rem">${esc(p.cliente)} · ${esc(p.nombre)}</span></td><td>${esc(a.responsable)}</td><td class="num">${toDM(a.fecha_inicio)} → ${toDM(a.fecha_vencimiento)}</td><td style="max-width:32ch">${esc(a.descripcion || 'Sin descripción')}${a.enlaces.length ? `<div class="links" style="margin-top:4px">${linkChips(a.enlaces)}</div>` : ''}</td>
      <td><div class="row" style="flex-wrap:nowrap;gap:6px"><button class="btn ghost sm" data-card="${a.id}">Ver</button><button class="btn sm" data-ok="${a.id}">Aprobar</button><button class="btn ghost sm danger" data-back="${a.id}">Devolver</button></div></td></tr>`; }).join('') +
      '</tbody></table>'
    : '<p class="muted">No hay actividades pendientes de revisión.</p>';
  $('irev').innerHTML = r.length
    ? r.slice(0, 4).map(a => `<li><span class="sv" style="background:var(--ok)"></span><div><button type="button" class="linkbtn" data-card="${a.id}"><b>${esc(a.titulo)}</b></button><p>${esc(a.responsable)} · ${esc((P(a.proyecto_id) || {}).cliente)}</p></div><button class="btn sm" data-ok="${a.id}">Aprobar</button></li>`).join('')
    : '<li style="grid-template-columns:1fr"><p>Sin pendientes.</p></li>';
}

/* ---------- líder: colaborador en revisión ---------- */
function fillFocus() {
  if (focus && !persona(focus)) focus = 0;
  $('focus').innerHTML = '<option value="0">Todo el equipo</option>' + S.personas.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join('');
  $('focus').value = String(focus);
  $('focusbar').classList.toggle('on', !!focus);
  $('teamnav').innerHTML = S.personas.map(p => `<button class="pbtn" data-v="persona" data-p="${p.id}"><span class="mini">${esc(initials(p.nombre))}</span>${esc(p.nombre)}</button>`).join('');
}

function curView() {
  const c = [...document.querySelectorAll('[data-view]')].find(x => x.style.display !== 'none');
  return c ? c.dataset.view : '';
}

function marcarEquipo() {
  const v = curView();
  document.querySelectorAll('#teamnav button').forEach(b => {
    if (v === 'persona' && +b.dataset.p === focus) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
}

function setFocus(id) {
  focus = +id || 0;
  $('focus').value = String(focus);
  $('focusbar').classList.toggle('on', !!focus);
  renderProj(); renderFeed(); renderPeople(); fillKb(); renderBlk(); renderReview();
  if (curView() === 'persona') renderPersona();
  marcarEquipo();
}

function renderPersona() {
  const el = $('v-persona');
  const U = focus && persona(focus);
  if (!U) {
    el.innerHTML = `<div class="page-head"><div><p class="label">Equipo</p><h2>¿A quién quieres revisar?</h2></div></div>` +
      (S.personas.length
        ? `<div class="pgrid">${S.personas.map(p => `<button class="pcard" data-pick="${p.id}"><span class="avatar" style="grid-row:auto">${esc(initials(p.nombre))}</span><b>${esc(p.nombre)}</b><span class="muted" style="font-size:.8rem">${p.dias}/${S.semana.habiles} días · ${p.cerradas} cerradas${p.bloqueos ? ` · <span style="color:var(--crit)">${p.bloqueos} ${plural(p.bloqueos, 'bloqueo', 'bloqueos')}</span>` : ''}</span></button>`).join('')}</div>`
        : '<p class="muted">Aún no hay colaboradores.</p>');
    return;
  }
  const acts = AE().filter(a => a.responsable_id === focus);
  const ps = S.proyectos.filter(p => acts.some(a => a.proyecto_id === p.id));
  const bl = BE().filter(b => b.responsable_id === focus);
  const open = acts.filter(a => a.estatus !== 'Completado').length;
  const feed = S.feed.filter(f => f.usuario_id === focus).slice(0, 8);
  const hab = S.semana.habiles;
  el.innerHTML = `<div class="page-head"><div class="phead"><span class="bigav">${esc(initials(U.nombre))}</span><div><p class="label">Colaborador</p><h2>${esc(U.nombre)}</h2><p class="muted mono" style="font-size:.8rem">${esc(U.email)}</p></div></div>
    <button class="btn ghost" data-ping="${U.id}">Pedir actualización</button></div>
    <div class="kpis"><div class="kpi"><span class="label">Días con registro</span><b style="${U.dias < hab ? 'color:var(--crit)' : ''}">${U.dias}/${hab}</b><span class="d muted">Semana ${S.semana.num}</span></div>
    <div class="kpi"><span class="label">Actividades cerradas</span><b>${U.cerradas}</b><span class="d muted">Esta semana</span></div>
    <div class="kpi"><span class="label">Actividades abiertas</span><b>${open}</b><span class="d muted">En ${ps.length} ${plural(ps.length, 'proyecto', 'proyectos')}</span></div>
    <div class="kpi"><span class="label">Bloqueos abiertos</span><b style="${bl.length ? 'color:var(--crit)' : ''}">${bl.length}</b><span class="d muted">${bl.length ? 'Más antiguo: ' + Math.max(...bl.map(b => b.dias)) + ' días' : 'Sin bloqueos'}</span></div></div>
    <div class="grid-2"><div style="display:grid;gap:16px">${ps.length ? ps.map(p => `<div class="panel"><div class="panel-head"><div><h3>${esc(p.cliente)} · ${esc(p.nombre)}</h3><span class="muted" style="font-size:.8rem">Compromiso ${toDM(p.fecha_compromiso)} · Avance del proyecto ${p.pct}%</span></div><span class="pill ${stC(p.estatus)}">${p.estatus}</span></div>
      <div class="tscroll"><table><thead><tr><th>Actividad</th><th>Estatus</th><th>Avance</th><th>Compromiso</th></tr></thead><tbody>${acts.filter(a => a.proyecto_id === p.id).map(a => `<tr><td><b>${esc(a.titulo)}</b></td><td><div style="display:grid;gap:4px"><span class="pill ${stC(a.estatus)}" style="justify-self:start">${a.estatus}</span>${revPill(a)}</div></td><td><div class="bar"><i><span style="width:${a.avance_pct}%"></span></i><em>${a.avance_pct}%</em></div></td><td class="num">${toDM(a.fecha_vencimiento)}</td></tr>`).join('')}</tbody></table></div></div>`).join('') : '<div class="panel"><p class="muted">Sin actividades registradas.</p></div>'}</div>
    <div style="display:grid;gap:16px"><div class="panel"><div class="panel-head"><h3>Bloqueos</h3></div>${bl.length ? bl.map(b => `<div style="display:grid;gap:4px;padding:8px 0;border-top:1px solid var(--line)"><span class="pill s-bloq" style="justify-self:start">${esc(b.tipo)}</span><b style="font-size:.9rem">${esc(b.actividad)}</b><span class="muted" style="font-size:.82rem">${esc(b.descripcion)} · ${b.dias} días abierto</span></div>`).join('') : '<p class="muted">Sin bloqueos abiertos.</p>'}</div>
    <div class="panel"><div class="panel-head"><h3>Últimos avances</h3></div>${feed.length ? `<ul class="feed">${feed.map(f => `<li><span class="avatar">${esc(initials(f.usuario))}</span><span class="sumline">${esc(resumen(f))}</span><span class="meta">${hora(f.creado_en)}</span></li>`).join('')}</ul>` : '<p class="muted">Sin avances recientes.</p>'}</div></div></div>`;
}

/* ---------- líder: administración ---------- */
function LinkBox(pre, onChange) {
  const o = {
    items: [],
    del: [],
    set(arr) { o.items = arr.map(l => ({ ...l })); o.del = []; o.render(); },
    nuevos() { return o.items.filter(l => !l.id).map(({ tipo, url }) => ({ tipo, url })); },
    render() {
      $(pre + '-ll').innerHTML = o.items.map((l, i) => `<span class="lk">${esc(TIPO_LBL[l.tipo] || l.tipo)} · <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(corto(l.url))}</a><button type="button" class="lkx" data-i="${i}" aria-label="Quitar enlace">×</button></span>`).join('');
      if (onChange) onChange();
    },
    add() {
      const u = $(pre + '-lu').value.trim();
      if (!u) return;
      if (!/^https?:\/\/\S+$/i.test(u)) return toast('Pega un enlace completo que empiece con https://');
      o.items.push({ tipo: $(pre + '-lt').value, url: u });
      $(pre + '-lu').value = '';
      o.render();
    },
  };
  $(pre + '-lu').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); o.add(); } });
  $(pre + '-la').onclick = () => o.add();
  $(pre + '-ll').addEventListener('click', e => {
    const b = e.target.closest('.lkx');
    if (!b) return;
    const [x] = o.items.splice(+b.dataset.i, 1);
    if (x && x.id) o.del.push(x.id);
    o.render();
  });
  return o;
}

let PF = { id: null, miembros: new Set() };
let UF = null;
const PL = LinkBox('pf');

function renderMbr() {
  const devs = S.usuarios.filter(u => (u.rol === 'dev' || u.rol === 'sublider') && (u.activo || PF.miembros.has(u.id)));
  $('pf-mbr').innerHTML = devs.length
    ? devs.map(u => `<label><input type="checkbox" value="${u.id}" ${PF.miembros.has(u.id) ? 'checked' : ''}>${esc(u.nombre)}</label>`).join('')
    : '<span class="muted" style="font-size:.84rem">Primero crea cuentas de colaboradores.</span>';
}

function pfReset() {
  PF = { id: null, miembros: new Set() };
  ['pf-cli', 'pf-nom', 'pf-ini', 'pf-comp', 'pf-lu'].forEach(i => ($(i).value = ''));
  $('pf-resp').value = '';
  PL.set([]);
  $('pf-title').textContent = 'Nuevo proyecto';
  $('pf-submit').textContent = 'Crear proyecto';
  $('pf-new').hidden = true;
  $('pf-arch').hidden = true;
  renderMbr();
}

function pfEdit(id) {
  const p = P(id);
  if (!p) return;
  PF = { id: p.id, miembros: new Set(p.miembros) };
  $('pf-cli').value = p.cliente;
  $('pf-nom').value = p.nombre;
  $('pf-resp').value = p.responsable_id || '';
  $('pf-ini').value = p.fecha_inicio || '';
  $('pf-comp').value = p.fecha_compromiso || '';
  PL.set(p.enlaces);
  $('pf-title').textContent = 'Editar proyecto';
  $('pf-submit').textContent = 'Guardar cambios';
  $('pf-new').hidden = false;
  $('pf-arch').hidden = false;
  renderMbr();
  $('pf').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Equipo del sublíder que se está creando o editando
let UE = new Set();
function renderEq() {
  const nombre = id => (S.usuarios.find(x => x.id === id) || {}).nombre;
  const devs = S.usuarios.filter(u => u.rol === 'dev' && (u.activo || UE.has(u.id)));
  $('uf-eq').innerHTML = devs.length
    ? devs.map(u => `<label><input type="checkbox" value="${u.id}" ${UE.has(u.id) ? 'checked' : ''}>${esc(u.nombre)}${u.sublider_id && u.sublider_id !== UF ? `<span class="muted" style="font-weight:500">&nbsp;· con ${esc(nombre(u.sublider_id))}</span>` : ''}</label>`).join('')
    : '<span class="muted" style="font-size:.84rem">Aún no hay colaboradores.</span>';
  $('uf-eqwrap').hidden = $('uf-rol').value !== 'sublider';
}
$('uf-rol').onchange = renderEq;
$('uf-eq').addEventListener('change', e => {
  const c = e.target;
  if (c.type !== 'checkbox') return;
  if (c.checked) UE.add(+c.value);
  else UE.delete(+c.value);
});

function ufReset() {
  UF = null;
  UE = new Set();
  ['uf-nom', 'uf-mail', 'uf-pass'].forEach(i => ($(i).value = ''));
  $('uf-mail').disabled = false;
  $('uf-rol').value = 'dev';
  $('uf-act').checked = true;
  $('uf-actwrap').hidden = true;
  $('uf-title').textContent = 'Nueva cuenta';
  $('uf-submit').textContent = 'Crear cuenta';
  $('uf-pass-l').textContent = 'Contraseña inicial';
  $('uf-pass-h').textContent = 'Mínimo 8 caracteres. Compártela por un canal seguro.';
  $('uf-new').hidden = true;
  renderEq();
}

function ufEdit(id) {
  const u = S.usuarios.find(x => x.id === +id);
  if (!u) return;
  UF = u.id;
  UE = new Set(S.usuarios.filter(x => x.sublider_id === u.id).map(x => x.id));
  $('uf-nom').value = u.nombre;
  $('uf-mail').value = u.email;
  $('uf-mail').disabled = true;
  $('uf-rol').value = u.rol;
  $('uf-pass').value = '';
  $('uf-act').checked = u.activo;
  $('uf-actwrap').hidden = false;
  $('uf-title').textContent = 'Editar cuenta';
  $('uf-submit').textContent = 'Guardar cambios';
  $('uf-pass-l').textContent = 'Nueva contraseña';
  $('uf-pass-h').textContent = 'Déjala vacía para no cambiarla.';
  $('uf-new').hidden = false;
  renderEq();
  $('uf').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderAdmin() {
  $('pf-clis').innerHTML = S.clientes.map(c => `<option value="${esc(c.nombre)}">`).join('');
  const resp = $('pf-resp').value;
  $('pf-resp').innerHTML = '<option value="">Sin responsable</option>' + S.usuarios.filter(u => u.activo).map(u => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('');
  $('pf-resp').value = resp;
  renderMbr();

  const filas = S.proyectos.map(p => `<tr><td><b>${esc(p.cliente)}</b><br><span class="muted" style="font-size:.8rem">${esc(p.nombre)}</span></td><td>${esc(p.responsable || '—')}</td><td class="num">${p.miembros.length}</td><td class="num">${toDM(p.fecha_compromiso)}</td><td><button type="button" class="btn ghost sm" data-pe="${p.id}">Editar</button></td></tr>`)
    .concat(S.archivados.map(p => `<tr><td><b>${esc(p.cliente)}</b><br><span class="muted" style="font-size:.8rem">${esc(p.nombre)} · archivado</span></td><td>—</td><td></td><td></td><td><button type="button" class="btn ghost sm" data-unarch="${p.id}">Reactivar</button></td></tr>`));
  $('adm-proj').innerHTML = filas.length
    ? '<table><thead><tr><th>Proyecto</th><th>Responsable</th><th>Equipo</th><th>Compromiso</th><th></th></tr></thead><tbody>' + filas.join('') + '</tbody></table>'
    : '<p class="muted">Aún no hay proyectos.</p>';

  renderEq();
  const nombreDe = id => (S.usuarios.find(x => x.id === id) || {}).nombre || '—';
  const equipoTxt = u => {
    if (u.rol === 'sublider') { const n = S.usuarios.filter(x => x.sublider_id === u.id).length; return `${n} a su cargo`; }
    if (u.rol === 'dev') return u.sublider_id ? `Con ${esc(nombreDe(u.sublider_id))}` : '<span class="muted">Sin sublíder</span>';
    return '';
  };
  $('adm-usr').innerHTML = '<table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Equipo</th><th>Estado</th><th></th></tr></thead><tbody>' +
    S.usuarios.map(u => `<tr><td><b>${esc(u.nombre)}</b></td><td class="mono" style="font-size:.78rem">${esc(u.email)}</td><td>${{ lider: 'Líder', sublider: 'Sublíder', dev: 'Colaborador' }[u.rol] || u.rol}</td><td style="font-size:.84rem">${equipoTxt(u)}</td><td><span class="pill ${u.activo ? 's-ok' : 's-todo'}">${u.activo ? 'Activa' : 'Inactiva'}</span></td><td><button type="button" class="btn ghost sm" data-ue="${u.id}">Editar</button></td></tr>`).join('') +
    '</tbody></table>';
}

$('pf-mbr').addEventListener('change', e => {
  const c = e.target;
  if (c.type !== 'checkbox') return;
  if (c.checked) PF.miembros.add(+c.value);
  else PF.miembros.delete(+c.value);
});
$('pf-new').onclick = pfReset;
$('pf').onsubmit = async e => {
  e.preventDefault();
  const body = {
    accion: 'guardar_proyecto',
    id: PF.id,
    cliente: $('pf-cli').value.trim(),
    nombre: $('pf-nom').value.trim(),
    responsable_id: +$('pf-resp').value || null,
    fecha_inicio: $('pf-ini').value || null,
    fecha_compromiso: $('pf-comp').value || null,
    miembros: [...PF.miembros],
    enlaces: PL.nuevos(),
    enlaces_eliminar: PL.del,
  };
  if (!body.cliente || !body.nombre) return toast('Escribe el cliente y el nombre del proyecto.');
  const editando = !!PF.id;
  await accion(async () => { await api('/api/admin', { method: 'POST', body }); pfReset(); }, editando ? 'Proyecto actualizado.' : 'Proyecto creado. El equipo asignado ya puede registrar actividades.', $('pf-submit'));
};
$('pf-arch').onclick = async () => {
  if (!PF.id) return;
  const id = PF.id;
  await accion(async () => { await api('/api/admin', { method: 'POST', body: { accion: 'archivar_proyecto', id, archivado: true } }); pfReset(); }, 'Proyecto archivado. Puedes reactivarlo desde la lista.', $('pf-arch'));
};
$('uf-new').onclick = ufReset;
$('uf').onsubmit = async e => {
  e.preventDefault();
  const nombre = $('uf-nom').value.trim();
  const password = $('uf-pass').value;
  if (!nombre) return toast('Escribe el nombre.');
  if ((!UF || password) && password.length < 8) return toast('La contraseña debe tener al menos 8 caracteres.');
  const body = UF
    ? { accion: 'actualizar_usuario', id: UF, nombre, rol: $('uf-rol').value, activo: $('uf-act').checked, password, equipo: [...UE] }
    : { accion: 'crear_usuario', nombre, email: $('uf-mail').value.trim(), rol: $('uf-rol').value, password, equipo: [...UE] };
  const editando = !!UF;
  await accion(async () => { await api('/api/admin', { method: 'POST', body }); ufReset(); }, editando ? 'Cuenta actualizada.' : 'Cuenta creada. Comparte el correo y la contraseña con la persona.', $('uf-submit'));
};

/* ---------- tarjetas del tablero ---------- */
const ST_COLOR = { 'Por hacer': 'var(--muted)', 'En progreso': 'var(--accent)', 'Bloqueado': 'var(--crit)', 'Completado': 'var(--ok)' };
const AV_COLORS = ['#2B59C3', '#1C8556', '#A86A12', '#7A4CC2', '#C03C28', '#0E7C86', '#B5487F', '#4A5A70'];
const avColor = id => AV_COLORS[Math.abs(+id || 0) % AV_COLORS.length];
const avatar = (id, nombre) => `<span class="av" style="background:${avColor(id)}" title="${esc(nombre)}">${esc(initials(nombre))}</span>`;
const fechaCorta = iso => { const [, m, d] = iso.split('-'); return `${+d} ${MESES[+m - 1]}`; };
const fechaHora = ts => new Intl.DateTimeFormat('es-MX', { timeZone: TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ts));
const IC = {
  reloj: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  clip: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7L14 4.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L15 7.5"/></svg>',
  desc: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function tarjeta(a, conCliente) {
  const p = P(a.proyecto_id) || {};
  const pendiente = a.estatus === 'Completado' && !a.revisada;
  const etiquetas = `<i style="background:${ST_COLOR[a.estatus]}" title="${a.estatus}"></i>` +
    (pendiente ? '<i style="background:var(--warn)" title="Pendiente de revisión"></i>' : '');
  const fecha = a.fecha_vencimiento
    ? `<span class="chip ${vencida(a) ? 'over' : a.estatus === 'Completado' ? 'done' : ''}" title="${vencida(a) ? 'Vencida' : 'Fecha fin'}">${IC.reloj}${fechaCorta(a.fecha_vencimiento)}</span>`
    : '';
  const avance = a.avance_pct > 0 && a.avance_pct < 100 ? `<span title="Avance">${a.avance_pct}%</span>` : '';
  const desc = a.descripcion ? `<span title="Tiene descripción">${IC.desc}</span>` : '';
  const links = a.enlaces.length ? `<span title="Entregables">${IC.clip}${a.enlaces.length}</span>` : '';
  const revisada = a.estatus === 'Completado' && a.revisada ? `<span class="chk" title="Revisada">${IC.check}</span>` : '';
  return `<button type="button" class="tcard" data-card="${a.id}"><span class="tlabels">${etiquetas}</span>` +
    (conCliente ? `<span class="tcli">${esc(p.cliente)}</span>` : '') +
    `<span class="ttitle">${revisada}<span>${esc(a.titulo)}</span></span>` +
    `<span class="tfoot">${fecha}${avance}${desc}${links}${avatar(a.responsable_id, a.responsable)}</span></button>`;
}

function columnas(acts, { agregar, conCliente }) {
  return COLS.map(c => {
    const it = acts.filter(a => a.estatus === c);
    return `<div class="col"><h3><span class="ct"><i class="coldot" style="background:${ST_COLOR[c]}"></i>${c}</span><span class="mono muted">${it.length}</span></h3>` +
      (it.map(a => tarjeta(a, conCliente)).join('') || '<p class="muted" style="font-size:.8rem;padding:4px">Sin actividades</p>') +
      (agregar ? `<button type="button" class="col-add" data-new="${c}">+ Añadir actividad</button>` : '') + '</div>';
  }).join('');
}

document.querySelectorAll('.leyenda').forEach(el => {
  el.innerHTML = COLS.map(c => `<span><i style="background:${ST_COLOR[c]}"></i>${c}</span>`).join('') +
    '<span><i style="background:var(--warn)"></i>Pendiente de revisión</span>' +
    `<span><b class="chip over" style="display:inline-flex;align-items:center;gap:3px;font-size:.7rem">${IC.reloj}fecha</b>Vencida</span>`;
});

function renderMine() {
  $('mkanban').innerHTML = columnas(AM(), { agregar: true, conCliente: true });
}

/* ---------- ventana de actividad ---------- */
const FL = LinkBox('f', () => preview());
let MODO = null;   // 'nuevo' | 'editar' | 'ver'
let histToken = 0;

function fillProjs() {
  const cur = $('f-proj').value;
  $('f-proj').innerHTML = S.proyectos.filter(p => p.soy_miembro).map(p => `<option value="${p.id}">${esc(p.cliente)} · ${esc(p.nombre)}</option>`).join('');
  if (cur && P(cur)) $('f-proj').value = cur;
}
const stVal = () => document.querySelector('input[name=st]:checked').value;
function setSt(v) { const r = document.querySelector(`input[name=st][value="${v}"]`); if (r) r.checked = true; }

function preview() {
  if (!S || !$('dlg').open) return;
  const st = stVal();
  $('dlg-pill').className = 'pill ' + stC(st);
  $('dlg-pill').textContent = st;
  $('blkbox').hidden = st !== 'Bloqueado';
  $('pctv').textContent = $('f-pct').value + '%';
  $('prev-wrap').hidden = MODO !== 'ver';
  const p = P($('f-proj').value);
  if (!p) { $('prev').textContent = 'No tienes proyectos asignados. Pide a tu líder que te asigne a uno.'; return; }
  const act = $('f-act').value.trim() || '(nombre de la actividad)';
  $('prev').innerHTML = `${esc(p.cliente.toUpperCase())} · ${esc(act)} | Avance: ${$('f-pct').value}% | Estatus: ${st} | Inicio: ${toDM($('f-ini').value)} | Fin: ${toDM($('f-fin').value)}` +
    (st === 'Bloqueado' ? `<br><span style="color:var(--crit)">Bloqueo (${esc($('f-btipo').value)}): ${esc($('f-bdesc').value || 'sin descripción')}</span>` : '') +
    ($('f-next').value ? `<br><span class="muted">Siguiente: ${esc($('f-next').value)}</span>` : '') +
    (FL.items.length ? `<br><span class="muted">Entregables: ${FL.items.map(l => esc(TIPO_LBL[l.tipo] || l.tipo)).join(', ')}</span>` : '');
}

async function cargarHistorial(a) {
  const token = ++histToken;
  const aviso = m => `<li class="muted" style="display:block">${esc(m)}</li>`;
  if (!a) { $('hist').innerHTML = aviso('El historial aparece cuando guardes la actividad.'); return; }
  $('hist').innerHTML = aviso('Cargando historial…');
  try {
    const d = await api(`/api/actividades?id=${a.id}`);
    if (token !== histToken) return;
    $('hist').innerHTML = d.eventos.map(e => `<li class="${e.tipo || ''}">${avatar(e.usuario_id, e.quien)}<div><p><b>${esc(e.quien)}</b> ${esc(e.texto)}</p>${e.detalle ? `<p class="hist-d">${esc(e.detalle)}</p>` : ''}<span class="hist-t">${fechaHora(e.fecha)}</span></div></li>`).join('') || aviso('Sin movimientos.');
  } catch (err) {
    if (token === histToken) $('hist').innerHTML = aviso(err.message);
  }
}

// modo: 'nuevo' (colaborador), 'editar' (colaborador, actividad propia) o 'ver' (líder, solo lectura)
function abrirActividad(modo, a, estatus) {
  if (modo === 'nuevo' && !S.proyectos.some(p => p.soy_miembro)) return toast('Todavía no estás asignado a ningún proyecto. Pide a tu líder que te agregue.');
  MODO = modo;
  EDIT = a ? { id: a.id, titulo: a.titulo } : null;
  const ver = modo === 'ver';
  if (ver) {
    const p = P(a.proyecto_id) || {};
    $('f-proj').innerHTML = `<option value="${a.proyecto_id}">${esc(p.cliente)} · ${esc(p.nombre)}</option>`;
  } else {
    fillProjs();
  }
  if (a) {
    $('f-proj').value = a.proyecto_id;
    $('f-act').value = a.titulo;
    $('f-desc').value = a.descripcion || '';
    $('f-next').value = a.siguiente_accion || '';
    $('f-pct').value = a.avance_pct;
    setSt(a.estatus);
    $('f-ini').value = a.fecha_inicio || '';
    $('f-fin').value = a.fecha_vencimiento || '';
    const bk = S.bloqueos.find(b => b.actividad_id === a.id);
    $('f-btipo').value = bk ? bk.tipo : 'Accesos / permisos';
    $('f-bdesc').value = bk ? bk.descripcion : '';
    $('f-bquien').value = bk ? bk.responsable_externo : '';
    FL.set(a.enlaces);
  } else {
    ['f-act', 'f-desc', 'f-next', 'f-bdesc', 'f-bquien', 'f-fin', 'f-lu'].forEach(i => ($(i).value = ''));
    $('f-btipo').selectedIndex = 0;
    const st = COLS.includes(estatus) ? estatus : 'En progreso';
    setSt(st);
    $('f-pct').value = st === 'Completado' ? 100 : 0;
    $('f-ini').value = S.hoy;
    FL.set([]);
  }
  $('frm').querySelectorAll('input, select, textarea').forEach(el => (el.disabled = ver));
  $('f-proj').disabled = ver || modo === 'editar';
  $('dlg').classList.toggle('ver', ver);
  $('f-submit').textContent = modo === 'nuevo' ? 'Guardar actividad' : 'Guardar cambios';
  $('f-cancel').textContent = ver ? 'Cerrar' : 'Cancelar';
  // El líder puede aprobar o devolver desde aquí las actividades completadas pendientes de revisión.
  const porRevisar = ver && supervisaR() && !esMia(a) && a.estatus === 'Completado' && !a.revisada;
  $('f-aprobar').hidden = $('f-devolver').hidden = !porRevisar;
  $('f-aprobar').dataset.ok = $('f-devolver').dataset.back = porRevisar ? a.id : '';
  $('dlg-ctx').textContent = modo === 'nuevo' ? 'Nueva actividad' : `${a.responsable} · ${(P(a.proyecto_id) || {}).cliente || ''}`;
  $('st-hint').textContent = ver
    ? 'Solo lectura: cada colaborador actualiza sus actividades.'
    : `Al llegar a 100% pasa a Completado y queda pendiente de revisión de ${nombreLider()}.`;
  if (!$('dlg').open) $('dlg').showModal();
  preview();
  cargarHistorial(a);
  if (modo === 'nuevo') $('f-act').focus();
}

function cerrarActividad() {
  if ($('dlg').open) $('dlg').close();
}

/* ---------- ventana de mensaje: pedir actualización o devolver ---------- */
let MSG = null;   // { tipo: 'actualizacion' | 'devolucion', usuario_id, actividad_id, nombre }

function abrirMensaje(cfg) {
  MSG = cfg;
  const dev = cfg.tipo === 'devolucion';
  const act = cfg.actividad_id && S.actividades.find(a => a.id === +cfg.actividad_id);
  $('msg-title').textContent = dev ? 'Devolver actividad' : 'Pedir actualización';
  $('msg-ctx').innerHTML = `Para <b>${esc(cfg.nombre)}</b>` + (act ? ` · «${esc(act.titulo)}»` : ' · todas sus actividades');
  $('msg-lbl').textContent = dev ? '¿Qué debe ajustar?' : '¿Qué necesitas que actualice?';
  $('msg-text').placeholder = dev
    ? 'Ej. Falta validar los totales contra el reporte del cliente y adjuntar el Excel.'
    : 'Ej. ¿Ya te dieron el acceso? Actualiza el avance y la fecha estimada.';
  $('msg-text').value = '';
  $('msg-ok').textContent = dev ? 'Devolver actividad' : 'Enviar solicitud';
  $('msg-ok').classList.toggle('danger', dev);
  $('msg').showModal();
  $('msg-text').focus();
}

function cerrarMensaje() {
  if ($('msg').open) $('msg').close();
}

$('msg').addEventListener('close', () => { MSG = null; });
$('msg').addEventListener('click', e => { if (e.target === $('msg')) cerrarMensaje(); });
$('msg-x').onclick = cerrarMensaje;
$('msg-cancel').onclick = cerrarMensaje;
$('msg-form').onsubmit = async e => {
  e.preventDefault();
  const cfg = MSG;
  if (!cfg) return;
  const texto = $('msg-text').value.trim();
  if (!texto) { $('msg-text').focus(); return toast(cfg.tipo === 'devolucion' ? 'Escribe por qué la devuelves.' : 'Escribe qué necesitas que actualice.'); }
  const dev = cfg.tipo === 'devolucion';
  await accion(async () => {
    if (dev) await api('/api/revision', { method: 'POST', body: { actividad_id: +cfg.actividad_id, accion: 'devolver', motivo: texto } });
    else await api('/api/recordatorios', { method: 'POST', body: { usuario_id: +cfg.usuario_id, actividad_id: cfg.actividad_id ? +cfg.actividad_id : null, mensaje: texto } });
    cerrarMensaje();
    if (dev) cerrarActividad();
  }, dev ? `Actividad devuelta a ${primer(cfg.nombre)} con tus comentarios.` : `Se envió la solicitud a ${primer(cfg.nombre)}.`, $('msg-ok'), dev);
};

function renderHome() {
  const acts = AM();
  const proys = misProyectos();
  const open = acts.filter(a => a.estatus !== 'Completado').length;
  const done = acts.filter(a => a.estatus === 'Completado');
  const pend = done.filter(a => !a.revisada).length;
  const bl = BM().length;
  $('dh-rec').innerHTML = S.recordatorios.length
    ? `<div class="notice"><div class="row" style="justify-content:space-between"><h3>Mensajes</h3><button type="button" class="btn ghost sm" id="rec-ok">Marcar como leídos</button></div>
      <ul class="avisos">${S.recordatorios.map(r => `<li class="${esc(r.tipo)}"><span class="sv"></span><div><p><b>${esc(r.de)}</b> · ${esc(r.mensaje)} <span class="muted" style="font-size:.8rem">${hora(r.creado_en)}</span></p>${r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ''}</div>${r.actividad_id && S.actividades.some(a => a.id === r.actividad_id) ? `<button type="button" class="btn sm" data-card="${r.actividad_id}">Ver actividad</button>` : '<span></span>'}</li>`).join('')}</ul></div>`
    : '';
  $('dh-kpis').innerHTML = `<div class="kpi"><span class="label">Actividades abiertas</span><b>${open}</b><span class="d muted">En ${proys.length} ${plural(proys.length, 'proyecto', 'proyectos')}</span></div>
    <div class="kpi"><span class="label">Completadas</span><b style="color:var(--ok)">${done.length}</b><span class="d muted">${done.length - pend} revisadas</span></div>
    <div class="kpi"><span class="label">Pendientes de revisión</span><b style="color:var(--warn)">${pend}</b><span class="d muted">Esperando a ${esc(nombreLider())}</span></div>
    <div class="kpi"><span class="label">Bloqueos abiertos</span><b style="${bl ? 'color:var(--crit)' : ''}">${bl}</b><span class="d muted">${bl ? 'Revísalos en Mis bloqueos' : 'Todo en orden'}</span></div>`;
  $('dh-proj').innerHTML = proys.length
    ? proys.map(p => {
      const my = acts.filter(a => a.proyecto_id === p.id);
      const d = my.filter(a => a.estatus === 'Completado').length;
      const pc = my.length ? Math.round((d / my.length) * 100) : 0;
      return `<div class="panel" style="display:grid;gap:12px"><div class="panel-head" style="margin:0"><div><p class="label">${esc(p.cliente)}</p><h3>${esc(p.nombre)}</h3><span class="muted" style="font-size:.8rem">Compromiso del proyecto ${toDM(p.fecha_compromiso)} · Responsable ${esc(p.responsable || '—')}</span></div><span class="pill ${stC(p.estatus)}">${p.estatus}</span></div>
      ${my.length ? `<div class="field" style="gap:4px"><span style="font-size:.82rem;font-weight:600">Mi avance: ${d} de ${my.length} ${plural(my.length, 'actividad completada', 'actividades completadas')}</span><div class="bar"><i><span style="width:${pc}%;background:var(--ok)"></span></i><em>${pc}%</em></div></div>
      <div class="tscroll"><table><tbody>${my.map(a => `<tr data-card="${a.id}" style="cursor:pointer" title="Abrir actividad"><td><b>${esc(a.titulo)}</b><br><span class="muted" style="font-size:.76rem">${toDM(a.fecha_inicio)} → ${toDM(a.fecha_vencimiento)}</span></td><td><div style="display:grid;gap:4px"><span class="pill ${stC(a.estatus)}" style="justify-self:start">${a.estatus}</span>${revPill(a)}</div></td><td class="num">${a.avance_pct}%</td></tr>`).join('')}</tbody></table></div>`
        : '<p class="muted" style="font-size:.86rem">Aún no registras actividades en este proyecto.</p>'}</div>`;
    }).join('')
    : '<div class="panel"><p class="muted">Todavía no estás asignado a ningún proyecto. Pide a tu líder que te agregue.</p></div>';
}

/* ---------- eventos de la ventana ---------- */
$('dlg').addEventListener('close', () => { MODO = null; EDIT = null; histToken++; });
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) cerrarActividad(); }); // clic en el fondo
$('dlg-x').onclick = cerrarActividad;
$('f-cancel').onclick = cerrarActividad;
$('f-proj').onchange = preview;
['f-act', 'f-btipo', 'f-bdesc', 'f-next', 'f-ini', 'f-fin'].forEach(i => $(i).addEventListener('input', preview));
$('f-pct').addEventListener('input', () => {
  const v = +$('f-pct').value;
  if (v === 100) setSt('Completado');
  else if (stVal() === 'Completado') setSt('En progreso');
  preview();
});
document.querySelectorAll('input[name=st]').forEach(r => (r.onchange = () => {
  const s = stVal();
  if (s === 'Completado') $('f-pct').value = 100;
  else if (+$('f-pct').value === 100) $('f-pct').value = 95;
  if (s === 'Por hacer') $('f-pct').value = 0;
  preview();
}));
$('frm').onsubmit = async e => {
  e.preventDefault();
  if (MODO !== 'nuevo' && MODO !== 'editar') return;
  const p = P($('f-proj').value);
  if (!p) return toast('No tienes proyectos asignados.');
  const titulo = $('f-act').value.trim();
  if (!titulo) { $('f-act').focus(); return toast('Escribe el nombre de la actividad.'); }
  const pct = +$('f-pct').value;
  let st = stVal();
  if (pct === 100) st = 'Completado';
  if (st === 'Bloqueado' && !$('f-bdesc').value.trim()) { $('f-bdesc').focus(); return toast(`Describe el bloqueo para que ${nombreLider()} sepa qué lo detiene.`); }
  if ($('f-ini').value && $('f-fin').value && $('f-fin').value < $('f-ini').value) return toast('La fecha fin no puede ser anterior a la fecha de inicio.');
  const body = {
    proyecto_id: p.id,
    titulo,
    descripcion: $('f-desc').value.trim(),
    estatus: st,
    avance_pct: pct,
    siguiente_accion: $('f-next').value.trim(),
    fecha_inicio: $('f-ini').value || null,
    fecha_vencimiento: $('f-fin').value || null,
    bloqueo: st === 'Bloqueado' ? { tipo: $('f-btipo').value, descripcion: $('f-bdesc').value.trim(), responsable_externo: $('f-bquien').value.trim() } : null,
    enlaces: FL.nuevos(),
    enlaces_eliminar: FL.del,
  };
  const editando = MODO === 'editar';
  if (editando) body.id = EDIT.id;
  const btn = $('f-submit');
  btn.disabled = true;
  try {
    await api('/api/actividades', { method: editando ? 'PUT' : 'POST', body });
  } catch (err) {
    return toast(err.message);
  } finally {
    btn.disabled = false;
  }
  cerrarActividad();
  try { await cargar(); } catch (err) { return toast(err.message); }
  toast(st === 'Completado'
    ? 'Guardada como Completada. Queda pendiente de revisión.'
    : editando ? `Cambios guardados. ${nombreLider()} ya los ve en su panel.` : `Actividad registrada. ${nombreLider()} ya la ve en su panel.`);
};

/* ---------- clics delegados ---------- */
document.addEventListener('click', async e => {
  const t = e.target;
  let b;
  if ((b = t.closest('[data-card]'))) {
    const a = S && S.actividades.find(x => x.id === +b.dataset.card);
    return a && abrirActividad(esMia(a) ? 'editar' : 'ver', a);
  }
  if ((b = t.closest('[data-new]'))) return registraR() && abrirActividad('nuevo', null, b.dataset.new);
  if ((b = t.closest('[data-go]'))) return show(b.dataset.go);
  if ((b = t.closest('[data-kb]'))) { $('kb-proj').value = b.dataset.kb; renderKanban(b.dataset.kb); return show('proyectos'); }
  if ((b = t.closest('[data-pick]'))) { setFocus(b.dataset.pick); return show('persona'); }
  if ((b = t.closest('[data-pe]'))) return pfEdit(b.dataset.pe);
  if ((b = t.closest('[data-ue]'))) return ufEdit(b.dataset.ue);
  if ((b = t.closest('[data-r]'))) {
    return accion(() => api('/api/bloqueos', { method: 'POST', body: { id: +b.dataset.r } }), `Bloqueo resuelto. ${nombreLider()} ya lo ve cerrado en su panel.`, b);
  }
  if ((b = t.closest('[data-ping]'))) {
    const u = persona(b.dataset.ping);
    return abrirMensaje({ tipo: 'actualizacion', usuario_id: b.dataset.ping, actividad_id: b.dataset.act || null, nombre: u ? u.nombre : '' });
  }
  if ((b = t.closest('[data-back]'))) {
    const a = S.actividades.find(x => x.id === +b.dataset.back);
    return a && abrirMensaje({ tipo: 'devolucion', usuario_id: a.responsable_id, actividad_id: a.id, nombre: a.responsable });
  }
  if ((b = t.closest('[data-ok]'))) {
    const a = S.actividades.find(x => x.id === +b.dataset.ok);
    if (!a) return;
    return accion(async () => { await api('/api/revision', { method: 'POST', body: { actividad_id: a.id, accion: 'aprobar' } }); cerrarActividad(); },
      `Actividad aprobada. ${primer(a.responsable)} ya lo ve en su inicio.`, b);
  }
  if ((b = t.closest('[data-unarch]'))) {
    return accion(() => api('/api/admin', { method: 'POST', body: { accion: 'archivar_proyecto', id: +b.dataset.unarch, archivado: false } }), 'Proyecto reactivado.', b);
  }
  if (t.closest('#rec-ok')) return accion(() => api('/api/recordatorios', { method: 'PUT', body: {} }), '', t.closest('#rec-ok'));
});

/* ---------- navegación ---------- */
function show(v) {
  if (!role || !S) return;
  if (!ALLOWED[role].includes(v)) v = HOME[role];
  document.querySelectorAll('[data-view]').forEach(s => (s.style.display = s.dataset.view === v ? 'grid' : 'none'));
  document.querySelectorAll('aside nav button').forEach(b => {
    if (b.dataset.v === v &&(v !== 'persona' || +b.dataset.p === focus)) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (v === 'persona') renderPersona();
  if (v === 'inicio' || v === 'dinicio') { document.querySelector(`[data-view="${v}"]`).prepend($('hero')); tick(); }
  const sec = document.querySelector(`[data-view="${v}"]`);
  if (sec) { sec.classList.remove('enter'); void sec.offsetWidth; sec.classList.add('enter'); countUp(sec); }
  try { history.replaceState(null, '', '#' + v); } catch { /* sin historial */ }
  window.scrollTo(0, 0);
}

document.querySelectorAll('aside nav').forEach(n => n.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || !b.dataset.v) return;
  if (b.dataset.p) setFocus(b.dataset.p);
  show(b.dataset.v);
}));
$('focus').onchange = e => setFocus(e.target.value);
$('fcli').onchange = renderProj;
$('kb-proj').onchange = e => renderKanban(e.target.value);

function renderAll() {
  if (!S) return;
  if (supervisaR()) {
    fillCli(); fillFocus(); renderKpis(); renderAlerts(); renderProj(); renderFeed(); renderPeople(); fillKb(); renderReview();
    if (role === 'lider') renderAdmin();
    if (curView() === 'persona') renderPersona();
    marcarEquipo();
  }
  if (registraR()) {
    if (MODO !== 'ver') fillProjs();
    renderMine(); renderHome();
  }
  preview();
  renderBlk();
  tick();
}

/* ---------- sesión ---------- */
async function entrar(u) {
  role = u.rol;
  me = u;
  focus = 0;
  EDIT = null;
  // El sublíder ve las dos secciones del menú: "Mi equipo" y "Mi trabajo" (sin Administración).
  document.querySelectorAll('aside nav').forEach(n => (n.hidden = n.dataset.role === 'lider' ? !supervisaR() : !registraR()));
  $('nav-admin').hidden = role !== 'lider';
  $('nav-sep-equipo').textContent = role === 'lider' ? 'Jefatura' : 'Mi equipo';
  $('me-name').textContent = u.nombre;
  $('me-role').textContent = ROL_LBL[role] || role;
  $('me-av').textContent = initials(u.nombre);
  $('rolechip').innerHTML = `Sesión de <b>${esc(u.nombre)}</b> · ` + ({
    lider: 'ves a todo el equipo y apruebas lo completado',
    sublider: 'ves tu trabajo y el de tu equipo, y apruebas lo de tu equipo',
    dev: 'solo ves tu trabajo',
  }[role] || '');
  $('focusbar').hidden = !supervisaR();
  await cargar();
  if (role === 'lider') {
    pfReset();
    ufReset();
  }
  $('login').hidden = true;
  const h = (location.hash || '').slice(1);
  show(ALLOWED[role].includes(h) ? h : HOME[role]);
}

function mostrarLogin() {
  cerrarMensaje();
  cerrarActividad();
  role = null;
  me = null;
  S = null;
  $('login').classList.remove('checking');
  $('login').hidden = false;
}

function lgErr(m) { $('lg-err').textContent = m; $('lg-err').hidden = false; }

$('lgform').onsubmit = async e => {
  e.preventDefault();
  const email = $('lg-mail').value.trim().toLowerCase();
  const password = $('lg-pass').value;
  if (!email || !password) return lgErr('Escribe tu correo y tu contraseña.');
  const btn = $('lg-btn');
  btn.disabled = true;
  try {
    const d = await api('/api/auth', { method: 'POST', body: { email, password, recordar: $('lg-rem').checked }, sinRedireccion: true });
    $('lg-err').hidden = true;
    $('lg-pass').value = '';
    await entrar(d.usuario);
  } catch (err) {
    lgErr(err.message);
  } finally {
    btn.disabled = false;
  }
};
$('lg-eye').onclick = () => {
  const i = $('lg-pass');
  const t = i.type === 'password';
  i.type = t ? 'text' : 'password';
  $('lg-eye').textContent = t ? 'Ocultar' : 'Ver';
};
$('lg-forgot').onclick = () => toast('Pide a tu líder que restablezca tu contraseña desde Administración.');
$('logout').onclick = async () => {
  await api('/api/auth', { method: 'DELETE', sinRedireccion: true }).catch(() => {});
  mostrarLogin();
  try { history.replaceState(null, '', location.pathname); } catch { /* sin historial */ }
};

/* ---------- animaciones ---------- */
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(sec) {
  if (RM) return;
  sec.querySelectorAll('.kpi b').forEach(b => {
    if (b.children.length) return;
    const t = b.textContent.trim();
    if (!/^\d+$/.test(t)) return;
    const n = +t;
    if (!n) return;
    const t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / 700);
      b.textContent = Math.round(n * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
const TILT = '.kpi,.pcard,.wdg,.hero .hi,.card,.alert';
let tEl = null;
document.addEventListener('pointermove', e => {
  if (RM || e.pointerType === 'touch') return;
  const el = e.target.closest(TILT);
  if (tEl && tEl !== el) tEl.style.transform = '';
  tEl = el;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - 0.5;
  const y = (e.clientY - r.top) / r.height - 0.5;
  const m = el.classList.contains('card') ? 5 : 7;
  el.style.transform = `perspective(800px) rotateX(${(-y * m).toFixed(2)}deg) rotateY(${(x * m).toFixed(2)}deg) translateZ(6px)`;
});
document.documentElement.addEventListener('pointerleave', () => { if (tEl) tEl.style.transform = ''; });
function setNav(c) {
  document.querySelector('.app').classList.toggle('collapsed', c);
  $('navtoggle').setAttribute('aria-expanded', String(!c));
  $('navtoggle').setAttribute('aria-label', c ? 'Mostrar menú' : 'Ocultar menú');
  try { localStorage.setItem('nexo-nav', c ? '1' : '0'); } catch { /* sin almacenamiento */ }
}
$('navtoggle').onclick = () => setNav(!document.querySelector('.app').classList.contains('collapsed'));
try { if (localStorage.getItem('nexo-nav') === '1') setNav(true); } catch { /* sin almacenamiento */ }

/* ---------- reloj y clima ---------- */
const CIUDADES = { cdmx: [19.4326, -99.1332], mty: [25.6866, -100.3161], gdl: [20.6597, -103.3496] };
const ICON = {
  sol: '<circle cx="24" cy="24" r="9" fill="#F2B233"/><g stroke="#F2B233" stroke-width="3" stroke-linecap="round"><path d="M24 5v5M24 38v5M5 24h5M38 24h5M10.5 10.5l3.5 3.5M34 34l3.5 3.5M10.5 37.5l3.5-3.5M34 14l3.5-3.5"/></g>',
  ps: '<circle cx="18" cy="17" r="8" fill="#F2B233"/><path d="M16 38h20a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0 1 12z" fill="#9FB3C8"/>',
  ll: '<path d="M12 30h24a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0-3 12z" fill="#8497AD"/><g stroke="#4A90D9" stroke-width="3" stroke-linecap="round"><path d="M17 35l-2 6M25 35l-2 6M33 35l-2 6"/></g>',
  nb: '<path d="M12 34h24a8 8 0 0 0 0-16 11 11 0 0 0-21 4 6 6 0 0 0-3 12z" fill="#9FB3C8"/>',
};
// Códigos WMO de Open-Meteo → icono y texto
function wmo(c) {
  if (c === 0) return ['sol', 'Despejado'];
  if (c === 1) return ['sol', 'Mayormente despejado'];
  if (c === 2) return ['ps', 'Parcialmente nublado'];
  if (c === 3) return ['nb', 'Nublado'];
  if (c === 45 || c === 48) return ['nb', 'Niebla'];
  if (c >= 51 && c <= 57) return ['ll', 'Llovizna'];
  if (c >= 61 && c <= 67) return ['ll', 'Lluvia'];
  if (c >= 71 && c <= 77) return ['nb', 'Nieve'];
  if (c >= 80 && c <= 82) return ['ll', 'Chubascos'];
  if (c >= 95) return ['ll', 'Tormenta'];
  return ['nb', 'Nublado'];
}
async function renderWx() {
  const [la, lo] = CIUDADES[$('wx-city').value];
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,weather_code&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FMexico_City&forecast_days=2`);
    if (!r.ok) throw new Error();
    const d = await r.json();
    const [ic, txt] = wmo(d.current.weather_code);
    $('wx-ic').innerHTML = ICON[ic];
    $('wx-t').textContent = Math.round(d.current.temperature_2m) + '°';
    $('wx-c').textContent = txt;
    $('wx-m').textContent = `Máx ${Math.round(d.daily.temperature_2m_max[0])}° · Mín ${Math.round(d.daily.temperature_2m_min[0])}° · Lluvia ${d.daily.precipitation_probability_max[0] ?? 0}%`;
    let i = d.hourly.time.findIndex(t => t > d.current.time);
    if (i < 0) i = 0;
    const horas = [i, i + 3, i + 6, i + 9].filter(k => k < d.hourly.time.length);
    $('wx-h').innerHTML = horas.map(k => `<div><svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">${ICON[wmo(d.hourly.weather_code[k])[0]]}</svg><b>${Math.round(d.hourly.temperature_2m[k])}°</b>${d.hourly.time[k].slice(11, 16)}</div>`).join('');
  } catch {
    $('wx-ic').innerHTML = ICON.nb;
    $('wx-t').textContent = '--°';
    $('wx-c').textContent = 'Clima no disponible';
    $('wx-m').textContent = '';
    $('wx-h').innerHTML = '';
  }
}
$('wx-city').onchange = renderWx;
renderWx();
setInterval(renderWx, 30 * 60 * 1000);

function tick() {
  const d = new Date();
  const hm = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  const sec = String(new Intl.DateTimeFormat('es-MX', { timeZone: TZ, second: 'numeric' }).format(d)).padStart(2, '0');
  $('clk').innerHTML = `${hm}<small>:${sec}</small>`;
  const fecha = new Intl.DateTimeFormat('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  $('hi-date').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  if (!S || !me) return;
  const h = +new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(d) % 24;
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  $('hi-greet').textContent = 'Hola, ' + primer(me.nombre);
  if (role === 'dev') {
    const bl = BM().length;
    const op = AM().filter(a => a.estatus !== 'Completado').length;
    $('hi-sub').textContent = `${saludo}. Tienes ${op} ${plural(op, 'actividad abierta', 'actividades abiertas')}` + (bl ? ` y ${bl} ${plural(bl, 'bloqueo abierto', 'bloqueos abiertos')}.` : '.');
    return;
  }
  const n = S.alertas.filter(a => a.proyecto_id).length;
  const m = S.kpis.nuevos;
  $('hi-sub').textContent = `${saludo}. ${n ? `Hay ${n} ${plural(n, 'proyecto que requiere', 'proyectos que requieren')} tu atención` : 'Ningún proyecto requiere tu atención'} y ${m} ${plural(m, 'avance nuevo', 'avances nuevos')} desde ayer.`;
}
tick();
setInterval(tick, 1000);

/* ---------- arranque ---------- */
(async () => {
  try {
    const d = await api('/api/auth', { sinRedireccion: true });
    if (!d.usuario) return mostrarLogin();
    await entrar(d.usuario);
  } catch {
    mostrarLogin();
  }
})();
