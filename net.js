// Netzwerk-Zustand: serialisiert G (server-autoritativ) aus Sicht eines Spielers (eigene Bahn immer Index 0) und hydriert ihn im Client.
(function(root){
const g=typeof module!=='undefined'?require('./game.js'):new Function('return{CT,ROWS,COLS,bfs}')();// Browser: globale lexikalische Bindungen aus game.js
const PK=new Set(['dist','grid','masterT','plan','_pp','_ppK','aiT','pers','burstT','inLog','leakLog','sendLog']);
function serState(G,pi){const sw=pi===1,fp=v=>sw&&(v===0||v===1)?1-v:v;
 const P=G.p.map(p=>{const o={};for(const k in p)if(!PK.has(k)&&k[0]!=='_')o[k]=p[k];
  o.masterT=p.masterT?p.masterT.id:null;
  o.towers=p.towers.map(t=>Object.assign({},t));
  o.creeps=p.creeps.map(c=>Object.assign({},c,{ct:c.ct.id,owner:fp(c.owner)}));
  o.proj=p.proj.map(r=>Object.assign({},r,{tg:r.tg&&r.tg.id}));
  // Gegnerdaten minimal halten wäre möglich; Spiel ist offen (beide Bahnen sichtbar)
  o.inLog=undefined;return o;});
 if(sw)P.reverse();
 const flip=a=>a.map(f=>f.pi===0||f.pi===1?Object.assign({},f,{pi:fp(f.pi)}):f);
 return{t:G.t,tick:G.tick,diff:G.diff,et:G.et,evt:G.evt,nextEvt:G.nextEvt,boostTick:G.boostTick,cid:G.cid,spd:G.spd,
  over:G.over?(sw?(G.over==='win'?'lose':'win'):G.over):null,p:P,fx:flip(G.fx.filter(f=>f.k!=='part'))};}
function hydrate(G,s,ev){const CTI={};for(const c of g.CT)CTI[c.id]=c;
 for(const k of['t','tick','diff','et','evt','nextEvt','boostTick','cid','spd'])G[k]=s[k];
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
function flipEv(ev,pi){return pi===1?ev.map(e=>e.pi===0||e.pi===1?Object.assign({},e,{pi:1-e.pi}):e):ev;}
const api={serState,hydrate,flipEv};
if(typeof module!=='undefined')module.exports=api;else root.NET=api;
})(typeof window!=='undefined'?window:globalThis);
