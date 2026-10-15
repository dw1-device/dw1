/* ---------- RetroArch 實時連線（配合 dw1_bridge.py） ---------- */
const LIVE={on:false,timer:null,last:'',err:'',stat:'',t:0,pending:false,para:null,busy:false};
function liveUrl(){ if(S.liveUrl) return S.liveUrl; return (location.protocol.startsWith('http')&&location.port==='55356')? location.origin : 'http://127.0.0.1:55356'; }
function liveToV(j){
  const recruited=RECRUITS.map(r=>r[0]).filter(nm=>{ const d=D.digis.find(x=>x.name===nm); return d && j.recruitedIds.includes(d.id); });
  return {n:1,title:'RetroArch 實時',cur:j.cur,stats:j.stats,dis:j.dis,hap:j.hap,days:j.days,weight:j.weight,life:j.life,mis:j.mis,win:j.win,age:j.age,poop:j.poop,fat:j.fat,lives:j.lives,
    tech:j.learned.length,learned:j.learned.filter(x=>x!==48&&x!==57),raised:j.raisedIds.filter(i=>DG[i]),recruited,day:j.day,hh:j.hh,mm:j.mm,live:true};
}
function liveBusyInput(){ const a=document.activeElement; return a && a.closest && a.closest('#view') && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.id!=='liveBtn'; }
async function liveTick(){
  if(LIVE.busy) return; LIVE.busy=true;
  try{
    const r=await fetch(liveUrl()+'/state',{cache:'no-store'}); const j=await r.json();
    if(!j.ok){ LIVE.stat='wait'; LIVE.err=j.error||'讀不到遊戲'; }
    else if(!DG[j.cur]){ LIVE.stat='wait'; LIVE.err='讀到的種類編號 '+j.cur+' 不正確（遊戲可能在標題畫面）'; }
    else {
      LIVE.stat='ok'; LIVE.err=''; LIVE.t=Date.now(); LIVE.para=j.para;
      const v=liveToV(j); const key=JSON.stringify(v);
      if(key!==LIVE.last){
        const first=!LIVE.last; LIVE.last=key; S.svList=[v]; S.svSel=0; S.svFile='RetroArch 實時'; S.svErr=''; svApply();
        if(first) S.log.push(`RetroArch 實時連線：${DG[v.cur].name}`);
        if(liveBusyInput()){ LIVE.pending=true; renderLCD(); save(); } else render();
      }
    }
  }catch(e){ LIVE.stat='err'; LIVE.err='連不上小程式（'+e.message+'）'; }
  LIVE.busy=false; liveBadge();
}
function liveBadge(){ const el=$('#liveStat'); if(el) el.innerHTML=liveStatText(); const b=$('#lcdLive'); if(b) b.className='livedot '+(LIVE.on?LIVE.stat:''); }
function liveStatText(){
  if(!LIVE.on) return '<span class="hint">未連線</span>';
  if(LIVE.stat==='ok') return `<span class="pill ok">● 實時中</span> <span class="hint">最後更新 ${new Date(LIVE.t).toLocaleTimeString()}</span>`;
  if(LIVE.stat==='wait') return `<span class="pill w">等待遊戲</span> <span class="hint">${esc(LIVE.err)}</span>`;
  if(LIVE.stat==='err') return `<span class="pill no">未連上</span> <span class="hint">${esc(LIVE.err)}。${location.protocol==='https:'?'在 claude.ai 開啟時瀏覽器可能會擋，請改開 http://127.0.0.1:55356/ 。':'請確認小程式正在運行。'}</span>`;
  return '<span class="hint">連線中…</span>';
}
function liveStart(){ if(LIVE.on) return; LIVE.on=true; LIVE.last=''; LIVE.stat=''; liveTick(); LIVE.timer=setInterval(liveTick,1000); render(); }
function liveStop(){ LIVE.on=false; clearInterval(LIVE.timer); LIVE.timer=null; LIVE.stat=''; render(); }
document.addEventListener('focusout',()=>{ if(LIVE.pending){ setTimeout(()=>{ if(!liveBusyInput()&&LIVE.pending){ LIVE.pending=false; render(); } },50); } });
function livePanel(){
  const para=LIVE.para? `<details><summary>原始育成數值（用來找出其他欄位）</summary><div class="paragrid">${LIVE.para.map((x,i)=>`<span><b>+${i*2}</b> ${x}</span>`).join('')}</div></details>`:'';
  return `<section class="panel"><h2>RetroArch 實時連線 <small>電腦版</small></h2>
    <div class="row"><button class="b p" id="liveBtn">${LIVE.on?'中斷連線':'實時連線'}</button><span id="liveStat">${liveStatText()}</span></div>
    <label class="f">小程式位址<input id="f-liveurl" value="${esc(liveUrl())}"></label>
    <ol class="ml2 tips"><li>RetroArch：設定 → 網絡 → 開啟「網絡指令」（連接埠 55355），用 Beetle PSX 或 SwanStation 核心開始遊戲（日版 Rev 1）。</li>
      <li>在終端機運行 <code>python3 dw1_bridge.py</code>（和 index.html 放在同一個資料夾）。</li>
      <li>瀏覽器開 <code>http://127.0.0.1:55356/</code>，網頁會自動連線；之後每秒更新，訓練、戰鬥、吃東西都不用存檔。</li></ol>
    <p class="hint">小程式只讀取遊戲記憶體，不會改動遊戲，也不會連接互聯網。</p>${para}</section>`;
}
if(location.protocol.startsWith('http') && location.port==='55356') setTimeout(liveStart,300);
