'use strict';
// Line Tower Wars – autoritativer PvP-Server (2–4 Spieler) (Node + ws)
const http=require('http'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const g=require('./game.js'),NET=require('./net.js');
const PORT=process.env.PORT||8080,SIM_DT=.05,SNAP_MS=100,PICK_S=+(process.env.PICK_S||20),RECONNECT_S=+(process.env.RECONNECT_S||30);
const SIM_SPEED=Math.max(1,Math.min(20,+(process.env.SIM_SPEED||1)));// nur für Tests
const RATE={per:20,burst:40,kick:150};// Befehle/s, Burst, Verstöße bis Kick

const server=http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
 res.end(JSON.stringify({ok:true,name:'ltw-server',rooms:rooms.size,matches:[...rooms.values()].filter(r=>r.G).length,queue:queue.length,players:sessions.size}));});
const wss=new WebSocketServer({server,perMessageDeflate:{threshold:512},maxPayload:16*1024});

const sessions=new Map(),rooms=new Map();
const ALPH='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const mkCode=()=>{let c;do{c=Array.from({length:5},()=>ALPH[crypto.randomInt(ALPH.length)]).join('');}while(rooms.has(c));return c;};
const send=(s,m)=>{if(s&&s.ws&&s.ws.readyState===1)s.ws.send(JSON.stringify(m));};

// ---------- Validierung ----------
const isInt=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const CTIDS=new Set(g.CT.map(c=>c.id)),ELEMS=new Set(Object.keys(g.ELEM));
function validate(G,pi,c){const p=G.p[pi];if(!c||typeof c!=='object'||typeof c.op!=='string')return'bad_cmd';
 const tower=()=>Number.isInteger(c.id)&&p.towers.some(t=>t.id===c.id);
 const okType=ty=>typeof ty==='string'&&Object.prototype.hasOwnProperty.call(g.TT,ty)&&ty!=='master'&&(!g.TT[ty].race||g.TT[ty].race===p.race);
 switch(c.op){
  case'build':if(!okType(c.type))return'bad_type';if(!isInt(c.x,0,g.COLS-1)||!isInt(c.y,0,g.ROWS-1))return'bad_cell';
   if(p.gold<g.TT[c.type].cost)return'no_gold';if(g.TT[c.type].max&&g.typeCount(p,c.type)>=g.TT[c.type].max)return'max_reached';if(!g.canPlace(p,c.x,c.y))return'blocked_or_occupied';return null;
  case'buildMany':if(!okType(c.type))return'bad_type';if(!Array.isArray(c.cells)||c.cells.length>g.COLS*g.ROWS)return'bad_cells';
   for(const q of c.cells)if(!Array.isArray(q)||!isInt(q[0],0,g.COLS-1)||!isInt(q[1],0,g.ROWS-1))return'bad_cell';return null;
  case'placeMaster':return isInt(c.x,0,g.COLS-1)&&isInt(c.y,0,g.ROWS-1)?null:'bad_cell';
  case'pickMaster':return typeof c.key==='string'&&['blitzmeister','frostmeister','goldmeister'].includes(c.key)?null:'bad_key';
  case'upgrade':if(!tower())return'bad_tower';if(c.path!==0&&c.path!==1)return'bad_path';{const t=p.towers.find(t=>t.id===c.id);if(!g.canUp(t,c.path))return'max_level';}return null;
  case'sell':case'target':case'slotRune':if(!tower())return'bad_tower';if(c.op==='slotRune'&&!ELEMS.has(c.e))return'bad_elem';return null;
  case'send':if(!CTIDS.has(c.creep))return'bad_creep';{const ct=g.CT.find(x=>x.id===c.creep);if(G.t<ct.unlock)return'locked';if(!g.ctAvail(p,ct))return'wrong_race';if(g.sendCd(G,p,ct)>0)return'cooldown';if(p.gold<g.creepCost(G,ct))return'no_gold';}return null;
  case'sendTo':return'no_target_choice';
  case'worker':case'mineUp':case'masterUp':return null;
  case'heroMove':return isInt(c.x,0,g.COLS-1)&&isInt(c.y,0,g.ROWS-1)?null:'bad_cell';
  case'heroAbility':if(c.i!==0&&c.i!==1)return'bad_ability';if(!p.hero)return'no_hero';if(p.hero.cd[c.i]>G.t)return'cooldown';return null;
  case'buyRune':case'dropRune':return ELEMS.has(c.e)?null:'bad_elem';
 }return'unknown_op';}

// ---------- Matches (2–4 Spieler) ----------
const SIZES=[2,3,4],okSize=n=>SIZES.includes(n)?n:2;
const alivePi=r=>r.G?r.G.p.map((p,i)=>i).filter(i=>!r.G.p[i].dead):[];
const names=r=>r.players.map(s=>s?s.name:'—');
function newRoom(code,priv,size){size=okSize(size);const r={code:code||mkCode(),priv,size,players:Array(size).fill(null),G:null,phase:'lobby',rematch:Array(size).fill(0),timer:null,evBuf:[],dc:Array(size).fill(null),elim:new Set()};rooms.set(r.code,r);return r;}
function lobbyInfo(r){broadcast(r,{t:'lobby',code:r.code,size:r.size,have:r.players.filter(Boolean).length,names:names(r)});}
function startMatch(r){r.G=g.newGame(r.size);r.G.diff=1;for(const p of r.G.p)p.ai=0;r.G.started=1;r.phase='pick';r.pickEnd=Date.now()+PICK_S*1000;r.rematch=Array(r.size).fill(0);r.evBuf=[];r.lastSnap=0;r.dc=Array(r.size).fill(null);r.elim=new Set();
 r.players.forEach((s,pi)=>{if(s){s.pi=pi;s.watch=null;send(s,{t:'match',code:r.code,you:pi,size:r.size,names:names(r),phase:'pick',pickLeft:PICK_S,opp:r.size===2?(r.players[1-pi]?.name||'Gegner'):names(r).filter((_,i)=>i!==pi).join(', ')});}});
 clearInterval(r.timer);r.timer=setInterval(()=>tickRoom(r),SIM_DT*1000);}
function eliminate(r,pi,reason){const p=r.G.p[pi];if(p.dead)return;p.lives=0;p.dead=1;p.creeps=[];p.proj=[];p.place=alivePi(r).length+1;r.elim.add(pi);
 send(r.players[pi],{t:'eliminated',place:p.place,reason});broadcast(r,{t:'playerOut',pi,name:r.players[pi]?.name,place:p.place,reason});checkEnd(r);}
function checkEnd(r){const al=alivePi(r);if(al.length<=1)endMatch(r,al.length?al[0]:-1,r.size===2?r._why||'lives':'last_standing');}
function tickRoom(r){const G=r.G;if(!G||r.phase==='over')return;const now=Date.now();
 for(let pi=0;pi<r.size;pi++)if(r.dc[pi]&&now>r.dc[pi]){r.dc[pi]=null;if(r.size===2){endMatch(r,1-pi,'forfeit_disconnect');return;}eliminate(r,pi,'forfeit_disconnect');if(r.phase==='over')return;}
 if(r.phase==='pick'){const races=Object.keys(g.RACE).filter(k=>!g.RACE[k].locked);if(now>=r.pickEnd||G.p.every(p=>p.race)){G.p.forEach(p=>{if(!p.race)g.pickRace(p,races[crypto.randomInt(races.length)]);});r.phase='play';r.tutEnd=now+5000;r.tutUsed=Array(r.size).fill(0);r.pause=null;r.resumeAt=0;broadcast(r,{t:'phase',phase:'play'});broadcast(r,{t:'tutOffer',left:5});}else return;}
 if(r.dc.some((d,i)=>d&&!G.p[i].dead))return;// pausiert während Verbindungsabbruch
 if(r.pause){if(now<r.pause.until)return;resumeRoom(r);}if(r.resumeAt&&now<r.resumeAt)return;
 for(let i=0;i<SIM_SPEED&&!G.over;i++)g.step(G,SIM_DT);
 if(G.ev.length){for(const e of G.ev)if(e.k==='elim'&&!r.elim.has(e.pi)){r.elim.add(e.pi);send(r.players[e.pi],{t:'eliminated',place:G.p[e.pi].place,reason:'lives'});broadcast(r,{t:'playerOut',pi:e.pi,name:r.players[e.pi]?.name,place:G.p[e.pi].place,reason:'lives'});}
  r.evBuf.push(...G.ev.filter(e=>e.k!=='shot'||r.evBuf.length<60));G.ev.length=0;}
 if(now-r.lastSnap>=SNAP_MS){r.lastSnap=now;snapshot(r);}
 if(G.over)endMatch(r,G.winner,r.size===2?'lives':'last_standing');}
function snapshot(r){const ev=r.evBuf;r.evBuf=[];const nm=names(r);r.players.forEach((s,pi)=>{if(s&&!r.dc[pi]){const st=NET.serState(r.G,pi,nm,s.watch);send(s,{t:'state',s:st,ev:NET.flipEv(ev,pi,st.watch,st.n)});}});}
function broadcast(r,m){r.players.forEach(s=>send(s,m));}
function resumeRoom(r){r.pause=null;r.resumeAt=Date.now()+3000;broadcast(r,{t:'resume',in:3});}
function endMatch(r,winner,reason){if(r.phase==='over')return;if(r.G){r.G.winner=winner;r.G.over=winner===0?'win':'lose';}clearInterval(r.timer);r.timer=null;if(r.G)snapshot(r);r.phase='over';
 r.players.forEach((s,pi)=>send(s,{t:'over',result:pi===winner?'win':'lose',reason,winner,winnerName:r.players[winner]?.name||'',place:pi===winner?1:(r.G?.p[pi]?.place||2),size:r.size}));
 r.players.forEach((s,pi)=>{if(s&&r.dc[pi]!=null||s&&!s.ws){sessions.delete(s.token);s.room=null;r.players[pi]=null;}});r.dc=Array(r.size).fill(null);
 if(r.players.every(x=>!x))rooms.delete(r.code);}
function leaveRoom(s,reason){const r=s.room;if(!r)return;const pi=r.players.indexOf(s);s.room=null;if(r.pause&&r.pause.pi===pi)resumeRoom(r);
 if(pi<0)return;if(r.phase==='pick'||r.phase==='play'){if(r.size===2)endMatch(r,1-pi,reason||'forfeit_left');else if(!r.G.p[pi].dead)eliminate(r,pi,reason||'forfeit_left');}
 r.players[pi]=null;broadcast(r,{t:'oppLeft',pi,name:s.name});if(r.phase==='lobby')lobbyInfo(r);
 if(r.players.every(x=>!x)){clearInterval(r.timer);rooms.delete(r.code);}}
const queues={2:[],3:[],4:[]};
function deq(s){for(const k in queues)queues[k]=queues[k].filter(x=>x!==s);}
function tryMatchQueue(){for(const n of SIZES){let q=queues[n]=queues[n].filter(s=>s.ws&&s.ws.readyState===1&&!s.room);
  q.forEach(s=>send(s,{t:'queued',size:n,have:Math.min(q.length,n)}));
  while(q.length>=n){const ps=q.splice(0,n);const r=newRoom(null,false,n);r.players=ps;ps.forEach(s=>s.room=r);startMatch(r);}}}
const queue={get length(){return SIZES.reduce((a,n)=>a+queues[n].length,0);}};

// ---------- Verbindungen ----------
wss.on('connection',ws=>{let s=null;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m.t!=='string')return;
  if(!s){if(m.t!=='hello')return;
   const old=typeof m.token==='string'&&sessions.get(m.token);
   if(old){s=old;if(s.ws&&s.ws!==ws)try{s.ws.close(4000,'replaced');}catch{}s.ws=ws;const r=s.room;
    send(s,{t:'welcome',token:s.token,resumed:true});
    if(r&&r.G&&r.phase!=='over'){const pi=r.players.indexOf(s);r.dc[pi]=null;send(s,{t:'match',code:r.code,you:pi,size:r.size,names:names(r),phase:r.phase,pickLeft:Math.max(0,(r.pickEnd-Date.now())/1000),opp:r.size===2?(r.players[1-pi]?.name||'Gegner'):names(r).filter((_,i)=>i!==pi).join(', ')});send(s,{t:'state',s:NET.serState(r.G,pi,names(r)),ev:[]});r.players.forEach((o,i)=>i!==pi&&send(o,{t:'oppReconnected',pi,name:s.name}));if(r.G.p[pi].dead)send(s,{t:'eliminated',place:r.G.p[pi].place});}
    return;}
   s={token:crypto.randomBytes(16).toString('hex'),ws,name:String(m.name||'Spieler').slice(0,20),room:null,pi:-1,bucket:RATE.burst,bt:Date.now(),viol:0};
   sessions.set(s.token,s);send(s,{t:'welcome',token:s.token});return;}
  // Rate-Limit (Token-Bucket über alle Nachrichten)
  const now=Date.now();s.viol=Math.max(0,s.viol-(now-s.bt)/1000*2);s.bucket=Math.min(RATE.burst,s.bucket+(now-s.bt)/1000*RATE.per);s.bt=now;
  if(s.bucket<1){if(++s.viol>RATE.kick){send(s,{t:'error',msg:'rate_limit_kick'});ws.close(4008,'rate limit');}else if(m.t==='cmd')send(s,{t:'ack',seq:m.seq,ok:false,err:'rate_limited'});return;}s.bucket--;
  const r=s.room;
  switch(m.t){
   case'watch':s.watch=Number.isInteger(m.pi)?m.pi:null;return;
   case'ping':return send(s,{t:'pong',ts:m.ts});
   case'queue':{if(r)return send(s,{t:'error',msg:'in_room'});deq(s);queues[okSize(m.size)].push(s);return tryMatchQueue();}
   case'leaveQueue':deq(s);return send(s,{t:'unqueued'});
   case'create':{if(r)leaveRoom(s);deq(s);const nr=newRoom(null,true,m.size);nr.players[0]=s;s.room=nr;send(s,{t:'room',code:nr.code,size:nr.size});return lobbyInfo(nr);}
   case'join':{const code=String(m.code||'').toUpperCase().trim(),nr=rooms.get(code);
    if(!nr||!nr.priv)return send(s,{t:'error',msg:'room_not_found'});if(nr.players.includes(s))return;if(nr.players.every(Boolean)||nr.phase!=='lobby')return send(s,{t:'error',msg:'room_full'});
    if(r&&r!==nr)leaveRoom(s);deq(s);nr.players[nr.players.indexOf(null)]=s;s.room=nr;send(s,{t:'room',code:nr.code,size:nr.size});lobbyInfo(nr);if(nr.players.every(Boolean))startMatch(nr);return;}
   case'leave':deq(s);leaveRoom(s,'forfeit_left');return send(s,{t:'left'});
   case'race':{if(!r||r.phase!=='pick')return send(s,{t:'error',msg:'not_pick_phase'});const pi=r.players.indexOf(s);
    if(typeof m.race!=='string'||!Object.prototype.hasOwnProperty.call(g.RACE,m.race)||g.RACE[m.race].locked)return send(s,{t:'error',msg:'bad_race'});if(r.G.p[pi].race)return send(s,{t:'error',msg:'race_locked'});g.pickRace(r.G.p[pi],m.race);return send(s,{t:'raceOk',race:m.race});}
   case'tutStart':{if(!r||r.phase!=='play')return send(s,{t:'error',msg:'not_playing'});const pi=r.players.indexOf(s);if(pi<0||r.tutUsed[pi]||r.pause||Date.now()>r.tutEnd+1000)return send(s,{t:'error',msg:'tut_denied'});r.tutUsed[pi]=1;r.pause={pi,until:Date.now()+60000};return broadcast(r,{t:'pause',pi,name:s.name,max:60});}
   case'tutDone':{if(!r||!r.pause||r.players.indexOf(s)!==r.pause.pi)return;return resumeRoom(r);}
   case'cmd':{if(!r||r.phase!=='play'||r.pause||Date.now()<r.resumeAt||r.dc.some((d,i)=>d&&!r.G.p[i].dead)||r.G.p[r.players.indexOf(s)]?.dead)return send(s,{t:'ack',seq:m.seq,ok:false,err:'not_playing'});const pi=r.players.indexOf(s);
    let err=validate(r.G,pi,m.c),res=false;if(!err){try{res=g.command(r.G,pi,m.c);}catch(e){err='server_error';}if(!err&&!res)err='rejected';}
    if(err)s.viol+=.2;return send(s,{t:'ack',seq:m.seq,ok:!err,err:err||undefined,op:m.c&&m.c.op});}
   case'rematch':{if(!r||r.phase!=='over'||!r.players.every(Boolean))return send(s,{t:'error',msg:'no_rematch'});const pi=r.players.indexOf(s);r.rematch[pi]=1;
    r.players.forEach((o,i)=>i!==pi&&send(o,{t:'rematchReq',name:s.name,have:r.rematch.filter(Boolean).length,size:r.size}));if(r.rematch.every(Boolean)){r.players.push(r.players.shift());r.phase='lobby';startMatch(r);}return;}
  }});
 ws.on('close',()=>{if(!s||s.ws!==ws)return;s.ws=null;deq(s);const r=s.room;
  if(r&&r.G&&(r.phase==='play'||r.phase==='pick')){const pi=r.players.indexOf(s);if(!r.G.p[pi].dead){r.dc[pi]=Date.now()+RECONNECT_S*1000;r.players.forEach((o,i)=>i!==pi&&send(o,{t:'oppDisconnected',left:RECONNECT_S,pi,name:s.name}));}}
  else{leaveRoom(s);sessions.delete(s.token);}});});
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},20000);
server.listen(PORT,()=>console.log('ltw-server listening on',PORT));
module.exports={server,validate};
