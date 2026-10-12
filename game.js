// Line Tower Wars – Spiellogik (geteilt von index.html und 3d.html, Node-Tests)
const COLS=11,ROWS=20,TICK=10;
// m: additive stats; rateMul multiplicative; flags camo/ap/air
const ELEM_MAX_T=6;
const TT={
 mauer:{n:'Mauer',c:'#8892a8',ico:'▦',cost:0,max:40,wall:1,b:{dmg:0,rng:0,rate:99,dt:'phys'},up:[[],[]]},
 pfeil:{n:'Pfeil',c:'#e8c547',ico:'➶',cost:10,b:{dmg:7,rng:3,rate:.6,dt:'phys',spd:14,pierce:1},up:[
  [{n:'Scharfe Spitzen',d:'+5 Schaden',cost:22,m:{dmg:5}},{n:'Schnellschuss',d:'30% schneller',cost:45,m:{rateMul:.7}},{n:'Durchschlag',d:'+2 Durchschlag, durchdringt Rüstung',cost:90,m:{pierce:2,ap:1}}],
  [{n:'Weitblick',d:'+0,8 Reichweite',cost:22,m:{rng:.8}},{n:'Adlerauge',d:'Erkennt Tarnung',cost:30,m:{camo:1}},{n:'Scharfschütze',d:'+40 Schaden, +1,5 Reichweite',cost:110,m:{dmg:40,rng:1.5,rateMul:1.4}}]]},
 kanone:{n:'Kanone',c:'#e07a3c',ico:'💣',cost:28,b:{dmg:24,rng:2.6,rate:1.4,dt:'phys',spd:7,splash:1.1,ground:1},up:[
  [{n:'Größere Bomben',d:'+0,4 Explosionsradius',cost:30,m:{splash:.4}},{n:'Schwere Ladung',d:'+20 Schaden',cost:55,m:{dmg:20}},{n:'Clusterbomben',d:'+30 Schaden, riesiger Radius',cost:150,m:{dmg:30,splash:.6}}],
  [{n:'Schnelles Laden',d:'25% schneller',cost:30,m:{rateMul:.75}},{n:'Panzerbrecher',d:'Durchdringt Rüstung',cost:50,m:{ap:1}},{n:'Flak',d:'Trifft Flieger, +10 Schaden',cost:90,m:{air:1,dmg:10}}]]},
 frost:{n:'Frost',c:'#6cc8f0',ico:'❄',cost:20,b:{dmg:5,rng:2.6,rate:.8,dt:'magic',spd:10,slow:.35,slowDur:2},up:[
  [{n:'Eiskälte',d:'+10% Verlangsamung',cost:25,m:{slow:.1}},{n:'Permafrost',d:'+10% Verl., +1,5s Dauer',cost:45,m:{slow:.1,slowDur:1.5}},{n:'Eissplitter',d:'Flächenfrost, +15 Schaden',cost:100,m:{splash:1,dmg:15}}],
  [{n:'Frostbiss',d:'+6 Schaden',cost:25,m:{dmg:6}},{n:'Kältesinn',d:'Erkennt Tarnung',cost:35,m:{camo:1}},{n:'Gletscher',d:'+1 Reichweite, 40% schneller',cost:90,m:{rng:1,rateMul:.6}}]]},
 gift:{n:'Gift',c:'#7bd65a',ico:'☠',cost:20,b:{dmg:4,rng:2.8,rate:1,dt:'poison',spd:9,dot:14,dotDur:3},up:[
  [{n:'Spürgas',d:'Erkennt Tarnung',cost:20,m:{camo:1}},{n:'Säure',d:'+8 Gift/s, ätzt Rüstung',cost:35,m:{dot:8,ap:1}},{n:'Seuche',d:'+25 Gift/s, Flächenwirkung',cost:120,m:{dot:25,splash:1}}],
  [{n:'Starkes Gift',d:'+6 Gift/s',cost:25,m:{dot:6}},{n:'Lange Wirkung',d:'+2s Giftdauer',cost:35,m:{dotDur:2}},{n:'Nervengift',d:'+10 Gift/s, verlangsamt 20%',cost:90,m:{dot:10,slow:.2,slowDur:2}}]]},
 element:{n:'Element',c:'#e070ff',ico:'✦',cost:40,max:ELEM_MAX_T,b:{dmg:14,rng:3,rate:1,dt:'magic',spd:12},up:[[2,3,4,5].map((l,i)=>({n:'Elementstufe '+l,d:'Element-Effekt stärker'+(l===5?' + Stufe-5-Bonus':''),cost:[25,45,70,110][i],m:{}})),[]]},
 blitz:{n:'Blitz',c:'#b58cff',ico:'⚡',cost:32,b:{dmg:16,rng:2.8,rate:1,dt:'magic',chain:3},up:[
  [{n:'Überladung',d:'+10 Schaden',cost:40,m:{dmg:10}},{n:'Kettenreaktion',d:'+2 Sprünge',cost:60,m:{chain:2}},{n:'Gewitter',d:'+40 Schaden, +2 Sprünge',cost:170,m:{dmg:40,chain:2}}],
  [{n:'Schnellentladung',d:'25% schneller',cost:40,m:{rateMul:.75}},{n:'Ionensicht',d:'Erkennt Tarnung, durchdringt Rüstung',cost:55,m:{camo:1,ap:1}},{n:'Sturmbögen',d:'+0,8 Reichweite, 30% schneller',cost:110,m:{rng:.8,rateMul:.7}}]]}};
// Wirtschaft: Senden ist die Hauptökonomie. HP skaliert mit der Stufe, nicht mit der Zeit (nur späte Verschärfung).
// ================= Rassen – komplett datengetrieben: Name, Palette (c/c2/acc), Silhouetten-Marker (mark), 5 Türme, Spezialeinheit, Held in EINER Tabelle; Logik/Renderer lesen nur diese Felder (design/elemente_rassen.md §2, Paletten art_direction.md §2) =================
// Jede Rasse: 5 Türme (Rolle+Fähigkeit, auf unsere Ökonomie skaliert ≈ Doc-Kosten ×0,2), Spezialeinheit, Held mit 2 Fähigkeiten.
// Turm-Felder wie Element-System (generisch): vis = Silhouetten-Archetyp für Renderer, noAtk = kein Angriff (Aura/Wirtschaft).
function genUp(cost,b2){// 2 Pfade × 3 Stufen, Kosten ×1,5 je Stufe (Doc); Pfad B Stufe 2 = Tarnsicht (falls nicht vorhanden)
 const c=[Math.round(cost*.9),Math.round(cost*1.35),Math.round(cost*2)];
 return[[{n:'Geschärft',d:'+35 % Schaden',cost:c[0],m:{dmgPct:.35}},{n:'Meisterhaft',d:'+50 % Schaden',cost:c[1],m:{dmgPct:.5}},{n:'Legendär',d:'+80 % Schaden, durchdringt Rüstung',cost:c[2],m:{dmgPct:.8,ap:1}}],
  [{n:'Weitsicht',d:'+0,5 Reichweite',cost:c[0],m:{rng:.5}},b2||{n:'Spähauge',d:'Erkennt Tarnung',cost:c[1],m:{camo:1}},{n:'Schnellfeuer',d:'35 % schneller, +0,5 RW',cost:c[2],m:{rateMul:.65,rng:.5}}]];}
const RACE={
 menschen:{mark:'banner',n:'Lichtschmiede',c:'#3E7BD6',c2:'#F2B233',acc:'#FFF6E0',d:'Mach Ängste zu Licht. Jede Angst wird verwandelt. Viele hintereinander geben mehr Gold und Mut.',xform:1,
  t:{m_bogen:{n:'Funkenwerfer',ico:'✨',cost:10,vis:'pfeil',role:'DMG',d:'Wirft Licht, trifft auch Flieger',b:{dmg:8,rng:3,rate:.75,dt:'phys',spd:14}},
   m_kanone:{n:'Glocke der Läuterung',ico:'🔔',cost:20,vis:'kanone',role:'DMG',d:'Lichtwelle auf 1 Feld, nur Boden',b:{dmg:25,rng:2.6,rate:1.4,dt:'phys',spd:7,splash:1,ground:1}},
   m_wacht:{n:'Wachfeuer',ico:'🔥',cost:14,vis:'pfeil',role:'CAMO',d:'Sieht versteckte Ängste',b:{dmg:5,rng:3,rate:.7,dt:'phys',spd:14,camo:1}},
   m_kapelle:{n:'Esse des Mutes',ico:'⚒',cost:24,vis:'aura',role:'SUP',d:'Gibt Mut: +15 % Kraft für Türme in 2 Feldern',b:{dmg:0,rng:2,rate:99,noAtk:1,aura:{dmgMul:1.15,r:2}}},
   m_ballista:{n:'Lichtspeer',ico:'🎯',cost:32,vis:'kanone',role:'AA',d:'Starker Lichtspeer, doppelt gegen Flieger',b:{dmg:45,rng:3.5,rate:1.6,dt:'phys',spd:16,airMul:1}}},
  unit:{id:'paladin',n:'Glühender Paladin',c:'#F2B233',cost:90,inc:11,hp:900,sp:1.1,unlock:200,heal:1,L:2,cd:30,d:'Leuchtet und heilt Ängste neben sich'},
  hero:{n:'Ilka',c:'#F2B233',ab:['amboss','goldregen']}},
 orks:{mark:'horns',n:'Glutriesen',c:'#E8402A',c2:'#FFB13B',acc:'#3A2E2A',d:'Zerschlag die Ängste! Viel Kraft und schnelle Türme. Jede Angst wird zu Licht, Mut bleibt übrig.',xform:1,
  t:{o_speer:{n:'Glutspeer',ico:'🔥',cost:10,vis:'pfeil',role:'DMG',d:'Glühender Speer, trifft 2 Ängste',b:{dmg:11,rng:2.8,rate:.85,dt:'phys',spd:13,pierce:2}},
   o_katapult:{n:'Felsfaust',ico:'🪨',cost:22,vis:'kanone',role:'DMG',d:'Wirft Glutfelsen auf 1,5 Felder, langsam',b:{dmg:36,rng:3,rate:2,dt:'phys',spd:6,splash:1.5,ground:1}},
   o_trommel:{n:'Glut-Kriegstrommel',ico:'🥁',cost:24,vis:'aura',role:'SUP',d:'Gibt Mut: Türme in 2 Feldern +20 % schneller',b:{dmg:0,rng:2,rate:99,noAtk:1,aura:{rateMul:.83,r:2}}},
   o_schamane:{n:'Aschenrufer',ico:'🌋',cost:18,vis:'blitz',role:'SLOW',d:'Glutkette auf 3 Ängste, macht sie 20 % langsamer',b:{dmg:6,rng:2.8,rate:1,dt:'magic',chain:3,slow:.2,slowDur:2}},
   o_wyvern:{n:'Glutfalken-Horst',ico:'🦅',cost:30,vis:'gift',role:'AA',d:'Nur Flieger, brennt 10/s',b:{dmg:25,rng:3.2,rate:1,dt:'phys',spd:12,airOnly:1,dot:10,dotDur:3}}},
  unit:{id:'berserker',n:'Flammengeweihter',c:'#E8402A',d:'Wird schneller, wenn sie schwach ist',cost:80,inc:10,hp:750,sp:1.2,unlock:200,berserk:1,L:2,cd:30},
  hero:{n:'Torvan',c:'#FF6A2A',ab:['kriegsschrei','erdbeben']}},
 untote:{mark:'eyes',n:'Astralwanderer',locked:1,c:'#6B3FA0',c2:'#7CFF4F',acc:'#D9D3C1',d:'Kontrolle & Wirtschaft',
  t:{u_ghul:{n:'Ghul-Grube',ico:'🦴',cost:10,vis:'pfeil',role:'DMG',d:'Ziel nimmt +15 % Schaden',b:{dmg:8,rng:2.6,rate:.85,dt:'phys',spd:12,amp:.15}},
   u_kessel:{n:'Seuchenkessel',ico:'☠',cost:20,vis:'gift',role:'DMG',d:'Giftwolke 12/s in 2 Feldern',b:{dmg:2,rng:2.4,rate:1.2,dt:'poison',spd:9,splash:2,dot:12,dotDur:3}},
   u_gruft:{n:'Frostgruft',ico:'❄',cost:22,vis:'frost',role:'SLOW',d:'30 % Slow, Fläche',b:{dmg:4,rng:2.6,rate:1,dt:'magic',spd:10,splash:1.2,slow:.3,slowDur:2}},
   u_nekro:{n:'Totenbeschwörer',ico:'💀',cost:28,vis:'blitz',role:'ECO',d:'Kills +2 Gold',b:{dmg:7,rng:2.8,rate:.9,dt:'magic',spd:12,killGold:2}},
   u_banshee:{n:'Banshee-Turm',ico:'👻',cost:26,vis:'frost',role:'CAMO',d:'Erkennt Tarnung, trifft Luft',b:{dmg:18,rng:3,rate:1,dt:'magic',spd:12,camo:1}}},
  unit:{id:'lich',n:'Lich-Schatten',c:'#9a6aff',cost:90,inc:11,hp:600,sp:1.3,unlock:200,camo:1,spawn:3,L:2,cd:30},
  hero:{n:'Neyra',c:'#9fe8ff',ab:['frostnova','seelenernte']}},
 elfen:{mark:'moon',n:'Kobolde',locked:1,c:'#5B4B9E',c2:'#4FE3D0',acc:'#CFE3FF',d:'Präzision & Anti-Luft',
  t:{e_jaeger:{n:'Jägerin',ico:'🌙',cost:12,vis:'pfeil',role:'DMG',d:'Prallt auf 2. Ziel',b:{dmg:18,rng:3.2,rate:.78,dt:'phys',chain:2}},
   e_brunnen:{n:'Mondbrunnen',ico:'⛲',cost:20,vis:'aura',role:'SUP',d:'+1 Reichweite in 2 Feldern',b:{dmg:0,rng:2,rate:99,noAtk:1,aura:{rng:1,r:2}}},
   e_baum:{n:'Uralter Baum',ico:'🌳',cost:24,vis:'gift',role:'SLOW',d:'Wurzeln: 0,8 s Stun, 2 Ziele',b:{dmg:8,rng:2.6,rate:1.8,dt:'magic',spd:9,freeze:1,freezeDur:.8,multi:2}},
   e_eule:{n:'Eulenwacht',ico:'🦉',cost:16,vis:'pfeil',role:'CAMO',d:'Tarnsicht für Türme in 4 Feldern',b:{dmg:7,rng:4,rate:.8,dt:'phys',spd:14,camo:1,aura:{camo:1,r:4}}},
   e_dryade:{n:'Dryadenhain',ico:'🍃',cost:30,vis:'frost',role:'AA',d:'+100 % vs. Luft, 30 % Slow',b:{dmg:36,rng:3.2,rate:1.3,dt:'magic',spd:13,airMul:1,slow:.3,slowDur:1.5}}},
  unit:{id:'wandler',n:'Gestaltwandler',c:'#4FE3D0',cost:85,inc:10,hp:650,sp:1.3,unlock:200,morph:1,L:2,cd:30},
  hero:{n:'Pip',c:'#CFE3FF',ab:['sternenregen','mondlicht']}},
 zwerge:{mark:'gear',n:'Hüter',c:'#5DBB4A',c2:'#FFE9F0',acc:'#8A6A3A',d:'Rette die Ängste! Viel Gold und starke Bremsen. Jede Angst wird zu Licht und wächst im Garten.',xform:1,
  t:{z_gewehr:{n:'Dornenschleuder',ico:'🌰',cost:11,vis:'pfeil',role:'DMG',d:'Samen sprengen harte Hüllen auf',b:{dmg:8,rng:2.8,rate:.85,dt:'phys',spd:16,ap:1}},
   z_moerser:{n:'Sonnensaat-Mörser',ico:'🌻',cost:20,vis:'kanone',role:'DMG',d:'Sonnensaat trifft 2 Felder',b:{dmg:18,rng:3,rate:1.9,dt:'phys',spd:6,splash:1.3,ground:1}},
   z_flak:{n:'Lichtstaub-Schleier',ico:'🌼',cost:26,vis:'kanone',role:'AA',d:'Nur Flieger, 4 auf einmal',b:{dmg:9,rng:3.2,rate:.6,dt:'phys',spd:16,airOnly:1,multi:4}},
   z_tesla:{n:'Rankenumarmung',ico:'🌿',cost:28,vis:'blitz',role:'SLOW',d:'Ranken halten 3 Ängste kurz fest',b:{dmg:7,rng:2.6,rate:1.1,dt:'magic',chain:3,freeze:1,freezeDur:.3}},
   z_schmelze:{n:'Hain der Wandlung',ico:'🌱',cost:30,vis:'eco',role:'ECO',d:'+1,5 Gold/s, greift nicht an (max. 2)',max:2,b:{dmg:0,rng:0,rate:99,noAtk:1,gps:1}}},
  unit:{id:'belagerung',n:'Uralter Hügel',c:'#7A8A5A',d:'Hart und zäh, Bremsen wirken schwach',cost:110,inc:13,hp:1300,sp:.8,unlock:220,armor:1,slowImm:.3,L:3,cd:35},
  hero:{n:'Bruma die Erwachte',c:'#9BD77A',ab:['sturmhammer','goldregen']}}};
for(const[rk,R]of Object.entries(RACE))for(const[k,T]of Object.entries(R.t)){T.race=rk;T.c=R.c;T.gen=1;T.up=genUp(T.cost,T.b.camo?{n:'Verstärkt',d:'+0,3 Reichweite, 15 % schneller',cost:Math.round(T.cost*1.35),m:{rng:.3,rateMul:.85}}:null);
 if(T.b.noAtk)T.up=[[{n:'Ausbau',d:'Effekt verstärkt',cost:Math.round(T.cost*1.2),m:{auraUp:1}}],[]];TT[k]=T;}
const raceTowers=rk=>Object.keys(RACE[rk].t);
const ECO={incMin:.2,incDim:400,incHp:1900,startGold:70,bounty:1,hpMul:.8,sdStart:840,sdLen:220};
const CT=[
 {id:'laeufer',n:'Läufer',c:'#ddd',cost:5,inc:1,hp:32,sp:1.6,gold:1,unlock:5},
 {id:'flitzer',n:'Flitzer',c:'#ffe066',cost:10,inc:2,hp:55,sp:2.8,gold:1,unlock:60},
 {id:'panzer',n:'Panzer',c:'#a0703c',cost:18,inc:3,hp:200,sp:1.1,gold:2,unlock:90,armor:1},
 {id:'schatten',n:'Schatten',c:'#8a8fb0',cost:30,inc:4,hp:170,sp:2,gold:3,unlock:120,camo:1},
 {id:'flieger',n:'Flieger',c:'#7ad',cost:45,inc:6,hp:290,sp:1.5,gold:4,unlock:150,fly:1},
 {id:'heiler',n:'Heiler',c:'#f6a',cost:80,inc:10,hp:620,sp:1.3,gold:6,unlock:180,heal:1},
 {id:'boss',n:'Koloss',c:'#e33',cost:150,inc:18,hp:2800,sp:.9,gold:12,unlock:240,boss:1,armor:1}];
function incGain(p,ct){return Math.max(1,Math.round(ct.inc*Math.max(ECO.incMin,1-p.income/ECO.incDim)));}
// ================= Spezialeinheiten (Doc §3.2) & Rasseneinheiten =================
// Bounty-Regel: Kopfgeld = Einkommensgewinn des Senders (bounty = ig). Cooldowns pro Sender. L = gestohlene Leben bei Leak.
const SPECIAL=[
 {id:'dieb',n:'Dieb',c:'#d4a017',cost:25,inc:3,hp:120,sp:2,unlock:90,L:0,thief:1,cd:30,d:'Bei Leak: stiehlt 10 % Gold (max. 60) statt Leben'},
 {id:'saboteur',n:'Saboteur',c:'#555a70',cost:30,inc:4,hp:200,sp:1.5,unlock:120,camo:1,sabo:1,cd:40,d:'Legt stärksten Turm in 2 Feldern 4 s lahm (einmal)'}];
for(const R of Object.values(RACE)){const u=R.unit;u.race=Object.keys(RACE).find(k=>RACE[k]===R);u.raceUnit=1;u.gold=Math.max(2,Math.round(u.inc/2));CT.push(u);}
for(const u of SPECIAL){u.gold=2;CT.push(u);}
const ctAvail=(p,c)=>!c.race||c.race===p.race;
function sendCd(G,p,c){return c.cd?Math.max(0,(p.sendCd?.[c.id]||0)-G.t):0;}
// ================= Helden =================
// 1 Held pro Spieler, steht auf der eigenen Bahn (blockiert nicht), läuft zu angetippter Zelle, greift automatisch an,
// XP aus Kills auf der Bahn, Stufe 1–10, 2 aktive Fähigkeiten mit Cooldown.
const ABIL={
 amboss:{n:'Amboss',ico:'⚒',cd:35,d:'Türme nahe Ilka: +30 % Kraft (8 s)'},
 meteor:{n:'Meteor',ico:'☄',cd:25,d:'Flächenschaden am dichtesten Pulk'},
 goldregen:{n:'Goldregen',ico:'💰',cd:60,d:'Sofort Gold'},
 kriegsschrei:{n:'Mutschrei',ico:'📯',cd:40,d:'Alle Türme 8 s lang schneller'},
 erdbeben:{n:'Glutbeben',ico:'🌋',cd:30,d:'Alle Ängste werden langsam und getroffen'},
 frostnova:{n:'Frostnova',ico:'❄',cd:25,d:'Friert Gegner in 2,5 Feldern 2 s ein'},
 seelenernte:{n:'Seelenernte',ico:'👻',cd:50,d:'Gold pro Gegner auf der Bahn'},
 sternenregen:{n:'Sternenregen',ico:'✨',cd:35,d:'Schaden an allen Gegnern der Bahn'},
 mondlicht:{n:'Mondlicht',ico:'🌙',cd:40,d:'Türme: Tarnsicht & +1 Reichweite (8 s)'},
 sturmhammer:{n:'Rankengriff',ico:'🌿',cd:20,d:'Die stärkste Angst wird 3 s festgehalten'}};
const heroXpNeed=l=>Math.round(25*Math.pow(l,1.5));
function heroStats(h){const l=h.lvl;return{dmg:12+6*l,rng:2.4+l*.08,rate:Math.max(.45,.9-l*.04),sp:2.2};}
function mkHero(p){const R=RACE[p.race];if(!R)return null;return{n:R.hero.n,c:R.hero.c,ab:R.hero.ab,x:5.5,y:15.5,tx:5.5,ty:15.5,lvl:1,xp:0,cd:[0,0],atk:0,ang:0,buffT:0};}
function heroMove(p,x,y){if(!p.hero||x<0||y<0||x>=COLS||y>=ROWS)return false;p.hero.tx=x+.5;p.hero.ty=y+.5;return true;}
function heroAbility(G,pi,i){const p=G.p[pi],h=p.hero;if(!h||h.cd[i]>G.t)return false;const k=h.ab[i],A=ABIL[k],l=h.lvl,cr=p.creeps.filter(c=>c.hp>0);
 const dmgAll=(list,d)=>list.forEach(c=>hurt(G,pi,c,d,'magic',1));let ok=true;
 if(k==='meteor'){if(!cr.length)return false;const c0=cr.reduce((b,c)=>cr.filter(o=>cdist(o,c)<1.5).length>cr.filter(o=>cdist(o,b)<1.5).length?c:b,cr[0]);dmgAll(cr.filter(c=>cdist(c,c0)<1.6),60+25*l);G.fx.push({k:'boom',pi,x:c0.x,y:c0.y,r:1.6,t:.5,c:'#ff7a2a'});}
 else if(k==='goldregen'){const g=25+12*l;p.gold+=g;G.ev.push({k:'minegold',pi,g});G.fx.push({k:'coin',pi,x:h.x,y:h.y-.5,t:1,txt:'+'+g});}
 else if(k==='kriegsschrei')p.rateBuffT=G.t+8;
 else if(k==='amboss'){p.anvilT=G.t+8;p.anvil={x:h.x,y:h.y};G.fx.push({k:'burst',pi,x:h.x,y:h.y,r:2.5,t:.6,c:'#F2B233'});}
 else if(k==='erdbeben'){if(!cr.length)return false;for(const c of cr){c.slow=Math.max(c.slow,.5);c.slowT=Math.max(c.slowT||0,4);}dmgAll(cr,15+8*l);G.fx.push({k:'pulse',pi,t:.6});}
 else if(k==='frostnova'){const t=cr.filter(c=>cdist(c,h)<2.5);if(!t.length)return false;for(const c of t){if(c.ct.boss){c.slow=Math.max(c.slow,.5);c.slowT=2;}else c.frzT=2;}dmgAll(t,10+6*l);G.fx.push({k:'boom',pi,x:h.x,y:h.y,r:2.5,t:.5,c:'#9fe8ff'});}
 else if(k==='seelenernte'){if(!cr.length)return false;const g=cr.length*(3+l);p.gold+=g;G.ev.push({k:'minegold',pi,g});}
 else if(k==='sternenregen'){if(!cr.length)return false;dmgAll(cr,20+10*l);for(const c of cr.slice(0,12))G.fx.push({k:'bolt',pi,a:{x:c.x,y:c.y-3},b:{x:c.x,y:c.y},t:.3,c:'#CFE3FF',w:2});}
 else if(k==='mondlicht')p.moonT=G.t+8;
 else if(k==='sturmhammer'){if(!cr.length)return false;const c=cr.reduce((a,b)=>b.hp>a.hp?b:a);c.frzT=3;hurt(G,pi,c,90+35*l,'magic',1);G.fx.push({k:'bolt',pi,a:{x:h.x,y:h.y},b:{x:c.x,y:c.y},t:.3,c:'#FF7A1A',w:4});}
 h.cd[i]=G.t+A.cd;G.ev.push({k:'ability',pi,a:k});return ok;}
function stepHero(G,pi,p,dt){const h=p.hero;if(!h)return;const S=heroStats(h),dx=h.tx-h.x,dy=h.ty-h.y,d=Math.hypot(dx,dy);
 if(d>.05){const m=Math.min(d,S.sp*dt);h.x+=dx/d*m;h.y+=dy/d*m;h.moving=1;}else h.moving=0;
 h.atk-=dt;if(h.atk<=0){const tg=p.creeps.filter(c=>c.hp>0&&cdist(c,h)<=S.rng).sort((a,b)=>remaining(p,a)-remaining(p,b))[0];
  if(tg){h.atk=S.rate;h.ang=Math.atan2(tg.y-h.y,tg.x-h.x);hurt(G,pi,tg,S.dmg,'phys',h.lvl>=6);G.fx.push({k:'bolt',pi,a:{x:h.x,y:h.y},b:{x:tg.x,y:tg.y},t:.12,c:h.c,w:2});}}}
function heroXp(p,xp){const h=p.hero;if(!h||h.lvl>=10)return;h.xp+=xp;while(h.lvl<10&&h.xp>=heroXpNeed(h.lvl)){h.xp-=heroXpNeed(h.lvl);h.lvl++;h.lvlT=p.now||0;}}
const PLAYABLE=()=>Object.keys(RACE).filter(k=>!RACE[k].locked);
function pickRace(p,rk){if(!RACE[rk])return false;p.race=rk;p.hero=mkHero(p);return true;}
const MT={
 blitzmeister:{n:'Blitzmeister',c:'#d0a0ff',d:'Kettenblitz-Aura: trifft periodisch mehrere Gegner (ab Stufe 3 auch getarnte).',cost:[60,60,90,130,180,250]},
 frostmeister:{n:'Frostmeister',c:'#9ef',d:'Globaler Frostpuls verlangsamt alle Gegner der Bahn.',cost:[60,60,90,130,180,250]},
 goldmeister:{n:'Goldmeister',c:'#fd5',d:'Bonus-Einkommen und Extragold pro Kill.',cost:[60,60,90,130,180,250]}};
const TGT=['first','last','strong','close'],TGTN={first:'Erster',last:'Letzter',strong:'Stärkster',close:'Nächster'};
function mStats(k,l){if(k==='blitzmeister')return{rate:2.2-l*.25,targets:1+l,dmg:12*l*l+8,rng:4+l*.4,camo:l>=3};
 if(k==='frostmeister')return{rate:6-l*.6,slow:.2+l*.08,dur:1.5+l*.5,dmg:5*l};return{inc:l*3,kill:l*.15};}
function tStats(t,noBuff){const T=TT[t.type],s=Object.assign({camo:0,ap:0,air:0,splash:0,slow:0,dot:0,chain:0,pierce:1,slowDur:2,dotDur:3},T.b);
 for(let p=0;p<2;p++)for(let i=0;i<t.up[p];i++){const m=T.up[p][i].m;for(const k in m){if(k==='rateMul')s.rate*=m[k];else if(k==='camo'||k==='ap'||k==='air')s[k]=1;else s[k]=(s[k]||0)+m[k];}}
 if(s.dmgPct){s.dmg*=1+s.dmgPct;}if(s.auraUp&&s.aura){const a=s.aura={...s.aura};if(a.rateMul)a.rateMul-=.08;if(a.dmgMul)a.dmgMul+=.1;if(a.rng)a.rng+=.5;}if(s.auraUp&&s.gps)s.gps+=1;
 if(t.type==='element')elemStats(t,s);
 if(!noBuff&&t.buff){s.rate*=t.buff.rateMul;s.rng+=t.buff.rng;if(t.buff.camo)s.camo=1;if(t.buff.dmgMul)s.dmg*=t.buff.dmgMul;}
 return s;}
// ================= Element-Turm-System (Schrein + Runen), siehe design/elemente_rassen.md =================
// Datengetrieben: m = Stat-Modifikatoren, sc = Felder die mit Level-Multiplikator skalieren, l5 = Bonus ab Lv5.
// Unterstützte Felder: dmg,splash,slow,slowDur,dot,dotDur,chain,pierce,multi,rateMul,rng,camo,air,ap,ground,
//  airMul(+% vs Luft),camoMul(+% vs Tarnung),freeze(Chance),freezeDur,killGold,gps(Gold/s passiv),amp(+% erlittener Schaden),
//  crit(Chance ×3),spread(Brand springt bei Tod),aura:{rateMul,rng,camo,r}
const RUNE_COST=15,FUSE_COST=0,LVL_COST=[0,25,45,70,110],LMUL=[1,1.35,1.75,2.25,3],ELEM_MAX=6;
const ELEM={
 feuer:{n:'Feuer',ico:'🔥',c:'#ff6a2a',role:'DMG',d:'Brand 8/s für 3 s',m:{dot:8,dotDur:3},sc:['dot'],l5:{spread:2}},
 wasser:{n:'Wasser',ico:'💧',c:'#3a9cff',role:'SLOW',d:'Treffer verlangsamt 20 % für 2 s',m:{slow:.2,slowDur:2},sc:[],l5:{slow:.1}},
 erde:{n:'Erde',ico:'🪨',c:'#b08850',role:'DMG',d:'Splash +12 in 1 Feld, nur Boden',m:{splash:1,dmg:12,ground:1},sc:['dmg'],l5:{freeze:.5,freezeDur:.5}},
 luft:{n:'Luft',ico:'🌪',c:'#c8f0ff',role:'AA',d:'Trifft Luft, +50 % vs. Flieger',m:{air:1,airMul:.5},sc:['airMul'],l5:{multi:3}},
 blitz:{n:'Blitz',ico:'⚡',c:'#fff35c',role:'DMG',d:'Kette auf 3 Ziele',m:{chain:3},sc:['dmg'],l5:{chain:2}},
 eis:{n:'Eis',ico:'❄',c:'#9fe8ff',role:'SLOW',d:'30 % Slow 1,5 s, 10 % Einfrieren',m:{slow:.3,slowDur:1.5,freeze:.1,freezeDur:.8},sc:[],l5:{freeze:.15}},
 licht:{n:'Licht',ico:'☀',c:'#fff4b0',role:'CAMO',d:'Erkennt Tarnung, +20 % vs. Getarnte',m:{camo:1,camoMul:.2},sc:['camoMul'],l5:{aura:{camo:1,r:4}}},
 schatten:{n:'Schatten',ico:'🌑',c:'#9a6aff',role:'ECO',d:'+1 Gold/Kill, durchdringt Rüstung',m:{killGold:1,ap:1},sc:['killGold'],l5:{killGold:3}}};
const COMBO={// Schlüssel: zwei Basis-Elemente alphabetisch mit '+'
 'feuer+wasser':{n:'Dampf',ico:'♨',c:'#e0e0e0',role:'SLOW',d:'Dampfwolke 1,5 Felder: 25 % Slow + 10/s',m:{splash:1.5,slow:.25,slowDur:2,dot:10,dotDur:2},sc:['dot']},
 'erde+feuer':{n:'Magma',ico:'🌋',c:'#ff4a10',role:'DMG',d:'Lava 25/s am Ziel, Splash, nur Boden',m:{splash:1,dot:25,dotDur:4,ground:1},sc:['dot']},
 'blitz+feuer':{n:'Plasma',ico:'🟣',c:'#ff5cf0',role:'DMG',d:'Strahl +60 Schaden, durchschlägt 3',m:{dmg:60,pierce:3,rateMul:1.3},sc:['dmg']},
 'feuer+licht':{n:'Sonne',ico:'🌞',c:'#ffd040',role:'CAMO',d:'Erkennt Tarnung, Flare +40 in 2 Feldern',m:{camo:1,splash:2,dmg:40,rateMul:1.8},sc:['dmg']},
 'feuer+schatten':{n:'Höllenfeuer',ico:'😈',c:'#c02040',role:'DMG',d:'Brand 15/s, ignoriert Rüstung',m:{dot:15,dotDur:4,ap:1},sc:['dot']},
 'blitz+wasser':{n:'Gewitterflut',ico:'🌊',c:'#4ac0ff',role:'DMG',d:'Kette 4 Ziele, +35 Schaden',m:{chain:4,dmg:35},sc:['dmg']},
 'eis+wasser':{n:'Gletscher',ico:'🧊',c:'#b0f0ff',role:'SLOW',d:'35 % Slow in 1,5 Feldern',m:{splash:1.5,slow:.35,slowDur:2},sc:[]},
 'licht+wasser':{n:'Quelle',ico:'⛲',c:'#80e0ff',role:'SUP',d:'Türme in 2 Feldern +15 % Angriffstempo',m:{aura:{rateMul:.87,r:2}},sc:[]},
 'schatten+wasser':{n:'Gift',ico:'☠',c:'#7bd65a',role:'DMG',d:'Gift 12/s für 6 s',m:{dot:12,dotDur:6,ap:1},sc:['dot']},
 'erde+licht':{n:'Kristall',ico:'💎',c:'#c0a0ff',role:'ECO',d:'+2 Gold/Kill, +1 Gold/s passiv',m:{killGold:2,gps:1},sc:['killGold','gps']},
 'blitz+luft':{n:'Gewitter',ico:'⛈',c:'#d0d8ff',role:'AA',d:'+45 Schaden, trifft Luft, 2 Ziele',m:{air:1,dmg:45,multi:2,airMul:.3},sc:['dmg']},
 'licht+luft':{n:'Aurora',ico:'🌈',c:'#a0ffd0',role:'SUP',d:'Türme in 2,5 Feldern +1 Reichweite & Tarnsicht',m:{aura:{rng:1,camo:1,r:2.5}},sc:[]},
 'blitz+eis':{n:'Frostfunke',ico:'✳',c:'#c0f0ff',role:'SLOW',d:'Kette 3, +25 Schaden, 15 % Slow',m:{chain:3,dmg:25,slow:.15,slowDur:2},sc:['dmg']},
 'blitz+schatten':{n:'Nachtblitz',ico:'🌩',c:'#8060ff',role:'DMG',d:'15 % Krit ×3, Krit betäubt 0,4 s',m:{crit:.15,freezeDur:.4},sc:['crit']},
 'licht+schatten':{n:'Zwielicht',ico:'🌗',c:'#d0a0ff',role:'SUP',d:'Ziel nimmt +20 % Schaden (4 s), Tarnsicht',m:{amp:.2,camo:1},sc:['amp']},
 'eis+schatten':{n:'Seelenfrost',ico:'👻',c:'#a0c0ff',role:'ECO',d:'25 % Slow, +3 Gold/Kill',m:{slow:.25,slowDur:2,killGold:3},sc:['killGold']}};
const comboKey=(a,b)=>[a,b].sort().join('+');
function elemDef(t){const el=t.el||[];if(!el.length)return null;const tl=1+((t.up&&t.up[0])||0);if(el.length===1)return{...ELEM[el[0].e],lv:tl,base:1};
 const C=COMBO[comboKey(el[0].e,el[1].e)];return C?{...C,lv:tl}:null;}
function applyMods(s,m,mul,sc){for(const k in m){const v=m[k];if(k==='aura'){s.aura={...v};continue;}if(k==='rateMul')s.rate*=v;else if(['camo','ap','air','ground'].includes(k))s[k]=v;
  else s[k]=(s[k]||0)+(sc&&sc.includes(k)?v*mul:typeof v==='number'&&/Dur$/.test(k)?v:v);}}
function elemStats(t,s){const D=elemDef(t);if(!D)return;const lv=D.lv,mul=LMUL[lv-1],dm=1+.1*(lv-1);
 s.ground=0;applyMods(s,D.m,mul,D.sc);if(lv>=5&&D.l5)applyMods(s,D.l5,1,[]);
 s.dmg*=1+.15*(lv-1);if(s.slowDur)s.slowDur*=dm;if(s.slow)s.slow=Math.min(.6,s.slow*dm);if(s.aura){if(s.aura.rateMul)s.aura.rateMul=1-(1-s.aura.rateMul)*mul;}
 s.el=D;}
// Elemente: am Schrein je Element max. 1x freischalten, max. 2 verschiedene; Element-Turm kostenlos auf ein freigeschaltetes Element umstellen (keine Mischungen/Stapel)
function canSlot(p,t,e){if(!t||t.type!=='element'||!(p.runes?.[e]>0))return null;const el=t.el||(t.el=[]);if(el.length&&el[0].e===e)return null;return{kind:el.length?'switch':'new',cost:0};}
const RUNE_MAX=2,activeEls=p=>Object.keys(p.runes||{}).filter(k=>p.runes[k]>0);
function dropRune(p,e){if(!(p.runes?.[e]>0))return false;delete p.runes[e];for(const t of p.towers)if(t.el&&t.el.length&&t.el[0].e===e)t.el=[];return true;}
function buyRune(p,e){if(!ELEM[e]||p.gold<RUNE_COST||p.runes?.[e]>0||activeEls(p).length>=RUNE_MAX)return false;p.gold-=RUNE_COST;p.runes=p.runes||{};p.runes[e]=1;return true;}
function slotRune(p,t,e){const c=canSlot(p,t,e);if(!c||p.gold<c.cost)return false;p.gold-=c.cost;t.upT=p.now||0;
 t.el=[{e,lv:1}];return c.kind;}
function elemCount(p){return p.towers.filter(t=>t.type==='element').length;}
// Auren (Unterstützer): stärkster Buff gilt, nicht stapelnd
function stepAuras(p,G){for(const t of p.towers)t.buff=null;for(const a of p.towers){if(TT[a.type]?.wall||(a.type==='element'&&!a.el?.length))continue;if(a.type!=='element'&&!TT[a.type]?.b?.aura)continue;const s=tStats(a,1);if(!s.aura)continue;
 for(const t of p.towers){if(t===a||TT[t.type].wall||Math.hypot(t.x-a.x,t.y-a.y)>s.aura.r)continue;const b=t.buff||(t.buff={rateMul:1,rng:0,camo:0});
  if(s.aura.rateMul)b.rateMul=Math.min(b.rateMul,s.aura.rateMul);if(s.aura.dmgMul)b.dmgMul=Math.max(b.dmgMul||1,s.aura.dmgMul);if(s.aura.rng)b.rng=Math.max(b.rng,s.aura.rng);if(s.aura.camo)b.camo=1;}}
 if(G&&G.t<(p.anvilT||0)&&p.anvil)for(const t of p.towers){if(TT[t.type]?.wall||Math.hypot(t.x+.5-p.anvil.x,t.y+.5-p.anvil.y)>2.5)continue;const b=t.buff||(t.buff={rateMul:1,rng:0,camo:0});b.dmgMul=(b.dmgMul||1)*1.3;}
 if(G&&(G.t<(p.rateBuffT||0)||G.t<(p.moonT||0)))for(const t of p.towers){if(TT[t.type]?.wall)continue;const b=t.buff||(t.buff={rateMul:1,rng:0,camo:0});if(G.t<(p.rateBuffT||0))b.rateMul*=.7;if(G.t<(p.moonT||0)){b.camo=1;b.rng=Math.max(b.rng,1);}}}

function mkPlayer(ai){return{ai,gold:ECO.startGold,income:10,lives:30,mine:{lvl:0,w:0,ph:[]},grid:Array.from({length:ROWS},()=>Array(COLS).fill(null)),towers:[],creeps:[],proj:[],dist:null,master:null,mLvl:0};}
const SPAWN={x:5,y:0};
function bfs(grid){const d=Array.from({length:ROWS},()=>Array(COLS).fill(Infinity)),q=[];
 for(let x=0;x<COLS;x++)if(!grid[ROWS-1][x]){d[ROWS-1][x]=0;q.push([x,ROWS-1]);}
 for(let i=0;i<q.length;i++){const[x,y]=q[i];for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;
  if(nx<0||ny<0||nx>=COLS||ny>=ROWS||grid[ny][nx]||d[ny][nx]<=d[y][x]+1)continue;d[ny][nx]=d[y][x]+1;q.push([nx,ny]);}}return d;}
function canPlace(p,x,y){if(x<0||y<0||x>=COLS||y>=ROWS||p.grid[y][x])return false;if(y===0&&x===SPAWN.x)return false;
 for(const c of p.creeps)if(!c.fly&&Math.floor(c.x)===x&&Math.floor(c.y)===y)return false;
 p.grid[y][x]=1;const d=bfs(p.grid);p.grid[y][x]=null;if(d[SPAWN.y][SPAWN.x]===Infinity)return false;
 for(const c of p.creeps)if(!c.fly&&c.y<ROWS&&d[Math.floor(c.y)][Math.floor(c.x)]===Infinity)return false;return true;}
let TID=1;
function wallCount(p){return p.towers.filter(t=>t.type==='mauer').length;}
function typeCount(p,ty){return p.towers.filter(t=>t.type===ty).length;}
function build(p,type,x,y,master){const cost=master?0:TT[type].cost;if(p.gold<cost||!canPlace(p,x,y))return null;if(TT[type]?.max&&typeCount(p,type)>=TT[type].max)return null;
 p.gold-=cost;const t={id:TID++,type,x,y,up:[0,0],cd:0,spent:cost,master:!!master,tgt:'first',born:p.now||0};p.grid[y][x]=t;p.towers.push(t);p.dist=bfs(p.grid);return t;}
// Linienbau (Ziehen): prüft Zellen in Reihenfolge kumulativ (Weg-Blockade, Gold, Max-Anzahl); ändert nichts
function planBuild(p,type,cells){const T=TT[type];if(!T)return{cells:[],cost:0,n:0};let gold=p.gold,cnt=typeCount(p,type),cost=0,n=0;const tmp=[],out=[];
 for(const[x,y]of cells){let ok=gold>=T.cost&&!(T.max&&cnt>=T.max)&&canPlace(p,x,y);if(ok){p.grid[y][x]={plan:1};p.dist=bfs(p.grid);tmp.push([x,y]);gold-=T.cost;cost+=T.cost;cnt++;n++;}out.push({x,y,ok});}
 for(const[x,y]of tmp)p.grid[y][x]=null;if(tmp.length)p.dist=bfs(p.grid);return{cells:out,cost,n};}
function buildMany(p,type,cells){let n=0;for(const[x,y]of cells)if(build(p,type,x,y))n++;return n;}
function canUp(t,path){if(t.master||t.up[path]>=TT[t.type].up[path].length)return false;return !(t.up[path]===2&&t.up[1-path]===3);}
function upCost(t,path){return TT[t.type].up[path][t.up[path]].cost;}
function upgrade(p,t,path){if(!canUp(t,path))return false;const c=upCost(t,path);if(p.gold<c)return false;p.gold-=c;t.upT=p.now||0;t.spent+=c;t.up[path]++;return true;}
function sell(p,t){if(t.master)return;p.gold+=Math.floor(t.spent*.75);p.grid[t.y][t.x]=null;p.towers.splice(p.towers.indexOf(t),1);p.dist=bfs(p.grid);}
function pickMaster(p,k){if(p.master)return false;p.master=k;return true;}
function placeMaster(p,x,y){if(!p.master||p.masterT)return null;const t=build(p,'master',x,y,true);if(t){p.masterT=t;p.mLvl=1;}return t;}
function mUp(p){if(!p.masterT||p.mLvl>=5)return false;const c=MT[p.master].cost[p.mLvl];if(p.gold<c)return false;p.gold-=c;p.mLvl++;return true;}
// ---- Minuten-Events (jede volle Minute, 5 s Ankündigung) ----
const EVT={rabatt:{n:'Sende-Rabatt',ico:'🏷',d:'Sendeeinheiten −30 % Kosten',dur:20},goldrausch:{n:'Goldrausch',ico:'💰',d:'Kill-Kopfgeld ×2, Goldmine ×2',dur:15},
 boost:{n:'Einkommens-Boost',ico:'📈',d:'Nächster Einkommens-Tick ×2',dur:0},blutmond:{n:'Blutmond',ico:'🩸',d:'Einheiten +25 % LP, +15 % Tempo, Lebensraub ×2, Kopfgeld +50 %',dur:30},
 frost:{n:'Frostzeit',ico:'❄',d:'Alle Einheiten −30 % Tempo',dur:12},turbo:{n:'Turbo',ico:'⏩',d:'Spieltempo ×1,5',dur:20}};
const evOn=(G,k)=>G.evt&&G.evt.k===k&&G.et<G.evt.end;
function stepEvents(G,rdt){G.et=(G.et||0)+rdt;const nextMin=(Math.floor(G.et/60)+1)*60;
 if(!G.nextEvt&&G.et>=nextMin-5){if(!G.bag||!G.bag.length){G.bag=Object.keys(EVT).sort(()=>Math.random()-.5);if(G.bag[0]===G.lastEvt)G.bag.push(G.bag.shift());}const k=G.bag.shift();G.nextEvt={k,at:nextMin};G.ev.push({k:'announce',e:k,pi:0});}
 if(G.nextEvt&&G.et>=G.nextEvt.at){const k=G.nextEvt.k;G.evt={k,start:G.et,end:G.et+EVT[k].dur};G.lastEvt=k;G.nextEvt=null;if(k==='boost')G.boostTick=true;G.ev.push({k:'evstart',e:k,pi:0});}}
function creepCost(G,ct){return evOn(G,'rabatt')?Math.ceil(ct.cost*.7):ct.cost;}
// ---- Goldmine (Design-Doc §5) ----
// Goldmine: Arbeiter tragen Gold aus dem Stollen zum Depot; bei Ankunft wird gutgeschrieben (kein Lager/Einsammeln)
// trip = Hin+Rück in s, y = Gold/s pro Arbeiter (Gold pro Lieferung = y*trip)
const MINE=[{cap:4,y:.5,trip:8},{cost:250,cap:6,y:.6,trip:7},{cost:500,cap:8,y:.7,trip:6}];
const workerCost=p=>40+15*p.mine.w;
function buyWorker(p){const m=p.mine,c=workerCost(p);if(m.w>=MINE[m.lvl].cap||p.gold<c)return false;p.gold-=c;m.w++;return true;}
function mineUp(p){const m=p.mine;if(m.lvl>=2)return false;const c=MINE[m.lvl+1].cost;if(p.gold<c)return false;p.gold-=c;m.lvl++;return true;}
function collect(p){return 0;}// veraltet: Gold kommt automatisch per Lieferung
function stepMine(G,p,dt){const m=p.mine,L=MINE[m.lvl],pi=G.p.indexOf(p);m.ph=m.ph||[];while(m.ph.length<m.w)m.ph.push(-m.ph.length/Math.max(1,m.w)*.5);// gestaffelt
 for(let i=0;i<m.w;i++){const a=m.ph[i];m.ph[i]+=dt/L.trip;if(a<.5&&m.ph[i]>=.5){const g=Math.max(1,Math.round(L.y*L.trip*(evOn(G,'goldrausch')?2:1)));p.gold+=g;G.ev.push({k:'minegold',pi,g});}if(m.ph[i]>=1)m.ph[i]-=1;}}
function sendTarget(G,from){const N=G.p.length,p=G.p[from],t=p.sendTo;if(Number.isInteger(t)&&t!==from&&G.p[t]&&!G.p[t].dead)return t;for(let k=1;k<N;k++){const i=(from+k)%N;if(!G.p[i].dead)return i;}return(from+1)%N;}
function sendCreep(G,from,id){const ct=CT.find(c=>c.id===id)||CT[0],p=G.p[from],o=G.p[sendTarget(G,from)];const cost=creepCost(G,ct);if(!ct||p.gold<cost||G.t<ct.unlock||!ctAvail(p,ct)||sendCd(G,p,ct)>0)return false;if(ct.cd)(p.sendCd=p.sendCd||{})[ct.id]=G.t+ct.cd;
 p.gold-=cost;const ig=incGain(p,ct);p.income+=ig;p.lastInc=ig;const sc=ECO.hpMul*(1+p.income/ECO.incHp)*(1+Math.pow(Math.max(0,G.t-ECO.sdStart)/ECO.sdLen,2))*(evOn(G,'blutmond')?1.25:1);
 (o.inLog=o.inLog||[]).push([G.t,ct.hp*sc]);(p.sendLog=p.sendLog||[]).push([G.t,ct.cost]);o.creeps.push({id:(G.cid=(G.cid||0)+1),ct,owner:from,bounty:ig,x:SPAWN.x+.5+(Math.random()-.5)*.3,y:.5,hp:ct.hp*sc,max:ct.hp*sc,fly:ct.fly,camo:ct.camo,armor:ct.armor,slow:0,slowT:0,dot:0,dotT:0,dotAp:0});return ig;}
function newGame(n){const G={diff:1,et:0,evt:null,nextEvt:null,p:Array.from({length:Math.max(2,Math.min(4,n||2))},(_,i)=>mkPlayer(i?1:0)),t:0,tick:TICK,fx:[],ev:[],over:null};for(const p of G.p)p.dist=bfs(p.grid);return G;}
const cdist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function remaining(p,c){if(c.fly)return ROWS-c.y;const y=Math.min(ROWS-1,Math.floor(c.y));return p.dist[y][Math.floor(c.x)]+(c.y%1);}
function canSee(s,c){return(!c.camo||s.camo)&&(!c.fly||!s.ground||s.air)&&(!s.airOnly||c.fly);}
// Schadensmodell: Rüstung reduziert phys 60%, magisch 30%, Gift ignoriert Rüstung; ap ignoriert Rüstung
function dmgMul(dt,ap,c){if(!c.armor||ap||dt==='poison')return 1;return dt==='phys'?.4:.7;}
function hurt(G,pi,c,d,dt,ap){if(c.hp<=0)return 0;if(c.ampT>G.t)d*=1+c.amp;const r=d*dmgMul(dt,ap,c);c.hp-=r;c.hitT=G.t;
 if(G.fx.length<300&&r>=1)G.fx.push({k:'txt',pi,x:c.x+(Math.random()-.5)*.4,y:c.y-.3,t:.7,txt:Math.round(r),c:dmgMul(dt,ap,c)<1?'#aaa':'#fff'});return r;}
function stepCreep(G,p,c,dt){
 if(c.slowT>0){c.slowT-=dt;if(c.slowT<=0)c.slow=0;}
 if(c.dotT>0){c.dotT-=dt;c.hp-=c.dot*dt*(c.ampT>G.t?1+c.amp:1);}
 if(c.frzT>0){c.frzT-=dt;return false;}
 if(c.ct.heal)for(const o of p.creeps)if(cdist(o,c)<1.5&&o.hp<o.max&&o.hp>0)o.hp=Math.min(o.max,o.hp+o.max*.025*dt);
 if(c.ct.slowImm&&c.slow<c.ct.slowImm)c.slow=0;
 if(c.ct.morph){const f=Math.floor(G.t/4)%2===1;if(f!==!!c.fly){c.fly=f?1:0;if(!f){c.x=Math.max(.5,Math.min(COLS-.5,c.x));const cx0=Math.floor(c.x),cy0=Math.min(ROWS-1,Math.floor(c.y));if(p.grid[cy0][cx0]){c.fly=1;}}}}
 if(c.ct.sabo&&!c.saboDone){const ts=p.towers.filter(t=>!TT[t.type].wall&&!TT[t.type]?.b?.noAtk&&Math.hypot(t.x+.5-c.x,t.y+.5-c.y)<=2);if(ts.length){const t=ts.reduce((a,b)=>tStats(b,1).dmg>tStats(a,1).dmg?b:a);t.offT=G.t+4;c.saboDone=1;G.fx.push({k:'txt',pi:G.p.indexOf(p),x:t.x+.5,y:t.y,t:1.2,txt:'⚙ lahm!',c:'#ff8080'});}}
 const sp=c.ct.sp*(1-c.slow)*(c.ct.berserk&&c.hp<c.max*.5?2:1)*(G.spd||1)*dt;
 if(c.fly){c.y+=sp;c.x+=(SPAWN.x+.5-c.x)*dt;}
 else{const cx=Math.floor(c.x),cy=Math.min(ROWS-1,Math.floor(c.y)),d=p.dist;let tx=cx+.5,ty=cy+.5;
  if(cy===ROWS-1&&d[cy][cx]===0)ty=ROWS+1;else{let best=d[cy][cx],bx=cx,by=cy;
   for(const[dx,dy]of[[0,1],[1,0],[-1,0],[0,-1]]){const nx=cx+dx,ny=cy+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(d[ny][nx]<best){best=d[ny][nx];bx=nx;by=ny;}}
   const atC=Math.abs(c.x-tx)<.08&&Math.abs(c.y-ty)<.08;if(atC||(bx!==cx&&Math.abs(c.y-ty)<.08)||(by!==cy&&Math.abs(c.x-tx)<.08)){tx=bx+.5;ty=by+.5;}}
  const dx=tx-c.x,dy=ty-c.y,l=Math.hypot(dx,dy);if(l>1e-6){const m=Math.min(sp,l);c.x+=dx/l*m;c.y+=dy/l*m;}}
 return c.y>=ROWS;}
function pickTarget(p,t,s,ctr){let best=null,bv=Infinity;
 for(const c of p.creeps){if(c.hp<=0||!canSee(s,c)||cdist(c,ctr)>s.rng)continue;
  const v=t.tgt==='first'?remaining(p,c):t.tgt==='last'?-remaining(p,c):t.tgt==='strong'?-c.hp:cdist(c,ctr);if(v<bv){bv=v;best=c;}}return best;}
function applyHit(G,pi,p,s,c){let d=s.dmg;if(c.fly&&s.airMul)d*=1+s.airMul;if(c.camo&&s.camoMul)d*=1+s.camoMul;
 let crit=s.crit&&Math.random()<s.crit;if(crit){d*=3;G.fx.push({k:'txt',pi,x:c.x,y:c.y-.6,t:.8,txt:'KRIT!',c:'#c0a0ff'});}
 if(s.amp){c.amp=Math.max(c.amp||0,s.amp);c.ampT=G.t+4;}
 hurt(G,pi,c,d,s.dt,s.ap);if(s.killGold)c.kg=Math.max(c.kg||0,Math.round(s.killGold));if(s.spread)c.spread=s.spread;if(s.dot)c.burnD=s.dot;
 if(crit&&s.freezeDur||s.freeze&&Math.random()<s.freeze){if(c.ct.boss){c.slow=Math.max(c.slow,.5);c.slowT=Math.max(c.slowT||0,1);}else c.frzT=Math.max(c.frzT||0,s.freezeDur||.5);}
 if(s.slow){c.slow=Math.max(c.slow,s.slow);c.slowT=Math.max(c.slowT,s.slowDur);}
 if(s.dot){c.dot=Math.max(c.dot,s.dot*dmgMul('poison',1,c));c.dotT=s.dotDur;}}
function fire(G,pi,p,t,dt){const ctr={x:t.x+.5,y:t.y+.5};t.cd-=dt;if(t.cd>0)return;
 if(t.master){const s=mStats(p.master,p.mLvl);if(p.master==='goldmeister')return;
  if(p.master==='blitzmeister'){const tg=p.creeps.filter(c=>c.hp>0&&(!c.camo||s.camo)&&cdist(c,ctr)<=s.rng).slice(0,s.targets);if(!tg.length)return;t.cd=s.rate;
   G.ev.push({k:'shot',ty:'blitz',pi});let prev=ctr;for(const c of tg){hurt(G,pi,c,s.dmg,'magic',1);G.fx.push({k:'bolt',pi,a:prev,b:{x:c.x,y:c.y},t:.25,c:'#e0c0ff',w:3});prev=c;}}
  else{if(!p.creeps.length)return;t.cd=s.rate;for(const c of p.creeps){hurt(G,pi,c,s.dmg,'magic',1);c.slow=Math.max(c.slow,s.slow);c.slowT=Math.max(c.slowT,s.dur);}G.fx.push({k:'pulse',pi,t:.6});G.ev.push({k:'pulse',pi});}
  return;}
 if(TT[t.type].wall||TT[t.type]?.b?.noAtk||(t.offT||0)>G.t)return;const s=tStats(t),tg=pickTarget(p,t,s,ctr);if(!tg)return;t.cd=s.rate;G.ev.push({k:'shot',ty:t.type,pi});t.ang=Math.atan2(tg.y-ctr.y,tg.x-ctr.x);
 const isEl=t.type==='element'||!!TT[t.type].gen;
 if(t.type==='blitz'||isEl&&s.chain){let prev=ctr,hit=[tg],cur=tg;for(let i=1;i<s.chain;i++){const n=p.creeps.find(c=>c.hp>0&&!hit.includes(c)&&canSee(s,c)&&cdist(c,cur)<2.3);if(!n)break;hit.push(n);cur=n;}
  hit.forEach((c,i)=>{if(isEl)applyHit(G,pi,p,{...s,dmg:s.dmg*Math.pow(.8,i)},c);else hurt(G,pi,c,s.dmg*Math.pow(.85,i),'magic',s.ap);G.fx.push({k:'bolt',pi,a:prev,b:{x:c.x,y:c.y},t:.15,c:s.el?s.el.c:TT[t.type].c,w:2,ty:t.type});prev=c;});return;}
 if(isEl&&s.multi>1){const more=p.creeps.filter(c=>c!==tg&&c.hp>0&&canSee(s,c)&&cdist(c,ctr)<=s.rng).slice(0,s.multi-1);for(const c of more)p.proj.push({x:ctr.x,y:ctr.y,ox:ctr.x,oy:ctr.y,tg:c,tx:c.x,ty:c.y,s,c:s.el?s.el.c:TT[t.type].c,type:t.type});}
 p.proj.push({x:ctr.x,y:ctr.y,ox:ctr.x,oy:ctr.y,tg,tx:tg.x,ty:tg.y,s,c:s.el?s.el.c:TT[t.type].c,type:t.type});}
function stepProj(G,pi,p,dt){for(let i=p.proj.length-1;i>=0;i--){const pr=p.proj[i],alive=pr.tg.hp>0&&p.creeps.includes(pr.tg);
 if(alive){pr.tx=pr.tg.x;pr.ty=pr.tg.y;}const dx=pr.tx-pr.x,dy=pr.ty-pr.y,l=Math.hypot(dx,dy),m=pr.s.spd*dt;
 if(l>m){pr.x+=dx/l*m;pr.y+=dy/l*m;continue;}
 p.proj.splice(i,1);const s=pr.s,pt={x:pr.tx,y:pr.ty};G.ev.push({k:s.splash&&pr.type==='kanone'?'boom':'hit',pi});
 if(s.splash){for(const c of p.creeps)if(c.hp>0&&cdist(c,pt)<=s.splash&&(!c.fly||!s.ground||s.air))applyHit(G,pi,p,s,c);G.fx.push({k:'boom',pi,x:pt.x,y:pt.y,r:s.splash,t:.3,c:pr.c});}
 else if(alive){applyHit(G,pi,p,s,pr.tg);let n=s.pierce-1;for(const c of p.creeps){if(n<=0)break;if(c!==pr.tg&&c.hp>0&&canSee(s,c)&&cdist(c,pt)<1.2){applyHit(G,pi,p,s,c);n--;}}
  G.fx.push({k:'spark',pi,x:pt.x,y:pt.y,t:.15,c:pr.c});}}}
function step(G,dt){if(G.over)return;for(const p of G.p)p.now=G.t;if(G.ev.length>200)G.ev.length=0;stepEvents(G,dt);if(evOn(G,'turbo'))dt*=1.5;G.spd=evOn(G,'blutmond')?1.15:evOn(G,'frost')?.7:1;G.t+=dt;G.tick-=dt;
 for(const p of G.p)stepMine(G,p,dt);
 if(G.tick<=0){G.tick+=TICK;G.ev.push({k:'tick',pi:0});const bm=G.boostTick?2:1;G.boostTick=false;for(const p of G.p)p.gold+=(p.income+(p.master==='goldmeister'?mStats('goldmeister',p.mLvl).inc:0))*bm;}
 G.p.forEach((p,pi)=>{if(p.dead)return;stepAuras(p,G);stepHero(G,pi,p,dt);let gps=0;for(const t of p.towers){if((t.type==='element'&&t.el?.length)||TT[t.type]?.b?.gps){const es=tStats(t,1);if(es.gps)gps+=es.gps;}}p.gold+=gps*dt;for(const t of p.towers)fire(G,pi,p,t,dt);stepProj(G,pi,p,dt);
  for(let i=p.creeps.length-1;i>=0;i--){const c=p.creeps[i];
   if(c.hp<=0){let g=c.bounty||incGain(p,c.ct);if(evOn(G,'goldrausch'))g*=2;if(evOn(G,'blutmond'))g=Math.ceil(g*1.5);if(p.master==='goldmeister')g=Math.ceil(g*(1+mStats('goldmeister',p.mLvl).kill));g+=c.kg||0;if(RACE[p.race]?.xform){p.chain=G.t-(p.chainT??-9)<=1.5?Math.min(5,(p.chain||0)+1):1;p.chainT=G.t;if(p.chain>1)g=Math.ceil(g*(1+.05*(p.chain-1)));}heroXp(p,2+3*(c.bounty||1));if(c.ct.spawn&&!c.child)for(let k=0;k<c.ct.spawn;k++)p.creeps.push({id:(G.cid=(G.cid||0)+1),ct:CT[0],child:1,owner:c.owner,bounty:0,x:c.x+(Math.random()-.5)*.4,y:c.y,hp:c.max*.13,max:c.max*.13,fly:0,camo:0,armor:0,slow:0,slowT:0,dot:0,dotT:0});{const def=G.p[c.owner??1-pi].lives-p.lives;if(def>4)g=Math.ceil(g*(1+Math.min(.6,def*.05)));}p.gold+=g;p.creeps.splice(i,1);
    if(c.spread){p.creeps.filter(o=>o.hp>0&&o!==c).sort((a,b)=>cdist(a,c)-cdist(b,c)).slice(0,c.spread).forEach(o=>{o.dot=Math.max(o.dot||0,c.burnD||8);o.dotT=3;});}
    G.fx.push({k:'coin',pi,x:c.x,y:c.y,t:.9,txt:'+'+g});const xf=!!RACE[p.race]?.xform,ch=xf?p.chain:0;
    if(xf){// Verwandeln statt Töten: Angst wird zu Licht (kein Tod), Kette steigert Tonhöhe/Lichtgröße/Gold
     G.fx.push({k:'burst',pi,x:c.x,y:c.y,r:.6+.15*ch,t:.5,c:'#FFF6E0'});G.ev.push({k:'transform',pi,x:c.x,y:c.y,g,chain:ch});if(ch>=5&&!p.stormOn){p.stormOn=1;G.ev.push({k:'lichtsturm',pi});G.fx.push({k:'pulse',pi,t:.6,c:'gold'});}if(ch<5)p.stormOn=0;
     for(let j=0;j<7+2*ch;j++){const a=Math.random()*7,v=1+Math.random()*2;G.fx.push({k:'part',pi,x:c.x,y:c.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-1.2,t:.6,c:j%2?'#F2B233':'#FFF6E0'});}}
    else{G.ev.push({k:'kill',pi,x:c.x,y:c.y,g});for(let j=0;j<7;j++){const a=Math.random()*7,v=1+Math.random()*2;G.fx.push({k:'part',pi,x:c.x,y:c.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.4,c:c.ct.c});}}continue;}
   if(stepCreep(G,p,c,dt)){p.creeps.splice(i,1);const X=(c.ct.L??(c.ct.boss?5:1))*(evOn(G,'blutmond')?2:1),ow=c.owner??1-pi;if(c.ct.thief){const st=Math.min(60,Math.floor(p.gold*.1));p.gold-=st;G.p[ow].gold+=st;G.fx.push({k:'steal',pi:ow,t:1.2,txt:'+'+st+' 💰 Dieb',x:5.5,y:ROWS-1.5});G.ev.push({k:'thief',pi:ow,g:st});}p.lives-=X;if(!G.p[ow].dead){const S=G.p[ow],gain=S.lives-p.lives>12?0:Math.max(0,Math.min(X,40-S.lives));S.lives+=gain;}if(G.firstSteal==null){G.firstSteal=G.t;G.fsBy=ow;}G.p[ow].stolen=(G.p[ow].stolen||0)+X;(p.leakLog=p.leakLog||[]).push(G.t);G.fx.push({k:'leak',pi,t:.4});G.fx.push({k:'steal',pi:ow,t:1.2,txt:'+'+X+' ❤',x:5.5,y:ROWS-1.5});G.ev.push({k:'leak',pi,n:X});G.ev.push({k:'steal',pi:ow,n:X});}}});
 for(const f of G.fx){f.t-=dt;if(f.k==='part'){f.x+=f.vx*dt;f.y+=f.vy*dt;}if(f.k==='txt'||f.k==='coin')f.y-=dt*.8;}
 G.fx=G.fx.filter(f=>f.t>0);
 G.p.forEach((p,pi)=>{if(!p.ai||p.dead)return;p.aiT=(p.aiT||0)-dt;if(p.aiT<=0)aiThink(G,pi);});
 if(G.p.length===2){if(G.p[0].lives<=0)G.over='lose';else if(G.p[1].lives<=0)G.over='win';if(G.over)G.winner=G.over==='win'?0:1;}
 else{for(const [i,p] of G.p.entries())if(!p.dead&&p.lives<=0){p.dead=1;p.lives=0;p.creeps=[];p.proj=[];p.place=G.p.filter(q=>!q.dead).length+1;G.ev.push({k:'elim',pi:i});}
  const al=G.p.filter(p=>!p.dead);if(al.length<=1){G.winner=al.length?G.p.indexOf(al[0]):0;G.over=G.winner===0?'win':'lose';}}}
const AIMIX=['pfeil','pfeil','frost','kanone','gift','blitz'];
// Verteidigungsstärke grob schätzen (Schaden/s, Anteile Luftabwehr/Tarnung/phys.)
function defEval(p){let dps=0,air=0,camo=0,phys=0;
 for(const t of p.towers){if(t.master){if(p.master==='blitzmeister'){const m=mStats('blitzmeister',p.mLvl);dps+=m.dmg*m.targets/m.rate*.5;air+=m.dmg/m.rate;}else if(p.master==='frostmeister')dps*=1.1;continue;}
  if(TT[t.type].wall)continue;const s=tStats(t);let d=s.dmg/s.rate*(s.splash?1.8:1)*(s.chain?1+(s.chain-1)*.5:1)+s.dot*1.2+s.slow*4;
  dps+=d;if(!s.ground||s.air)air+=d;if(s.camo)camo+=d;if(s.dt==='phys')phys+=d;}
 const pathF=Math.max(1,Math.min(4,(p.dist[SPAWN.y][SPAWN.x]||ROWS)/ROWS));
 return{dps,power:dps*pathF,air:dps?air/dps:0,camo:dps?camo/dps:0,phys:dps?phys/dps:0};}
const recent=(log,t,w)=>(log||[]).filter(e=>(e[0]??e)>t-w);
// KI: Runen am Schrein kaufen und in Element-Türme setzen (Konter: Luft vs Flieger, Licht vs Tarnung, sonst Kombos)
function aiRunes(G,p,danger,needAir,needCamo){const R=Math.random;if(R()>(danger?.6:.35))return;
 const ts=p.towers.filter(t=>t.type==='element');if(!ts.length)return;const t=ts.reduce((a,b)=>((a.el||[]).length+a.up[0]<=(b.el||[]).length+b.up[0]?a:b));const el=t.el||[];let e=null;p.runes=p.runes||{};const own=Object.keys(p.runes).filter(k=>p.runes[k]>0),want=needAir?'luft':needCamo?'licht':null;if(want&&!own.includes(want)&&own.length>=RUNE_MAX&&p.gold>=RUNE_COST+5){dropRune(p,own[0]);own.shift();}
 if(want&&(own.includes(want)||own.length<RUNE_MAX)&&(!el.length||el[0].e!==want))e=want;
 else if(!el.length)e=own.length&&(own.length>=RUNE_MAX||R()<.5)?own[Math.floor(R()*own.length)]:['feuer','erde','blitz','eis','wasser','schatten'].filter(k=>!own.includes(k))[Math.floor(R()*5)];
 if(el.length&&canUp(t,0)&&p.gold>=upCost(t,0)+15&&R()<.5){upgrade(p,t,0);return;}if(!e)return;
 p.runes=p.runes||{};const need=(p.runes[e]?0:RUNE_COST);if(!(p.runes[e]>0)&&p.gold<need+5)return;if(!(p.runes[e]>0)&&!buyRune(p,e))return;const c=canSlot(p,t,e);if(c)slotRune(p,t,e);}
// KI-Platzierung: Schadenstürme dorthin, wo sie die meisten Pfadzellen abdecken (Kurven/U-Turns, mittleres/spätes Labyrinth).
// Kandidaten = vorhandene Mauern (werden ersetzt) + geplante Mauerzellen -> Labyrinth bleibt intakt. Splash bevorzugt Kurven, Slow früh im Pfad.
function spotScore(p,ty,x,y,path,turn){const r=ty==='element'?3:TT[ty].b.rng||2.5,L=path.length||1,slow=ty==='frost',splash=ty==='kanone';let sc=0;
 path.forEach(([px,py],i)=>{if(Math.hypot(px-x,py-y)>r)return;let w=1;if(turn[i])w+=splash?1.5:.4;const f=i/L;w*=slow?1.3-.7*f:.7+.6*Math.min(1,f*1.6);sc+=w;});
 for(const t of p.towers)if(!TT[t.type].wall&&Math.hypot(t.x-x,t.y-y)<1.5)sc*=.85;return sc;}
function plannedPath(p){// Pfad im fertigen Labyrinth (alle geplanten Mauern gesetzt), gecacht pro Planlänge
 const k=(p.plan||[]).length+'|'+p.towers.length;if(p._ppK===k)return p._pp;const grid=p.grid.map(r=>r.slice());for(const[x,y]of p.plan||[])if(!grid[y][x]){grid[y][x]={plan:1};if(bfs(grid)[SPAWN.y][SPAWN.x]===Infinity)grid[y][x]=null;}
 const q={grid,dist:bfs(grid)};p._ppK=k;p._pp=tracePath(q);return p._pp;}
function aiPlaceDmg(p,ty){const cur=tracePath(p),fin=plannedPath(p);
 const mk=path=>({path,turn:path.map((c,i)=>i>0&&i<path.length-1&&(path[i-1][0]-c[0])!==(c[0]-path[i+1][0]))});const A=mk(cur),B=mk(fin);
 const spotScore2=(x,y)=>spotScore(p,ty,x,y,A.path,A.turn)*(p.plan&&p.plan.length?.8:0)+spotScore(p,ty,x,y,B.path,B.turn);const path=cur;
 const cand=[];for(const t of p.towers)if(t.type==='mauer')cand.push([t.x,t.y,t]);const nD=p.towers.filter(t=>!TT[t.type].wall).length,early=nD<8&&p.plan&&p.plan.length;let gain=null;
 if(early){// Frühphase: nur Zellen des geplanten Schlangen-Labyrinths, gewichtet nach Weglängen-Zuwachs
  const L0=p.dist[SPAWN.y][SPAWN.x];gain={};for(const[x,y]of p.plan){if(p.grid[y][x]||!canPlace(p,x,y))continue;p.grid[y][x]={tmp:1};const L=bfs(p.grid)[SPAWN.y][SPAWN.x];p.grid[y][x]=null;if(L===Infinity)continue;gain[x+','+y]=L-L0;cand.push([x,y,null]);}}
 else for(const[x,y]of(p.plan||[]).slice(0,30))if(!p.grid[y][x]&&canPlace(p,x,y))cand.push([x,y,null]);
 if(!cand.length)for(let y=1;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!p.grid[y][x]&&canPlace(p,x,y)&&path.some(([px,py])=>Math.abs(px-x)+Math.abs(py-y)===1))cand.push([x,y,null]);
 let best=null,bs=-1;for(const c of cand){const v=gain&&!c[2]?(gain[c[0]+','+c[1]]*10+spotScore2(c[0],c[1])+(ROWS-c[1])*.3+(path.some(([px,py])=>px===c[0]&&py===c[1])?8:path.some(([px,py])=>Math.abs(px-c[0])+Math.abs(py-c[1])<=1)?3:0)+((p.grid[c[1]]?.[c[0]-1]||p.grid[c[1]]?.[c[0]+1])?5:0)):spotScore2(c[0],c[1]);if(v>bs){bs=v;best=c;}}if(!best||bs<=0)return null;
 const[x,y,w]=best;if(w)sell(p,w);const t=build(p,ty,x,y);if(!t&&w)build(p,'mauer',x,y);if(t&&p.plan){const i=p.plan.findIndex(q=>q[0]===x&&q[1]===y);if(i>=0)p.plan.splice(i,1);}return t;}
// KI-Rassen-Mischung: Angriffstürme gewichtet nach Rolle (DMG häufig, Aura/Eco selten)
function raceMix(rk){const out=[];for(const k of raceTowers(rk)){const T=TT[k],w=T.role==='DMG'?3:T.role==='SLOW'?2:T.role==='AA'?1:1;for(let i=0;i<w;i++)out.push(k);}return out;}
const raceRole=(rk,role)=>raceTowers(rk).find(k=>TT[k].role===role);
// KI-Held: Fähigkeiten bei Bedarf, Position mit bester Pfadabdeckung
function aiHero(G,pi,p){const h=p.hero;if(!h)return;const n=p.creeps.length;
 h.ab.forEach((k,i)=>{if(h.cd[i]>G.t)return;const eco=k==='goldregen'||k==='seelenernte'&&n>=4,buff=(k==='kriegsschrei'||k==='mondlicht'||k==='amboss')&&n>=5,hit=!['goldregen','seelenernte','kriegsschrei','mondlicht','amboss'].includes(k)&&(n>=4||p.creeps.some(c=>c.y>ROWS*.6));if(eco||buff||hit)heroAbility(G,pi,i);});
 if(G.t>=(p.heroPosT||0)){p.heroPosT=G.t+45;const path=tracePath(p);let best=null,bs=-1;for(let y=4;y<ROWS-1;y++)for(let x=0;x<COLS;x++){const sc=path.filter(([px,py])=>Math.hypot(px-x,py-y)<=2.6).length+(y/ROWS);if(sc>bs){bs=sc;best=[x,y];}}if(best)heroMove(p,best[0],best[1]);}}
function aiThink(G,pi){const p=G.p[pi],o=G.p[G.p.length===2?1-pi:sendTarget(G,pi)],R=Math.random;if(!p.race&&!p.noRace)pickRace(p,p.racePref||PLAYABLE()[Math.floor(R()*PLAYABLE().length)]);if((G.diff??1)===0&&G.t<28)return;const mix=p.race?raceMix(p.race):p.mix||AIMIX;aiHero(G,pi,p);
 p.pers=p.pers||{burst:R(),greed:.45+R()*.4,caution:.8+R()*.5,tilt:R()};const P=p.pers;
 // Schlangen-Labyrinth: Wandreihen jede 2. Zeile mit wechselnder Lücke -> maximale Weglänge
 if(!p.plan){p.plan=[];for(let r=2;r<ROWS-1;r+=2){const gap=(r/2)%2?COLS-1:0;for(let x=0;x<COLS;x++)if(x!==gap)p.plan.push([x,r]);}}
 // --- Lage bewerten ---
 const E=defEval(p),laneHP=p.creeps.reduce((a,c)=>a+c.hp,0),inRate=recent(p.inLog,G.t,40).reduce((a,e)=>a+e[1],0)/40,
  leaks=recent(p.leakLog,G.t,30).length,oInc=o.income;
 const need=(inRate*1.1+laneHP/12+oInc*.6+4)*(1+.35*leaks)*P.caution,ratio=E.power/need;
 const deep=p.creeps.some(c=>c.y>ROWS*.6&&c.hp>c.max*.4),danger=ratio<(G.t<150?1.5:1.1)||deep||leaks>0&&ratio<1.5,camoThreat=p.creeps.some(c=>c.camo)||G.t>=CT.find(c=>c.camo).unlock-10,airThreat=p.creeps.some(c=>c.fly)||G.t>=CT.find(c=>c.fly).unlock-10;
 p.mode=danger?'def':'eco';
 // lernt aus Leaks: wird vorsichtiger
 const nl=(p.leakLog||[]).length;if(nl>(p.seenL||0)){P.caution=Math.min(2.2,P.caution*(1+.06*(nl-(p.seenL||0))));p.seenL=nl;}
 // --- Verteidigung: in Gefahr fast alles, sonst nur kleiner Anteil ---
 const g0=p.gold;const ecoDef=G.t>=(p.defT||0);if(ecoDef&&!danger)p.defT=G.t+5+R()*6;
 let budget=danger?p.gold*(ratio<.5||leaks?1:.75):ecoDef?p.gold*(ratio>2.5?.15:.35):0;const spend=c=>{budget-=c;};
 // gezielte Konter
 if(camoThreat&&E.camo<.15&&budget>20){const t=p.towers.find(t=>!t.master&&CAMO[t.type]&&t.up[CAMO[t.type][0]]<CAMO[t.type][1]&&canUp(t,CAMO[t.type][0]));
  if(t){const c=upCost(t,CAMO[t.type][0]);if(c<=budget&&upgrade(p,t,CAMO[t.type][0]))spend(c);}}
 const basic=p.race?raceTowers(p.race)[0]:'pfeil',slowT=p.race?(raceRole(p.race,'SLOW')||raceTowers(p.race)[1]):'frost';
 const pickTy=()=>{let ty=G.t<60?((p.ept=(p.ept||0)+1)%4===0?slowT:basic):mix[Math.floor(R()*mix.length)];if(G.t>=90&&typeCount(p,'element')<Math.min(ELEM_MAX_T,1+Math.floor(G.t/150))&&R()<.4)ty='element';if(airThreat&&E.air<.5&&(ty==='kanone'||TT[ty].b.ground))ty=(p.race&&raceRole(p.race,'AA'))||mix.find(x=>!TT[x].b.ground)||'pfeil';if(camoThreat&&E.camo<.15&&p.race&&raceRole(p.race,'CAMO')&&R()<.5)ty=raceRole(p.race,'CAMO');if(TT[ty].max&&typeCount(p,ty)>=TT[ty].max)ty=basic;
  if(danger&&TT[ty].cost>Math.min(budget,p.gold)){const ch=Object.keys(TT).filter(k=>!TT[k].wall&&TT[k].cost<=Math.min(budget,p.gold)&&(k!=='kanone'||!airThreat));if(ch.length)ty=ch[Math.floor(R()*ch.length)];}return ty;};
 // Gratis-Mauern sofort setzen (Labyrinth zuerst), unabhängig vom Budget
 // Menschliches Tempo: höchstens 1 Bau pro ~1,2-2 s (Gefahr: schneller), gleiche Regeln/Kosten wie Spieler
 const paceOk=()=>G.t>=(p.bT||0),paced=()=>{p.bT=G.t+(danger?.5:1.2)+R()*.8;};
 if(paceOk()){let k=4;while(p.plan.length&&k-->0){const[x,y,fty]=p.plan[0];if(p.grid[y][x]||!canPlace(p,x,y)){p.plan.shift();continue;}const ty=fty||'mauer';if(ty==='mauer'&&wallCount(p)>=TT.mauer.max)break;if(p.gold<TT[ty].cost)break;if(build(p,ty,x,y)){p.plan.shift();paced();}break;}}
 {const nd=p.towers.filter(t=>!TT[t.type].wall).length;if(G.t>3&&(nd<3||G.t<45&&nd<8||G.t<120&&leaks>0))budget=Math.max(budget,p.gold);}let guard=20;
 const paceD=()=>G.t>=(p.bTd||0);for(let gb=p.gold+p.towers.length*1e6;budget>=5&&guard--&&paceD();gb!==p.gold+p.towers.length*1e6&&(p.bTd=G.t+(G.t<45?.7:danger?.6:1.4)+R()*.4,gb=p.gold+p.towers.length*1e6)){
  if(p.plan.length){const[x,y]=p.plan[0];if(p.grid[y][x]||!canPlace(p,x,y)){p.plan.shift();continue;}
   const nDmg=p.towers.filter(t=>!TT[t.type].wall).length,early=G.t>3&&(nDmg<3||G.t<45&&nDmg<8);
   let ty=early||(danger&&E.dps<need*1.2)||(p.nb=(p.nb||0)+1)%3===0?pickTy():'mauer';if(ty==='mauer'&&wallCount(p)>=TT.mauer.max)ty=pickTy();if(p.gold<TT[ty].cost||budget<TT[ty].cost)break;
   if(ty==='mauer'){build(p,ty,x,y);p.plan.shift();continue;}if(aiPlaceDmg(p,ty))spend(TT[ty].cost);else break;continue;}
  if(R()<.6){const ty=pickTy(),c=TT[ty].cost;if(c>budget||p.gold<c)break;if(aiPlaceDmg(p,ty))spend(c);else break;continue;}
  const walls=[];
  if(walls.length&&R()<.6){const cov=w=>{let n=0;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const y=w.y+dy,x=w.x+dx;if(y>=0&&y<ROWS&&x>=0&&x<COLS&&p.dist[y][x]<Infinity)n+=1+(p.dist[y][x]>p.dist[SPAWN.y][SPAWN.x]*.5?.2:0);}return n;};const w=walls.reduce((b,x)=>cov(x)>cov(b)?x:b,walls[0]),ty=pickTy(),c=TT[ty].cost;if(c>budget||p.gold<c)break;const x=w.x,y=w.y;sell(p,w);if(build(p,ty,x,y))spend(c);else build(p,'mauer',x,y);continue;}
  const ts=p.towers.filter(t=>!t.master&&!TT[t.type].wall);if(!ts.length)break;const t=ts[Math.floor(R()*ts.length)];let pa=R()<.5?0:1;if(!canUp(t,pa))pa=1-pa;if(!canUp(t,pa))continue;
  const c=upCost(t,pa);if(c>budget)break;upgrade(p,t,pa);spend(c);}
 aiRunes(G,p,danger,airThreat&&E.air<.5,camoThreat&&E.camo<.15);
 if(p.masterT&&p.mLvl<5){const c=MT[p.master].cost[p.mLvl];if(p.gold>c&&(danger?R()<.5:R()<.15+(p.master==='goldmeister'?.2:0)))mUp(p);}
 // --- Wirtschaft: Senden (Mischung aus Dauerdruck und gesparten Wellen) ---
 const ow=defEval(o),av=CT.filter(c=>G.t>=c.unlock&&ctAvail(p,c)&&sendCd(G,p,c)<=0);
 const weight=c=>{let w=.6+c.cost/40;if(c.fly)w*=1+3*(1-ow.air);if(c.camo)w*=ow.camo>.1?.3:4;if(c.armor)w*=.5+2.5*ow.phys;if(c.heal)w*=1+(o.creeps.length>4?1:0);if(c.thief)w*=o.gold>150?2:.3;if(c.sabo)w*=.8;if(c.raceUnit)w*=1.2;return w*(.7+R()*.6);};
 const choose=max=>{const ok=av.filter(c=>c.cost<=max);if(!ok.length)return null;let tot=0;const ws=ok.map(c=>tot+=weight(c));const r=R()*tot;return ok[ws.findIndex(v=>v>=r)];};
 let sendBudget=0;
 if(danger&&ratio>.35&&p.gold>40&&R()<.5)sendBudget=p.gold*.2;
 if(!danger||ratio>.7){
  if(p.burstT==null)p.burstT=(P.burst>.5?1:0)*p.income*(2.5+R()*4);
  if(p.burstT>0){if(p.gold>=p.burstT+5){sendBudget=p.gold*(.75+R()*.2);p.burstT=null;}else if(R()<.15*(1-P.burst))sendBudget=p.gold*.25;}
  else{sendBudget=p.gold*P.greed*(danger?.4:1)*(.6+R()*.4);p.burstT=R()<.25?null:0;}
  const D=[.5,.72,1.05][G.diff??1];sendBudget*=D;
  // frühe Phase entschärft: erst ab 50/45/30 s, in den ersten 3 min gedeckelt
  if(G.t<[60,50,30][G.diff??1])sendBudget=0;if(G.t<180)sendBudget=Math.min(sendBudget,p.gold*[.15,.22,.45][G.diff??1]);
  // Events: Rabatt angekündigt -> sparen, Rabatt/Blutmond aktiv -> kräftig senden
  if(G.nextEvt&&G.nextEvt.k==='rabatt')sendBudget=0;
  if((evOn(G,'rabatt')||evOn(G,'blutmond'))&&G.t>=180)sendBudget=Math.max(sendBudget,p.gold*.75*D);}
 // Goldmine
 if(!danger&&p.mine.w<MINE[p.mine.lvl].cap&&p.gold>workerCost(p)+25&&R()<.3+.2*(p.pers.tilt||0))buyWorker(p);
 else if(!danger&&p.mine.w>=MINE[p.mine.lvl].cap&&p.mine.lvl<2&&p.gold>MINE[p.mine.lvl+1].cost+80&&R()<.2)mineUp(p);
 // Komfortabler Vorsprung (Leicht/Normal): KI investiert eher in Abwehr/Mine statt den Gegner zu überrollen
 if((G.diff??1)<2&&p.lives-o.lives>6)sendBudget*=(G.diff??1)?.55:.35;
 // Dauerdruck: spätestens alle ~15-25 s mindestens eine Einheit senden
 if(G.t>=40&&G.t-(p.lastSend??0)>15+R()*10&&sendBudget<5){const c=choose(p.gold);if(c)sendBudget=creepCost(G,c);}
 let n=0;const maxN=G.t<180?[1,2,6][G.diff??1]:40;while(sendBudget>=5&&n++<maxN){const c=choose(Math.min(sendBudget,p.gold));if(!c||!sendCreep(G,pi,c.id))break;sendBudget-=creepCost(G,c);p.lastSend=G.t;}
 p.aiT=.8+R()*1.7;}
const CAMO={pfeil:[1,2],frost:[1,2],gift:[0,1],blitz:[1,2]};for(const k in TT)if(TT[k].gen&&!TT[k].b.camo&&!TT[k].b.noAtk)CAMO[k]=[1,2];
// ===== Schnittstelle Logik <-> Darstellung (2D-Canvas heute, 3D später) =====
// Metrik: Ø Pfadzellen in Reichweite pro Schadensturm
function pathCoverage(p){const path=tracePath(p),ts=p.towers.filter(t=>!TT[t.type].wall&&!t.master);if(!ts.length)return 0;return ts.reduce((a,t)=>{const r=tStats(t).rng;return a+path.filter(([x,y])=>Math.hypot(x-t.x,y-t.y)<=r).length;},0)/ts.length;}
function tracePath(p){const d=p.dist,out=[];let x=SPAWN.x,y=SPAWN.y;if(d[y][x]===Infinity)return out;out.push([x,y]);
 for(let i=0;i<COLS*ROWS&&d[y][x]>0;i++){let b=null;for(const[dx,dy]of[[0,1],[1,0],[-1,0],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=COLS||ny>=ROWS)continue;if(d[ny][nx]<d[y][x]&&(!b||d[ny][nx]<d[b[1]][b[0]]))b=[nx,ny];}if(!b)break;x=b[0];y=b[1];out.push([x,y]);}return out;}
function getSnapshot(G){return{t:G.t,over:G.over,tick:G.tick,cols:COLS,rows:ROWS,spawn:{...SPAWN},
 evt:G.evt&&G.et<G.evt.end?{k:G.evt.k,left:G.evt.end-G.et}:null,next:G.nextEvt?{k:G.nextEvt.k,in:G.nextEvt.at-G.et}:null,
 lanes:G.p.map((p,pi)=>({pi,race:p.race||null,hero:p.hero?{...p.hero,cd:p.hero.cd.map(c=>Math.max(0,c-G.t)),need:heroXpNeed(p.hero.lvl),rng:heroStats(p.hero).rng}:null,runes:{...(p.runes||{})},lives:p.lives,gold:p.gold,income:p.income,master:p.master,mLvl:p.mLvl,mode:p.mode,
  mine:{lvl:p.mine.lvl,w:p.mine.w,ph:(p.mine.ph||[]).slice(0,p.mine.w).map(v=>Math.max(0,v)),cap:MINE[p.mine.lvl].cap,per:Math.max(1,Math.round(MINE[p.mine.lvl].y*MINE[p.mine.lvl].trip)),gps:MINE[p.mine.lvl].y*p.mine.w},
  path:tracePath(p),
  towers:p.towers.map(t=>({id:t.id,type:t.type,vis:TT[t.type]?.vis||t.type,col:TT[t.type]?.race?RACE[TT[t.type].race].c2:null,race:TT[t.type]?.race||null,off:(t.offT||0)>G.t,x:t.x,y:t.y,up:[...t.up],lv:t.up[0]+t.up[1],master:t.master,ang:t.ang,born:t.born,upT:t.upT,tgt:t.tgt,wall:!!TT[t.type]?.wall,
   rng:t.master?(p.master==='blitzmeister'?mStats('blitzmeister',p.mLvl).rng:.5):tStats(t).rng,el:t.type==='element'&&elemDef(t)?(d=>({n:d.n,ico:d.ico,c:d.c,lv:d.lv,base:!!d.base,runes:t.el.map(r=>r.e)}))(elemDef(t)):null,buff:!!t.buff,camo:!t.master&&!TT[t.type]?.wall&&!!tStats(t).camo})),
  creeps:p.creeps.map(c=>({id:c.id,type:c.ct.id,raceUnit:!!c.ct.raceUnit,thief:!!c.ct.thief,sabo:!!c.ct.sabo,color:c.ct.c,x:c.x,y:c.y,hp:c.hp,max:c.max,fly:!!c.fly,camo:!!c.camo,armor:!!c.armor,boss:!!c.ct.boss,heal:!!c.ct.heal,slow:c.slow>0,dot:c.dotT>0,hitT:c.hitT||-9})),
  proj:p.proj.map(r=>({x:r.x,y:r.y,type:r.type,color:r.c,ox:r.ox,oy:r.oy,tx:r.tg?r.tg.x:r.tx,ty:r.tg?r.tg.y:r.ty})),
  fx:G.fx.filter(f=>f.pi===pi)}))};}
// Befehle eines Spielers (UI/3D/KI): {op:'build'|'upgrade'|'sell'|'send'|'target'|'collect'|'worker'|'mineUp'|'masterUp'|'pickMaster'|'placeMaster', ...}
function command(G,pi,c){const p=G.p[pi],T=c.id!=null?p.towers.find(t=>t.id===c.id):null;
 switch(c.op){case'sendTo':if(c.to===null||Number.isInteger(c.to)&&c.to!==pi&&c.to>=0&&c.to<G.p.length){p.sendTo=c.to;return true;}return false;case'build':return !!build(p,c.type,c.x,c.y);case'placeMaster':return !!placeMaster(p,c.x,c.y);case'pickMaster':return pickMaster(p,c.key);
  case'upgrade':return !!T&&upgrade(p,T,c.path);case'sell':if(!T||T.master)return false;sell(p,T);return true;case'target':if(!T||!TGT.includes(c.mode))return false;T.tgt=c.mode;return true;
  case'send':return sendCreep(G,pi,c.creep);case'collect':return collect(p);case'worker':return buyWorker(p);case'mineUp':return mineUp(p);case'pickRace':return pickRace(p,c.race);case'heroMove':return heroMove(p,c.x,c.y);case'heroAbility':return heroAbility(G,pi,c.i);case'buildMany':return buildMany(p,c.type,c.cells);case'buyRune':return buyRune(p,c.e);case'dropRune':return dropRune(p,c.e);case'slotRune':return slotRune(p,T,c.e);case'masterUp':return mUp(p);}return false;}
if(typeof module!=='undefined')module.exports={PLAYABLE,sendTarget,aiHero,raceMix,RACE,raceTowers,ABIL,SPECIAL,pickRace,heroAbility,heroMove,heroXpNeed,heroStats,ctAvail,sendCd,planBuild,buildMany,aiPlaceDmg,pathCoverage,ELEM,COMBO,RUNE_COST,RUNE_MAX,dropRune,activeEls,FUSE_COST,LVL_COST,buyRune,slotRune,canSlot,elemDef,comboKey,typeCount,getSnapshot,command,tracePath,EVT,evOn,MINE,buyWorker,mineUp,collect,workerCost,creepCost,ECO,incGain,defEval,aiThink,newGame,step,build,canPlace,sell,upgrade,canUp,tStats,sendCreep,pickMaster,placeMaster,mUp,bfs,pickTarget,dmgMul,COLS,ROWS,SPAWN,TT,CT};
