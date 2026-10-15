/* ---------- 存檔分析（記憶卡存檔，只在瀏覽器內讀取） ----------
   存檔格式見資料統整 §16.13／§16.15。每份資料以 copy 起點為 0：
   +440 種類；+444 已學招式位元；+480 起 132 bytes＝RAM 0x8014274C（教養 +40、心情 +42、體重 +66、壽命 +72、失誤 +82、戰鬥 +84、年齡 +86）；
   +624 起＝RAM 0x8016C8F0（攻 +0、防 +2、速 +4、智 +6、HP 上限 +16、MP 上限 +18）；+656 起＝劇情旗標（旗標 n 在 +245+n/8）。
   +466 日、+468 時、+470 分。校驗碼 +0x4FC。訓練一次＝遊戲時間 1 小時（TRN_REL 0x8008a718）。 */
const EVO_AT={1:6,2:24,3:72,4:144};
function svParse(buf){
  const u=new Uint8Array(buf), dv=new DataView(buf); const out=[]; const seen=new Set();
  const i16=o=>dv.getInt16(o,true), u32=o=>dv.getUint32(o,true);
  const sumOk=c=>{ if(c+0xF00>u.length) return false; let s=0; for(let i=0;i<0x4E4;i++) s+=u[c+i]; for(let i=0x500;i<0xF00;i++) s+=u[c+i]; return (s>>>0)===u32(c+0x4FC); };
  let dec=null; try{ dec=new TextDecoder('shift_jis'); }catch(e){}
  for(let o=0;o+0x2000<=u.length;o+=0x80){
    if(u[o]!==0x53||u[o+1]!==0x43) continue;
    let c=-1; if(sumOk(o+0x200)) c=o+0x200; else if(sumOk(o+0x1100)) c=o+0x1100; if(c<0||seen.has(c)) continue;
    const sp=u32(c+440); if(!DG[sp]) continue; seen.add(c);
    let title=''; if(dec){ const t=u.slice(o+4,o+68); const z=t.indexOf(0); title=dec.decode(z>=0?t.slice(0,z):t).replace(/　+/g,' ').trim(); }
    const P=c+480, learned=[], raised=[];
    for(let i=0;i<58;i++) if(u[c+444+(i>>3)]&(1<<(i&7))) learned.push(i);
    D.digis.forEach(x=>{ const n=512+x.id; if(u[c+656+245+(n>>3)]&(1<<(n&7))) raised.push(x.id); });
    out.push({n:out.length+1, title, cur:sp,
      stats:{hp:i16(c+640), mp:i16(c+642), atk:i16(c+624), def:i16(c+626), spd:i16(c+628), int:i16(c+630)},
      dis:i16(P+40), hap:i16(P+42), weight:i16(P+66), life:i16(P+72), mis:i16(P+82), win:i16(P+84), age:i16(P+86), poop:i16(P+30),
      tech:learned.length, learned:learned.filter(x=>x!==48&&x!==57), raised, day:i16(c+466), hh:i16(c+468), mm:i16(c+470)});
  }
  return out;
}
function svCtx(v){ return {cur:v.cur, stats:{...v.stats}, weight:v.weight, mis:v.mis, win:v.win, hap:v.hap, dis:v.dis, tech:v.tech, age:v.age, life:v.life, raised:v.raised}; }
function pickDrill(k,lv){ let best=null; drills().forEach(d=>{ const g=trainGain(d.gym,d.base,lv,true); const v=(g[k]||0)/FATIGUE[d.main]; if(g[k]&&(!best||v>best.v||(v===best.v&&d.main===k&&best.d.main!==k))) best={d,g,v}; }); return best; }
const STATCAP=k=>(k==='hp'||k==='mp')?9999:999;
// 逐小時模擬：每次訓練或休息都是 1 小時，年齡 +1，年齡到了就照遊戲每小時判定一次
function hourSim(ctx, goal, nextStat){
  const lv=DG[ctx.cur].level, thr=EVO_AT[lv], cap=S.planCap, restPer=REST[S.planRest].per;
  const st={...ctx.stats}; let age=ctx.age, fat=S.fat, life=ctx.life, n=0, restH=0, waitH=0, lastK=null; const steps=[];
  const evoNow=()=>{ if(age<thr) return null; const P=predictEvo({...ctx,stats:st}); if(P.best!==-1) return P.best; if(lv===3&&age>=96) return NUMEMON; return null; };
  const ready=()=>predictEvo({...ctx,stats:st}).best===goal;
  const tick=()=>{ age++; if(life!=null) life--; return evoNow(); };
  const push=o=>{ const l=steps[steps.length-1];
    if(o.rest&&l&&l.rest) l.h++; else if(o.wait&&l&&l.wait) l.h++;
    else if(o.d&&l&&l.d===o.d){ l.n++; l.after={...st}; l.fat=fat; l.age=age; } else steps.push(o); };
  let res=null, why='';
  for(let g=0; g<4000 && res===null; g++){
    if(lv>=4 && life!=null && life<=0){ res='dead'; break; }
    if(ready()){ push({wait:true,h:1}); waitH++; res=tick(); continue; }
    const k=nextStat(st,lastK); if(!k){ res='stuck'; break; } lastK=k;
    const b=pickDrill(k,lv); if(!b){ res='nogym'; why=k; break; }
    const cost=FATIGUE[b.d.main];
    if(fat+cost>=cap){ fat=Math.max(0,fat-restPer); restH++; push({rest:true,h:1}); res=tick(); continue; }
    for(const x in b.g) st[x]=Math.min(STATCAP(x), st[x]+b.g[x]);
    fat+=cost; n++; push({d:b.d,g:b.g,n:1,after:{...st},fat,age:age+1}); res=tick();
  }
  if(res===null) res='stuck';
  return {res, why, steps, n, restH, waitH, age, st, hours:age-ctx.age, life};
}
// 目標除能力外的條件：已達成／可以補救（怎樣）／不可能
function goalFeas(ctx, goal){
  const e=D.evo[goal]; const c2={...ctx}; const fixes=[], imp=[], lvl=DG[ctx.cur].level;
  if(!e) return {imp:['沒有這個進化資料。'],fixes,c2};
  const grp=[]; // {ok, fix:{text,apply}, imp}
  // 體重
  if(Math.abs(ctx.weight-e.w)<=5) grp.push({k:'w',ok:true});
  else grp.push({k:'w',fix:{text:`體重調到 ${e.w-5}～${e.w+5}g（存檔是 ${ctx.weight}g；吃肉類增重，訓練、不吃東西會減重）`,apply:c=>{c.weight=e.w;}}});
  if(e.rookie){
    grp.push({k:'mis',ok:true});
    grp.push(ctx.cur===e.bonusDigi?{k:'bonus',ok:true}:{k:'bonus',imp:`額外加成要由${DG[e.bonusDigi].name}進化`});
  } else {
    const [mv,mop]=e.mis;
    if(mop==='le') grp.push(ctx.mis<=mv?{k:'mis',ok:true}:{k:'mis',imp:`失誤已有 ${ctx.mis} 次，要 ${mv} 次以下（失誤要進化後才歸零）`});
    else grp.push(ctx.mis>=mv?{k:'mis',ok:true}:{k:'mis',fix:{text:`故意犯失誤到 ${mv} 次（存檔是 ${ctx.mis} 次）`,apply:c=>{c.mis=mv;}}});
    const lab={hap:'心情',dis:'教養',win:'戰鬥次數',tech:'技能數'}, how={dis:'責罵、教養道具',hap:'稱讚、餵喜歡的食物',win:'打野外戰鬥（每場約 20 分鐘）',tech:'學新招式'};
    const opts=e.bonus.map(b=>{ if(b.k==='prev') return ctx.cur===b.v?{ok:true}:null;
      const v=ctx[b.k]; const ok=b.op==='le'?v<=b.v:v>=b.v; if(ok) return {ok:true};
      if(b.op==='le' && (b.k==='win'||b.k==='tech')) return null;
      const gap=Math.abs(v-b.v)/Math.max(1,Math.abs(b.v));
      return {gap,fix:{text:`${lab[b.k]}${b.op==='le'?'降到 '+b.v+' 以下':'提高到 '+b.v+(b.k==='hap'?'（≈ '+((b.v+100)/2)+'%）':'')}（存檔是 ${v}；${b.op==='le'?(b.k==='dis'?'稱讚會降教養':'責罵會降心情'):how[b.k]}）`,apply:c=>{c[b.k]=b.v;}}}; }).filter(Boolean);
    if(opts.some(o=>o.ok)) grp.push({k:'bonus',ok:true});
    else if(opts.length){ opts.sort((a,b)=>a.gap-b.gap); grp.push({k:'bonus',fix:opts[0].fix}); }
    else grp.push({k:'bonus',imp:'額外加成的條件都做不到（前一形態不對，或戰鬥／技能已超過上限）'});
  }
  const okN=1+grp.filter(g=>g.ok).length, fixable=grp.filter(g=>g.fix);
  grp.filter(g=>g.imp).forEach(g=>imp.push(g.imp));
  if(okN+fixable.length<3) return {imp:imp.length?imp:['條件組不足 3 組。'], fixes, c2, blocked:true};
  const need = lvl===2? fixable.length : Math.max(0,3-okN);
  fixable.slice(0,need).forEach(g=>{ g.fix.apply(c2); fixes.push(g.fix.text); });
  return {imp, fixes, c2};
}
function goalPlan(ctx, goal){
  const lv=DG[ctx.cur].level; const e=D.evo[goal];
  const F=goalFeas(ctx,goal); if(F.blocked) return {F, impossible:true};
  const c=F.c2; let best=null, worst=null;
  const consider=r=>{ if(r.res===goal){ if(!best||r.hours<best.hours) best=r; } else if(!worst||r.hours>worst.hours) worst=r; };
  if(e.rookie){
    e.top.forEach(t=>consider(hourSim(c,goal,st=>lastTopStat(st)===t?null:(st[t]>=STATCAP(t)?null:t))));
  } else {
    const req=e.stats, ks=Object.keys(req);
    const perms=a=>a.length<=1?[a]:a.flatMap((x,i)=>perms([...a.slice(0,i),...a.slice(i+1)]).map(q=>[x,...q]));
    const ords= ks.length<=4? perms(ks) : [ks.slice().sort((a,b)=>(req[b]-c.stats[b])-(req[a]-c.stats[a]))];
    const extra=(st)=>{ let bk=null,bv=-1; ks.forEach(k=>{ if(st[k]>=STATCAP(k)) return; const b=pickDrill(k,lv); if(!b) return; const v=((k==='hp'||k==='mp')?b.g[k]/10:b.g[k])/FATIGUE[b.d.main]; if(v>bv){bv=v;bk=k;} }); return bk; };
    ords.forEach(ord=>consider(hourSim(c,goal,st=>ord.find(k=>st[k]<req[k])||extra(st))));
  }
  return {F, ctx2:c, best, worst};
}
function svStepsTable(r, ctx){
  const rows=r.steps.map((x,i)=>x.rest? `<tr><td class="num">${i+1}</td><td><b>${REST[S.planRest].name} ${x.h} 小時</b></td><td class="hint">疲勞每小時 −${REST[S.planRest].per}</td><td></td></tr>`
    : x.wait? `<tr><td class="num">${i+1}</td><td><b>等待 ${x.h} 小時</b></td><td class="hint">數值不要再改變，等年齡到時進化</td><td></td></tr>`
    : `<tr><td class="num">${i+1}</td><td><b>${x.d.gym.name}・${x.d.n} × ${x.n}</b><br><span class="hint">每次 ${Object.entries(x.g).map(([k,v])=>SN[k]+'+'+v).join('、')}・到年齡 ${x.age} 小時</span></td><td class="hint">${STATKEYS.map(k=>SN[k]+' '+x.after[k]).join('、')}</td><td class="num">${x.fat}</td></tr>`).join('');
  return `<div class="tw"><table><thead><tr><th class="num">#</th><th>做什麼</th><th>做完後的能力</th><th class="num">疲勞</th></tr></thead><tbody>${rows||'<tr><td colspan="4">不用訓練。</td></tr>'}</tbody></table></div>`;
}
function svPredictText(v){
  const ctx=svCtx(v), d=DG[v.cur], lv=d.level, thr=EVO_AT[lv];
  if(lv===5) return {P:null, html:'<p>完全體沒有下一階段。</p>'};
  if(lv===1){ const to=(D.evo[v.cur]?.to||[])[0]; return {P:null, html:`<p>幼年期 I 到 6 小時自動進化${to?'成 <b>'+DG[to].name+'</b>':''}。</p>`}; }
  const P=predictEvo(ctx); let h='';
  const clock=`遊戲時間 ${String(v.hh).padStart(2,'0')}:${String(v.mm).padStart(2,'0')}`;
  if(P.best!==-1){
    h = v.age>=thr ? `<div class="note ok-note">年齡 ${v.age} 小時，已過 ${thr} 小時的進化時間。讀檔後下一個整點（${clock}，約 ${60-v.mm} 分鐘後）就會進化成 <b>${DG[P.best].name}</b>。</div>`
      : `<div class="note ok-note">數值不變的話，年齡到 ${thr} 小時（還有 ${thr-v.age} 小時）會進化成 <b>${DG[P.best].name}</b>。</div>`;
  } else if(lv===3){ const R=numemonRisk(ctx); h=`<div class="note">${R.text}</div>`; }
  else if(lv===4){ h=`<div class="note">目前沒有完全體合資格，${v.age>=thr?'每小時會再判定；':'到 '+thr+' 小時開始每小時判定；'}數值不變的話不會進化。剩餘壽命約 ${v.life} 小時。${v.age<360?'年齡剛好 360 小時時有 50% 變成宇宙腦魔（還有 '+(360-v.age)+' 小時）。':''}</div>`; }
  else h='<div class="note">按目前數值，沒有候選合資格。</div>';
  return {P, html:h};
}
function vSave(){
  const L=S.svList||[]; if(S.svSel>=L.length) S.svSel=0; const v=L[S.svSel];
  let body='';
  if(v){
    const ctx=svCtx(v), d=DG[v.cur], lv=d.level; const pr=svPredictText(v);
    const summ=`<div class="kpis"><div><span>數碼精靈</span><b class="big">${esc(d.name)}</b><span>${LV[lv]}</span></div><div><span>年齡</span><b class="big">${v.age} 小時</b></div><div><span>體重</span><b class="big">${v.weight}g</b></div><div><span>失誤</span><b class="big">${v.mis}</b></div></div>
      <div class="lcd" style="margin-top:4px"><div class="st">${STATKEYS.map(k=>`<div><span>${SN[k]}</span><b>${v.stats[k]}</b></div>`).join('')}<div><span>教養</span><b>${v.dis}</b></div><div><span>心情</span><b>${v.hap}</b></div><div><span>戰鬥</span><b>${v.win}</b></div><div><span>技能數</span><b>${v.tech}</b></div><div><span>壽命</span><b>${v.life}</b></div></div></div>
      <p class="hint">遊戲時間第 ${v.day+1} 天 ${String(v.hh).padStart(2,'0')}:${String(v.mm).padStart(2,'0')}。以前養過：${v.raised.map(i=>DG[i].name).join('、')||'沒有'}。存檔沒有記錄疲勞，訓練模擬用「育成紀錄」的疲勞 ${S.fat}。</p>
      <button class="b p" data-svapply="1">把這些數值套用到「我的精靈」和「育成紀錄」</button>`;
    let cand='';
    if(pr.P && pr.P.rows.length){
      cand=`<div class="tw"><table class="stk"><thead><tr><th>候選</th><th>組數</th>${pr.P.avgMode?'<th>比較平均</th>':''}<th>狀態</th></tr></thead><tbody>${pr.P.rows.map(r=>`<tr><td class="c1"><b>${r.order}. ${DG[r.id].name}</b>${r.raised?' <span class="pill">養過</span>':''}</td><td data-l="組數">${r.met}／4${r.eff!==r.met?' → '+r.eff:''}</td>${pr.P.avgMode?`<td data-l="比較平均">${r.avg??'—'}</td>`:''}<td data-l="狀態">${pr.P.best===r.id?'<span class="pill ok">最有可能</span>':r.eff>=3?'<span class="pill w">合資格</span>':`<span class="hint">欠 ${r.groups.filter(g=>!g.ok).map(g=>g.name.replace('（任一）','')).join('、')}</span>`}</td></tr>`).join('')}</tbody></table></div>`;
    }
    // 目標
    let goalHTML='';
    if(pr.P && (pr.P.rows.length || lv===3)){
      const goals=pr.P.rows.map(r=>r.id); if(lv===3) goals.push(NUMEMON);
      if(!goals.includes(S.svGoal)) S.svGoal=(pr.P.best!==-1?pr.P.best:goals[0]);
      const g=S.svGoal; let res='';
      if(g===NUMEMON){
        const R=numemonRisk(ctx); const A=evoAdvice(NUMEMON,ctx);
        res = R.p===100? `<div class="verdict ok"><b>可以。</b>${R.text}</div>` : `<div class="verdict no"><b>${R.text.replace(/<\/?b>/g,'')}</b></div>`;
        res+=`<ul class="ml2 tips">${A.tips.map(t=>`<li>${t}</li>`).join('')}</ul>`;
      } else {
        const G=goalPlan(ctx,g);
        if(G.impossible) res=`<div class="verdict no"><b>不可能。</b>${G.F.imp.map(esc).join('；')}。</div><p class="hint">這一代沒辦法了。下一代可以預先避開這些情況。</p>`;
        else {
          const fx=G.F.fixes.length? `<p><b>先處理這些（能力以外的條件）：</b></p><ul class="ml2 tips">${G.F.fixes.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:'';
          const r=G.best;
          if(r){
            res=`<div class="verdict ok"><b>可以。</b>照下面的訓練共 ${r.n} 次、休息 ${r.restH} 小時${r.waitH>1?'、等待 '+(r.waitH-1)+' 小時':''}，約 <b>${r.hours} 小時後（年齡 ${r.age} 小時）</b>進化成 <b>${DG[g].name}</b>。</div>${fx}${svStepsTable(r,ctx)}`;
          } else {
            const w=G.worst; let why='';
            if(w.res==='dead') why=`壽命不夠：大約 ${w.hours} 小時後壽命就會用完。`;
            else if(w.res==='nogym') why=`選擇的訓練場地沒有可以練${SN[w.why]}的項目，請在下面加入場地。`;
            else if(w.res==='stuck') why='能力練到上限仍然勝不過其他候選。';
            else if(w.res===NUMEMON) why=`來不及：練到第 ${w.hours} 小時（年齡 ${w.age}）仍未合資格，會變成鼻涕獸。`;
            else {
              const P2=predictEvo({...G.ctx2,stats:w.st}); const row=P2.rows.find(x=>x.id===w.res);
              const ways=row?breakWays(row,g):[];
              why=`照計劃訓練，第 ${w.hours} 小時（年齡 ${w.age}）會先進化成 <b>${DG[w.res].name}</b>。${ways.length?'要避開它，訓練前先令它少於 3 組：'+ways.join('；或 ')+'。':''}`;
              if(w.hours<=1 && lv>=2 && v.age>=EVO_AT[lv]) why+=' 因為已過進化時間，讀檔後第一個整點就會判定。';
            }
            res=`<div class="verdict no"><b>按存檔現況做不到。</b>${why}</div>${fx}${w.steps.length?`<details><summary>看看照計劃訓練會怎樣（到 ${DG[w.res]?.name||'停止'}為止）</summary>${svStepsTable(w,ctx)}</details>`:''}`;
          }
        }
      }
      goalHTML=`<section class="panel"><h2>選擇進化目標 <small>訓練一次＝遊戲 1 小時</small></h2>
        <label class="f">我想進化成<select id="sel-svgoal">${goals.map(id=>`<option value="${id}"${id===g?' selected':''}>${DG[id].name}${id===NUMEMON?'（成長期期滿未進化）':''}</option>`).join('')}</select></label>
        ${res}
        <details><summary>訓練設定（和「訓練計劃」共用）</summary><div class="list" style="margin-top:6px">${GYMS.map(g=>`<label><input type="checkbox" data-pgym="${g.id}" ${S.planGyms.includes(g.id)?'checked':''}> ${g.name}</label>`).join('')}</div>
          <label class="f">休息方式<select id="sel-prest">${Object.entries(REST).map(([k,x])=>`<option value="${k}"${k===S.planRest?' selected':''}>${x.name}（每小時 −${x.per}）</option>`).join('')}</select></label>
          <label class="f">疲勞到多少前要休息<input type="number" id="f-planCap" data-k="planCap" value="${S.planCap}" min="20" max="100"></label></details>
        <p class="hint">模擬方法：每次訓練或休息都是遊戲 1 小時，年齡 +1；年齡到了進化時間後，每小時照遊戲規則判定一次，所以訓練途中其他候選先合資格就會先進化。體重、失誤和額外加成假設照「先處理」一欄做好且不再改變；吃飯、睡覺的時間沒有計入，實際需要的時間會更長。</p></section>`;
    }
    body=`<section class="panel"><h2>存檔內容 <small>${esc(v.title||'')}</small></h2>${summ}</section>
      <section class="panel"><h2>最有可能的進化</h2>${pr.html}${cand}</section>${goalHTML}`;
  }
  $('#view').innerHTML=`<div class="grid">
    <section class="panel"><h2>上載存檔 <small>PS1 記憶卡</small></h2>
      <label class="f">選擇記憶卡檔案<input type="file" id="sv-file" accept=".mcr,.mcd,.mc,.srm,.mcs,.psv,.gme,.vmp,.mem,.vgs,.ddf,.bin,.dat,application/octet-stream"></label>
      ${L.length>1?`<label class="f">卡內的「數碼暴龍世界」存檔<select id="sel-svsel">${L.map((x,i)=>`<option value="${i}"${i===S.svSel?' selected':''}>存檔 ${x.n}：${esc(x.title||DG[x.cur].name)}</option>`).join('')}</select></label>`:''}
      ${S.svErr?`<div class="note">${esc(S.svErr)}</div>`:''}
      <p class="hint">支援 .mcr／.mcd／.srm 等整張記憶卡，以及 .mcs、.psv、.gme 單一存檔（日版 Rev 1）。檔案只在你的瀏覽器裡讀取，不會上載到任何伺服器，也不會被修改。</p>
    </section>${body}</div>`;
}
function svApply(){
  const v=(S.svList||[])[S.svSel]; if(!v) return;
  Object.assign(S,{cur:v.cur, stats:{...v.stats}, weight:v.weight, mis:v.mis, win:v.win, hap:v.hap, dis:v.dis, age:v.age, tech:v.tech, learned:v.learned.slice(), raised:v.raised.slice(), sample:false});
  if(DG[v.cur].level>=2 && S.svGoal!==undefined) S.evoGoal=S.svGoal;
}
