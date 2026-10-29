/* PeakPlan v6: lokal verfügbare, kuratierte Übungsbibliothek. Keine Live-Abfrage und keine behauptete individuelle Wirksamkeitsprognose. */
(function(root){
'use strict';
const CATEGORIES={finger:'Fingerkraft',pull:'Zugkraft',boulder:'Bouldern & Board',power:'Explosivität',technique:'Technik & Koordination',core:'Rumpf & Körperspannung',prehab:'Schulter & Ausgleich',legs:'Beine & Ganzkörper',run:'Laufen & Ausdauer',mobility:'Mobilität & Erholung'};
// Kategorie | Übungsname | Fokus | Gerät | Beschreibung | Standard-Messgröße | Beanspruchung
const RAW=`finger|No-Hang Pickup, 1 Arm|Maximalkraft|Liftblock, Gewicht|Einarmiges isometrisches Heben mit reproduzierbarer Griffposition und Haltedauer|kg|high
finger|No-Hang Pickup, 2 Arme|Maximalkraft|Liftblock, Gewicht|Beidarmige Variante mit definierter Gesamtkraft und identischem Protokoll|kg|high
finger|Max Hang Half-Crimp|Maximalkraft|Hangboard|Schwerer Hang an definierter Leiste, 3–5 s, lange Pausen|kg|high
finger|Max Hang Open Hand|Maximalkraft|Hangboard|Schwerer Hang bei offener Griffposition und definierter Leistentiefe|kg|high
finger|Assisted One-Arm Hang|Maximalkraft|Hangboard, Unterstützung|Einarmiges Halten mit reproduzierbarer Entlastung|kg|high
finger|Repeaters 7:3|Kraftausdauer|Hangboard|Wiederholte Halte- und Pausenintervalle bei kontrollierter Intensität|s|medium
finger|Low-Intensity Long Hangs|Kapazität|Hangboard|Längerer submaximaler Hang, Füße ggf. auf Boden|s|low
finger|Finger Density Hangs|Kapazität|Hangboard|Moderate isometrische Belastung über längere Haltezeit|s|medium
finger|Edge Recruitment Pulls|Rekrutierung|Kraftsensor, Griff|Kurze ansteigende isometrische Zugversuche ohne abruptes Reißen|s|high
finger|Finger RFD Pulls|Schnellkraft|Kraftsensor, Griff|Explosiver, kontrollierter Kraftanstieg bei reproduzierbarer Ausgangsposition|kg|high
finger|Half-Crimp Isometrics|Maximalkraft|Hangboard|Isometrisches Halten im Half-Crimp|s|medium
finger|Open-Hand Isometrics|Maximalkraft|Hangboard|Isometrisches Halten mit offener Hand|s|medium
finger|Pinch Block Lift|Daumenkraft|Pinchblock, Gewicht|Isometrisches Abheben am Pinchblock|kg|medium
finger|Sloper Holds|Offene Hand|Sloperboard|Isometrischer Slopergriff mit kontrollierter Neigung|s|medium
finger|3-Finger Drag Holds|Griffspezifisch|Hangboard|Kontrolliertes Halten in Drei-Finger-Position; hohe individuelle Vorsicht|s|high
finger|Extensor Band Opens|Ausgleich|Fingerband|Aktive Streckung der Finger gegen Bandwiderstand|reps|low
pull|Weighted Pull-ups|Maximalkraft|Klimmzugstange, Gürtel|Klimmzüge mit Zusatzgewicht und standardisierter Bewegungstiefe|kg|high
pull|Bodyweight Pull-ups|Zugkraft|Klimmzugstange|Kontrollierte Wiederholungen mit Körpergewicht|reps|medium
pull|Assisted Pull-ups|Zugkraft|Band, Maschine|Unterstützte saubere Klimmzüge|reps|medium
pull|One-Arm Assisted Pull-up|Zugkraft|Stange, Band|Einarmige unterstützte Zugbewegung, langsame Kontrolle|reps|high
pull|Lock-Off 90°|Isometrische Zugkraft|Klimmzugstange|Halten bei ungefähr 90° Ellenbogenwinkel|s|high
pull|Lock-Off 120°|Isometrische Zugkraft|Klimmzugstange|Halten im mittleren Zugwinkel|s|high
pull|Scapular Pull-ups|Schulterkontrolle|Klimmzugstange|Schulterblattbewegung ohne volles Ellenbogenbeugen|reps|low
pull|Ring Rows|Horizontale Zugkraft|Ringe|Horizontales Rudern mit kontrollierter Rumpfspannung|reps|medium
pull|Barbell Rows|Zugkraft|Langhantel|Rudern mit stabiler Rumpfposition|kg|medium
pull|Chest-Supported Rows|Zugkraft|Hantelbank|Rudern mit Brustauflage, reduzierte Rumpfbelastung|kg|medium
pull|Lat Pulldown|Zugkraft|Kabelzug|Vertikales Ziehen mit kontrolliertem Bewegungsumfang|kg|medium
pull|Eccentric Pull-ups|Eccentrik|Klimmzugstange|Langsam kontrollierte exzentrische Phase|reps|high
boulder|Moonboard Limit-Bouldern|Maximale Boulderleistung|Moonboard|Wenige schwere Boulder, vollständige Erholung, Versuche dokumentieren|attempts|high
boulder|Kilterboard Limit-Bouldern|Maximale Boulderleistung|Kilterboard|Schwere Boulder bei dokumentiertem Neigungswinkel|attempts|high
boulder|Spraywall Limit-Sequenzen|Maximale Boulderleistung|Spraywall|Kurze, individuell schwere Zugfolgen mit langen Pausen|attempts|high
boulder|Outdoor-Projektieren|Maximale Boulderleistung|Fels|Projektspezifisches Arbeiten an schweren Zügen|attempts|high
boulder|Moonboard Benchmark-Session|Leistungstest|Moonboard|Wiederholte standardisierte Benchmark-Boulder, Version und Grad festhalten|attempts|high
boulder|Kilterboard Benchmark-Session|Leistungstest|Kilterboard|Vergleichbare Benchmark-Probleme bei gleichem Winkel|attempts|high
boulder|4x4 Bouldern|Kraftausdauer|Boulderwand|Vier Boulder mehrfach in Blöcken, Belastung bewusst dosieren|rounds|high
boulder|Board-Volumen|Technik / Kapazität|Board|Mehrere Boulder deutlich unter Limit in sauberer Qualität|problems|medium
boulder|Project Links|Bewegungsverknüpfung|Boulderwand|Zwei oder drei harte Teilsequenzen gezielt verbinden|attempts|high
boulder|Intervall-Bouldern|Kraftausdauer|Boulderwand|Kletterabschnitte nach Zeit mit definierten Pausen|rounds|medium
boulder|Technik-Volumen|Bewegungsqualität|Boulderwand|Viele kontrollierte leichte bis mittlere Boulder|problems|low
boulder|Steilwand-Volumen|Kraftübertragung|Steilwand|Sauberes Volumen in überhängendem Gelände|problems|medium
power|Campusboard Ladders|Kontaktkraft|Campusboard|Dynamische Sprossenfolgen nur bei guter Belastbarkeit|reps|high
power|Campusboard Max Reach|Explosivität|Campusboard|Einzelne weite Züge mit vollständiger Erholung|attempts|high
power|Campusboard Double Dynos|Explosivität|Campusboard|Beidarmige dynamische Versuche, hoher Gewebestress|attempts|high
power|Plyometric Pull-ups|Zugschnellkraft|Klimmzugstange|Explosive Klimmzüge mit sicherer Landung|reps|high
power|Explosive Board Singles|Schnellkraft|Boulderboard|Kurze dynamische Einzelzüge, voll erholt|attempts|high
power|Medicine Ball Slams|Ganzkörper-Power|Medizinball|Explosives Werfen/Schlagen mit kontrollierter Technik|reps|medium
power|Deadpoint Drills|Timing|Boulderwand|Kontrollierte dynamische Zielbewegungen|attempts|medium
power|Low-Volume Dynos|Koordination / Power|Boulderwand|Wenige qualitative dynamische Boulder|attempts|high
technique|Silent Feet|Trittpräzision|Boulderwand|Tritte leise und bewusst setzen|problems|low
technique|No Readjustment|Bewegungspräzision|Boulderwand|Hände und Füße nach dem Setzen nicht nachkorrigieren|problems|low
technique|Hover Hands|Körperspannung|Boulderwand|Hand kurz vor Griffkontakt kontrolliert halten|problems|low
technique|Hip Rotation|Bewegungseffizienz|Boulderwand|Hüftrotationen an moderaten Bouldern üben|problems|low
technique|Flagging Drills|Balance|Boulderwand|Gegengewicht über freies Bein bewusst steuern|problems|low
technique|Drop-Knee Practice|Körperspannung|Boulderwand|Drop-Knee-Position unter kontrollierter Belastung|problems|medium
technique|Toe-Hook Drills|Fußtechnik|Boulderwand|Gezielte Zehenhaken in verschiedenen Winkeln|problems|medium
technique|Heel-Hook Drills|Fußtechnik|Boulderwand|Gezielte Fersenhaken und Hüftspannung|problems|medium
technique|Beta Reading|Taktik|Boulderwand|Zugfolge vor dem Versuch planen und vergleichen|problems|low
technique|Foot Swap Drills|Koordination|Boulderwand|Präzise Fußwechsel auf moderaten Tritten|problems|low
technique|Tempo Bouldering|Kontrolle|Boulderwand|Leichte Boulder mit bewusst langsamem Bewegungstempo|problems|low
technique|Video Technique Review|Analyse|Kamera|Einzelne Bewegungen filmen und mit Plan vergleichen|minutes|low
core|Front Lever Progressions|Zug- und Rumpfspannung|Stange, Ringe|Passende Front-Lever-Progression halten|s|high
core|Hanging Leg Raises|Rumpfkraft|Klimmzugstange|Kontrolliertes Anheben der Beine|reps|medium
core|Toes to Bar|Körperspannung|Klimmzugstange|Beine zur Stange ohne Schwung|reps|medium
core|Hollow Body Hold|Rumpfspannung|Matte|Hohlkörperposition unter Kontrolle halten|s|medium
core|Dead Bug|Rumpfstabilität|Matte|Alternierende Arm-/Beinbewegung mit neutralem Rumpf|reps|low
core|Pallof Press|Anti-Rotation|Kabelzug, Band|Rumpf gegen seitlichen Zug stabilisieren|reps|low
core|Side Plank|Laterale Stabilität|Matte|Seitstütz halten|s|low
core|Ab Wheel Rollout|Anti-Extension|Ab Wheel|Ausrollen mit stabiler Wirbelsäule|reps|medium
core|L-Sit|Rumpf- und Hüftkraft|Parallettes|L-Sit-Position halten|s|medium
core|Bird Dog|Kontrolle|Matte|Diagonale Extremitätenstreckung|reps|low
prehab|Band External Rotation|Rotatorenmanschette|Theraband|Schmerzfreie Außenrotation mit kontrollierter Last|reps|low
prehab|Cable External Rotation|Rotatorenmanschette|Kabelzug|Externe Rotation in schmerzfreiem Umfang|kg|low
prehab|Face Pulls|Schulterblattkontrolle|Kabelzug, Band|Zum Gesicht ziehen, Schulterblätter kontrollieren|reps|low
prehab|Prone Y-T-W Raises|Schulterkontrolle|Matte, leichte Hanteln|Y-, T- und W-Bewegungen mit leichter Belastung|reps|low
prehab|Scapular Wall Slides|Beweglichkeit / Kontrolle|Wand|Armgleiten mit kontrollierter Schulterblattbewegung|reps|low
prehab|Push-ups|Drückkraft|Boden|Liegestütz sauber und schmerzfrei ausführen|reps|medium
prehab|Dumbbell Bench Press|Drückkraft|Kurzhanteln|Kontrolliertes Drücken mit frei gewählter Griffposition|kg|medium
prehab|Serratus Push-ups|Schulterblattkontrolle|Boden|Schulterblätter im gestützten Arm kontrolliert bewegen|reps|low
prehab|Wrist Extension Curls|Unterarm-Ausgleich|Kurzhantel|Handgelenk kontrolliert strecken|reps|low
prehab|Reverse Wrist Curls|Unterarm-Ausgleich|Kurzhantel|Kontrollierte Handgelenksstreckung|reps|low
legs|Goblet Squats|Beinkraft|Kettlebell|Kniebeuge mit Gewicht vor der Brust|kg|medium
legs|Barbell Squats|Maximalkraft Beine|Langhantel|Kniebeugen mit geeigneter Last|kg|high
legs|Romanian Deadlifts|Hintere Kette|Langhantel|Hüftstreckung mit kontrollierter exzentrischer Phase|kg|medium
legs|Bulgarian Split Squats|Einbein-Kraft|Kurzhanteln|Einbeinige Kniebeuge mit erhöhtem Hinterfuß|kg|medium
legs|Step-ups|Einbein-Kraft|Bank|Aufsteigen mit kontrollierter Hüft- und Knieposition|reps|medium
legs|Calf Raises|Fuß-/Wadenkraft|Stufe|Wadenheben über Bewegungsumfang|reps|low
legs|Single-Leg RDL|Balance / Hüfte|Kurzhantel|Einbeiniger Hip-Hinge|reps|medium
legs|Deadlift|Ganzkörperkraft|Langhantel|Klassisches Kreuzheben|kg|high
run|Easy Run|Aerobe Basis|Outdoor, Laufband|Lockerer Lauf bei Sprechtempo|minutes|low
run|Threshold Intervals|Schwelle|Outdoor, Laufband|Längere Intervalle unter kontrollierter Belastung|minutes|high
run|VO2max Intervals 3 min|VO2max|Outdoor, Laufband|Kurze harte Intervalle mit aktiver Pause|minutes|high
run|VO2max Intervals 5 min|VO2max|Outdoor, Laufband|Harte 5-min-Intervalle bei kontrollierter Intensität|minutes|high
run|Strides|Laufökonomie|Outdoor|Kurze lockere Steigerungsläufe|reps|low
run|Recovery Run|Regeneration|Outdoor|Sehr lockerer kurzer Lauf|minutes|low
run|Hill Sprints|Power|Berg|Kurze explosive Bergantritte, lange Pausen|reps|high
run|Tempo Run|Schwelle|Outdoor|Zusammenhängender Tempodauerlauf|minutes|high
run|Bike Zone 2|Aerobe Basis|Fahrrad|Ruhige Ausfahrt mit niedriger Belastung|minutes|low
mobility|Shoulder Mobility Flow|Beweglichkeit|Matte|Sanfte Schulterbewegung ohne Provokation|minutes|low
mobility|Thoracic Rotation|Brustwirbelsäule|Matte|Kontrollierte Rotationen im Vierfüßlerstand|reps|low
mobility|Forearm Mobility|Unterarm|Matte|Sanfte aktive Beweglichkeit von Handgelenk und Unterarm|minutes|low
mobility|Hip Mobility Flow|Hüfte|Matte|Kontrollierte Hüftmobilisation|minutes|low
mobility|Breathing Recovery|Erholung|Matte|Entspannter Atemfokus ohne Belastungsziel|minutes|low
mobility|Walking|Regeneration|Outdoor|Lockerer Spaziergang zur allgemeinen Aktivität|minutes|low`;
const lines=RAW.trim().split('\n');
const exerciseList=lines.map((line,i)=>{const [category,name,focus,equipment,description,metric,stress]=line.split('|');return {id:'lib-'+String(i+1).padStart(3,'0'),name,category,focus,equipment,description,metric,stress,origin:'curated'};});
const byId=Object.fromEntries(exerciseList.map(x=>[x.id,x]));
function find(id, custom=[]){return byId[id]||custom.find(x=>x.id===id)||null;}
function all(custom=[]){return [...exerciseList,...custom.filter(x=>x&&x.id&&x.name)];}
root.PeakExercises=Object.freeze({all,find,CATEGORIES,COUNT:exerciseList.length});
})(typeof window!=='undefined'?window:globalThis);
