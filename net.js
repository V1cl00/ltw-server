// Netzwerk-Zustand: serialisiert G (server-autoritativ) aus Sicht eines Spielers (eigene Bahn immer Index 0) und hydriert ihn im Client.
(function(root){
const g=typeof module!=='undefined'?require('./game.js'):new Function('return{CT,ROWS,COLS,bfs,sendTarget}')();// Browser: globale lexikalische Bindungen aus game.js
const PK=new Set(['dist','grid','masterT','plan','_pp','_ppK','aiT','pers','burstT','inLog','leakLog','sendLog']);
// Sicht von Spieler pi: Index 0 = pi, Index 1 = aktuelles Sendeziel (2 Bahnen werden gerendert); weitere Spieler als Kurzinfo in s.others
function serState(G,pi,names,watch){const N=G.p.length,st=N===2?1-pi:g.sendTarget(G,pi),tg=N>2&&Number.isInteger(watch)&&watch!==pi&&G.p[watch]?watch:st,ord=[pi,tg],vm=v=>v===pi?0:v===tg?1:(v===0||v>0)&&v<N?1:v;
 const P=ord.map(ri=>{const p=G.p[ri],o={};for(const k in p)if(!PK.has(k)&&k[0]!=='_')o[k]=p[k];
  o.masterT=p.masterT?p.masterT.id:null;
  o.towers=p.towers.map(t=>Object.assign({},t));
  o.creeps=p.creeps.map(c=>Object.assign({},c,{ct:c.ct.id,owner:vm(c.owner)}));
  o.proj=p.proj.map(r=>Object.assign({},r,{tg:r.tg&&r.tg.id}));
  o.inLog=undefined;o.ri=ri;return o;});
 const flip=a=>a.filter(f=>f.pi==null||f.pi===pi||f.pi===tg).map(f=>f.pi===pi||f.pi===tg?Object.assign({},f,{pi:vm(f.pi)}):f);
 const over=G.over?(G.winner===pi?'win':'lose'):null;
 return{t:G.t,tick:G.tick,diff:G.diff,et:G.et,evt:G.evt,nextEvt:G.nextEvt,boostTick:G.boostTick,cid:G.cid,spd:G.spd,n:N,me:pi,tgt:st,watch:tg,
  others:N>2?G.p.map((p,i)=>({i,name:names&&names[i]||('Spieler '+(i+1)),race:p.race,lives:p.lives,dead:!!p.dead,place:p.place||0,inc:p.income})):null,
  over,p:P,fx:flip(G.fx.filter(f=>f.k!=='part'))};}
function hydrate(G,s,ev){const CTI={};for(const c of g.CT)CTI[c.id]=c;
 for(const k of['t','tick','diff','et','evt','nextEvt','boostTick','cid','spd','n','me','tgt','watch','others'])G[k]=s[k];
 if(s.over)G.over=s.over;
 s.p.forEach((sp,i)=>{const p=G.p[i];for(const k in sp)if(!['towers','creeps','proj','masterT'].includes(k))p[k]=sp[k];
  p.towers=sp.towers;p.grid=Array.from({length:g.ROWS},()=>Array(g.COLS).fill(null));for(const t of p.towers)p.grid[t.y][t.x]=t;
  p.masterT=sp.masterT!=null?p.towers.find(t=>t.id===sp.masterT)||null:null;
  p.creeps=sp.creeps.map(c=>Object.assign(c,{ct:CTI[c.ct]||g.CT[0]}));
  const byId={};for(const c of p.creeps)byId[c.id]=c;
  p.proj=sp.proj.filter(r=>byId[r.tg]).map(r=>Object.assign(r,{tg:byId[r.tg]}));
  p.dist=g.bfs(p.grid);p.ai=0;});
 G.fx=(G.fx||[]).filter(f=>f.k==='part').concat(s.fx);
 if(ev&&ev.length)G.ev.push(...ev);return G;}
function flipEv(ev,pi,tg){if(tg==null)tg=1-pi;return ev.filter(e=>e.pi==null||e.pi===pi||e.pi===tg||e.k==='elim').map(e=>e.k==='elim'?Object.assign({},e,{pi:e.pi===pi?0:-1,elim:e.pi}):e.pi===pi?Object.assign({},e,{pi:0}):e.pi===tg?Object.assign({},e,{pi:1}):e);}
const api={serState,hydrate,flipEv};
if(typeof module!=='undefined')module.exports=api;else root.NET=api;
})(typeof window!=='undefined'?window:globalThis);
