// 3–4 Spieler: Raum mit Größe, Quick-Match pro Größe, Sendeziel, Zuschauen, Elimination, Letzter gewinnt, Reconnect, Rematch
const {spawn}=require('child_process'),WebSocket=require('ws'),path=require('path');
const PORT=19000+Math.floor(Math.random()*900),URL='ws://127.0.0.1:'+PORT;
const srv=spawn(process.execPath,[path.join(__dirname,'..','server.js')],{env:{...process.env,PORT,PICK_S:'2',RECONNECT_S:'3',SIM_SPEED:'20'},stdio:['ignore','pipe','inherit']});
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+m);};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(name,token){return new Promise(res=>{const ws=new WebSocket(URL),C={ws,name,msgs:[],state:null,acks:{},seq:0,waiters:[]};
 ws.on('message',d=>{const m=JSON.parse(d);C.msgs.push(m);if(m.t==='state')C.state=m.s;if(m.t==='ack')C.acks[m.seq]=m;if(m.t==='welcome'){C.token=m.token;res(C);}C.waiters=C.waiters.filter(w=>!(w.f(m)&&(w.r(m),1)));});
 ws.on('open',()=>ws.send(JSON.stringify({t:'hello',name,token})));C.send=m=>ws.send(JSON.stringify(m));
 C.wait=(f,ms=20000)=>new Promise((r,j)=>{const hit=C.msgs.find(f);if(hit)return r(hit);C.waiters.push({f,r});setTimeout(()=>j(new Error(name+' timeout')),ms);});
 C.cmd=async c=>{const seq=++C.seq;C.send({t:'cmd',seq,c});return C.wait(m=>m.t==='ack'&&m.seq===seq);};});}
(async()=>{await new Promise(r=>srv.stdout.on('data',d=>/listening/.test(d)&&r()));
 console.log('== 4er-Raum per Code');
 const C=[];for(const n of['A','B','C','D'])C.push(await client(n));
 C[0].send({t:'create',size:4});const room=await C[0].wait(m=>m.t==='room');ok(room.size===4,'room size 4 '+room.code);
 C[1].send({t:'join',code:room.code});C[2].send({t:'join',code:room.code});const lb=await C[0].wait(m=>m.t==='lobby'&&m.have===3);ok(!C[0].msgs.some(m=>m.t==='match'),'no start at 3/4 ('+lb.names.join(',')+')');
 C[3].send({t:'join',code:room.code});const ms=await Promise.all(C.map(c=>c.wait(m=>m.t==='match')));ok(ms.map(m=>m.you).sort().join()==='0,1,2,3'&&ms[0].size===4,'match starts when full, seats 0-3');
 const E=await client('E');E.send({t:'join',code:room.code});ok((await E.wait(m=>m.t==='error')).msg==='room_full','5th rejected');
 C.forEach((c,i)=>c.send({t:'race',race:['menschen','orks','menschen','orks'][i]}));await Promise.all(C.map(c=>c.wait(m=>m.t==='phase')));
 await sleep(400);const s0=C[0].state;ok(s0.n===4&&s0.others.length===4&&s0.p.length===2&&s0.tgt===1,'state: n=4, others=4, 2 lanes, target=next (1)');
 ok(C[1].state.tgt===2&&C[3].state.tgt===0,'targets ring: B->C, D->A');
 let r=await C[0].cmd({op:'sendTo',to:3});ok(r.ok,'A sendTo D ok');r=await C[0].cmd({op:'sendTo',to:0});ok(!r.ok,'sendTo self rejected');
 await sleep(1500);r=await C[0].cmd({op:'send',creep:'laeufer'});ok(r.ok,'A sends unit');await sleep(300);
 ok(C[3].state.p[0].creeps.some(c=>c.owner!==0),'unit arrived on D lane');ok(C[0].state.p[1].ri===3,'A watches D (target) as lane 1');
 C[0].send({t:'watch',pi:2});await sleep(400);ok(C[0].state.p[1].ri===2&&C[0].state.watch===2,'watch C -> lane 1 shows C');
 r=await C[0].cmd({op:'build',type:'pfeil',x:3,y:3});ok(r.ok&&C[0].state.p[0].ri===0,'build on own island only (lane 0 = self)');
 console.log('== Reconnect (C)');
 const tokC=C[2].token;C[2].ws.terminate();await C[0].wait(m=>m.t==='oppDisconnected');C[2]=await client('C',tokC);const rm=await C[2].wait(m=>m.t==='match');ok(rm.you===2,'C resumed seat 2');
 console.log('== Elimination: B verlässt, D wird totgespammt');
 C[1].send({t:'leave'});const po=await C[0].wait(m=>m.t==='playerOut'&&m.pi===1);ok(po.place===4,'B out (left) place 4');
 await C[0].cmd({op:'sendTo',to:3});await C[2].cmd({op:'sendTo',to:3});
 const t0=Date.now();const g=require('../game.js');
 while(Date.now()-t0<120000&&!C[0].msgs.some(m=>m.t==='over')){for(const c of [C[0],C[2]]){const st=c.state;if(!st)continue;const id=['boss','panzer','flitzer','laeufer'].find(k=>{const x=g.CT.find(y=>y.id===k);return st.t>=x.unlock&&st.p[0].gold>=x.cost;});if(id)c.cmd({op:'send',creep:id});}
  if(C[3].msgs.some(m=>m.t==='eliminated')&&!C._d){C._d=1;ok(true,'D eliminated by lives');C[0].send({t:'sendTo'});await C[0].cmd({op:'sendTo',to:2});}await sleep(150);}
 const ov=await Promise.all([0,2,3].map(i=>C[i].wait(m=>m.t==='over',60000)));
 ok(ov.filter(o=>o.result==='win').length===1&&ov.every(o=>o.reason==='last_standing'),'one winner, last standing: '+ov.map(o=>o.result+'#'+o.place).join(' '));
 console.log('== Quick Match 3er');
 const Q=[];for(const n of['Q1','Q2','Q3'])Q.push(await client(n));Q[0].send({t:'queue',size:3});Q[1].send({t:'queue',size:2});await sleep(300);ok(!Q[0].msgs.some(m=>m.t==='match'),'different sizes not mixed');
 Q[1].send({t:'queue',size:3});Q[2].send({t:'queue',size:3});const qm=await Promise.all(Q.map(c=>c.wait(m=>m.t==='match')));ok(qm.every(m=>m.size===3),'3-player quick match formed');
 console.log('== Rematch (3er)');Q.forEach(c=>c.send({t:'leave'}));
 console.log(`\n${pass} passed, ${fail} failed`);srv.kill();process.exit(fail?1:0);})().catch(e=>{console.log('ERR',e.message);srv.kill();process.exit(1);});
