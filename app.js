/* PeakPlan v5 — evidenzinformierter periodisierter Coach, Offline-PWA. */
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

function initialState(){return {version:1,week:structuredClone(DEFAULT_WEEK),exceptions:{},logs:{},settings:{alertMinutes:60,exportDays:90,reminderRelease:2,adaptiveEnabled:true,blockStart:dateKey(new Date()),boardChoice:'both',weakness:'tension',coachMode:'auto',fingerMethod:'nohang',edgeDepth:15,lastIcsSignature:"",lastIcsAt:"",lastIcsCount:0},checkins:{},createdAt:new Date().toISOString()};}
/* v3: Lokaler, transparenter Adaptionsalgorithmus. Keine Cloud, keine Black-Box-Prognose. */
const ADAPTIVE_VERSION = 5;
function historyBefore(date,days=28){
  const start=plusDays(date,-days);
  return Object.entries(state.logs).flatMap(([d,byId])=>{
    if(d>=date||d<start)return [];
    return Object.entries(byId).filter(([,log])=>log?.status==='done').map(([sid,log])=>({date:d,sid,log}));
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
function checks(date){return state.checkins?.[date]||{};}
function numOrNull(x){return x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;}
function assess(date,type){
  const c=checks(date),h7=historyBefore(date,7),h3=historyBefore(date,3),h2=historyBefore(date,2),h14=historyBefore(date,14);
  const reasons=[];let fatigue=0, level='normal';
  const shoulder=numOrNull(c.shoulder),sleep=numOrNull(c.sleep),energy=numOrNull(c.energy),soreness=numOrNull(c.soreness);
  if(energy!==null&&energy<=3){fatigue+=2;reasons.push('Energie heute niedrig');}
  else if(energy!==null&&energy<=5){fatigue+=1;reasons.push('Energie heute reduziert');}
  if(sleep!==null&&sleep<=4){fatigue+=2;reasons.push('Schlafqualität niedrig');}
  else if(sleep!==null&&sleep<=6){fatigue+=1;reasons.push('Schlafqualität mäßig');}
  if(soreness!==null&&soreness>=7){fatigue+=2;reasons.push('Starker Muskelkater');}
  else if(soreness!==null&&soreness>=5){fatigue+=1;reasons.push('Erhöhter Muskelkater');}
  const isPull=['kraft','boulder'].includes(type);
  const heavyClimb=h2.filter(x=>['kraft','boulder'].includes(x.log.snapshot?.type)&&Number(x.log.rpe)>=8);
  const hardAny=h3.filter(x=>Number(x.log.rpe)>=8);
  if(isPull&&heavyClimb.length){fatigue+=2;reasons.push('Harte Finger-/Boulderbelastung in den letzten 48 h');}
  if(hardAny.length>=2){fatigue+=1;reasons.push('Mehrere harte Einheiten in den letzten 72 h');}
  const recent7=h7.filter(x=>x.log.snapshot?.type!=='rest');
  if(recent7.length>=5){fatigue+=1;reasons.push('Mindestens fünf absolvierte Einheiten in sieben Tagen');}
  const missed=Object.entries(state.logs).some(([d,v])=>d<date&&d>=plusDays(date,-7)&&Object.values(v).some(x=>x?.status==='skipped'));
  if(missed)reasons.push('Ausgefallene Einheiten werden nicht automatisch nachgeholt');
  if(fatigue>=4)level='recovery';else if(fatigue>=2)level='reduced';
  if(isPull&&shoulder!==null&&shoulder>=3){level=shoulder>=6?'recovery':'protect';reasons.unshift('Schulterbeschwerden '+shoulder+'/10: keine maximale Zug-/Fingerbelastung');}
  if(isPull&&shoulder===null&&date<=dateKey(new Date())){if(level==='normal')level='reduced';reasons.unshift('Aktueller Schulterstatus fehlt – zunächst keine maximale Zugbelastung einplanen');}
  if(shoulder!==null&&shoulder>=6&&type==='prehab'){level='recovery';reasons.unshift('Deutliche Schulterbeschwerden: nicht in Schmerz hinein trainieren');}
  if(!h14.length&&!Object.keys(c).length)reasons.push('Noch keine Verlaufsdaten oder Tagesformangaben – Basisprogramm');
  return {level,fatigue,reasons,hasCheckin:Object.keys(c).length>0,shoulder,history:h14};
}
function latestMetric(history,type,key){
  return history.filter(x=>numOrNull(x.log[key])!==null&&(key==='finger'?['max_limit','max_transfer'].includes(x.log.snapshot?.templateId):x.log.snapshot?.type===type)).slice(0,3);
}
function strengthTarget(date,type,key,increment){
  const arr=latestMetric(historyBefore(date,35),type,key);
  if(!arr.length)return {text:'Noch kein vergleichbarer Wert protokolliert – Belastung nach sauberer Technik und RPE 8 wählen.',progress:false};
  const last=Number(arr[0].log[key]);
  const good=arr.length>=2&&arr.slice(0,2).every(x=>x.log.quality==='ziel'&&Number(x.log.rpe)<=8&&numOrNull(x.log.shoulder)!==null&&Number(x.log.shoulder)<=2)
    &&Number(arr[0].log[key])>=Number(arr[1].log[key]);
  const value=(good?last+increment:last);
  return {text:`Letzter dokumentierter Wert: ${last} kg. ${good?`Vorsichtiger nächster Versuch: ${value} kg (+${increment} kg) bei unverändertem Protokoll und RPE ≤ 8.`:`Orientierungswert: ${value} kg nur bei gleicher Griff-/Satz-/Zeitvorgabe; bei hoher RPE reduzieren.`}`,progress:good};
}
function adaptedProgram(base,date){
  return window.PeakCoach?.workout(base,state,date) || base;
}
function adaptiveTag(s){
  if(!s.adaptive)return '';
  const cfg={normal:['lime','Coach · freigegeben'],reduced:['orange','Volumen angepasst'],protect:['orange','Belastungsschutz'],recovery:['red','Regeneration']};
  const [cl,txt]=cfg[s.adaptive.level]||cfg.normal;
  return `<span class="pill ${cl}">${txt}</span>`;
}
function phaseCard(date){
  const p=PeakCoach.phase(date,state.settings), r=PeakCoach.readiness(state,date,'kraft');
  const done=allLogs().filter(x=>x.date>=p.start&&x.date<=date).length;
  return `<section class="panel coach-panel"><div class="between"><div><div class="eyebrow">DEIN TRAININGSBLOCK · ZYKLUS ${p.cycle}</div><h2 style="margin:7px 0">${esc(p.name)}</h2></div><span class="pill ${p.deload?'orange':'lime'}">Woche ${p.week} / 12</span></div>
    <div class="phase-bar"><div style="width:${Math.round(100*(p.week/12))}%"></div></div>
    <p class="hint" style="margin:10px 0 8px">${esc(p.goal)}. ${p.deload?'Diese Woche ist eine geplante Entlastung.':'Nächste Entlastung: Woche '+p.nextDeload+'.'}</p>
    <div class="coach-mini"><span>Protokollierte Einheiten: <strong>${done}</strong></span><span>Datenbasis: <strong>${esc(r.confidence)}</strong></span></div>
    <button class="button small quiet" data-action="open-coach" data-date="${date}">Warum dieser Trainingsblock? ↗</button></section>`;
}
function coachInsight(date){
 const plan=PeakCoach.decision(state,date,'kraft');
 const names={beibehalten:'Plan beibehalten',reduzieren:'Dosis reduzieren',wiedereinstieg:'Kontrollierter Wiedereinstieg',schutz:'Belastung schützen',pause:'Heute Pause respektieren'};
 return `<section class="panel coach-insight"><div class="between"><div><div class="eyebrow">COACH-ENTSCHEIDUNG · ${esc(niceDate(date,true))}</div><h2 style="font-size:18px;margin:7px 0">${esc(names[plan.strategy]||'Plan prüfen')}</h2></div><span class="pill ${plan.strategy==='beibehalten'?'lime':'orange'}">${plan.mode==='auto'?'Auto':'Manuell'}</span></div>
 <p class="hint" style="margin:9px 0">${esc(plan.why[0])}</p><div class="hint">${plan.diagnosis.key&&plan.mode==='auto'?`Wiederkehrender Hinweis: ${esc(plan.diagnosis.signal)} (${esc(plan.diagnosis.confidence)}).`:'Kein belastbar bestätigtes Defizit – Fokus bleibt auf der Maximalkraft.'}</div>
 <button class="button small quiet" style="margin-top:12px" data-action="open-coach" data-date="${date}">Entscheidung erklären ↗</button></section>`;
}
function openCoach(date){
 const p=PeakCoach.phase(date,state.settings), a=PeakCoach.readiness(state,date,'kraft'),plan=PeakCoach.decision(state,date,'kraft');
 modal=`<h2>Dein Trainingscoach</h2><p class="modal-sub">Transparente Heuristik · Block ${p.cycle} · Woche ${p.week}/12</p>
 <div class="panel coach-panel"><strong>${esc(p.name)}</strong><p class="hint" style="margin:8px 0">${esc(p.goal)}. ${esc(p.emphasis)}.</p><p class="hint">Geplanter Beginn: ${esc(p.start)} · nächster 12-Wochen-Zyklus automatisch fortlaufend.</p></div>
 <div class="subhead">AKTUELLE ENTSCHEIDUNG</div><div class="panel"><strong>${esc(plan.why[0])}</strong><p class="hint" style="margin:8px 0">${esc(plan.why.slice(1).join(" "))}</p><p class="hint">Defizitdaten: ${esc(plan.diagnosis.observations)} unabhängige Selbstberichte. ${esc(plan.diagnosis.reason)}</p></div>
 <div class="subhead">WAS DER COACH BERÜCKSICHTIGT</div><div class="panel"><p class="hint">Aktuelle Belastung, harte Klettereinheiten der letzten 48–72 Stunden, RPE, Tagesform, Schmerzangaben und vergleichbare Lastprotokolle. Datenbasis: ${esc(a.confidence)}. Keine validierte individuelle Verletzungs- oder Leistungsprognose.</p><p class="hint">Periodisierung: Wochen 1–3 Fundament · 4 Entlastung · 5–7 Maximalkraft · 8 Entlastung · 9–11 Transfer · 12 Konsolidierung/Tests. Die 12-Wochen-Aufteilung ist eine Trainerheuristik, kein nachgewiesenes Optimum.</p></div>
 <div class="subhead">STUDIEN & GRENZEN</div><div class="panel">${PeakCoach.SOURCES.map(x=>`<div class="source-entry"><a target="_blank" rel="noopener noreferrer" href="${attr(x.url)}">${esc(x.name)} ↗</a><div class="hint">${esc(x.claim)}</div></div>`).join('')}</div>
 <div class="modal-footer"><button class="button primary" data-action="close-modal">Schließen</button></div>`;render();
}
function checkinPanel(date){
 const c=checks(date),a=PeakCoach.readiness(state,date,'kraft');
 const has=Object.keys(c).length>0;
 return `<div class="panel checkin-panel"><div class="between"><div><div class="subhead" style="margin:0 0 5px">TAGESFORM · ${esc(niceDate(date,true))}</div><strong>${has?`Energie ${esc(c.energy??'–')}/10 · Schlaf ${esc(c.sleep??'–')}/10`:'Noch kein Tagescheck'}</strong><div class="hint" style="margin-top:5px">${has?`Muskelkater ${esc(c.soreness??'–')}/10 · Schulter ${esc(c.shoulder??'–')}/10 · Finger ${esc(c.fingerPain??'–')}/10`:'Ergänzt deine Leistungsdaten und beeinflusst Trainingsintensität.'}</div><div class="hint" style="margin-top:5px">Zeitbudget: ${esc(c.minutesAvailable||'offen')} Minuten · Wunsch: ${esc(c.sessionWish==='light'?'reduziert':c.sessionWish==='off'?'heute frei':c.sessionWish==='return'?'Wiedereinstieg':'normal')}</div></div><button class="button small primary" data-action="open-checkin" data-date="${date}">${has?'Ändern':'Eintragen'}</button></div></div>`;
}
function openCheckin(date){
 const c=checks(date);
 function optionSelect(name,label,values){return `<div class="field"><label>${label}</label><select name="${name}"><option value="">Nicht erfasst</option>${values.map(i=>`<option value="${i}" ${numOrNull(c[name])===i?'selected':''}>${i} / 10</option>`).join('')}</select></div>`;}
 modal=`<h2>Tagesform erfassen</h2><p class="modal-sub">${esc(niceDate(date))} · Lokal auf deinem iPhone.</p><form id="checkin-form" data-date="${date}" class="form-col"><div class="form-grid">${optionSelect('energy','Energie · 10 = top',[1,2,3,4,5,6,7,8,9,10])}${optionSelect('sleep','Schlafqualität · 10 = top',[1,2,3,4,5,6,7,8,9,10])}${optionSelect('soreness','Muskelkater · 10 = stark',[0,1,2,3,4,5,6,7,8,9,10])}${optionSelect('shoulder','Schulterschmerz · 10 = stark',[0,1,2,3,4,5,6,7,8,9,10])}${optionSelect('fingerPain','Fingerschmerz · 10 = stark',[0,1,2,3,4,5,6,7,8,9,10])}</div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Heute verfügbare Zeit</label><select name="minutesAvailable"><option value="">Keine Begrenzung</option>${[30,45,60,90,120,150].map(v=>`<option value="${v}" ${Number(c.minutesAvailable)===v?'selected':''}>${v} Minuten</option>`).join('')}</select></div><div class="field"><label>Mein Wunsch heute</label><select name="sessionWish"><option value="normal" ${c.sessionWish!=='off'&&c.sessionWish!=='light'?'selected':''}>Coach entscheidet</option><option value="light" ${c.sessionWish==='light'?'selected':''}>Heute reduziert</option><option value="off" ${c.sessionWish==='off'?'selected':''}>Heute frei</option><option value="return" ${c.sessionWish==='return'?'selected':''}>Wiedereinstieg nach Pause</option></select></div></div><p class="hint">Warnregel: Ab 3/10 Finger- oder Schulterschmerz entfallen schwere Griff-/Zuglasten. Ab 5/10 wird für entsprechende Einheiten Regeneration vorgeschlagen. Dies ist keine medizinische Diagnostik.</p><div class="modal-footer"><button class="button primary" type="submit">Tagesplan aktualisieren</button><button class="button quiet" type="button" data-action="close-modal">Abbrechen</button></div></form>`;
 render();
}

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
    if (!(ex.hidden||[]).includes('weekly-'+idx)) { const raw=savedSession?clone(savedSession):{id:'weekly-'+idx,templateId:spec.template,title:template.name,type:template.type,time:spec.time||'18:00',duration:template.duration,description:template.description,steps:clone(template.steps),origin:'weekly'};result.push(savedSession?raw:adaptedProgram(raw,date));}
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
  return {version:1,week:data.week.map((w,i)=>({template:TEMPLATES[w?.template]?w.template:DEFAULT_WEEK[i].template,time:/^\d\d:\d\d$/.test(w?.time)?w.time:DEFAULT_WEEK[i].time})),exceptions:data.exceptions&&typeof data.exceptions==='object'?data.exceptions:{},logs:data.logs&&typeof data.logs==='object'?data.logs:{},settings:{blockStart:/^\d{4}-\d\d-\d\d$/.test(data.settings?.blockStart||'')?data.settings.blockStart:dateKey(new Date()),boardChoice:['both','moon','kilter','none'].includes(data.settings?.boardChoice)?data.settings.boardChoice:'both',weakness:['finger','pull','power','tension','footwork','feet','coordination','tactics'].includes(data.settings?.weakness)?data.settings.weakness:'tension',coachMode:data.settings?.coachMode==='manual'?'manual':'auto',fingerMethod:['nohang','hang'].includes(data.settings?.fingerMethod)?data.settings.fingerMethod:'nohang',edgeDepth:[15,20].includes(Number(data.settings?.edgeDepth))?Number(data.settings.edgeDepth):15,alertMinutes:data.settings?.reminderRelease===2&&[0,15,30,60,120].includes(Number(data.settings?.alertMinutes))?Number(data.settings?.alertMinutes):60,exportDays:[30,90,180].includes(Number(data.settings?.exportDays))?Number(data.settings?.exportDays):90,reminderRelease:2,adaptiveEnabled:data.settings?.adaptiveEnabled!==false,lastIcsSignature:String(data.settings?.lastIcsSignature||""),lastIcsAt:String(data.settings?.lastIcsAt||""),lastIcsCount:Number(data.settings?.lastIcsCount||0)},checkins:data.checkins&&typeof data.checkins==='object'&&!Array.isArray(data.checkins)?data.checkins:{},createdAt:data.createdAt||new Date().toISOString()};
}
function sessionStart(date,s){
  const start=parseDate(date);
  const [hh,mm]=String(s.time||'18:00').split(':').map(Number);
  start.setHours(hh,mm,0,0);return start;
}
function reminderTime(date,s){return new Date(sessionStart(date,s).getTime()-state.settings.alertMinutes*60000);}
function dateTimeLabel(d){return new Intl.DateTimeFormat('de-DE',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d);}
function upcomingEvents(days=90,onlyFuture=true){
  const now=new Date(),today=dateKey(now),events=[];
  for(let i=0;i<days;i++){
    const date=plusDays(today,i);
    for(const s of getSessions(date)){
      const status=getLog(date,s.id)?.status;
      if(s.type==='rest'||['skipped','moved','done'].includes(status))continue;
      if(onlyFuture&&sessionStart(date,s).getTime()<=now.getTime())continue;
      events.push({date,s});
    }
  }
  return events.sort((a,b)=>sessionStart(a.date,a.s)-sessionStart(b.date,b.s));
}
function calendarSignature(events){
  const source=JSON.stringify(events.map(({date,s})=>[date,s.id,s.title,s.time,s.duration,s.description,s.steps]));
  let h=2166136261;for(let i=0;i<source.length;i++){h^=source.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16)+'-'+events.length+'-'+state.settings.alertMinutes;
}
function calendarExportStatus(){
  if(!state.settings.lastIcsAt)return 'noch-nicht-exportiert';
  return state.settings.lastIcsSignature===calendarSignature(upcomingEvents(state.settings.exportDays))?'datei-erzeugt':'plan-geaendert';
}
function reminderSummary(){
  const next=upcomingEvents(14)[0];
  if(!next)return '<span class="hint">In den nächsten 14 Tagen ist kein weiteres Training geplant.</span>';
  const alarm=reminderTime(next.date,next.s);
  return `<div class="reminder-preview"><span class="reminder-bell" aria-hidden="true">◷</span><div><div class="reminder-preview-label">NÄCHSTE GEPLANTE ERINNERUNG</div><strong>${esc(dateTimeLabel(alarm))} Uhr</strong><div class="hint" style="margin-top:4px">${esc(next.s.title)} · Beginn ${esc(next.s.time)} Uhr</div></div></div>`;
}
function toast(message){const old=document.querySelector('.toast');if(old)old.remove();const t=document.createElement('div');t.className='toast';t.textContent=message;document.body.appendChild(t);clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>t.remove(),3800);}

function render(){
  const root=document.getElementById('app');
  root.innerHTML=`<div class="app-shell"><header class="topbar"><div class="logo-wrap"><div class="brand-mark">P.</div><div><div class="brand-name">PeakPlan</div><div class="eyebrow">BOULDER · STRENGTH · RUN</div></div></div><div class="top-date">${esc(niceDate(dateKey(new Date()),true))}<br/><span>Dein Trainingscockpit · v5</span></div></header>
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
  ${phaseCard(today)}
  ${coachInsight(today)}
  ${checkinPanel(today)}
  <div class="section-head"><h2>Deine Trainingswoche</h2><button class="button small quiet" data-action="nav" data-view="calendar">Alle Tage →</button></div>
  <div class="cards"><div class="stat-card"><div class="stat-label">Einheiten · 7 Tage</div><div class="stat-val">${countDone(7)}</div><div class="stat-foot">Absolviert</div></div><div class="stat-card"><div class="stat-label">Einheiten · 30 Tage</div><div class="stat-val">${countDone(30)}</div><div class="stat-foot">Absolviert</div></div></div>
  <div class="section-head"><h2>Heute im Detail</h2><span class="mini">${sessions.length} Eintrag/Einträge</span></div>
  ${sessions.map(s=>sessionCard(today,s)).join('')||'<div class="empty">Keine Einträge für heute.</div>'}
  <div class="section-head"><h2>Als Nächstes</h2><span class="mini">Dein Wochenrhythmus</span></div><div class="panel"><div class="timeline">${upcoming||'Aktuell keine weiteren Einheiten.'}</div></div>
  <div class="section-head"><h2>Deine nächste Erinnerung</h2><span class="pill blue">${state.settings.alertMinutes} Min. vorher</span></div>
  <div class="panel">${reminderSummary()}<p class="hint" style="margin:11px 0">Damit die Meldung auch bei geschlossener App erscheint, müssen die Termine einmal in Apple Kalender importiert werden. PeakPlan allein sendet noch keine Hintergrund-Push-Nachrichten.</p><button class="button primary full" data-action="nav" data-view="settings">Kalender-Erinnerungen einrichten →</button></div>
  <p class="hint" style="margin-top:15px">Trainerheuristiken, keine validierte individuelle Leistungs- oder Verletzungsprognose. Bei anhaltenden Schmerzen medizinisch abklären.</p>`;
}
function sessionCard(date,s){
  const log=getLog(date,s.id), status=log?.status;
  const statusLabel=status==='done'?'<span class="pill lime">✓ Erledigt</span>':status==='skipped'?'<span class="pill red">Ausgefallen</span>':status==='moved'?`<span class="pill orange">Verschoben ${log.to?`→ ${esc(niceDate(log.to,true))}`:''}</span>`:'';
  return `<article class="session-card" style="${status==='skipped'||status==='moved'?'opacity:.68;':''}"><div class="session-head"><div><div class="session-meta"><span>${esc(s.time)} Uhr · ${esc(s.duration)} min</span>${s.type!=='rest'?`<span class="meta-reminder">◷ ${esc(dateTimeLabel(reminderTime(date,s)))} Uhr</span>`:''}</div><div class="session-title">${esc(s.title)}</div></div>${badge(s.type)}</div><div class="session-desc">${esc(s.description||'Individuelle Einheit')}</div>${s.adaptive?`<div class="pills" style="margin-bottom:10px">${adaptiveTag(s)}</div>`:''}<div class="between"><div>${statusLabel||`<span class="mini">${esc((s.steps||[]).length)} Trainingsblöcke</span>`}</div><button class="button small ${status==='done'?'quiet':'primary'}" data-action="open-session" data-date="${date}" data-id="${attr(s.id)}">${status==='done'?'Details':'Programm ansehen'} →</button></div></article>`;
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
  ${phaseCard(selectedDate)}
  ${coachInsight(selectedDate)}
  ${checkinPanel(selectedDate)}
  <div class="section-head"><h2>${esc(niceDate(selectedDate))}</h2><button class="button small primary" data-action="add-session" data-date="${selectedDate}">+ Einheit</button></div>
  ${chosen.map(s=>sessionCard(selectedDate,s)).join('')||'<div class="empty">Noch nichts geplant. Mit „+ Einheit“ kannst du ein Training eintragen.</div>'}
  <div class="panel" style="margin-top:12px"><div class="between"><strong style="font-size:13px">Erinnerung 1 Stunde vorher</strong><button class="button small quiet" data-action="nav" data-view="settings">Einrichten →</button></div>${reminderSummary()}<p class="hint" style="margin:8px 0 0">Apple Kalender übernimmt nach dem Import die Erinnerung auch bei geschlossener PeakPlan-App. Bei Änderungen erneut abgleichen.</p></div>`;
}
function renderProgress(){
  const entries=allLogs();
  const series=[['Fingerboard · 15 mm','finger','kg'],['Weighted Pull-ups · Zusatzgewicht','pullup','kg'],['Laufen · Distanz','distance','km']];
  return `<div class="eyebrow">DEINE TRAININGSHISTORIE</div><h1 style="font-size:29px;margin:7px 0 0">Fortschritt</h1><p class="hint" style="margin:7px 0 20px">Die Diagramme entstehen ausschließlich aus deinen tatsächlich protokollierten Trainingseinheiten. Es werden keine Werte erfunden.</p>
  <div class="cards"><div class="stat-card"><div class="stat-label">Einheiten gesamt</div><div class="stat-val">${entries.length}</div></div><div class="stat-card"><div class="stat-label">Letzte 7 Tage</div><div class="stat-val">${countDone(7)}</div></div></div>
  ${series.map(([title,key,unit])=>{const points=entries.filter(e=>Number.isFinite(Number(e.log[key]))&&String(e.log[key]??'')!=='').map(e=>({date:e.date,value:Number(e.log[key])})).reverse();return `<div class="section-head"><h2>${esc(title)}</h2><span class="mini">${points.length} Messwerte</span></div><div class="panel">${points.length?svgChart(points,unit):`<div class="empty">Noch keine ${esc(unit)}-Messwerte. Beim Abschließen einer Einheit kannst du die Daten eintragen.</div>`}</div>`;}).join('')}
  <div class="section-head"><h2>Board-Transfer</h2></div><div class="panel"><strong>${esc(PeakCoach.boardTrend(state,dateKey(new Date())).message)}</strong><p class="hint" style="margin:8px 0 0">Bewertung nur aus protokollierten Durchstiegen und Versuchen, keine automatische Umrechnung von Schwierigkeitssystemen.</p></div>
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
  <div class="section-head"><h2>Flexibler Coach v5</h2><button class="button small quiet" data-action="open-coach" data-date="${dateKey(new Date())}">Studien ↗</button></div>
  ${phaseCard(dateKey(new Date()))}
  ${coachInsight(dateKey(new Date()))}
  <div class="panel"><div class="between"><div><strong>Trainingssteuerung aktiv</strong><div class="hint">Leistungsdaten, Tagesform und Zeitbudget; der Coach darf den Plan ausdrücklich beibehalten.</div></div><input style="width:auto;min-width:21px;height:23px" type="checkbox" aria-label="Adaptive Planung aktivieren" data-setting="adaptiveEnabled" ${state.settings.adaptiveEnabled?'checked':''}/></div>
  <div class="form-grid" style="margin:15px 0"><div class="field"><label>Beginn Trainingszyklus</label><input type="date" data-setting="blockStart" value="${attr(state.settings.blockStart)}" /></div><div class="field"><label>Board-Ausstattung</label><select data-setting="boardChoice"><option value="both" ${state.settings.boardChoice==='both'?'selected':''}>Moon- & Kilterboard</option><option value="moon" ${state.settings.boardChoice==='moon'?'selected':''}>Moonboard</option><option value="kilter" ${state.settings.boardChoice==='kilter'?'selected':''}>Kilterboard</option><option value="none" ${state.settings.boardChoice==='none'?'selected':''}>Nur Boulderwand</option></select></div><div class="field"><label>Schwerpunkt bestimmen</label><select data-setting="coachMode"><option value="auto" ${state.settings.coachMode!=='manual'?'selected':''}>Automatisch · bei genügend Daten</option><option value="manual" ${state.settings.coachMode==='manual'?'selected':''}>Manuell festlegen</option></select></div><div class="field" ${state.settings.coachMode==='manual'?'':'style="display:none"'}><label>Manueller Technikfokus</label><select data-setting="weakness"><option value="tension" ${state.settings.weakness==='tension'?'selected':''}>Körperspannung</option><option value="finger" ${state.settings.weakness==='finger'?'selected':''}>Kleine Griffe</option><option value="power" ${state.settings.weakness==='power'?'selected':''}>Dynamik / Power</option><option value="feet" ${['footwork','feet'].includes(state.settings.weakness)?'selected':''}>Trittpräzision</option><option value="coordination" ${state.settings.weakness==='coordination'?'selected':''}>Koordination</option><option value="pull" ${state.settings.weakness==='pull'?'selected':''}>Zugkraft</option><option value="tactics" ${state.settings.weakness==='tactics'?'selected':''}>Taktik / Pausen</option></select></div><div class="field"><label>Fingerkraft-Methode</label><select data-setting="fingerMethod"><option value="nohang" ${state.settings.fingerMethod==='nohang'?'selected':''}>No-Hang / Pickup</option><option value="hang" ${state.settings.fingerMethod==='hang'?'selected':''}>Hangboard-Hangs</option></select></div><div class="field"><label>Leistentiefe</label><select data-setting="edgeDepth"><option value="15" ${Number(state.settings.edgeDepth)===15?'selected':''}>15 mm</option><option value="20" ${Number(state.settings.edgeDepth)===20?'selected':''}>20 mm</option></select></div></div>
  <p class="hint">Auto ist voreingestellt. Bei wenigen Daten wählt PeakPlan keinen künstlichen Schwachpunkt. Die Defiziterkennung beruht auf wiederholten Selbsteinschätzungen, nicht auf einer objektiven Bewegungsanalyse. Änderungen sind vorerst tagesbezogene Entscheidungen innerhalb des 12-Wochen-Rahmens. Qualität vor Rotation: Hauptübungen bleiben für vergleichbare Messungen stabil. Nach einem Teilblock wechseln der Schwerpunkt und ausgewählte Nebenübungen. Ältere Kraftwerte ohne dokumentiertes Griff-/Lastprotokoll lösen bewusst keine automatische Laststeigerung aus.</p></div><div class="section-head"><h2>Dein Wochenrhythmus</h2></div>
  <div class="panel">${state.week.map((w,i)=>`<div class="setting-row"><div class="setting-day">${WEEKDAYS[i]}</div><select data-setting="template" data-day="${i}" aria-label="Programm ${WEEKDAYS[i]}">${Object.entries(TEMPLATES).map(([key,t])=>`<option value="${key}" ${key===w.template?'selected':''}>${esc(t.name)}</option>`).join('')}</select><input type="time" data-setting="time" data-day="${i}" aria-label="Uhrzeit ${WEEKDAYS[i]}" value="${esc(w.time)}"/></div>`).join('')}</div>
  <div class="section-head"><h2>Trainings-Erinnerungen</h2><span class="pill lime">${state.settings.alertMinutes} Minuten vorher</span></div>
  <div class="panel"><div class="pill blue" style="margin-bottom:12px">Apple Kalender · kostenlos · kein zusätzlicher Server</div>
  <p style="font-size:13px">Jede geplante Einheit erhält einen Kalendertermin mit einem <strong>Alarm ${state.settings.alertMinutes} Minuten vor Trainingsbeginn</strong>. Im Termin stehen die vollständigen Trainingsinhalte. Apple Kalender kann dich auch bei geschlossener PeakPlan-App benachrichtigen.</p>
  ${reminderSummary()}
  <div class="form-grid" style="margin:14px 0"><div class="field"><label for="alert-mins">Erinnerung vorher</label><select id="alert-mins" data-setting="alertMinutes"><option value="0" ${state.settings.alertMinutes===0?'selected':''}>Bei Beginn</option><option value="15" ${state.settings.alertMinutes===15?'selected':''}>15 Minuten</option><option value="30" ${state.settings.alertMinutes===30?'selected':''}>30 Minuten</option><option value="60" ${state.settings.alertMinutes===60?'selected':''}>1 Stunde</option><option value="120" ${state.settings.alertMinutes===120?'selected':''}>2 Stunden</option></select></div><div class="field"><label for="export-days">Zeitraum</label><select id="export-days" data-setting="exportDays">${[30,90,180].map(n=>`<option value="${n}" ${state.settings.exportDays===n?'selected':''}>${n} Tage</option>`).join('')}</select></div></div>
  <button class="button primary full" data-action="export-ics">${upcomingEvents(state.settings.exportDays).length} Trainingstermine teilen / speichern ↗</button>
  ${calendarExportStatus()==='plan-geaendert'?'<p class="warning" style="margin-top:13px">Dein Kalenderplan weicht von der letzten exportierten Datei ab oder das Exportzeitfenster ist inzwischen weitergelaufen. Bereits importierte Termine ändern sich nicht automatisch.</p>':calendarExportStatus()==='datei-erzeugt'?`<p class="hint" style="margin-top:12px">Zuletzt erzeugte Kalenderdatei: ${esc(dateTimeLabel(new Date(state.settings.lastIcsAt)))} Uhr. Bitte stelle sicher, dass du die Datei tatsächlich in Apple Kalender importiert hast.</p>`:'<p class="hint" style="margin-top:12px">Du hast noch keine Kalenderdatei aus dieser Version erstellt.</p>'}
  <div class="subhead">SO GEHT ES AUF DEM IPHONE</div>
  <div class="step"><div class="step-index">1</div><div><div class="step-name">Datei erzeugen</div><div class="step-detail">Oben auf „Trainingstermine … erstellen“ tippen.</div></div></div>
  <div class="step"><div class="step-index">2</div><div><div class="step-name">In Apple Kalender übernehmen</div><div class="step-detail">Die .ics-Datei bei Bedarf über Apple Mail als Anhang an dich selbst senden, öffnen und in einen eigenen Kalender „PeakPlan“ importieren.</div></div></div>
  <div class="step"><div class="step-index">3</div><div><div class="step-name">Mitteilungen testen</div><div class="step-detail">In iOS unter Einstellungen → Mitteilungen → Kalender Alarme erlauben und einen importierten Termin kontrollieren.</div></div></div>
  <div class="button-group" style="margin-top:14px"><button class="button quiet" data-action="test-ics">Test-Erinnerung erstellen</button></div>
  <p class="hint" style="margin:12px 0 0">Wichtig: Ein .ics-Import synchronisiert sich nicht automatisch. Werden Einheiten in PeakPlan verschoben, abgesagt oder beendet, bleiben bereits importierte Kalendertermine bestehen, bis du sie im Kalender aktualisierst. Vor einem erneuten Import alte PeakPlan-Termine entfernen, um Duplikate zu vermeiden. Der Testtermin beginnt ca. 70 Minuten nach dem Export und hat damit einen Alarm in ca. 10 Minuten.</p>
  <hr/><div class="between"><strong style="font-size:13px">Direkte Web-Push-Nachrichten</strong><span class="pill orange">Backend erforderlich</span></div><p class="hint" style="margin:8px 0 0">Für automatische Pushs direkt von PeakPlan ist ein zusätzlicher Push- und Zeitplanungsdienst nötig. Diese Version nutzt stattdessen Apple-Kalenderalarme, ohne Anmeldedaten oder Trainingshistorie an einen Server zu senden.</p></div>
  <div class="section-head"><h2>Deine Daten sichern</h2></div><div class="panel"><p style="font-size:13px">Deine Daten bleiben auf diesem Gerät im App-Speicher. Exportiere regelmäßig ein JSON-Backup, denn das Löschen von Website-Daten oder der App kann lokale Einträge entfernen.</p><div class="button-group"><button class="button primary" data-action="export-json">Backup exportieren ↓</button><button class="button" data-action="import-json">Backup importieren ↑</button></div><input class="hidden" id="import-file" type="file" accept="application/json,.json"/><p class="hint" style="margin-top:12px">Keine Anmeldung, keine Trackingdienste, keine Cloud-Datenbank. Die Dateien kannst du bei Bedarf selbst in iCloud Drive sichern.</p></div>
  <div class="section-head"><h2>Installation</h2></div><div class="panel"><p class="hint" style="margin-bottom:0">Nach der Veröffentlichung auf HTTPS: In Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach kann die Anwendung offline starten, sobald die Dateien einmal geladen wurden. Erst unter einer HTTPS-Adresse funktioniert der Offline-Service-Worker.</p></div>
  <p class="warning" style="margin-top:18px">Trainingsvorlagen sind individuelle Ausgangsentwürfe und ersetzen keine medizinische Belastungsfreigabe. Insbesondere bei bestehenden Schulterbeschwerden nur schmerzfreie Belastungen wählen.</p>`;
}

function openSession(date,sid){
  const s=getById(date,sid);if(!s){toast('Einheit nicht gefunden.');return;}
  const log=getLog(date,s.id),old=log?.status==='done';
  modal=`<div class="between"><div><div class="eyebrow">${esc(niceDate(date))} · ${esc(s.time)} UHR</div><h2 style="margin:7px 0">${esc(s.title)}</h2></div>${badge(s.type)}</div><p class="modal-sub">${esc(s.duration)} Minuten · ${esc(s.description)}</p>${old?`<div class="pill lime">✓ Absolviert · RPE ${esc(log.rpe||'–')}</div>`:''}
  ${s.adaptive?`<div class="panel adaptive-explain"><div class="pills">${adaptiveTag(s)}</div><p class="hint" style="margin:10px 0 0">${esc(s.adaptive.reasons.length?s.adaptive.reasons.join(' · '):'Plan nach Blockphase, Tagescheck und dokumentierten Einheiten.')}</p>${!s.adaptive.hasCheckin?`<button class="button small" style="margin-top:10px" data-action="open-checkin" data-date="${date}">Tagesform eintragen</button>`:''}</div>`:''}<div class="subhead">DEIN KONKRETES PROGRAMM</div>${stepList(s.steps)}
  ${log?.notes?`<div class="panel" style="margin-top:12px"><div class="subhead" style="margin-top:0">DEINE NOTIZEN</div><p style="margin:0;font-size:13px">${esc(log.notes)}</p></div>`:''}
  <div class="modal-footer">${s.type!=='rest'?`<button class="button primary" data-action="complete-session" data-date="${date}" data-id="${attr(s.id)}">${old?'Log bearbeiten':'✓ Training abschließen'}</button>`:''}<button class="button" data-action="edit-session" data-date="${date}" data-id="${attr(s.id)}">Bearbeiten</button></div>
  ${s.type!=='rest'?`<div class="button-group" style="margin-top:12px"><button class="button small" data-action="single-ics" data-date="${date}" data-id="${attr(s.id)}">◷ In Apple Kalender übernehmen · ${state.settings.alertMinutes} Min. vorher</button></div>`:''}
  <div class="button-group" style="margin-top:10px"><button class="button small quiet" data-action="move-session" data-date="${date}" data-id="${attr(s.id)}">↗ Verschieben</button><button class="button small quiet" data-action="skip-session" data-date="${date}" data-id="${attr(s.id)}">${log?.status==='skipped'?'Wieder aktivieren':'Ausfallen lassen'}</button><button class="button small quiet" data-action="close-modal">Schließen</button></div>`;
  render();
}
function openComplete(date,sid){
  const s=getById(date,sid), log=getLog(date,sid)||{};if(!s)return;
  modal=`<h2>Training protokollieren</h2><p class="modal-sub">${esc(niceDate(date))} · ${esc(s.title)}</p><form id="complete-form" data-date="${date}" data-id="${attr(sid)}"><div class="form-grid">
  <div class="field"><label>Belastung (RPE)</label><select name="rpe">${Array.from({length:10},(_,i)=>i+1).map(n=>`<option value="${n}" ${(log.rpe||8)===n?'selected':''}>${n} / 10</option>`).join('')}</select></div>
  <div class="field"><label>Finger ${esc(state.settings.edgeDepth)} mm · kg (Arbeitslast)</label><input type="number" inputmode="decimal" step="0.5" min="0" max="200" name="finger" placeholder="z. B. 55" value="${attr(log.finger??'')}" /></div>
  <div class="field"><label>Pull-up Zusatzgewicht · kg</label><input type="number" inputmode="decimal" step="0.5" min="0" max="200" name="pullup" placeholder="z. B. 52" value="${attr(log.pullup??'')}" /></div>
  <div class="field"><label>Laufdistanz · km</label><input type="number" inputmode="decimal" step="0.1" min="0" max="200" name="distance" placeholder="z. B. 8.2" value="${attr(log.distance??'')}" /></div>
  <div class="field"><label>Laufdauer · min</label><input type="number" inputmode="decimal" step="1" min="0" max="1000" name="minutes" placeholder="z. B. 40" value="${attr(log.minutes??'')}" /></div></div>
  <div class="subhead">STÄRKEPROTOKOLL · FÜR VERGLEICHBARE KRAFTWERTE</div><div class="form-grid">
  <div class="field"><label>Fingertechnik</label><select name="fingerMode"><option value="">Nicht protokolliert</option><option value="nohang" ${(log.fingerMode||'')==='nohang'?'selected':''}>No-Hang / Pickup</option><option value="hang" ${(log.fingerMode||'')==='hang'?'selected':''}>Hangboard-Hang</option></select></div>
  <div class="field"><label>Griff</label><select name="fingerGrip"><option value="">Nicht protokolliert</option><option value="half" ${log.fingerGrip==='half'?'selected':''}>Half-Crimp</option><option value="open" ${log.fingerGrip==='open'?'selected':''}>Open Hand</option></select></div>
  <div class="field"><label>Leiste · mm</label><input name="fingerEdge" type="number" min="5" max="50" inputmode="decimal" value="${attr(log.fingerEdge??state.settings.edgeDepth)}" /></div>
  <div class="field"><label>Haltedauer · Sekunden</label><input name="fingerHold" type="number" min="1" max="60" inputmode="decimal" value="${attr(log.fingerHold??5)}" /></div>
  <div class="field"><label>Pull-up · Wiederholungen/Satz</label><input name="pullupReps" type="number" min="1" max="30" inputmode="numeric" value="${attr(log.pullupReps??(s.adaptive?.phase?.key==='base'?4:3))}" /></div>
  <div class="field"><label>Fingerschmerz nach Einheit (0–10)</label><select name="fingerPain"><option value="">Nicht erfasst</option>${Array.from({length:11},(_,i)=>`<option value="${i}" ${numOrNull(log.fingerPain)===i?'selected':''}>${i}/10</option>`).join('')}</select></div></div>
  <p class="hint" style="margin:10px 0">Für No-Hang: gehobene Gesamtlast; für Hangboard: zusätzliches Gewicht in kg. Ohne vollständiges Fingerprotokoll erfolgt keine automatische Laststeigerung.</p>
  <div class="subhead">BOARD-TRANSFER</div><div class="form-grid"><div class="field"><label>Board</label><select name="board"><option value="">–</option>${['Moonboard','Kilterboard','Wand','Outdoor'].map(v=>`<option value="${v}" ${log.board===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Schwierigkeit / Boulder</label><input name="grade" maxlength="65" placeholder="z. B. 7C / Projektname" value="${attr(log.grade??'')}" /></div><div class="field"><label>Versuche</label><input name="attempts" type="number" min="0" max="999" value="${attr(log.attempts??'')}"/></div><div class="field"><label>Durchstieg</label><select name="send"><option value="">Nicht erfasst</option><option value="yes" ${log.send==='yes'?'selected':''}>Ja</option><option value="no" ${log.send==='no'?'selected':''}>Nein</option></select></div></div>
  <div class="field" style="margin-top:13px"><label>Was hat dich bei schwierigen Zügen am ehesten limitiert? (optional)</label><select name="limiter"><option value="">Nicht einschätzbar / nicht relevant</option>${[['finger','Kleine Griffe / Fingerkraft'],['pull','Zugkraft'],['tension','Körperspannung / Fußdruck'],['feet','Trittpräzision'],['power','Explosivität'],['coordination','Koordination'],['tactics','Beta / Pausengestaltung']].map(([k,v])=>`<option value="${k}" ${log.limiter===k?'selected':''}>${v}</option>`).join('')}</select><p class="hint">Subjektiver Hinweis, keine gesicherte Diagnose. Bei uneinheitlichen Angaben wird kein Defizit erzwungen.</p></div>
  <div class="form-grid" style="margin-top:13px"><div class="field"><label>Ziel der Einheit erreicht?</label><select name="quality"><option value="">Bitte auswählen</option><option value="ziel" ${log.quality==='ziel'?'selected':''}>Ja · alle Hauptsätze/Intervalle</option><option value="teilweise" ${log.quality==='teilweise'?'selected':''}>Teilweise</option><option value="nicht" ${log.quality==='nicht'?'selected':''}>Nein</option></select></div><div class="field"><label>Schulter nach Training (0–10)</label><select name="shoulder"><option value="">Nicht erfasst</option>${Array.from({length:11},(_,i)=>`<option value="${i}" ${numOrNull(log.shoulder)===i?'selected':''}>${i} / 10</option>`).join('')}</select></div></div><div class="field" style="margin-top:13px"><label>Notizen, Boulderprojekte, Schmerz / Regeneration</label><textarea name="notes" placeholder="Wie lief die Einheit? Welche Boulder, welche Schwierigkeit?">${esc(log.notes||'')}</textarea></div>
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
async function deliverIcs(name,content){
  // iOS kann die erzeugte Kalenderdatei über das System-Teilen-Menü direkt an Mail/Dateien übergeben.
  if(typeof File!=='undefined' && typeof navigator.canShare==='function' && typeof navigator.share==='function'){
    const file=new File([content],name,{type:'text/calendar'});
    if(navigator.canShare({files:[file]})){
      try {await navigator.share({files:[file],title:'PeakPlan Trainingskalender'});return true;}
      catch(err){if(err?.name==='AbortError')return false;}
    }
  }
  download(name,content,'text/calendar;charset=utf-8');return true;
}
function icsEsc(v){return String(v??'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function foldLine(line){let out='',n=0;for(const cp of line){const length=new TextEncoder().encode(cp).length;if(n+length>73){out+='\r\n ';n=1;}out+=cp;n+=length;}return out;}
function icsDateTime(d){return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;}
function icsStamp(d){return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');}
function eventToIcs(date,s,uidOverride){
  const start=sessionStart(date,s),end=new Date(start.getTime()+Math.max(Number(s.duration)||0,10)*60000);
  const full=[s.description,...(s.steps||[]).map(([a,b],j)=>`${j+1}. ${a}: ${b}`)].filter(Boolean).join('\n');
  const preview=(s.steps||[]).slice(0,2).map(([a])=>a).filter(Boolean).join(', ');
  const lead=s.title+(preview?' · '+preview:'');
  return ['BEGIN:VEVENT',`UID:${uidOverride||date+'-'+s.id.replace(/[^a-zA-Z0-9-]/g,'')+'@peakplan.local'}`,
    `DTSTAMP:${icsStamp(new Date())}`,`DTSTART:${icsDateTime(start)}`,`DTEND:${icsDateTime(end)}`,
    `SUMMARY:${icsEsc('Training: '+lead)}`,`DESCRIPTION:${icsEsc(full)}`,
    'BEGIN:VALARM','ACTION:DISPLAY',`TRIGGER:-PT${state.settings.alertMinutes}M`,
    `DESCRIPTION:${icsEsc('Training: '+lead)}`,'END:VALARM','END:VEVENT'];
}
function toIcs(events=upcomingEvents(state.settings.exportDays)){
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PeakPlan//Training Calendar v4//DE','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:PeakPlan Training'];
  for(const {date,s} of events)lines.push(...eventToIcs(date,s));
  lines.push('END:VCALENDAR');return {content:lines.map(foldLine).join('\r\n')+'\r\n',count:events.length};
}
function toTestIcs(){
  const start=new Date(Date.now()+70*60000);start.setSeconds(0,0);
  const date=dateKey(start),s={id:'reminder-test',title:'PeakPlan-Test-Erinnerung',time:`${pad(start.getHours())}:${pad(start.getMinutes())}`,duration:10,
    description:'Test für deinen Apple-Kalenderalarm. Wenn du diese Datei rechtzeitig importierst, sollte dein iPhone etwa 10 Minuten nach dem Erstellen erinnern.',
    steps:[['Test','Kalender-Mitteilungen aktivieren und Termin prüfen']]};
  return {date,content:toIcs([{date,s}]).content};
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
      case 'open-checkin':openCheckin(d);break;
      case 'open-coach':openCoach(d||dateKey(new Date()));break;
      case 'edit-session':openEdit(d,sid);break;
      case 'add-session':openEdit(d,null);break;
      case 'move-session':openMove(d,sid);break;
      case 'skip-session':setSkip(d,sid);break;
      case 'close-modal':modal='';render();break;
      case 'export-json':download(`PeakPlan-Backup-${dateKey(new Date())}.json`,JSON.stringify(state,null,2),'application/json');toast('Backup erstellt. Bitte sicher in Dateien/iCloud ablegen.');break;
      case 'import-json':document.getElementById('import-file')?.click();break;
      case 'export-ics':{
        const events=upcomingEvents(state.settings.exportDays),{content,count}=toIcs(events);
        if(!count){toast('Keine geplanten Einheiten im Exportzeitraum.');return;}
        const delivered=await deliverIcs(`PeakPlan-Kalender-${dateKey(new Date())}.ics`,content);
        if(!delivered)return;
        state.settings.lastIcsSignature=calendarSignature(events);state.settings.lastIcsAt=new Date().toISOString();state.settings.lastIcsCount=count;
        updateState();toast(`${count} Termine mit 1-Stunden-Alarm vorbereitet. Bitte in Apple Kalender importieren.`);break;
      }
      case 'single-ics':{
        const sess=getById(d,sid);if(!sess){toast('Einheit nicht gefunden.');return;}
        if(['skipped','moved'].includes(getLog(d,sid)?.status)){toast('Diese Einheit wurde abgesagt oder verschoben.');return;}
        const {content}=toIcs([{date:d,s:sess}]);
        const delivered=await deliverIcs(`PeakPlan-${d}-${sid.replace(/[^a-zA-Z0-9-]/g,'')}.ics`,content);
        if(delivered)toast('Kalenderdatei erstellt. Jetzt in Apple Kalender importieren.');break;
      }
      case 'test-ics':{
        const {content}=toTestIcs();const delivered=await deliverIcs('PeakPlan-Test-Erinnerung.ics',content);
        if(delivered)toast('Testtermin erstellt – bitte sofort importieren (Alarm nach ca. 10 Min.).');break;
      }
    }
  });
  document.addEventListener('change',async e=>{
    const el=e.target;
    if(el.id==='import-file'&&el.files?.[0]){
      try{const file=el.files[0];if(file.size>5_000_000)throw new Error('Backup-Datei zu groß.');const data=JSON.parse(await file.text());const parsed=safeState(data);if(!confirm('Bestehende PeakPlan-Daten vollständig durch dieses Backup ersetzen?'))return;state=parsed;selectedDate=dateKey(new Date());calendarAnchor=selectedDate;view='today';updateState();toast('Backup eingelesen.');}
      catch(err){toast('Import fehlgeschlagen: '+err.message);}finally{el.value='';}return;
    }
    if(el.dataset.setting==='blockStart'&&/^\d{4}-\d{2}-\d{2}$/.test(el.value)){state.settings.blockStart=el.value;updateState();toast('Zyklusbeginn gespeichert.');return;}
    if(['boardChoice','weakness','coachMode','fingerMethod','edgeDepth'].includes(el.dataset.setting)){state.settings[el.dataset.setting]=el.dataset.setting==='edgeDepth'?Number(el.value):el.value;updateState();toast('Trainingsprofil aktualisiert.');return;}
    if(el.dataset.setting==='adaptiveEnabled'){state.settings.adaptiveEnabled=el.checked;updateState();toast('Adaptive Planung '+(el.checked?'aktiviert.':'deaktiviert.'));return;}
    if(el.dataset.setting==='template'||el.dataset.setting==='time'){
      const day=Number(el.dataset.day);if(Number.isInteger(day)&&day>=0&&day<7){state.week[day][el.dataset.setting]=el.value;updateState();toast('Wochenplan aktualisiert.');}return;
    }
    if(el.dataset.setting==='alertMinutes'||el.dataset.setting==='exportDays'){
      state.settings[el.dataset.setting]=Number(el.value);updateState();return;
    }
  });
  document.addEventListener('submit',e=>{
    if(!['edit-form','complete-form','move-form','checkin-form'].includes(e.target.id))return;
    e.preventDefault();const form=e.target,fd=new FormData(form),date=form.dataset.date,sid=form.dataset.id;
    if(form.id==='checkin-form'){const c={};for(const key of ['sleep','energy','soreness','shoulder','fingerPain']){const n=numOrNull(fd.get(key));if(n!==null&&n>=0&&n<=10)c[key]=n;}if(!state.checkins)state.checkins={};const minutes=numOrNull(fd.get('minutesAvailable'));if([30,45,60,90,120,150].includes(minutes))c.minutesAvailable=minutes;const wish=String(fd.get('sessionWish')||'normal');if(['off','light','return'].includes(wish))c.sessionWish=wish;if(Object.keys(c).length)state.checkins[date]=c;else delete state.checkins[date];modal='';updateState();toast('Tagesform gespeichert · Trainingsplan neu berechnet.');return;}
    if(form.id==='edit-form'){
      const target=String(fd.get('date'));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(target)){toast('Ungültiges Datum.');return;}
      const steps=String(fd.get('steps')||'').split(/\r?\n/).filter(x=>x.trim()).slice(0,30).map(line=>{const p=line.split('|');return [p.shift().trim().slice(0,120),p.join('|').trim().slice(0,400)];});
      editSave(date,sid,{date:target,title:String(fd.get('title')).trim().slice(0,110),time:String(fd.get('time')),type:TYPES[String(fd.get('type'))]?String(fd.get('type')):'other',duration:Number(fd.get('duration'))||0,description:String(fd.get('description')||'').trim().slice(0,250),steps});
    }
    if(form.id==='move-form'){moveSave(date,sid,String(fd.get('target')));}
    if(form.id==='complete-form'){
      const s=getById(date,sid);if(!s)return;
      const log={status:'done',title:s.title,snapshot:clone(s),completedAt:new Date().toISOString(),rpe:Number(fd.get('rpe')),notes:String(fd.get('notes')||'').slice(0,2000),quality:['ziel','teilweise','nicht'].includes(String(fd.get('quality')))?String(fd.get('quality')):'',shoulder:numOrNull(fd.get('shoulder')),fingerPain:numOrNull(fd.get('fingerPain')),fingerMode:String(fd.get('fingerMode')||''),fingerGrip:String(fd.get('fingerGrip')||''),fingerEdge:numOrNull(fd.get('fingerEdge')),fingerHold:numOrNull(fd.get('fingerHold')),pullupReps:numOrNull(fd.get('pullupReps')),board:String(fd.get('board')||''),grade:String(fd.get('grade')||'').slice(0,65),attempts:numOrNull(fd.get('attempts')),send:String(fd.get('send')||''),limiter:['finger','pull','tension','feet','power','coordination','tactics'].includes(String(fd.get('limiter')))?String(fd.get('limiter')):''};
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
