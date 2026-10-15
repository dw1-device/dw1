/* ---------- 開始之街食堂（DG.SCN 第 274～280 區塊，日版 Rev 1） ----------
   進店時決定廚師（劇本 0x3420 附近）：
   1. 宇宙腦魔已加入：亂數 0～99 ≤ 19 → 宇宙腦魔（約 20%）
   2. 蛋蛋獸已加入：再擲一次 ≤ 9 → 蛋蛋獸（約 10%）
   3. 按時鐘：0～5 時加魯魯獸、6～11 時巨龍獸、12～17 時火焰獸、18～23 時雪人獸（該廚師已加入）
   4. 否則：火焰獸 → 巨龍獸 → 加魯魯獸 → 雪人獸 中第一個已加入的
   每道菜：攻、防、速、智、HP、MP、疲勞、心情、教養、飽足、體重（劇本指令 0x35 加、0x36 減）。肚子不餓不能吃。 */
const DINER_KEYS=['atk','def','spd','int','hp','mp','fat','hap','dis','food','w'];
const DINER_LAB={atk:'攻',def:'防',spd:'速',int:'智',hp:'HP',mp:'MP',fat:'疲勞',hap:'心情',dis:'教養',food:'飽足',w:'體重'};
const DINER=[
 {chef:'火焰獸', hours:[12,18], dishes:[
   ['赤熱拉麵','赤熱ラーメン',400,[1,0,0,1,0,0,-5,2,0,20,2]],
   ['燃燒咖哩','バーニングカレー',1200,[3,0,0,2,0,0,-5,4,0,26,3]],
   ['熔岩風火鍋','溶岩風なべ',3500,[5,0,0,3,0,0,-5,6,1,20,4]]]},
 {chef:'巨龍獸', hours:[6,12], dishes:[
   ['暴君龍蕎麥麵','暴君竜そば',400,[0,1,1,0,10,0,-5,2,0,18,2]],
   ['恐龍薄餅','ザウルスピザ',1000,[0,3,2,0,30,0,-5,4,0,28,3]],
   ['侏羅紀漢堡','ジュラシックバーガー',2500,[0,5,3,0,50,0,-5,8,1,35,4]]]},
 {chef:'加魯魯獸', hours:[0,6], dishes:[
   ['帶骨牛排','骨つきステーキ',1000,[0,0,0,1,10,0,-5,0,1,30,3]],
   ['豪華帶骨牛排','ＤＸ骨つきステーキ',2500,[0,0,0,2,30,0,-5,1,2,40,4]],
   ['夢幻帶骨牛排','幻の骨つきステーキ',5000,[0,0,0,3,50,0,-5,2,3,50,5]]]},
 {chef:'雪人獸', hours:[18,24], dishes:[
   ['融雪奶昔','雪解けシェイク',300,[0,0,1,0,0,10,-2,3,0,12,2]],
   ['雪糕','アイスクリーム',700,[0,0,2,0,0,30,-2,5,0,16,3]],
   ['絕對零度刨冰','絶対零度カキ氷',1600,[0,0,2,0,0,50,-2,7,1,20,4]]]},
 {chef:'宇宙腦魔', rand:'約 20%', dishes:[
   ['宇宙沙律','宇宙サラダ',1500,[1,1,1,1,10,10,-5,1,1,20,0]],
   ['不明飛行湯','未確認飛行スープ',4000,[2,2,2,2,20,20,-5,2,2,30,1]],
   ['銀河全餐','ギャラクシーフルコース',9000,[3,3,3,3,30,30,-5,3,3,45,5]]]},
 {chef:'蛋蛋獸', rand:'約 10%', dishes:[
   ['謎之水煮蛋','謎のゆでタマゴ',1000,[[1,0,1,0,10,0,-5,1,0,18,1],[0,1,0,1,0,10,-5,1,0,18,1],[2,2,2,2,20,20,-5,2,1,18,1]]],
   ['謎之玉子燒','謎のタマゴやき',2500,[[2,0,2,0,20,0,-5,2,0,24,2],[0,2,0,2,0,20,-5,2,0,24,2],[3,3,3,3,30,30,-5,3,1,24,2]]],
   ['謎之雞蛋丼','謎のタマゴどん',6000,[[3,0,3,0,30,0,-5,3,1,36,3],[0,3,0,3,0,30,-5,3,1,36,3],[4,4,4,4,40,40,-5,4,3,36,3]]]]},
];
const DINER_MAIN=['火焰獸','巨龍獸','加魯魯獸','雪人獸'];
function dinerChef(hour, got){
  const main=DINER.filter(c=>c.hours&&got.has(c.chef));
  const slot=main.find(c=>hour>=c.hours[0]&&hour<c.hours[1]);
  const base= slot? slot.chef : (DINER_MAIN.find(n=>got.has(n))||null);
  return {base, vade:got.has('宇宙腦魔'), digi:got.has('蛋蛋獸')};
}
function dinerFx(v){ return DINER_KEYS.map((k,i)=>[k,v[i]]).filter(([k,x])=>x).map(([k,x])=>`<span class="fx ${k==='fat'?(x<0?'g':'b'):x>0?'g':'b'}">${DINER_LAB[k]} ${x>0?'+':''}${x}</span>`).join(' '); }
function vDiner(){
  const got=new Set(S.recruited||[]); const hr=S.clock??12;
  const now=dinerChef(hr,got); const anyChef=DINER.some(c=>got.has(c.chef));
  const want=S.dinerWant||'';
  const loc=n=>{ const r=RECRUITS.find(r=>r[0]===n); return r? r[1] : ''; };
  let nowHTML;
  if(!anyChef) nowHTML='<div class="note">還沒有廚師加入，食堂未開張。招募火焰獸、巨龍獸、加魯魯獸、雪人獸其中一隻後開張（在「繁榮度」勾選已加入的精靈，或上載存檔自動讀取）。</div>';
  else {
    const parts=[]; if(now.vade) parts.push('約 20% 是宇宙腦魔'); if(now.digi) parts.push(`約 ${now.vade?'8':'10'}% 是蛋蛋獸`);
    nowHTML=`<div class="note ok-note">現在 ${hr} 時進店：${now.base?`<b>${now.base}</b>當值`:'沒有當值廚師'}${parts.length?`；${parts.join('、')}（每次進店重新決定）`:''}。</div>`;
  }
  const sched=`<div class="dsched">${[...Array(24).keys()].map(h=>{ const c=dinerChef(h,got).base; const on=h===hr; return `<div class="dh${on?' on':''}" title="${h} 時：${c||'—'}"><span>${h}</span><i class="c${c?DINER_MAIN.indexOf(c):'x'}"></i></div>`; }).join('')}</div>
    <div class="dleg">${DINER_MAIN.map((n,i)=>`<span><i class="c${i}"></i>${n}${got.has(n)?'':'（未加入）'}</span>`).join('')}</div>`;
  const wantOpts=[['','全部'],['atk','攻擊'],['def','防禦'],['spd','速度'],['int','智力'],['hp','HP'],['mp','MP'],['dis','教養'],['hap','心情']];
  const cards=DINER.map(c=>{
    const joined=got.has(c.chef); const when=c.hours? `${c.hours[0]}～${c.hours[1]-1} 時` : `進店時${c.rand}`;
    const rows=c.dishes.map(([tc,jp,price,fx])=>{
      const multi=Array.isArray(fx[0]); const list=multi?fx:[fx];
      const hit=!want || list.some(v=>v[DINER_KEYS.indexOf(want)]>0);
      return `<tr class="${hit?'':'dim'}"><td class="c1"><b>${tc}</b><br><span class="hint">${jp}</span></td><td class="num" data-l="價錢">${price}</td><td data-l="效果">${multi? list.map((v,i)=>`<div><span class="hint">${['甲','乙','丙'][i]}：</span>${dinerFx(v)}</div>`).join('') : dinerFx(fx)}</td></tr>`; }).join('');
    return `<section class="panel${joined?'':' faded'}"><h2>${c.chef} <small>${when}</small></h2>
      <p class="hint">${joined?'<span class="pill ok">已加入</span> ':'<span class="pill">未加入</span> '}招募地點：${esc(loc(c.chef))}${c.chef==='蛋蛋獸'?'。三款效果（甲、乙、丙）隨機出其中一款，各約 1/3。':''}</p>
      <div class="tw"><table class="stk"><thead><tr><th>料理</th><th class="num">價錢 ｛｝</th><th>效果</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
  }).join('');
  $('#view').innerHTML=`<div class="grid">
    <section class="panel"><h2>開始之街食堂 <small>誰在當值</small></h2>
      <label class="f">現在時間（時，0～23）<input type="number" id="f-clock" data-k="clock" value="${hr}" min="0" max="23"></label>
      ${nowHTML}${sched}
      <ul class="ml2 tips">
        <li>兩隻或以上廚師加入後，四位主廚輪班：0～5 時加魯魯獸、6～11 時巨龍獸、12～17 時火焰獸、18～23 時雪人獸。只有一位加入時，全日都是他。</li>
        <li>當值的主廚還沒加入時，由火焰獸 → 巨龍獸 → 加魯魯獸 → 雪人獸中第一位已加入的代班。</li>
        <li>宇宙腦魔、蛋蛋獸加入後，每次進店先擲骰：約 20% 是宇宙腦魔，其次約 10% 是蛋蛋獸。不是想要的廚師，可以出店再進。</li>
        <li>肚子不餓不能點菜。每道菜都會回復疲勞（雪人獸 −2，其他 −5），並增加心情、飽足和體重；能力加成是永久的。</li>
        <li>蛋蛋獸的菜有程式錯誤：判斷「肚子不餓」失敗時會繼續往下執行，有機會不餓也能吃。</li>
      </ul>
      <label class="f">想加哪一項能力<select id="sel-dwant">${wantOpts.map(([k,n])=>`<option value="${k}"${k===want?' selected':''}>${n}</option>`).join('')}</select></label>
      <p class="hint">資料從遊戲劇本檔解析（日版 Rev 1）。價錢單位是｛｝（Bit）。</p>
    </section>${cards}</div>`;
}
