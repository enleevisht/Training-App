/* PeakPlan v1 — Offlinefähiger, privater Trainingskalender ohne externe Abhängigkeiten. */
'use strict';

const WEEKDAYS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
const TYPES = {kraft:'Kraft',boulder:'Bouldern',run:'Laufen',prehab:'Prehab',rest:'Regeneration',other:'Sonstiges'};
const KIND_COLORS = {kraft:'purple',boulder:'lime',run:'blue',prehab:'orange',rest:'',other:''};
const TEMPLATES = {
  max_limit: {
    name:'Maximalkraft + Limit-Bouldern', type:'kraft',duration:115,
    description:'Qualität vor Volumen. Zuerst gezieltes Aufwärmen, danach Maximalkraft und kurze harte Boulder.',
    steps:[
      ['Aufwärmen','20–25 min progressiv: leichte Boulder, Schulterkontrolle und Fingeraktivierung'],
      ['Fingerboard 15 mm','4–5 × 5 s schwer; 3–4 min Satzpause; keine Wiederholung bis zum Versagen'],
      ['Weighted Pull-ups','4 × 3 Wdh., RPE 8; 3–4 min Pause – nur bei beschwerdefreier Schulter'],
      ['Moonboard 40°','25–35 min Limit-Boulder, 3–5 hochwertige Versuche pro Problem; lange Pausen'],
      ['Cool-down / Log','5–10 min; Kraftwerte, Projekte, RPE dokumentieren']
    ]
  },
  prehab: {
    name:'Antagonisten + Schulterpflege',type:'prehab',duration:55,
    description:'Kontrollierte Belastung und Bewegungsqualität – nur schmerzfrei.',
    steps:[
      ['Mobilisieren','10 min kontrollierte Schulter- und Brustwirbelsäulenbewegung'],
      ['Außenrotation','3 × 10–12 leicht bis moderat; keine provokanten Positionen'],
      ['Face Pulls','3 × 12 technisch sauber'],
      ['Drückbewegung','3 × 8–12 in schmerzfreier Variante'],
      ['Rumpf','3 × 30–45 s schmerzfreie Stabilisation']
    ]
  },
  intervals: {
    name:'Laufintervalle',type:'run',duration:55,
    description:'Mittwoch: Qualitätseinheit. Tempo an Tagesform und aktueller Leistungsfähigkeit ausrichten.',
    steps:[
      ['Einlaufen','15 min locker + 3 kurze Steigerungen'],
      ['Hauptteil','3 × 8 min zügig, RPE 7–8; 3 min lockeres Traben zwischen den Intervallen'],
      ['Auslaufen','10–15 min sehr locker'],
      ['Log','Distanz, Pace, Herzfrequenz, Gefühl und RPE notieren']
    ]
  },
  max_transfer: {
    name:'Fingerkraft + Board-Transfer',type:'boulder',duration:105,
    description:'Zweite hochwertige Krafteinheit mit gezieltem Transfer auf harte Boulderzüge.',
    steps:[
      ['Aufwärmen','20–25 min stufenweise auf Finger- und Schulterniveau'],
      ['Fingerkraft','4 × 5 s, 15-mm-Leiste, RPE 8–9; lange Pausen'],
      ['Board-Limit','40 min Moonboard 2019 / Kilter 40°, 2–3 Projekte, vollständige Erholung'],
      ['Technik-Links','15 min einzelne harte Zugfolgen verbinden, nicht auspowern'],
      ['Log','Griff, Last, Boulder/Grad, Versuche, Schultergefühl']
    ]
  },
  rest: {
    name:'Regeneration / frei',type:'rest',duration:0,
    description:'Geplanter Ruhetag. Bewegung nach Lust und Energie, keine Pflicht.',
    steps:[['Erholung','Optional 15–30 min Spaziergang oder leichte Mobilität']]
  },
  board_volume: {
    name:'Board / Outdoor-Volumen',type:'boulder',duration:125,
    description:'Technisch gute Boulder und gezielte Projektzeit statt ermüdendem Junk-Volumen.',
    steps:[
      ['Aufwärmen','20 min zunehmend schwere Boulder'],
      ['Qualitätsblock','45–60 min Board oder Outdoor, 3–6 anspruchsvolle Boulder'],
      ['Technik / Volumen','20–30 min kontrolliert unter dem persönlichen Limit'],
      ['Log','Probleme, Grad, Versuche und RPE festhalten']
    ]
  },
  easy_run: {
    name:'Locker laufen',type:'run',duration:70,
    description:'Sonntag: lockerer aerober Lauf – ohne unnötige Ermüdung für die nächste Kraftwoche.',
    steps:[
      ['Locker anlaufen','10 min wirklich entspannt'],
      ['Grundlagenlauf','Insgesamt ca. 10–15 km bei unterhaltungsfähigem Tempo; Distanz bei Bedarf kürzen'],
      ['Log','Distanz, Dauer, mittlere HF und Belastungsgefühl']
    ]
  }
};
const DEFAULT_WEEK = [
  {template:'max_limit',time:'18:00'}, {template:'prehab',time:'18:00'},
  {template:'intervals',time:'18:00'}, {template:'max_transfer',time:'18:00'},
  {template:'rest',time:'18:00'}, {template:'board_volume',time:'11:00'},
  {template:'easy_run',time:'10:00'}
];

function initialState(){return {version:1,week:structuredClone(DEFAULT_WEEK),exceptions:{},logs:{},settings:{alertMinutes:30,exportDays:90},createdAt:new Date().toISOString()};}
let state = initialState();
let view = 'today';
let calendarMode = 'month';
let selectedDate = dateKey(new Date());
let calendarAnchor = selectedDate;
let modal = '';
let noticeTimer;

function pad(n){return String(n).padStart(2,'0');}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function parseDate(s){const [y,m,d]=String(s).split('-').map(Number);return new Date(y,m-1,d,12,0,0,0);}
function plusDays(s,n){const d=parseDate(s);d.setDate(d.getDate()+n);return dateKey(d);}
function weekday(s){return (parseDate(s).getDay()+6)%7;}
function monday(s){return plusDays(s,-weekday(s));}
function niceDate(s,short=false){return new Intl.DateTimeFormat('de-DE',short?{day:'numeric',month:'short'}:{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(parseDate(s));}
function monthLabel(s){return new Intl.DateTimeFormat('de-DE',{month:'long',year:'numeric'}).format(parseDate(s));}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function attr(v){return esc(v);}
function id(){return 'custom-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);}
function badge(kind){return `<span class="pill ${KIND_COLORS[kind]||''}">${esc(TYPES[kind]||'Training')}</span>`;}
function clone(x){return structuredClone(x);}
function getException(date){return state.exceptions[date] || {added:[],hidden:[]};}
function getSessions(date){
  const idx=weekday(date), spec=state.week[idx], ex=getException(date);
  let result=[];
  if (spec && spec.template && TEMPLATES[spec.template]) {
    const template=TEMPLATES[spec.template];
    const savedSession=state.logs[date]?.['weekly-'+idx]?.snapshot;
    if (!(ex.hidden||[]).includes('weekly-'+idx)) result.push(savedSession?clone(savedSession):{id:'weekly-'+idx,templateId:spec.template,title:template.name,type:template.type,time:spec.time||'18:00',duration:template.duration,description:template.description,steps:clone(template.steps),origin:'weekly'});
  }
  for(const entry of ex.added||[]) result.push({...clone(entry),origin:'custom'});
  return result.sort((a,b)=>String(a.time).localeCompare(String(b.time)));
}
function getLog(date,sessionId){return state.logs[date]?.[sessionId]||null;}
function activeSessions(date){return getSessions(date).filter(s=>s.type!=='rest'&& !['skipped','moved','done'].includes(getLog(date,s.id)?.status));}
function completed(date){return getSessions(date).filter(s=>getLog(date,s.id)?.status==='done');}
function countDone(days){let n=0;for(let i=0;i<days;i++)n+=completed(plusDays(dateKey(new Date()),-i)).length;return n;}
function allLogs(){return Object.entries(state.logs).flatMap(([date,byId])=>Object.entries(byId).filter(([,log])=>log.status==='done').map(([sid,log])=>({date,sid,log}))).sort((a,b)=>b.date.localeCompare(a.date));}
function getById(date,sid){return getSessions(date).find(s=>s.id===sid);}
function stepList(steps){return (steps||[]).map((s,i)=>`<div class="step"><div class="step-index">${i+1}</div><div><div class="step-name">${esc(s[0])}</div><div class="step-detail">${esc(s[1])}</div></div></div>`).join('');}
function updateState(){writeState().catch(()=>toast('Speichern fehlgeschlagen – bitte Backup exportieren.'));render();}

function openDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open('peakplan-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('data');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function readState(){
  try {const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('data','readonly');const req=tx.objectStore('data').get('state');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  catch(e){try{return JSON.parse(localStorage.getItem('peakplan-state')||'null');}catch{return null;}}
}
async function writeState(){
  const snapshot=clone(state);
  try {const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction('data','readwrite');tx.objectStore('data').put(snapshot,'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
  catch(e){localStorage.setItem('peakplan-state',JSON.stringify(snapshot));}
}
function safeState(data){
  if(!data||typeof data!=='object'||data.version!==1||!Array.isArray(data.week)||data.week.length!==7)throw new Error('Ungültige oder inkompatible Sicherungsdatei.');
  return {version:1,week:data.week.map((w,i)=>({template:TEMPLATES[w?.template]?w.template:DEFAULT_WEEK[i].template,time:/^\d\d:\d\d$/.test(w?.time)?w.time:DEFAULT_WEEK[i].time})),exceptions:data.exceptions&&typeof data.exceptions==='object'?data.exceptions:{},logs:data.logs&&typeof data.logs==='object'?data.logs:{},settings:{alertMinutes:[0,15,30,60,120].includes(Number(data.settings?.alertMinutes))?Number(data.settings?.alertMinutes):30,exportDays:[30,90,180].includes(Number(data.settings?.exportDays))?Number(data.settings?.exportDays):90},createdAt:data.createdAt||new Date().toISOString()};
}
function toast(message){const old=document.querySelector('.toast');if(old)old.remove();const t=document.createElement('div');t.className='toast';t.textContent=message;document.body.appendChild(t);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>t.remove(),3800);}

function render(){
  const root=document.getElementById('app');
  root.innerHTML=`<div class="app-shell"><header class="topbar"><div class="logo-wrap"><div class="brand-mark">P.</div><div><div class="brand-name">PeakPlan</div><div class="eyebrow">BOULDER · STRENGTH · RUN</div></div></div><div class="top-date">${esc(niceDate(dateKey(new Date()),true))}<br/><span>Dein Trainingscockpit</span></div></header>
  ${view==='today'?renderToday():view==='calendar'?renderCalendar():view==='progress'?renderProgress():renderSettings()}
  </div><nav class="nav"><div class="nav-inner">${navButton('today','⌂','Heute')}${navButton('calendar','▦','Kalender')}${navButton('progress','↗','Fortschritt')}${navButton('settings','⚙','Plan & Backup')}</div></nav>
  ${modal?`<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="Trainingsdetails">${modal}</section></div>`:''}`;
}
function navButton(k,icon,label){return `<button class="nav-button ${view===k?'active':''}" data-action="nav" data-view="${k}"><span class="nav-icon">${icon}</span>${label}</button>`;}
function renderToday(){
  const today=dateKey(new Date()), sessions=getSessions(today), active=activeSessions(today), nextDays=[];
  for(let i=1;i<=10;i++){const d=plusDays(today,i);const plans=activeSessions(d);if(plans.length){nextDays.push({date:d,sessions:plans});if(nextDays.length>=3)break;}}
  const headline=active.length?active.map(s=>s.title).join(' + '):(completed(today).length?'Training erledigt!':'Heute regenerieren');
  const desc=active.length?active.map(s=>`${s.time} Uhr · ${s.duration} Min.`).join('  ·  '):(completed(today).length?'Gute Arbeit. Die Einheit ist in deinem Trainingstagebuch gespeichert.':'Heute ist keine aktive Einheit eingeplant. Nutze die Zeit zum Erholen oder passe deinen Kalender an.');
  const upcoming=nextDays.map(e=>`<div class="timeline-item"><div class="timeline-date">${esc(niceDate(e.date,true))} · ${esc(e.sessions[0].time)}</div><div class="timeline-title">${esc(e.sessions.map(s=>s.title).join(' + '))}</div></div>`).join('');
  return `<section class="hero"><div class="eyebrow">HEUTE · ${esc(niceDate(today))}</div><h1>${esc(headline)}</h1><p>${esc(desc)}</p><div class="button-group"><button class="button primary" data-action="nav" data-view="calendar">Trainingskalender öffnen ↗</button>${active.length?`<button class="button" data-action="open-session" data-date="${today}" data-id="${attr(active[0].id)}">Einheit ansehen</button>`:''}</div></section>
  <div class="section-head"><h2>Deine Trainingswoche</h2><button class="button small quiet" data-action="nav" data-view="calendar">Alle Tage →</button></div>
  <div class="cards"><div class="stat-card"><div class="stat-label">Einheiten · 7 Tage</div><div class="stat-val">${countDone(7)}</div><div class="stat-foot">Absolviert</div></div><div class="stat-card"><div class="stat-label">Einheiten · 30 Tage</div><div class="stat-val">${countDone(30)}</div><div class="stat-foot">Absolviert</div></div></div>
  <div class="section-head"><h2>Heute im Detail</h2><span class="mini">${sessions.length} Eintrag/Einträge</span></div>
  ${sessions.map(s=>sessionCard(today,s)).join('')||'<div class="empty">Keine Einträge für heute.</div>'}
  <div class="section-head"><h2>Als Nächstes</h2><span class="mini">Dein Wochenrhythmus</span></div><div class="panel"><div class="timeline">${upcoming||'Aktuell keine weiteren Einheiten.'}</div></div>
  <p class="hint" style="margin-top:15px">Die Trainingseinheiten sind editierbare Ausgangsvorlagen, keine automatische Belastungsdiagnostik. Bei aktuellen Schulterbeschwerden bitte schmerzauslösende Übungen nicht durchführen.</p>`;
}
function sessionCard(date,s){
  const log=getLog(date,s.id), status=log?.status;
  const statusLabel=status==='done'?'<span class="pill lime">✓ Erledigt</span>':status==='skipped'?'<span class="pill red">Ausgefallen</span>':status==='moved'?`<span class="pill orange">Verschoben ${log.to?`→ ${esc(niceDate(log.to,true))}`:''}</span>`:'';
  return `<article class="session-card" style="${status==='skipped'||status==='moved'?'opacity:.68;':''}"><div class="session-head"><div><div class="session-meta"><span>${esc(s.time)} Uhr · ${esc(s.duration)} min</span></div><div class="session-title">${esc(s.title)}</div></div>${badge(s.type)}</div><div class="session-desc">${esc(s.description||'Individuelle Einheit')}</div><div class="between"><div>${statusLabel||`<span class="mini">${esc((s.steps||[]).length)} Trainingsblöcke</span>`}</div><button class="button small ${status==='done'?'quiet':'primary'}" data-action="open-session" data-date="${date}" data-id="${attr(s.id)}">${status==='done'?'Details':'Programm ansehen'} →</button></div></article>`;
}
function renderCalendar(){
  const today=dateKey(new Date()), first=parseDate(calendarAnchor);
  const start=calendarMode==='month'?monday(dateKey(new Date(first.getFullYear(),first.getMonth(),1))):monday(calendarAnchor);
  const weeks=calendarMode==='month'?Math.ceil(((weekday(dateKey(new Date(first.getFullYear(),first.getMonth(),1))))+new Date(first.getFullYear(),first.getMonth()+1,0).getDate())/7):1;
  const days=Array.from({length:weeks*7},(_,i)=>plusDays(start,i));
  const header=calendarMode==='month'?monthLabel(calendarAnchor):`${niceDate(start,true)} – ${niceDate(plusDays(start,6),true)}`;
  const cells=days.map(d=>{
    const sessions=getSessions(d), nonRest=sessions.filter(s=>s.type!=='rest');
    const states=nonRest.map(s=>getLog(d,s.id)?.status==='done'?'done':s.type==='run'?'run':s.type==='rest'?'rest':'training');
    const outside=calendarMode==='month'&&parseDate(d).getMonth()!==first.getMonth();
    return `<button class="day ${outside?'other':''} ${d===selectedDate?'selected':''} ${d===today?'today':''}" data-action="choose-date" data-date="${d}" aria-label="${esc(niceDate(d))}"><span class="daynumber">${parseDate(d).getDate()}</span><span class="dots">${states.slice(0,3).map(t=>`<span class="dot ${t==='training'?'':t}"></span>`).join('')}</span></button>`;
  }).join('');
  const chosen=getSessions(selectedDate);
  return `<div class="between"><div><div class="eyebrow">DEIN PERSÖNLICHER PLAN</div><h1 style="font-size:28px;margin:7px 0 0">Trainingskalender</h1></div><button class="button small quiet" data-action="jump-today">Heute</button></div>
  <div class="calendar-toolbar"><button class="icon-button" data-action="calendar-shift" data-delta="-1" aria-label="Zurück">‹</button><div class="calendar-title">${esc(header)}</div><button class="icon-button" data-action="calendar-shift" data-delta="1" aria-label="Weiter">›</button></div>
  <div class="between" style="margin-bottom:13px"><div class="segmented"><button class="segment ${calendarMode==='week'?'active':''}" data-action="calendar-mode" data-mode="week">Woche</button><button class="segment ${calendarMode==='month'?'active':''}" data-action="calendar-mode" data-mode="month">Monat</button></div><div class="mini"><span class="dot" style="display:inline-block"></span> Boulder/Kraft &nbsp; <span class="dot run" style="display:inline-block"></span> Laufen</div></div>
  <div class="calendar"><div class="calendar-weekdays">${WEEKDAYS.map(d=>`<div class="weekday">${d}</div>`).join('')}</div><div class="calendar-grid">${cells}</div></div>
  <div class="section-head"><h2>${esc(niceDate(selectedDate))}</h2><button class="button small primary" data-action="add-session" data-date="${selectedDate}">+ Einheit</button></div>
  ${chosen.map(s=>sessionCard(selectedDate,s)).join('')||'<div class="empty">Noch nichts geplant. Mit „+ Einheit“ kannst du ein Training eintragen.</div>'}
  <div class="panel" style="margin-top:12px"><div class="between"><strong style="font-size:13px">Erinnerung auf dem iPhone</strong><button class="button small quiet" data-action="nav" data-view="settings">Einrichten →</button></div><p class="hint" style="margin:8px 0 0">Exportiere deinen Plan als Apple-Kalenderdatei mit Alarmen. Echte Web-Push-Mitteilungen kommen in einem späteren Ausbau.</p></div>`;
}
function renderProgress(){
  const entries=allLogs();
  const series=[['Fingerboard · 15 mm','finger','kg'],['Weighted Pull-ups · Zusatzgewicht','pullup','kg'],['Laufen · Distanz','distance','km']];
  return `<div class="eyebrow">DEINE TRAININGSHISTORIE</div><h1 style="font-size:29px;margin:7px 0 0">Fortschritt</h1><p class="hint" style="margin:7px 0 20px">Die Diagramme entstehen ausschließlich aus deinen tatsächlich protokollierten Trainingseinheiten. Es werden keine Werte erfunden.</p>
  <div class="cards"><div class="stat-card"><div class="stat-label">Einheiten gesamt</div><div class="stat-val">${entries.length}</div></div><div class="stat-card"><div class="stat-label">Letzte 7 Tage</div><div class="stat-val">${countDone(7)}</div></div></div>
  ${series.map(([title,key,unit])=>{const points=entries.filter(e=>Number.isFinite(Number(e.log[key]))&&String(e.log[key]??'')!=='').map(e=>({date:e.date,value:Number(e.log[key])})).reverse();return `<div class="section-head"><h2>${esc(title)}</h2><span class="mini">${points.length} Messwerte</span></div><div class="panel">${points.length?svgChart(points,unit):`<div class="empty">Noch keine ${esc(unit)}-Messwerte. Beim Abschließen einer Einheit kannst du die Daten eintragen.</div>`}</div>`;}).join('')}
  <div class="section-head"><h2>Trainingstagebuch</h2></div><div class="panel">${entries.length?entries.slice(0,30).map(e=>`<div class="log-card"><div class="between"><strong>${esc(e.log.title||'Training')}</strong><span class="mini">${esc(niceDate(e.date,true))}</span></div><div class="hint">RPE ${esc(e.log.rpe||'–')} ${e.log.finger?'· Finger '+esc(e.log.finger)+' kg':''}${e.log.pullup?' · Pull-up +'+esc(e.log.pullup)+' kg':''}${e.log.distance?' · '+esc(e.log.distance)+' km':''}</div>${e.log.notes?`<div class="hint" style="margin-top:4px">${esc(e.log.notes)}</div>`:''}</div>`).join(''):'<div class="empty">Dein Log ist noch leer. Starte mit deiner nächsten Einheit.</div>'}</div>`;
}
function svgChart(points,unit){
  const values=points.map(p=>p.value),min=Math.min(...values),max=Math.max(...values),span=Math.max(max-min,1);
  const pts=points.map((p,i)=>[18+(i/(Math.max(points.length-1,1)))*304,139-((p.value-min)/span)*105]);
  const line=pts.map(p=>p.join(',')).join(' ');
  const dots=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#c2f66c"/>`).join('');
  return `<svg class="progress-chart" viewBox="0 0 340 170" role="img" aria-label="Messreihe von ${min} bis ${max} ${unit}"><line x1="18" x2="322" y1="139" y2="139" stroke="#304357"/><line x1="18" x2="322" y1="34" y2="34" stroke="#304357" stroke-dasharray="3 4"/><text x="18" y="20" fill="#9aafc0" font-size="12">${esc(max)} ${esc(unit)}</text><text x="18" y="160" fill="#9aafc0" font-size="11">${esc(points[0].date.slice(5))}</text><text x="322" y="160" text-anchor="end" fill="#9aafc0" font-size="11">${esc(points[points.length-1].date.slice(5))}</text><polyline points="${line}" fill="none" stroke="#c2f66c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>`;
}
function renderSettings(){
  return `<div class="eyebrow">TRAININGSSTEUERUNG</div><h1 style="font-size:29px;margin:7px 0 0">Plan & Einstellungen</h1><p class="hint">Du kannst jeden Wochentag und seine Uhrzeit anpassen. Änderungen wirken auf alle Tage, die nicht individuell überschrieben wurden.</p>
  <div class="section-head"><h2>Dein Wochenrhythmus</h2></div>
  <div class="panel">${state.week.map((w,i)=>`<div class="setting-row"><div class="setting-day">${WEEKDAYS[i]}</div><select data-setting="template" data-day="${i}" aria-label="Programm ${WEEKDAYS[i]}">${Object.entries(TEMPLATES).map(([key,t])=>`<option value="${key}" ${key===w.template?'selected':''}>${esc(t.name)}</option>`).join('')}</select><input type="time" data-setting="time" data-day="${i}" aria-label="Uhrzeit ${WEEKDAYS[i]}" value="${esc(w.time)}"/></div>`).join('')}</div>
  <div class="section-head"><h2>iPhone-Erinnerungen</h2></div>
  <div class="panel"><div class="pill blue" style="margin-bottom:12px">Apple-Kalender · lokal auf dem iPhone</div><p style="font-size:13px">Exportiere anstehende Trainingseinheiten als Kalendertermine inklusive Alarm. In den Termindetails stehen bereits alle Übungen. Die iPhone-Kalender-App kann dich dann auch erinnern, wenn PeakPlan geschlossen ist.</p>
  <div class="form-grid" style="margin:14px 0"><div class="field"><label for="alert-mins">Erinnerung vorher</label><select id="alert-mins" data-setting="alertMinutes"><option value="0" ${state.settings.alertMinutes===0?'selected':''}>Bei Beginn</option><option value="15" ${state.settings.alertMinutes===15?'selected':''}>15 Minuten</option><option value="30" ${state.settings.alertMinutes===30?'selected':''}>30 Minuten</option><option value="60" ${state.settings.alertMinutes===60?'selected':''}>1 Stunde</option><option value="120" ${state.settings.alertMinutes===120?'selected':''}>2 Stunden</option></select></div><div class="field"><label for="export-days">Kalenderzeitraum</label><select id="export-days" data-setting="exportDays">${[30,90,180].map(n=>`<option value="${n}" ${state.settings.exportDays===n?'selected':''}>${n} Tage</option>`).join('')}</select></div></div>
  <button class="button primary full" data-action="export-ics">Kalenderdatei (.ics) erstellen ↓</button><p class="hint" style="margin:12px 0 0">Wichtig: Kalenderdateien sind eine Momentaufnahme, keine automatische Synchronisierung. Nach Planänderungen erneut exportieren; bereits importierte Termine gegebenenfalls entfernen. Der Import auf iOS erfolgt je nach Version über Dateien, Mail oder eine Kalender-App.</p>
  <hr/><div class="between"><strong style="font-size:13px">Echte Web-Push-Nachrichten</strong><span class="pill orange">Noch nicht eingerichtet</span></div><p class="hint" style="margin:8px 0 0">iOS unterstützt Push für Home-Bildschirm-Web-Apps. Dafür benötigen wir zusätzlich einen eingerichteten Push-Dienst mit Zeitsteuerung; dieser erste Offline-Build versendet noch keine Push-Nachrichten.</p></div>
  <div class="section-head"><h2>Deine Daten sichern</h2></div><div class="panel"><p style="font-size:13px">Deine Daten bleiben auf diesem Gerät im App-Speicher. Exportiere regelmäßig ein JSON-Backup, denn das Löschen von Website-Daten oder der App kann lokale Einträge entfernen.</p><div class="button-group"><button class="button primary" data-action="export-json">Backup exportieren ↓</button><button class="button" data-action="import-json">Backup importieren ↑</button></div><input class="hidden" id="import-file" type="file" accept="application/json,.json"/><p class="hint" style="margin-top:12px">Keine Anmeldung, keine Trackingdienste, keine Cloud-Datenbank. Die Dateien kannst du bei Bedarf selbst in iCloud Drive sichern.</p></div>
  <div class="section-head"><h2>Installation</h2></div><div class="panel"><p class="hint" style="margin-bottom:0">Nach der Veröffentlichung auf HTTPS: In Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach kann die Anwendung offline starten, sobald die Dateien einmal geladen wurden. Erst unter einer HTTPS-Adresse funktioniert der Offline-Service-Worker.</p></div>
  <p class="warning" style="margin-top:18px">Trainingsvorlagen sind individuelle Ausgangsentwürfe und ersetzen keine medizinische Belastungsfreigabe. Insbesondere bei bestehenden Schulterbeschwerden nur schmerzfreie Belastungen wählen.</p>`;
}

function openSession(date,sid){
  const s=getById(date,sid);if(!s){toast('Einheit nicht gefunden.');return;}
  const log=getLog(date,s.id),old=log?.status==='done';
  modal=`<div class="between"><div><div class="eyebrow">${esc(niceDate(date))} · ${esc(s.time)} UHR</div><h2 style="margin:7px 0">${esc(s.title)}</h2></div>${badge(s.type)}</div><p class="modal-sub">${esc(s.duration)} Minuten · ${esc(s.description)}</p>${old?`<div class="pill lime">✓ Absolviert · RPE ${esc(log.rpe||'–')}</div>`:''}
  <div class="subhead">DEIN KONKRETES PROGRAMM</div>${stepList(s.steps)}
  ${log?.notes?`<div class="panel" style="margin-top:12px"><div class="subhead" style="margin-top:0">DEINE NOTIZEN</div><p style="margin:0;font-size:13px">${esc(log.notes)}</p></div>`:''}
  <div class="modal-footer">${s.type!=='rest'?`<button class="button primary" data-action="complete-session" data-date="${date}" data-id="${attr(s.id)}">${old?'Log bearbeiten':'✓ Training abschließen'}</button>`:''}<button class="button" data-action="edit-session" data-date="${date}" data-id="${attr(s.id)}">Bearbeiten</button></div>
  <div class="button-group" style="margin-top:10px"><button class="button small quiet" data-action="move-session" data-date="${date}" data-id="${attr(s.id)}">↗ Verschieben</button><button class="button small quiet" data-action="skip-session" data-date="${date}" data-id="${attr(s.id)}">${log?.status==='skipped'?'Wieder aktivieren':'Ausfallen lassen'}</button><button class="button small quiet" data-action="close-modal">Schließen</button></div>`;
  render();
}
function openComplete(date,sid){
  const s=getById(date,sid), log=getLog(date,sid)||{};if(!s)return;
  modal=`<h2>Training protokollieren</h2><p class="modal-sub">${esc(niceDate(date))} · ${esc(s.title)}</p><form id="complete-form" data-date="${date}" data-id="${attr(sid)}"><div class="form-grid">
  <div class="field"><label>Belastung (RPE)</label><select name="rpe">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${(log.rpe||8)===n?'selected':''}>${n} / 10</option>`).join('')}</select></div>
  <div class="field"><label>Finger 15 mm · kg</label><input type="number" inputmode="decimal" step="0.5" min="0" max="200" name="finger" placeholder="z. B. 55" value="${attr(log.finger??'')}" /></div>
  <div class="field"><label>Pull-up Zusatzgewicht · kg</label><input type="number" inputmode="decimal" step="0.5" min="0" max="200" name="pullup" placeholder="z. B. 52" value="${attr(log.pullup??'')}" /></div>
  <div class="field"><label>Laufdistanz · km</label><input type="number" inputmode="decimal" step="0.1" min="0" max="200" name="distance" placeholder="z. B. 8.2" value="${attr(log.distance??'')}" /></div>
  <div class="field"><label>Laufdauer · min</label><input type="number" inputmode="decimal" step="1" min="0" max="1000" name="minutes" placeholder="z. B. 40" value="${attr(log.minutes??'')}" /></div></div>
  <div class="field" style="margin-top:13px"><label>Notizen, Boulderprojekte, Schmerz / Regeneration</label><textarea name="notes" placeholder="Wie lief die Einheit? Welche Boulder, welche Schwierigkeit?">${esc(log.notes||'')}</textarea></div>
  <div class="modal-footer"><button type="submit" class="button primary">✓ Speichern</button><button type="button" class="button quiet" data-action="open-session" data-date="${date}" data-id="${attr(sid)}">Zurück</button></div></form>`;
  render();
}
function openEdit(date,sid){
  const original=sid?getById(date,sid):null;
  const s=original||{title:'Individuelle Einheit',type:'boulder',time:'18:00',duration:75,description:'',steps:[['Aufwärmen','15–20 min'],['Hauptteil','Übungen und Sätze eintragen']]};
  modal=`<h2>${original?'Einheit bearbeiten':'Einheit hinzufügen'}</h2><p class="modal-sub">Datum, Uhrzeit und Trainingsprogramm frei anpassen.</p><form id="edit-form" data-date="${date}" data-id="${attr(sid||'')}" class="form-col">
  <div class="field"><label>Titel</label><input name="title" required maxlength="110" value="${attr(s.title)}"/></div>
  <div class="form-grid"><div class="field"><label>Datum</label><input name="date" type="date" required value="${date}"/></div><div class="field"><label>Uhrzeit</label><input name="time" type="time" required value="${attr(s.time)}"/></div>
  <div class="field"><label>Trainingstyp</label><select name="type">${Object.entries(TYPES).map(([k,v])=>`<option value="${k}" ${s.type===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="field"><label>Dauer (Minuten)</label><input name="duration" type="number" min="0" max="480" required value="${attr(s.duration)}"/></div></div>
  <div class="field"><label>Beschreibung</label><input name="description" maxlength="250" value="${attr(s.description||'')}"/></div>
  <div class="field"><label>Programm (eine Zeile pro Block: Titel | Umfang / Hinweise)</label><textarea name="steps" rows="8">${esc((s.steps||[]).map(s=>s.join(' | ')).join('\n'))}</textarea></div>
  <div class="modal-footer"><button type="submit" class="button primary">Speichern</button><button type="button" class="button quiet" data-action="close-modal">Abbrechen</button></div></form>`;
  render();
}
function openMove(date,sid){
  const s=getById(date,sid);if(!s)return;
  modal=`<h2>Einheit verschieben</h2><p class="modal-sub">${esc(s.title)} · ${esc(niceDate(date))}</p><form id="move-form" data-date="${date}" data-id="${attr(sid)}" class="form-col"><div class="field"><label>Neues Datum</label><input type="date" name="target" required value="${plusDays(date,1)}"/></div><p class="hint">Andere Einheiten am Zieltag bleiben bestehen. Die ursprüngliche Einheit wird als „verschoben“ markiert.</p><div class="modal-footer"><button class="button primary" type="submit">Verschieben</button><button class="button quiet" type="button" data-action="close-modal">Abbrechen</button></div></form>`;
  render();
}
function exception(date){return state.exceptions[date]||(state.exceptions[date]={added:[],hidden:[]});}
function editSave(originalDate,sid,data){
  if(sid){const e=exception(originalDate);if(sid.startsWith('weekly-')){if(!e.hidden.includes(sid))e.hidden.push(sid);}else{e.added=e.added.filter(x=>x.id!==sid);} }
  const target=exception(data.date);target.added.push({id:id(),title:data.title,type:data.type,time:data.time,duration:data.duration,description:data.description,steps:data.steps});
  selectedDate=data.date;calendarAnchor=data.date;view='calendar';modal='';updateState();toast('Einheit gespeichert.');
}
function moveSave(date,sid,target){
  const s=getById(date,sid);if(!s||target===date){toast('Bitte ein anderes Datum auswählen.');return;}
  const data=clone(s);data.id=id();delete data.origin;delete data.templateId;
  exception(target).added.push(data);
  (state.logs[date]||(state.logs[date]={}))[sid]={status:'moved',to:target,title:s.title,snapshot:clone(s)};
  selectedDate=target;calendarAnchor=target;view='calendar';modal='';updateState();toast('Einheit verschoben.');
}
function setSkip(date,sid){
  const s=getById(date,sid);if(!s)return;
  const old=getLog(date,sid);(state.logs[date]||(state.logs[date]={}))[sid]=old?.status==='skipped'?{status:'planned',title:s.title}:{status:'skipped',title:s.title};modal='';updateState();toast(old?.status==='skipped'?'Einheit wieder aktiviert.':'Einheit als ausgefallen markiert.');
}
function download(name,content,mime){
  const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
}
function icsEsc(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function foldLine(line){let out='',n=0;for(const cp of line){const length=new TextEncoder().encode(cp).length;if(n+length>73){out+='\r\n ';n=1;}out+=cp;n+=length;}return out;}
function toIcs(){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PeakPlan//Training Calendar v1//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PeakPlan Training'];
  const today=dateKey(new Date());let count=0;
  for(let i=0;i<state.settings.exportDays;i++){
    const date=plusDays(today,i);
    for(const s of getSessions(date)){
      if(s.type==='rest'||['skipped','moved'].includes(getLog(date,s.id)?.status))continue;
      const [hours,mins]=s.time.split(':').map(Number),start=parseDate(date);start.setHours(hours,mins,0,0);
      const end=new Date(start.getTime()+Math.max(s.duration,10)*60000);
      const dt=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
      const stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      const full=[s.description,...(s.steps||[]).map(([a,b],j)=>`${j+1}. ${a}: ${b}`)].join('\n');
      lines.push('BEGIN:VEVENT',`UID:${date}-${s.id.replace(/[^a-zA-Z0-9-]/g,'')}@peakplan.local`,`DTSTAMP:${stamp}`,`DTSTART:${dt(start)}`,`DTEND:${dt(end)}`,`SUMMARY:${icsEsc('Training: '+s.title)}`,`DESCRIPTION:${icsEsc(full)}`,
        'BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:-PT${state.settings.alertMinutes}M`,`DESCRIPTION:${icsEsc('Training: '+s.title+' – '+(s.steps?.[0]?.[0]||'Programm öffnen'))}`,'END:VALARM','END:VEVENT');
      count++;
    }
  }
  lines.push('END:VCALENDAR');return {content:lines.map(foldLine).join('\r\n')+'\r\n',count};
}

function registerActions(){
  document.addEventListener('click',async e=>{
    const el=e.target.closest('[data-action]');if(!el)return;
    const action=el.dataset.action;
    if(action==='close-modal'&&e.target.closest('.modal')&&e.target!==el)return;
    const d=el.dataset.date,sid=el.dataset.id;
    switch(action){
      case 'nav':view=el.dataset.view;modal='';render();break;
      case 'jump-today':selectedDate=dateKey(new Date());calendarAnchor=selectedDate;render();break;
      case 'calendar-mode':calendarMode=el.dataset.mode;calendarAnchor=selectedDate;render();break;
      case 'calendar-shift':{
        const dir=Number(el.dataset.delta);
        if(calendarMode==='month'){const x=parseDate(calendarAnchor);x.setDate(1);x.setMonth(x.getMonth()+dir);calendarAnchor=dateKey(x);}
        else calendarAnchor=plusDays(calendarAnchor,dir*7);
        render();break;
      }
      case 'choose-date':selectedDate=d;if(calendarMode==='month'&&parseDate(d).getMonth()!==parseDate(calendarAnchor).getMonth())calendarAnchor=d;render();break;
      case 'open-session':openSession(d,sid);break;
      case 'complete-session':openComplete(d,sid);break;
      case 'edit-session':openEdit(d,sid);break;
      case 'add-session':openEdit(d,null);break;
      case 'move-session':openMove(d,sid);break;
      case 'skip-session':setSkip(d,sid);break;
      case 'close-modal':modal='';render();break;
      case 'export-json':download(`PeakPlan-Backup-${dateKey(new Date())}.json`,JSON.stringify(state,null,2),'application/json');toast('Backup erstellt. Bitte sicher in Dateien/iCloud ablegen.');break;
      case 'import-json':document.getElementById('import-file')?.click();break;
      case 'export-ics':{const {content,count}=toIcs();if(!count){toast('Keine geplanten Einheiten im Exportzeitraum.');return;}download(`PeakPlan-Kalender-${dateKey(new Date())}.ics`,content,'text/calendar;charset=utf-8');toast(`${count} Trainingstermine exportiert. Jetzt in deinen Kalender importieren.`);break;}
    }
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.id==='import-file'&&el.files?.[0]){
      try{const file=el.files[0];if(file.size>5_000_000)throw new Error('Backup-Datei zu groß.');const data=JSON.parse(await file.text());const parsed=safeState(data);if(!confirm('Bestehende PeakPlan-Daten vollständig durch dieses Backup ersetzen?'))return;state=parsed;selectedDate=dateKey(new Date());calendarAnchor=selectedDate;view='today';updateState();toast('Backup eingelesen.');}
      catch(err){toast('Import fehlgeschlagen: '+err.message);}finally{el.value='';}return;
    }
    if(el.dataset.setting==='template'||el.dataset.setting==='time'){
      const day=Number(el.dataset.day);if(Number.isInteger(day)&&day>=0&&day<7){state.week[day][el.dataset.setting]=el.value;updateState();toast('Wochenplan aktualisiert.');}return;
    }
    if(el.dataset.setting==='alertMinutes'||el.dataset.setting==='exportDays'){
      state.settings[el.dataset.setting]=Number(el.value);updateState();return;
    }
  });
  document.addEventListener('submit',e=>{
    if(!['edit-form','complete-form','move-form'].includes(e.target.id))return;
    e.preventDefault();const form=e.target,fd=new FormData(form),date=form.dataset.date,sid=form.dataset.id;
    if(form.id==='edit-form'){
      const target=String(fd.get('date'));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(target)){toast('Ungültiges Datum.');return;}
      const steps=String(fd.get('steps')||'').split(/\r?\n/).filter(x=>x.trim()).slice(0,30).map(line=>{const p=line.split('|');return [p.shift().trim().slice(0,120),p.join('|').trim().slice(0,400)];});
      editSave(date,sid,{date:target,title:String(fd.get('title')).trim().slice(0,110),time:String(fd.get('time')),type:TYPES[String(fd.get('type'))]?String(fd.get('type')):'other',duration:Number(fd.get('duration'))||0,description:String(fd.get('description')||'').trim().slice(0,250),steps});
    }
    if(form.id==='move-form'){moveSave(date,sid,String(fd.get('target')));}
    if(form.id==='complete-form'){
      const s=getById(date,sid);if(!s)return;
      const log={status:'done',title:s.title,snapshot:clone(s),completedAt:new Date().toISOString(),rpe:Number(fd.get('rpe')),notes:String(fd.get('notes')||'').slice(0,2000)};
      for(const key of ['finger','pullup','distance','minutes']){const raw=String(fd.get(key)||'').trim().replace(',','.');if(raw!==''){const value=Number(raw);if(Number.isFinite(value)&&value>=0)log[key]=value;}}
      (state.logs[date]||(state.logs[date]={}))[sid]=log;modal='';updateState();toast('Training dokumentiert. Stark!');
    }
  });
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){modal='';render();}});
}
async function init(){
  const saved=await readState();if(saved){try{state=safeState(saved);}catch{state=initialState();}}
  registerActions();render();
  if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
