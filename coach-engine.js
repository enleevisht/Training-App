/* PeakPlan Coach 6.0 — lokale, transparente Entscheidungsregeln.
 * Keine behauptete KI-Prognose. Keine medizinische Diagnostik.
 * Evidenz und Gültigkeitsgrenzen in README und UI offengelegt.
 */
(function(root){
'use strict';
const MS=86400000;
const PHASES={
  base:{name:'Fundament & Belastbarkeit',short:'Fundament',goal:'Technik, Kapazität und belastbare Kraftbasis',emphasis:'Volumen moderat · saubere Wiederholungen'},
  strength:{name:'Maximalkraft',short:'Maxkraft',goal:'Hohe Kraftqualität bei begrenzter Ermüdung',emphasis:'Schwere kontrollierte Sätze · lange Pausen'},
  transfer:{name:'Transfer & Power',short:'Transfer',goal:'Kraft in schwierige, hochwertige Boulderzüge übertragen',emphasis:'Limit-Bouldern · Power · weniger Zusatzvolumen'},
  test:{name:'Konsolidierung & Vergleichstest',short:'Testwoche',goal:'Erholung und standardisierte Messungen',emphasis:'Geringer Umfang · gleiche Testbedingungen'}
};
const SOURCES=[
 {id:'climb_review',name:'Langer et al. (2023) · Krafttraining im Klettern',url:'https://pubmed.ncbi.nlm.nih.gov/36820707/',claim:'Systematisches Review: vielfältige, kletterspezifische statische und dynamische Belastungsformen; begrenzte Studienzahl.'},
 {id:'dynamic_rct',name:'Saeterbakken et al. (2024) · Fingerkraft vs. Boulderleistung',url:'https://pubmed.ncbi.nlm.nih.gov/39450143/',claim:'RCT: Kraftverbesserung führte nach fünf Wochen nicht automatisch zu besserer Boulderleistung.'},
 {id:'finger_cohort',name:'Fingerloading-Studie (2024) · niedrige und hohe Lasten',url:'https://pubmed.ncbi.nlm.nih.gov/39560837/',claim:'Retrospektive Selbstselektionsdaten: niedrigintensive und schwere Hangboard-Reize; keine kausale Überlegenheit bewiesen.'},
 {id:'autoreg',name:'Huang et al. (2025) · Autoregulation',url:'https://pubmed.ncbi.nlm.nih.gov/40791980/',claim:'Review: RPE/APRE/VBT sind für Krafttraining sinnvoll; Aussagen nicht direkt kletterspezifisch.'},
 {id:'load',name:'Swinton et al. (2024) · Intensität und Dosis',url:'https://pubmed.ncbi.nlm.nih.gov/38652410/',claim:'Meta-Analyse: Trainingsintensität und Ziel bestimmen wesentliche Teile der Kraftanpassung.'},
 {id:'injury',name:'Verletzungsrisiken Klettern · Review (2024)',url:'https://pubmed.ncbi.nlm.nih.gov/38162697/',claim:'Höhere Intensität, Crimp-Belastung und frühere Verletzung assoziiert; Risikoschätzung pro Person nicht validiert.'},
 {id:'period',name:'Zhang et al. (2026) · Periodisierungsvergleich',url:'https://pubmed.ncbi.nlm.nih.gov/41869632/',claim:'Lineare und wellenförmige Periodisierung liefern insgesamt ähnliche Ergebnisse; die konkrete 12-Wochen-Struktur ist eine Trainerheuristik.'}
];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const valid=(v)=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const n=(v,fallback=null)=>valid(v)?Number(v):fallback;
function parse(d){return new Date(String(d)+'T12:00:00');}
function span(a,b){return Math.round((parse(a)-parse(b))/MS);}
function plus(d,days){const x=parse(d);x.setDate(x.getDate()+days);return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');}
function phase(date,settings={}){
 const start=/^\d{4}-\d\d-\d\d$/.test(settings.blockStart||'')?settings.blockStart:date;
 const elapsed=Math.max(0,span(date,start));const cycle=Math.floor(elapsed/84)+1;
 const week=Math.floor(elapsed%84/7)+1;const day=elapsed%7+1;
 let key=week<=4?'base':week<=8?'strength':week<=11?'transfer':'test';
 const deload=week===4||week===8;const info=PHASES[key];
 return {...info,key,week,day,cycle,deload,progress:(week-1)/12,remaining:84-(elapsed%84),start:plus(start,(cycle-1)*84),end:plus(start,cycle*84-1),nextDeload:[4,8,12].find(w=>w>=week)||12};
}
function history(state,date,days=42){const result=[];const logs=state.logs||{};
 for(const [day,map] of Object.entries(logs))if(day<date && span(date,day)<=days && span(date,day)>0){
  for(const [id,log] of Object.entries(map||{}))if(log&&log.status==='done'){
   const exercises=Array.isArray(log.exerciseEntries)?log.exerciseEntries:[];
   const gripRows=exercises.filter(x=>['finger','pull','boulder','power'].includes(x.category)&&x.stress!=='low');
   const gripExercise=gripRows.length>0;
   const hardRpe=Math.max(n(log.rpe,0),...exercises.map(x=>n(x.rpe,0)));
   const hasGrip=exercises.length?gripExercise:['kraft','boulder'].includes(log.snapshot?.type);
   const gripRpe=gripRows.length?Math.max(...gripRows.map(x=>n(x.rpe,n(log.rpe,0)))):(exercises.length?0:n(log.rpe,0));
   result.push({date:day,id,log,type:log.snapshot?.type||'other',template:log.snapshot?.templateId||'',gripExercise,hasGrip,gripRpe,hardRpe,exercises});
  }
 }
 return result.sort((a,b)=>b.date.localeCompare(a.date));}
function check(state,date){return state.checkins?.[date]||{};}
function readiness(state,date,type){
 const c=check(state,date),h=history(state,date,28),h2=h.filter(x=>span(date,x.date)<=2),h3=h.filter(x=>span(date,x.date)<=3),h7=h.filter(x=>span(date,x.date)<=7);
 const isGrip=['kraft','boulder'].includes(type);let score=0;const reasons=[];let level='normal';
 if(n(c.energy)!==null){if(n(c.energy)<=3){score+=3;reasons.push('Deutlich reduzierte Energie');}else if(n(c.energy)<=5){score++;reasons.push('Energie unter gewohntem Niveau');}}
 if(n(c.sleep)!==null){if(n(c.sleep)<=3){score+=2;reasons.push('Schlechter Schlaf');}else if(n(c.sleep)<=5){score++;reasons.push('Schlaf eingeschränkt');}}
 if(n(c.soreness)!==null){if(n(c.soreness)>=8){score+=2;reasons.push('Sehr starker Muskelkater');}else if(n(c.soreness)>=6){score++;reasons.push('Muskelkater vorhanden');}}
 const heavyGrip=h2.filter(x=>x.hasGrip&&x.gripRpe>=8);
 if(isGrip&&heavyGrip.length){score+=2;reasons.push('Schwere Finger-/Zugbelastung innerhalb der letzten 48 Stunden');}
 const hard=h3.filter(x=>x.hardRpe>=8);if(hard.length>=2){score++;reasons.push('Mehrere harte Belastungen in 72 Stunden');}
 const grip7=h7.filter(x=>x.hasGrip&&x.gripRpe>=7);
 if(isGrip&&grip7.length>=3){score++;reasons.push('Bereits mindestens drei fordernde Kletter-/Krafteinheiten in sieben Tagen');}
 const shoulder=n(c.shoulder),finger=n(c.fingerPain);
 if(score>=4)level='recovery';else if(score>=2)level='reduced';
 if(isGrip&&((shoulder!==null&&shoulder>=5)||(finger!==null&&finger>=5))){level='recovery';reasons.unshift('Deutliche Finger-/Schulterschmerzen: keine belastende Einheit empfehlen');}
 else if(isGrip&&((shoulder!==null&&shoulder>=3)||(finger!==null&&finger>=3))){level='protect';reasons.unshift('Finger-/Schulterschmerz: keine schweren Züge, kein Hangboard und keine dynamischen Spitzenlasten');}
 else if(type==='prehab'&&shoulder!==null&&shoulder>=5){level='recovery';reasons.unshift('Deutliche Schulterschmerzen: nur individuell schmerzfreie Bewegung');}
 if(isGrip&&(shoulder===null||finger===null))reasons.push('Finger- oder Schulterstatus fehlt: Belastung im Aufwärmen sorgfältig prüfen');
 if(!Object.keys(c).length)reasons.push('Kein Tagescheck – Einstufung allein aus dem Trainingstagebuch');
 const confidence=h.length>=10&&Object.keys(c).length>=4?'mittel':h.length>=4&&Object.keys(c).length>=2?'eingeschränkt':'gering';
 return {level,score,reasons,confidence,h,hasCheckin:Object.keys(c).length>0,shoulder,finger,heavyGrip:heavyGrip.length,hard7:h7.filter(x=>x.hardRpe>=8).length,completed7:h7.length};
}
function boardTrend(state,date){
 const entries=history(state,date,42).filter(x=>(x.type==='boulder'||x.log.board)&&['yes','no'].includes(x.log.send));
 const recent=entries.slice(0,4),sends=recent.filter(x=>x.log.send==='yes').length;
 const hardFailed=recent.filter(x=>x.log.send==='no'&&n(x.log.attempts,0)>=5).length;
 const message=recent.length<2?'Noch wenige dokumentierte Board-Durchstiege – zunächst saubere Vergleichswerte sammeln.':
   sends>=2?'Mehrere dokumentierte Durchstiege: bei guter Erholung gezielt ein etwas schwereres Projekt wählen.':
   hardFailed>=2?'Mehrere Projekte trotz vieler Versuche offen: Mikrozüge, Trittposition und Ruhezeiten priorisieren, statt alle Versuche zu steigern.':
   'Konstante Projektarbeit: zunächst Versuchszahl und Qualität nachvollziehbar dokumentieren.';
 return {count:recent.length,sends,hardFailed,message};
}
const LIMITERS={finger:'Kleine Griffe / Fingerbelastung',pull:'Zugkraft',tension:'Körperspannung / Fußdruck',feet:'Trittpräzision',power:'Explosivität',coordination:'Koordination',tactics:'Taktik / Pausengestaltung'};
function diagnosis(state,date){
 const all=history(state,date,84).filter(x=>x.log.limiter && LIMITERS[x.log.limiter] && ['boulder','kraft'].includes(x.type));
 // A single session is not a diagnosis; look for reports on separate days.
 const unique=all.filter((x,i)=>all.findIndex(y=>y.date===x.date&&y.log.limiter===x.log.limiter)===i);
 const count={};for(const x of unique)count[x.log.limiter]=(count[x.log.limiter]||0)+1;
 const ranked=Object.entries(count).sort((a,b)=>b[1]-a[1]);const [key,nCount]=ranked[0]||[];
 const share=nCount/Math.max(1,unique.length);
 if(!key || unique.length<5||nCount<3||share<0.6) return {key:null,confidence:'unzureichend',observations:unique.length,signal:null,reason:unique.length<5?`Erst ${unique.length} von mindestens fünf unabhängigen Protokollen mit limiterendem Faktor vorhanden.`:'Die beobachteten Limitierungen sind uneinheitlich. Kein Schwerpunktwechsel begründbar.'};
 return {key,confidence:unique.length>=8&&nCount>=5?'mittel':'niedrig',observations:unique.length,signal:`${nCount} von ${unique.length} Meldungen: ${LIMITERS[key]}`,reason:'Wiederholt selbst berichteter limitierender Faktor; Hinweis, keine objektive Diagnose.'};
}
function decision(state,date,type){
 const r=readiness(state,date,type),d=diagnosis(state,date),c=check(state,date),mode=state.settings?.coachMode==='manual'?'manual':'auto';
 const validManual=['finger','pull','tension','feet','power','coordination','tactics'];
 const legacy={footwork:'feet'};const manualKey=legacy[state.settings?.weakness]||state.settings?.weakness;
 const focus=mode==='manual'&&validManual.includes(manualKey)?manualKey:mode==='auto'?d.key:null;
 const why=[];const h=history(state,date,120),recent=h.filter(x=>span(date,x.date)<=10),prior=h.filter(x=>span(date,x.date)>10);
 const skipped=Object.entries(state.logs||{}).filter(([day])=>day<date&&span(date,day)<=10).flatMap(([,byId])=>Object.values(byId||{})).filter(x=>x?.status==='skipped').length;
 let strategy='beibehalten';
 if(r.level==='protect'||r.level==='recovery') {strategy='schutz';why.push('Schmerz und akute Erholung haben Vorrang.');}
 else if(c.sessionWish==='off'){strategy='pause';why.push('Heute ausdrücklich kein Training gewünscht.');}
 else if(c.sessionWish==='light'||r.level==='reduced'){strategy='reduzieren';why.push('Belastung an Tagesform oder deinen Wunsch anpassen.');}
 else if(c.sessionWish==='return'||(h.length>=5&&recent.length===0&&prior.length>0&&skipped>=2)){strategy='wiedereinstieg';why.push('Wiedereinstieg nach gemeldeter Pause oder mehrfach abgesagten Einheiten: Einstiegsbelastung senken.');}
 else why.push('Kein hinreichender Grund für eine Planänderung. Bewährte Hauptreize bleiben bestehen.');
 if(!recent.length&&h.length>=3&&skipped<2&&c.sessionWish!=='return')why.push('Zuletzt keine absolvierten Einheiten protokolliert: fehlende Logs sind kein Beweis für eine Trainingspause.');
 if(mode==='manual'&&focus)why.push('Technikschwerpunkt ausdrücklich manuell vorgegeben.');
 else if(mode==='auto'&&focus)why.push(d.signal+' – ergänzende Technikarbeit, keine automatische Änderung des Kraftziels.');
 else why.push('Kein eindeutiges Technikdefizit: kein künstlicher Schwerpunkt.');
 const minutes=n(c.minutesAvailable);
 if(minutes!==null&&minutes>=20&&minutes<=180)why.push(`Heute maximal ${minutes} Minuten verfügbar.`);
 return {strategy,why,focus,mode,diagnosis:d,readiness:r,minutes:minutes>=20&&minutes<=180?minutes:null};
}
function fitTime(base,minutes,notes){
 if(minutes===null||minutes>=base.duration||base.duration<=0)return base;
 if(minutes<40&&['kraft','boulder'].includes(base.type)){
  base.duration=minutes;
  base.title='Kurze Technik / Erholung statt Maximalkraft';
  base.steps=[['Bewegung vorbereiten','8–10 Minuten leichte, schmerzfreie Mobilität und allmähliches Aufwärmen.'],['Leichte Bewegungsqualität',`${Math.max(5,minutes-15)} Minuten lockere technische Züge ohne Limitbelastung; bei Beschwerden lieber pausieren.`],['Rückmeldung','Keine fehlende Maximalkrafteinheit nachholen oder zusammenpressen.']];
  notes.push('Zeitfenster zu kurz für sichere hochintensive Einheit mit vollständigem Warm-up und Pausen.');
  return base;
 }
 if(base.type==='run'){
   base.duration=minutes;
   if(minutes<40)base.steps=[['Einlaufen','8–10 min locker'],['Lockerer Lauf',`${Math.max(10,minutes-15)} min entspannt bei RPE 3–4, kein Intervalltraining.`],['Auslaufen','5 min locker']];
   else if(base.title.includes('Interval'))base.steps=[['Einlaufen','12 min locker + zwei kurze Steigerungen'],['Kurze Qualitätsintervalle','2 × 5 min bei RPE 7–8; 3 min Gehpause/Trabpause; bei müden Beinen stattdessen locker laufen.'],['Auslaufen','10–15 min locker']];
   else base.steps=[['Lockerer Dauerlauf',`${Math.max(20,minutes-5)} min Sprechtempo, RPE 3–4.`],['Gehen und Log','5 min locker auslaufen, Verlauf dokumentieren.']];
   notes.push('Laufprogramm an verfügbares Zeitfenster angepasst, Intensität nicht kompensatorisch erhöht.');
   return base;
 }
 if(base.type==='boulder'&&minutes<70){
   base.duration=minutes;
   base.steps=[['Aufwärmen','20–25 min schrittweise, inklusive Finger und Schulter'],['Boulder-Hauptreiz',`${Math.max(12,minutes-30)} min qualitativ gute, kontrollierte Versuche; lange Pausen, keine Zusatzübungen.`],['Log','5 min Ergebnis und limitierende Faktoren dokumentieren.']];
   notes.push('Zusatzübungen fallen weg; Warm-up und Pausen bleiben erhalten.');
   return base;
 }
 const warm=base.steps.find(s=>/Aufwärmen|Einlaufen|Beweglichkeit|Locker anlaufen/i.test(s[0]))||base.steps[0];
 const main=base.steps.find(s=>/Finger-Maximalkraft|Fingerkraft · Aufbau|Fingerprimer|Fingerreize|Schwellenorientiert|VO₂max|Erhaltungsreiz|Geringe Belastung|Qualität statt|Moderates Volumen|Schwere Boulderqualität|Limit-Bouldern|Board-Limit|Locker|Rotatorenmanschette|Standardisiert|Boulder-Benchmark|Technik/i.test(s[0]))||base.steps[1];
 const finish=base.steps.find(s=>/Log|Trainingstagebuch|Auslaufen|Abschluss|Stoppregel|Neubewertung/i.test(s[0]));
 const chosen=[warm,main,finish].filter((s,i,a)=>s&&a.indexOf(s)===i);
 base.steps=chosen;
 base.duration=minutes;
 notes.push('Zeitbudget: Hauptreiz und Warm-up beibehalten; optionale Zusatzübungen weglassen. Keine Pausen verkürzen, um Volumen aufzuholen.');
 return base;
}
function protocol(log){return log.fingerMode&&valid(log.fingerEdge)&&valid(log.fingerHold)&&log.fingerGrip?`${log.fingerMode}/${log.fingerEdge}/${log.fingerHold}/${log.fingerGrip}`:null;}
function progression(state,date,metric,opts={}){
 const recent=history(state,date,70).filter(x=>valid(x.log[metric]));
 if(!recent.length)return {value:null,change:0,confidence:'gering',message:'Noch kein Messwert – Arbeitslast erst protokollieren.',reason:'keine Ausgangsdaten',n:0};
 let matched=recent;
 if(metric==='finger')matched=recent.filter(x=>protocol(x.log)&&protocol(x.log)===opts.protocol);
 else matched=recent.filter(x=>Number(x.log.pullupReps)===Number(opts.reps));
 if(matched.length===0)return {value:null,change:0,confidence:'gering',message:'Für diese Übungsvariante existiert noch kein vergleichbares Protokoll. Neue Ausgangslast ermitteln.',reason:'Protokollvergleich fehlt',n:0};
 const last=matched[0],base=n(last.log[metric]);
 const good=(x)=>x.log.quality==='ziel'&&n(x.log.rpe,10)<=8.5&&n(x.log.shoulder,10)<=2&&n(x.log.fingerPain,10)<=2;
 const qualified=matched.length>=2&&matched[0].date!==matched[1].date&&span(matched[0].date,matched[1].date)>=3&&good(matched[0])&&good(matched[1])&&n(matched[0].log[metric])>=n(matched[1].log[metric]);
 const increment=metric==='finger'?0.5:1;
 const change=qualified?increment:0;
 const plateau=matched.length>=3&&matched.slice(0,3).every(x=>x.log.quality!=='ziel'||n(x.log.rpe,10)>=9);
 let message=`Letzter vergleichbarer Wert ${base.toLocaleString('de-DE')} kg. `;
 if(qualified)message+=`Nächster kleiner Versuch ${String(base+change).replace('.',',')} kg (+${String(change).replace('.',',')} kg), nur bei gleicher Technik und RPE ≤ 8.`;
 else message+='Last zunächst halten oder nach Tagesform reduzieren; keine automatische Steigerung.';
 if(plateau)message+=' Wiederholt hoher RPE / Ziel verfehlt: Übungsvariante oder Belastungsdosis überprüfen.';
 return {value:base,change,confidence:matched.length>=3?'mittel':'eingeschränkt',message,plateau,reason:qualified?'zwei vergleichbare erfolgreiche Einheiten':'keine ausreichende Bestätigung',n:matched.length};
}
const stepsBySlot={
 max_limit: {base:'Kraftbasis A',strength:'Maximalkraft A',transfer:'Kraft erhalten & Transfer',test:'Kraftdiagnostik A'},
 max_transfer:{base:'Kraftbasis B',strength:'Maximalkraft B',transfer:'Explosiver Board-Transfer',test:'Technik & Vergleich'},
 board_volume:{base:'Technik & Volumen',strength:'Schwere Boulderqualität',transfer:'Limit-Bouldern & Power',test:'Boulder-Benchmark'},
 intervals:{base:'Schwellenintervalle',strength:'VO₂max-Intervalle',transfer:'Lauferhaltung',test:'Lockere Intervalle'},
 easy_run:{base:'Grundlagenausdauer',strength:'Lockerer Lauf',transfer:'Regenerativer Lauf',test:'Kurzer ruhiger Lauf'},
 prehab:{base:'Schulter & Antagonisten',strength:'Schulterstabilität',transfer:'Stabilität & Mobilität',test:'Aktive Regeneration'}
};
function workout(base,state,date){
 const b=structuredClone(base),p=phase(date,state.settings||{}),plan=decision(state,date,b.type),a=plan.readiness;
 const k=b.templateId;
 if(!k||b.origin==='custom'||b.type==='rest'||!state.settings?.adaptiveEnabled)return b;
 const slot=stepsBySlot[k];if(!slot)return b;
 const info=[`Block ${p.cycle} · Woche ${p.week}/12 · ${p.name}`,p.goal];const notes=[...a.reasons,...plan.why];
 const dayPhase=p.deload?'deload':p.key;let level=a.level;
 if(p.deload){notes.unshift('Geplante Entlastungswoche: Umfang bewusst deutlich reduziert');if(level==='normal')level='reduced';}
 if(plan.strategy==='reduzieren'||plan.strategy==='wiedereinstieg')if(level==='normal')level='reduced';
 if(plan.strategy==='pause'&&level!=='protect')level='recovery';
 const boardChoice=state.settings.boardChoice||'both';
 const weak=plan.focus;
 const weaknessDrill={finger:'3 × 3 kontrollierte Einzelzüge an moderaten kleinen Griffen; keine Schmerzprovokation.',power:'4 × 1–2 explosive Einzelzüge an guten Griffen, lange Pausen und kein Technikverlust.',tension:'3 × 4 präzise, kontrollierte Züge an steiler Wand mit aktivem Fußdruck.',feet:'4 × 2–3 kontrollierte Sequenzen mit bewusst gesetzten Füßen und möglichst leisen Tritten.',pull:'3 × 3 saubere Zugfolgen an guten Griffen, volle Erholung; keine zusätzliche Maximallast.',tactics:'3 Projektversuche mit expliziten Pausen und Beta-Notizen.',coordination:'3 × 3 koordinative Zugfolgen mit sicheren Griffen und hochwertiger Ausführung.'}[weak]||'3 × 4 technisch saubere, abwechslungsreiche Boulderzüge; keinen Defizit-Schwerpunkt erzwingen.';
 const board=boardChoice==='moon'?'Moonboard':boardChoice==='kilter'?'Kilterboard':boardChoice==='none'?'Wand':'Moonboard oder Kilterboard';
 const edge=Number(state.settings.edgeDepth)||15;
 const method=state.settings.fingerMethod==='hang'?'Hangboard-Hangs':'No-Hang-Pickups';
 const key=`${state.settings.fingerMethod||'nohang'}/${edge}/5/half`;
 const finger=progression(state,date,'finger',{protocol:key}),pull=progression(state,date,'pullup',{reps:p.key==='base'?4:3});
 const stagnation=finger.plateau||pull.plateau;
 const boardStats=boardTrend(state,date);
 const variation=Math.floor((p.week-1)/3)%2;
 const fingerIntro=`${method}, ${edge}-mm-Leiste, Half-Crimp, kontrolliert; `;
 const teach='Abbrechen bei Schmerzen, Formverlust oder ruckartiger Belastung.';
 let steps=[],duration=b.duration,title=slot[dayPhase==='deload'?'base':dayPhase]||b.title;
 const add=(a,b)=>steps.push([a,b]);
 if(level==='recovery'){
  title='Regeneration statt '+title;duration=20;
  add('Pause oder sehr leichte Bewegung','Heute keine harten Intervalle, maximalen Fingerreize oder Limit-Boulder. Ruhe ist eine gültige Trainingseinheit.');
  add('Optional 15–20 Minuten','Entspannter Spaziergang oder schmerzfreie Mobilität. Kein Training gegen Beschwerden.');
  add('Neubewertung','Vor dem nächsten Training Tagescheck wiederholen; anhaltende oder stärkere Beschwerden fachlich abklären.');
 }else if(level==='protect'&&['boulder','kraft'].includes(b.type)){
  title='Schutzprogramm · Finger/Schulter';duration=30;
  add('Kein Belastungstest','Keine Fingerboard-Maxima, schweren Pull-ups, Campusboard-Dynamik oder Limitzüge.');
  add('Alternative','20–30 min sehr leichte, schmerzfreie Bein-/Ausdauerarbeit oder Ruhe; keine gereizte Struktur belasten.');
  add('Beobachtung','Bei persistierenden, zunehmenden oder belastungsabhängigen Schmerzen ärztlich/physiotherapeutisch abklären.');
 }else if(['max_limit','max_transfer'].includes(k)){
  add('Aufwärmen','20–25 min stufenweise: leichte Bewegungen/Boulder, schmerzfreie Schulterkontrolle, 3–4 zunehmend kräftige Finger-Aufwärmsätze.');
  if(dayPhase==='deload'||level==='reduced'){
   duration=55;
   add('Fingerreize · reduziert',fingerIntro+'2–3 × 5 s bei RPE 6–7; 3 min Pause. Keine Bestwerte. '+teach);
   add('Zugkraft erhalten','2 × 3 kontrollierte Pull-ups bei RPE 6–7; keine maximale Zusatzlast.');
   add('Technik & Bewegung','15–20 min leichte Boulder, keine Limitversuche. Optional bei Schmerzen weglassen.');
  }else if(p.key==='base'){
   duration=k==='max_limit'?95:90;
   add('Fingerkraft · Aufbau',fingerIntro+`4 × 5 s, RPE 7–8, 3–4 min Pause. ${finger.message}`);
   add('Weighted Pull-ups',k==='max_limit'?`4 × 4, RPE 7–8; 3 min Pause. ${pull.value===null?'Mit kontrollierter Startlast beginnen.':'Letzter vergleichbarer 4er-Wert: '+pull.value+' kg.'} `:'3 × 4, RPE 7; 3 min Pause.');
   add('Technischer Bouldertransfer',k==='max_limit'?'15–20 min kontrollierte Boulder knapp unter Limit.':'25 min technisch anspruchsvolle, aber nicht maximale Züge.');
  }else if(p.key==='strength'){
   duration=k==='max_limit'?100:90;
   add('Finger-Maximalkraft',fingerIntro+`4–5 × 5 s, RPE 8–9, vollständige 3–4 min Pause. ${finger.message} ${teach}`);
   add('Weighted Pull-ups',k==='max_limit'?`4 × 3, RPE 8–9, 3–4 min Pause. ${pull.message}`:'3 × 3 kontrolliert, RPE 8, lange Pausen.');
   add('Boulderqualität',k==='max_limit'?'10–15 min schwere Einzelzüge nur bei guter Restqualität; andernfalls auslassen.':`20–25 min ${board}, wenige harte Züge mit 3–5 min Pause.`);
  }else if(p.key==='transfer'){
   duration=90;
   add('Fingerprimer',fingerIntro+'3 × 5 s bei RPE 7–8; nur Erhaltung, keine Lastrekorde.');
   add('Board-Limit',k==='max_limit'?`25–30 min ${board}, 2–3 Probleme, je 3–5 Versuche mit voller Erholung.`:`40 min ${board}: gezielte Zugfolgen, 3–5 min zwischen Maximalversuchen.`);
   add('Kraft erhalten',k==='max_limit'?'2–3 × 3 Weighted Pull-ups bei RPE 7–8.':'2–3 × 3 saubere Pull-ups ohne Ermüdungsjagd.');
  }else{
   duration=65;
   add('Standardisierter Vergleich','Nach gutem Aufwärmen 2–3 kontrollierte Arbeitsversuche im exakt gleichen Finger-Protokoll. Keine Grenzversuche in Schmerz hinein.');
   add('Kraftvergleich',fingerIntro+'Wiederhole das letzte dokumentierte, vergleichbare Testprotokoll. '+finger.message);
   add('Abschluss','Vollständigen Log speichern; nächster 12-Wochen-Zyklus beginnt danach.');
  }
  if(stagnation&&level==='normal')notes.push('Wiederholte schwierige Sätze erkannt: nach diesem Teilblock gegebenenfalls Übung oder Reiz anpassen, nicht blind Last erhöhen');
  add('Trainingstagebuch','Lasten NUR mit Griffart, Leistentiefe, Hold-Zeit und Methode vergleichen; Pull-up-Last mit Wiederholungen, RPE und Qualität festhalten.');
 }else if(k==='board_volume'){
  add('Aufwärmen','20–25 min über mehrere Griffarten und Schwierigkeiten; kein Sprung direkt auf Maximalzüge.');
  if(dayPhase==='deload'||level==='reduced'){duration=55;add('Qualität statt Ermüdung',`20–25 min ${board}, Boulder klar unter persönlichem Limit, lange Pausen.`);}
  else if(p.key==='base'){duration=105;add('Technik',variation?'40 min Trittpräzision, stabile Körperspannung, Richtungswechsel.':'40 min Fußwechsel, effiziente Ruhepositionen und flüssige Zugfolgen.');add('Moderates Volumen',`25–30 min ${board} bei RPE 6–7; Qualität vor Menge.`);}
  else if(p.key==='strength'){duration=95;add('Schwere Boulderqualität',`40–50 min ${board}: 2–4 schwierige Boulder, 3–5 min zwischen harten Versuchen; bei abfallender Qualität stoppen.`);add('Individueller Schwächenblock',weaknessDrill);}
  else if(p.key==='transfer'){duration=100;add('Limit-Bouldern',`45 min ${board}: 2–3 Projekte nahe individuellem Limit, mehrere volle Pausen.`);add('Power-Transfer',variation?'15 min kontrollierte dynamische Koordination an guten Griffen (nur schmerzfrei).':'15 min harte Link-Moves und Körperpositionen, kein Junk-Volumen.');add('Board-Trend',boardStats.message);}
  else{duration=70;add('Boulder-Benchmark','Nach identischem Warm-up 2–3 bekannte Boulder unter ähnlichen Bedingungen wiederholen. Grad, Versuche und Erfolg erfassen.');}
  add('Gezielte Technikarbeit',weaknessDrill);
  add('Leistungsbeleg','Board, Grad, Problem, Versuche, Send und subjektive Bewegungsausführung dokumentieren.');
 }else if(k==='intervals'){
  add('Einlaufen','12–15 min locker, Lauf-ABC und 2–3 Steigerungen.');
  if(dayPhase==='deload'||level==='reduced'){duration=40;add('Geringe Belastung','25–35 min locker laufen, RPE 3–4 statt harter Intervalle.');}
  else if(p.key==='base'){duration=55;add('Schwellenorientiert','3 × 8 min bei RPE 7–8; 3 min lockeres Traben. Nicht maximale Erschöpfung anstreben.');}
  else if(p.key==='strength'){duration=50;add('VO₂max-orientiert','5 × 3 min kontrolliert hart (RPE 8–9); 2–3 min lockeres Traben. Nur bei ausreichender Regeneration.');}
  else if(p.key==='transfer'){duration=45;add('Erhaltungsreiz','3 × 5 min bei RPE 7–8 mit 3 min Trabpause; Kraft-/Boulderpriorität bleibt bestehen.');}
  else{duration=35;add('Schonender Reiz','20–30 min locker + 3 × 20 s lockere Steigerungen.');}
  add('Auslaufen','10 min locker; Pace/Herzfrequenz sowie RPE dokumentieren.');
 }else if(k==='easy_run'){
  const runMinutes=dayPhase==='deload'||level==='reduced'?35:p.key==='base'?60:p.key==='strength'?50:45;
  duration=runMinutes+5;add('Lockerer Dauerlauf',`${runMinutes} min im Sprechtempo, RPE 3–4. Bei schweren Beinen früher abbrechen.`);add('Log','Dauer, Distanz und subjektive Ermüdung notieren.');
 }else if(k==='prehab'){
  duration=level==='reduced'||p.deload?35:50;add('Beweglichkeit','8 min sanfte Schulterblattkontrolle und Brustwirbelsäulenbewegung.');
  add('Rotatorenmanschette',`2–3 × 10–15 leichte kontrollierte Außenrotationen; keine schmerzhaften Positionen.`);
  add('Antagonisten',variation?'2–3 × 8–12 Liegestütze oder Floor Press, schmerzfrei.':'2–3 × 10–12 Face Pulls plus 2 × 8 kontrollierte Drückbewegungen.');
  add('Scapula & Rumpf','2–3 × 8–12 kontrollierte Serratus-/Scapula-Bewegungen; 2–3 × 20–35 s Rumpfstabilisation.');
  add('Stoppregel','Bei zunehmendem Schmerz Übung auslassen; Beschwerden nicht „wegtrainieren“.');
 }else return b;
 // Periodization meta info remains available in calendar, detail, and export.
 const reduction=level==='reduced'||p.deload;
 b.title=title;b.duration=duration;b.steps=steps;
 fitTime(b,plan.minutes,notes);
 b.description=`${p.short} · Woche ${p.week}/12${p.deload?' · Entlastung':''}. ${p.goal}.`;
 b.adaptive={level,coachStrategy:plan.strategy,diagnosis:plan.diagnosis,coachMode:plan.mode,coachFocus:plan.focus,reasons:notes,progression:finger.change>0||pull.change>0,confidence:a.confidence,phase:p,hasCheckin:a.hasCheckin,info,stimulus:dayPhase,sourceIds:['climb_review','autoreg','load','dynamic_rct']};
 return b;
}
root.PeakCoach={VERSION:'6.0',phase,readiness,history,progression,boardTrend,diagnosis,decision,workout,SOURCES};
if(typeof module!=='undefined'&&module.exports)module.exports=root.PeakCoach;
})(typeof window!=='undefined'?window:globalThis);
