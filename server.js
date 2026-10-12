'use strict';
// Line Tower Wars – autoritativer 1v1-PvP-Server (Node + ws)
const http=require('http'),crypto=require('crypto'),{WebSocketServer}=require('ws');
const g=require('./game.js'),NET=require('./net.js');
const PORT=process.env.PORT||8080,SIM_DT=.05,SNAP_MS=100,PICK_S=+(process.env.PICK_S||20),RECONNECT_S=+(process.env.RECONNECT_S||30);
const SIM_SPEED=Math.max(1,Math.min(20,+(process.env.SIM_SPEED||1)));// nur für Tests
const RATE={per:20,burst:40,kick:150};// Befehle/s, Burst, Verstöße bis Kick

const server=http.createServer((req,res)=>{
 res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});
 res.end(JSON.stringify({ok:true,name:'ltw-server',rooms:rooms.size,matches:[...rooms.values()].filter(r=>r.G).length,queue:queue.length,players:sessions.size}));});
const wss=new WebSocketServer({server,perMessageDeflate:{threshold:512},maxPayload:16*1024});

const sessions=new Map(),rooms=new Map();let queue=[];
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
  case'worker':case'mineUp':case'masterUp':return null;
  case'heroMove':return isInt(c.x,0,g.COLS-1)&&isInt(c.y,0,g.ROWS-1)?null:'bad_cell';
  case'heroAbility':if(c.i!==0&&c.i!==1)return'bad_ability';if(!p.hero)return'no_hero';if(p.hero.cd[c.i]>G.t)return'cooldown';return null;
  case'buyRune':case'dropRune':return ELEMS.has(c.e)?null:'bad_elem';
 }return'unknown_op';}

// ---------- Matches ----------
function newRoom(code,priv){const r={code:code||mkCode(),priv,players:[null,null],G:null,phase:'lobby',rematch:[0,0],timer:null,evBuf:[],dc:[null,null]};rooms.set(r.code,r);return r;}
function startMatch(r){r.G=g.newGame();r.G.diff=1;for(const p of r.G.p)p.ai=0;r.G.started=1;r.phase='pick';r.pickEnd=Date.now()+PICK_S*1000;r.rematch=[0,0];r.evBuf=[];r.lastSnap=0;r.paused=false;
 r.players.forEach((s,pi)=>{if(s){s.pi=pi;send(s,{t:'match',code:r.code,you:pi,phase:'pick',pickLeft:PICK_S,opp:r.players[1-pi]?.name||'Gegner'});}});
 clearInterval(r.timer);r.timer=setInterval(()=>tickRoom(r),SIM_DT*1000);}
function tickRoom(r){const G=r.G;if(!G)return;const now=Date.now();
 for(let pi=0;pi<2;pi++)if(r.dc[pi]&&now>r.dc[pi]){endMatch(r,1-pi,'forfeit_disconnect');return;}
 if(r.phase==='pick'){const races=Object.keys(g.RACE);if(now>=r.pickEnd||G.p.every(p=>p.race)){G.p.forEach(p=>{if(!p.race)g.pickRace(p,races[crypto.randomInt(races.length)]);});r.phase='play';broadcast(r,{t:'phase',phase:'play'});}else return;}
 if(r.dc[0]||r.dc[1])return;// pausiert während Verbindungsabbruch
 for(let i=0;i<SIM_SPEED&&!G.over;i++)g.step(G,SIM_DT);if(G.ev.length){r.evBuf.push(...G.ev.filter(e=>e.k!=='shot'||r.evBuf.length<60));G.ev.length=0;}
 if(now-r.lastSnap>=SNAP_MS){r.lastSnap=now;snapshot(r);}
 if(G.over){endMatch(r,G.over==='win'?0:1,'lives');}}
function snapshot(r){const ev=r.evBuf;r.evBuf=[];r.players.forEach((s,pi)=>{if(s&&!r.dc[pi])send(s,{t:'state',s:NET.serState(r.G,pi),ev:NET.flipEv(ev,pi)});});}
function broadcast(r,m){r.players.forEach(s=>send(s,m));}
function endMatch(r,winner,reason){if(r.phase==='over')return;clearInterval(r.timer);r.timer=null;if(r.G)snapshot(r);r.phase='over';
 r.players.forEach((s,pi)=>send(s,{t:'over',result:pi===winner?'win':'lose',reason}));
 // nach Forfeit: weg-gebliebenen Spieler entfernen
 r.players.forEach((s,pi)=>{if(s&&r.dc[pi]){sessions.delete(s.token);r.players[pi]=null;}});r.dc=[null,null];
 if(!r.players[0]&&!r.players[1])rooms.delete(r.code);}
function leaveRoom(s,reason){const r=s.room;if(!r)return;const pi=r.players.indexOf(s);s.room=null;
 if(pi<0)return;if(r.phase==='pick'||r.phase==='play'){endMatch(r,1-pi,reason||'forfeit_left');}
 r.players[pi]=null;const o=r.players[1-pi];if(o)send(o,{t:'oppLeft'});
 if(!r.players[0]&&!r.players[1]){clearInterval(r.timer);rooms.delete(r.code);}}
function tryMatchQueue(){queue=queue.filter(s=>s.ws&&s.ws.readyState===1&&!s.room);while(queue.length>=2){const a=queue.shift(),b=queue.shift();const r=newRoom(null,false);r.players=[a,b];a.room=b.room=r;startMatch(r);}}

// ---------- Verbindungen ----------
wss.on('connection',ws=>{let s=null;ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m.t!=='string')return;
  if(!s){if(m.t!=='hello')return;
   const old=typeof m.token==='string'&&sessions.get(m.token);
   if(old){s=old;if(s.ws&&s.ws!==ws)try{s.ws.close(4000,'replaced');}catch{}s.ws=ws;const r=s.room;
    send(s,{t:'welcome',token:s.token,resumed:true});
    if(r&&r.G&&r.phase!=='over'){const pi=r.players.indexOf(s);r.dc[pi]=null;send(s,{t:'match',code:r.code,you:pi,phase:r.phase,pickLeft:Math.max(0,(r.pickEnd-Date.now())/1000),opp:r.players[1-pi]?.name||'Gegner'});send(s,{t:'state',s:NET.serState(r.G,pi),ev:[]});send(r.players[1-pi],{t:'oppReconnected'});}
    return;}
   s={token:crypto.randomBytes(16).toString('hex'),ws,name:String(m.name||'Spieler').slice(0,20),room:null,pi:-1,bucket:RATE.burst,bt:Date.now(),viol:0};
   sessions.set(s.token,s);send(s,{t:'welcome',token:s.token});return;}
  // Rate-Limit (Token-Bucket über alle Nachrichten)
  const now=Date.now();s.viol=Math.max(0,s.viol-(now-s.bt)/1000*2);s.bucket=Math.min(RATE.burst,s.bucket+(now-s.bt)/1000*RATE.per);s.bt=now;
  if(s.bucket<1){if(++s.viol>RATE.kick){send(s,{t:'error',msg:'rate_limit_kick'});ws.close(4008,'rate limit');}else if(m.t==='cmd')send(s,{t:'ack',seq:m.seq,ok:false,err:'rate_limited'});return;}s.bucket--;
  const r=s.room;
  switch(m.t){
   case'ping':return send(s,{t:'pong',ts:m.ts});
   case'queue':if(r)return send(s,{t:'error',msg:'in_room'});if(!queue.includes(s))queue.push(s);send(s,{t:'queued'});return tryMatchQueue();
   case'leaveQueue':queue=queue.filter(x=>x!==s);return send(s,{t:'unqueued'});
   case'create':{if(r)leaveRoom(s);queue=queue.filter(x=>x!==s);const nr=newRoom(null,true);nr.players[0]=s;s.room=nr;return send(s,{t:'room',code:nr.code});}
   case'join':{const code=String(m.code||'').toUpperCase().trim(),nr=rooms.get(code);
    if(!nr||!nr.priv)return send(s,{t:'error',msg:'room_not_found'});if(nr.players[0]&&nr.players[1])return send(s,{t:'error',msg:'room_full'});
    if(r&&r!==nr)leaveRoom(s);queue=queue.filter(x=>x!==s);nr.players[nr.players[0]?1:0]=s;s.room=nr;if(nr.players[0]&&nr.players[1]&&nr.phase!=='play'&&nr.phase!=='pick')startMatch(nr);return;}
   case'leave':queue=queue.filter(x=>x!==s);leaveRoom(s,'forfeit_left');return send(s,{t:'left'});
   case'race':{if(!r||r.phase!=='pick')return send(s,{t:'error',msg:'not_pick_phase'});const pi=r.players.indexOf(s);
    if(typeof m.race!=='string'||!Object.prototype.hasOwnProperty.call(g.RACE,m.race))return send(s,{t:'error',msg:'bad_race'});if(r.G.p[pi].race)return send(s,{t:'error',msg:'race_locked'});g.pickRace(r.G.p[pi],m.race);return send(s,{t:'raceOk',race:m.race});}
   case'cmd':{if(!r||r.phase!=='play'||r.dc[0]||r.dc[1])return send(s,{t:'ack',seq:m.seq,ok:false,err:'not_playing'});const pi=r.players.indexOf(s);
    let err=validate(r.G,pi,m.c),res=false;if(!err){try{res=g.command(r.G,pi,m.c);}catch(e){err='server_error';}if(!err&&!res)err='rejected';}
    if(err)s.viol+=.2;return send(s,{t:'ack',seq:m.seq,ok:!err,err:err||undefined,op:m.c&&m.c.op});}
   case'rematch':{if(!r||r.phase!=='over'||!r.players[0]||!r.players[1])return send(s,{t:'error',msg:'no_rematch'});const pi=r.players.indexOf(s);r.rematch[pi]=1;
    send(r.players[1-pi],{t:'rematchReq'});if(r.rematch[0]&&r.rematch[1]){r.players.reverse();startMatch(r);}return;}
  }});
 ws.on('close',()=>{if(!s||s.ws!==ws)return;s.ws=null;queue=queue.filter(x=>x!==s);const r=s.room;
  if(r&&r.G&&(r.phase==='play'||r.phase==='pick')){const pi=r.players.indexOf(s);r.dc[pi]=Date.now()+RECONNECT_S*1000;send(r.players[1-pi],{t:'oppDisconnected',left:RECONNECT_S});}
  else{leaveRoom(s);sessions.delete(s.token);}});});
setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue;}ws.isAlive=false;ws.ping();}},20000);
server.listen(PORT,()=>console.log('ltw-server listening on',PORT));
module.exports={server,validate};
