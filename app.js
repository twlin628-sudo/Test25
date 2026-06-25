/* ════════════════════════════════════════════════════════════
   時空料理 — M2（完整核心迴圈）
   雙軸時間 + 條件熟成(持久化) + 紀元 + 庫存 + 配方 + 委託 + 結局
   純前端、零依賴。對齊《系統規格書》《內容聖經》《進程地圖》《敘事文案》。
   ════════════════════════════════════════════════════════════ */

/* ───────── 紀元 ───────── */
const ERAS = {
  apocalypse:{ id:"apocalypse", name:"文明終末", envTags:[],        tools:[],        commons:[] },
  industrial:{ id:"industrial", name:"工業時代", envTags:["freeze"],tools:["oven"],  commons:["milk","dough","egg"] },
  medieval:  { id:"medieval",   name:"中世紀",   envTags:["warm"],  tools:["barrel"],commons:["grape","honey"] },
};
const ERA_ORDER = ["apocalypse","industrial","medieval"];

/* ───────── 食材（forms + transitions；對齊內容聖經 §2/§3）─────────
   transition: { from, at(絕對年齡天), to, requiresEnv? }
   解析時：年齡達標的轉換中，優先「環境符合的條件轉換」，否則取「無條件轉換」，否則停滯。 */
const INGREDIENTS = {
  milk:{ id:"milk", name:"牛奶", base:"milk.fresh", commons:true, forms:{
      "milk.fresh":{name:"牛奶",art:"milk",tag:"fresh"}, "milk.spoiled":{name:"腐敗牛奶",art:"milk",tag:"spoiled"},
      "cheese.fresh":{name:"起司",art:"cheese",tag:"normal"}, "cheese.aged":{name:"陳年起司",art:"cheese",tag:"rare"},
      "cheese.fossil":{name:"化石起司",art:"cheese",tag:"fossil"} },
    transitions:[ {from:"milk.fresh",at:7,to:"milk.spoiled"}, {from:"milk.spoiled",at:30,to:"cheese.fresh"},
      {from:"cheese.fresh",at:365,to:"cheese.aged"}, {from:"cheese.aged",at:36500,to:"cheese.fossil"} ]},
  grape:{ id:"grape", name:"葡萄", base:"grape.fresh", forms:{
      "grape.fresh":{name:"葡萄",art:"grape",tag:"fresh"}, "raisin.fresh":{name:"葡萄乾",art:"raisin",tag:"normal"},
      "raisin.dry":{name:"乾癟葡萄乾",art:"raisin",tag:"spoiled"}, "dust.generic":{name:"塵",art:"dust",tag:"fossil"} },
    transitions:[ {from:"grape.fresh",at:7,to:"raisin.fresh"}, {from:"raisin.fresh",at:90,to:"raisin.dry"},
      {from:"raisin.dry",at:3650,to:"dust.generic"} ]},
  honey:{ id:"honey", name:"蜂蜜", base:"honey.fresh", forms:{
      "honey.fresh":{name:"蜂蜜",art:"honey",tag:"fresh"}, "honey.crystal":{name:"結晶蜂蜜",art:"crystal_honey",tag:"normal"},
      "honey.ancient":{name:"古代蜂蜜",art:"crystal_honey",tag:"rare"}, "honey.amber":{name:"琥珀蜂蜜",art:"amber_honey",tag:"mythic"} },
    transitions:[ {from:"honey.fresh",at:365,to:"honey.crystal"}, {from:"honey.crystal",at:36500,to:"honey.ancient"},
      {from:"honey.ancient",at:365000,to:"honey.amber"} ]},
  dough:{ id:"dough", name:"麵團", base:"dough.raw", forms:{
      "dough.raw":{name:"生麵團",art:"dough",tag:"fresh"}, "dough.fermented":{name:"發酵麵團",art:"dough",tag:"normal"},
      "dough.dried":{name:"乾硬麵團",art:"dough",tag:"spoiled"}, "dough.sour":{name:"酸種麵團",art:"dough",tag:"normal"},
      "dough.petrified":{name:"石化麵團",art:"dough",tag:"fossil"} },
    transitions:[ {from:"dough.raw",at:1,to:"dough.fermented",requiresEnv:"warm"}, {from:"dough.raw",at:1,to:"dough.dried"},
      {from:"dough.fermented",at:7,to:"dough.sour"}, {from:"dough.fermented",at:365,to:"dough.petrified"},
      {from:"dough.sour",at:365,to:"dough.petrified"}, {from:"dough.dried",at:365,to:"dough.petrified"} ]},
  egg:{ id:"egg", name:"蛋", base:"egg.fresh", forms:{
      "egg.fresh":{name:"蛋",art:"egg",tag:"fresh"}, "chick.fresh":{name:"幼雛",art:"chick",tag:"normal"},
      "hen.fresh":{name:"母雞",art:"hen",tag:"rare"}, "egg.rotten":{name:"腐蛋",art:"egg",tag:"spoiled"} },
    transitions:[ {from:"egg.fresh",at:7,to:"chick.fresh",requiresEnv:"warm"}, {from:"egg.fresh",at:14,to:"egg.rotten"},
      {from:"chick.fresh",at:30,to:"hen.fresh"} ]},
  /* 配方產物（亦為 ingredient，便於後續熟成） */
  bread:{ id:"bread", name:"麵包", base:"bread.fresh", forms:{
      "bread.fresh":{name:"麵包",art:"bread",tag:"normal"}, "bread.stale":{name:"乾硬麵包",art:"bread",tag:"spoiled"},
      "bread.mold":{name:"發霉麵包",art:"bread",tag:"spoiled"}, "bread.fossil":{name:"化石麵包",art:"bread",tag:"fossil"} },
    transitions:[ {from:"bread.fresh",at:7,to:"bread.stale"}, {from:"bread.stale",at:30,to:"bread.mold"},
      {from:"bread.mold",at:3650,to:"bread.fossil"} ]},
  wine:{ id:"wine", name:"葡萄酒", base:"wine.fresh", forms:{
      "wine.fresh":{name:"新釀葡萄酒",art:"wine",tag:"normal"}, "wine.aged":{name:"陳年葡萄酒",art:"wine",tag:"rare"},
      "wine.mythic":{name:"神話級葡萄酒",art:"wine",tag:"mythic"} },
    transitions:[ {from:"wine.fresh",at:365,to:"wine.aged"}, {from:"wine.aged",at:1095000,to:"wine.mythic"} ]},
  eternal:{ id:"eternal", name:"永恆三明治", base:"eternal_sandwich", forms:{
      "eternal_sandwich":{name:"永恆三明治",art:"eternal_sandwich",tag:"mythic"} }, transitions:[] },
};

/* formId → 形態定義（含所屬 ingredient） */
const FORMS = {};
const ALL_FORMS = [];
for(const ing of Object.values(INGREDIENTS))
  for(const [fid,def] of Object.entries(ing.forms)){
    FORMS[fid] = { formId:fid, ...def, ingredient:ing.id };
    ALL_FORMS.push(FORMS[fid]);
  }

/* ───────── 配方（內容聖經 §3）───────── */
const RECIPES = [
  { id:"bake_bread", name:"烤麵包", tool:"oven", era:null, output:"bread",
    inputs:[ {match:{formId:"dough.fermented"}, count:1} ] },
  { id:"make_wine", name:"釀葡萄酒", tool:"barrel", era:"medieval", output:"wine",
    inputs:[ {match:{formId:"grape.fresh"}, count:1} ] },
  { id:"eternal", name:"永恆三明治", tool:null, era:null, output:"eternal", hidden:true,
    inputs:[ {match:{art:"bread", notTag:"fossil"}, count:1},
             {match:{tag:"rare", art:"cheese"}, count:1},
             {match:{formId:"honey.ancient"}, count:1} ] },
];

/* ───────── 委託（敘事文案 §3 + 進程地圖）───────── */
const ORDERS = {
  o_milk:{ id:"o_milk", name:"失落的乳香", next:"o_wine",
    desc:"……還記得那雪白之液麼？盛於器中，靜待月色流轉，便會凝成另一種濃香。——倘若你尚記得『等待』為何物。",
    hint:"目標：把牛奶熟成，看看會變成什麼。",
    done:"酪成。焦黑的第一頁，補上了一角。",
    goal:()=> [...codex].some(f=> FORMS[f] && FORMS[f].ingredient==="milk" && f.startsWith("cheese")),
    reward:()=>{ if(!S.unlocked.actions.includes("era_switch")){ S.unlocked.actions.push("era_switch"); S.unlocked.eras.push("industrial","medieval"); } } },
  o_wine:{ id:"o_wine", name:"釀酒師的遺願", next:"o_pharaoh",
    desc:"葡萄入桶，封之。其後唯一要事，便是讓時間經過。一年尚淺，百年方醇……老朽已無那許多年歲。但你有。",
    hint:"目標：到中世紀用木桶釀酒，再讓它陳年。",
    done:"酒香穿越了時間。某位釀酒師，會欣慰的。",
    goal:()=> codex.has("wine.aged"), reward:()=>{} },
  o_pharaoh:{ id:"o_pharaoh", name:"法老的盛宴", next:null,
    desc:"昔有王者，欲嚐『永恆』之味。麵餅、陳酪、與千歲之蜜，三者相疊——據說嚐過的人，便不再畏懼時間。",
    hint:"目標：湊齊 麵包 + 陳年起司 + 古代蜂蜜，調理成一物。",
    done:"__ENDING__",
    goal:()=> codex.has("eternal_sandwich"), reward:()=>{} },
};
const ENDING_TEXT =
"永恆三明治成。\n書頁泛起久違的金光，焦痕一寸寸退去——\n但翻過這一頁，其後仍是大片空白。\n\n料理文明的重建，才剛剛開始。\n〔未完待續〕";

/* 形態描述（敘事文案 §4.2） */
const COPY = {
 "milk.fresh":"尋常的雪白之液。一切的起點。","milk.spoiled":"過了頭。但別急著倒掉——壞，有時也是一種路。",
 "cheese.fresh":"乳之凝華。月餘可成。","cheese.aged":"歲月為它鍍上金邊。愈陳，愈貴。","cheese.fossil":"堅如磐石。已非食物，卻仍是某些古法的材料。",
 "grape.fresh":"飽滿的一串。陽光封存其中。","raisin.fresh":"水分褪去，甜味留下。","raisin.dry":"再乾一些，便所剩無幾了。","dust.generic":"萬物的終點，也是某些開始。",
 "dough.raw":"麵粉與水的約定。尚未甦醒。","dough.fermented":"在溫暖中甦醒、呼吸、膨脹。","dough.dried":"無人喚醒它，於是它乾硬了。","dough.sour":"久候之下，酸香漸生。","dough.petrified":"歲月把它變成了石頭。",
 "egg.fresh":"一枚蛋。裡頭藏著一個未定的未來。","chick.fresh":"溫暖喚出了生命。啾。","hen.fresh":"牠會下蛋——時間的循環，就此展開。","egg.rotten":"沒有溫暖，只剩一聲嘆息。",
 "honey.fresh":"金黃黏稠。據說它永不腐壞。","honey.crystal":"時間讓它凝成糖砂。","honey.ancient":"蜜不會壞。它只會變得更老、更貴。","honey.amber":"蜜的盡頭，是琥珀。連光都被封在裡面。",
 "bread.fresh":"火與時間的合謀。","bread.stale":"放久了，硬了。","bread.mold":"綠斑爬上了麵包。","bread.fossil":"連黴菌都放棄了。",
 "wine.fresh":"新釀。青澀，但有潛力。","wine.aged":"時間替它做完了所有的事。","wine.mythic":"封存了三千年的光陰。一滴，足矣。",
 "eternal_sandwich":"三個時代，疊成一口。嚐過的人，不再畏懼時間。",
};

/* 歲月之軸節點 */
const NODES = [ {d:0,label:"今日"},{d:30,label:"一月"},{d:365,label:"一年"},{d:36500,label:"百年"},{d:365000,label:"千年"},{d:1095000,label:"三千年"} ];
const MAX_DAYS = 1095000, SLIDER_MAX = 1000;

/* ───────── 引擎（純函式）───────── */
function resolveForm(item, eraId){
  const ing = INGREDIENTS[item.id]; if(!ing) return item.formId;
  const env = (ERAS[eraId] && ERAS[eraId].envTags) || [];
  let form = item.formId;
  for(let i=0;i<24;i++){
    const ts = ing.transitions.filter(t=> t.from===form && item.ageDays >= t.at);
    if(!ts.length) break;
    const pick = ts.find(t=> t.requiresEnv && env.includes(t.requiresEnv)) || ts.find(t=> !t.requiresEnv);
    if(!pick || pick.to===form) break;
    form = pick.to;
  }
  return form;
}
function itemMatches(item, m){
  const f = FORMS[item.formId]; if(!f) return false;
  if(m.formId) return item.formId === m.formId;
  if(m.art && f.art !== m.art) return false;
  if(m.tag && f.tag !== m.tag) return false;
  if(m.notTag && f.tag === m.notTag) return false;
  return true;
}
function matchRecipes(){
  const tools = ERAS[S.kitchenEra].tools, out = [];
  for(const r of RECIPES){
    if(r.tool && !tools.includes(r.tool)) continue;
    if(r.era && r.era !== S.kitchenEra) continue;
    const used = new Set(), consume = []; let ok = true;
    for(const inp of r.inputs){
      let need = inp.count;
      for(const it of S.inventory){
        if(used.has(it.uid)) continue;
        if(itemMatches(it, inp.match)){ used.add(it.uid); consume.push(it.uid); if(--need<=0) break; }
      }
      if(need>0){ ok=false; break; }
    }
    if(ok) out.push({ recipe:r, consume });
  }
  return out;
}
function sliderToDays(v){ const p=v/SLIDER_MAX; return p<=0?0:Math.round(Math.pow(10, p*Math.log10(MAX_DAYS+1))-1); }
function daysToSlider(d){ return d<=0?0:Math.round(SLIDER_MAX*Math.log10(d+1)/Math.log10(MAX_DAYS+1)); }
function formatAge(d){ if(d<=0)return"此刻"; if(d<30)return d+" 天"; if(d<365)return Math.round(d/30)+" 個月"; if(d<36500)return Math.round(d/365)+" 年"; return Math.round(d/365).toLocaleString()+" 年"; }

/* ───────── 存檔 ───────── */
const SAVE_KEY="chrono.save", SAVE_VERSION=3;
function defaultSave(){
  return { saveVersion:SAVE_VERSION, kitchenEra:"apocalypse",
    inventory:[{ uid:"i1", id:"milk", formId:"milk.fresh", ageDays:0, bornEra:"apocalypse" }],
    nextUid:2, codex:[], orders:{ active:"o_milk", done:[] },
    unlocked:{ actions:[], eras:["apocalypse"] }, settings:{ volume:0.8 },
    flags:{ ftueDone:false, ftueStep:0 }, stats:{ agings:0, discoveries:0 } };
}
function loadSave(){
  try{ const raw=localStorage.getItem(SAVE_KEY); if(!raw) return defaultSave();
    let s=JSON.parse(raw);
    // 既有存檔向前遷移：已在玩的人跳過 FTUE
    if((s.saveVersion??0) < SAVE_VERSION) s = { ...defaultSave(), ...s, saveVersion:SAVE_VERSION, flags:{ ftueDone:true, ftueStep:0 } };
    if(!s.flags) s.flags = { ftueDone:true, ftueStep:0 };
    return s;
  }catch(e){ return defaultSave(); }
}
let S = loadSave();
const codex = new Set(S.codex);
function discovered(f){ return codex.has(f); }
function persist(){ S.codex=[...codex]; try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function newUid(){ return "i"+(S.nextUid++); }

/* ───────── 音效 ───────── */
let actx=null;
function ensureAudio(){ if(!actx){ const AC=window.AudioContext||window.webkitAudioContext; if(AC) actx=new AC(); } if(actx&&actx.state==="suspended") actx.resume(); }
document.addEventListener("pointerdown", ensureAudio, {passive:true});
function vol(){ return S.settings.volume ?? 0.8; }
function tone(type,f0,f1,dur,peak){ if(!actx||vol()<=0)return; const t=actx.currentTime,o=actx.createOscillator(),g=actx.createGain();
  o.type=type;o.frequency.setValueAtTime(f0,t); if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);
  g.gain.setValueAtTime(Math.max(.0001,peak*vol()),t); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t+dur+.02); }
function noiseSweep(dur,peak){ if(!actx||vol()<=0)return; const t=actx.currentTime,len=Math.floor(actx.sampleRate*dur);
  const buf=actx.createBuffer(1,len,actx.sampleRate),ch=buf.getChannelData(0);
  for(let i=0;i<len;i++) ch[i]=(Math.random()*2-1)*(1-i/len);
  const src=actx.createBufferSource();src.buffer=buf; const f=actx.createBiquadFilter();f.type="bandpass";
  f.frequency.setValueAtTime(300,t); f.frequency.exponentialRampToValueAtTime(1400,t+dur);
  const g=actx.createGain();g.gain.value=peak*vol(); src.connect(f).connect(g).connect(actx.destination); src.start(); }
const sfxClick=()=>tone("triangle",420,260,.06,.25), sfxFlow=b=>noiseSweep(b?1.2:.6,.25),
  sfxStamp=()=>{tone("triangle",200,90,.18,.6);tone("sine",880,560,.25,.18);}, sfxSoft=()=>tone("sine",240,200,.14,.12),
  sfxMake=()=>{tone("sine",330,440,.18,.2);tone("sine",440,660,.22,.18);};

/* ───────── DOM ───────── */
const $=id=>document.getElementById(id);
function useArt(svg,art){ svg.innerHTML=`<use href="#art-${art}"/>`; }
let selectedUid=null;

/* ───────── 渲染 ───────── */
function curEra(){ return ERAS[S.kitchenEra]; }
function renderFolio(){ $("folio").textContent = "殘頁 · "+curEra().name; document.getElementById("app").dataset.era = S.kitchenEra; }
function renderEraNav(){
  const nav=$("eraNav");
  if(!S.unlocked.actions.includes("era_switch") || S.unlocked.eras.length<2){ nav.hidden=true; return; }
  nav.hidden=false; nav.innerHTML="";
  for(const eid of ERA_ORDER){ if(!S.unlocked.eras.includes(eid)) continue;
    const b=document.createElement("button"); b.className="era-tab"+(eid===S.kitchenEra?" active":"");
    b.textContent=ERAS[eid].name; b.onclick=()=>switchEra(eid); nav.appendChild(b); }
}
function renderOrder(){
  const id=S.orders.active, box=$("orderBox");
  if(!id){ box.hidden=true; return; }
  const o=ORDERS[id]; box.hidden=false;
  $("orderName").textContent=o.name; $("orderDesc").textContent=o.desc; $("orderHint").textContent=o.hint;
}
function renderInventory(){
  const grid=$("invGrid"); grid.innerHTML="";
  $("invCount").textContent="（"+S.inventory.length+" / 20）";
  $("invEmpty").hidden = S.inventory.length>0;
  for(const it of S.inventory){
    const f=FORMS[it.formId]; const card=document.createElement("button");
    card.className="inv-card"+(it.uid===selectedUid?" selected":""); card.dataset.tag=f.tag;
    card.innerHTML=`<span class="age-badge">${shortAge(it.ageDays)}</span><svg class="artwork" viewBox="0 0 100 100"><use href="#art-${f.art}"/></svg><small>${f.name}</small>`;
    card.onclick=()=>selectItem(it.uid); grid.appendChild(card);
  }
}
function shortAge(d){ if(d<=0)return""; if(d<365)return"·"; if(d<36500)return Math.round(d/365)+"y"; return Math.round(d/365/100)/10+"c"; }
function renderCraft(){
  const box=$("craftBox"); box.innerHTML="";
  for(const m of matchRecipes()){
    const b=document.createElement("button"); const r=m.recipe;
    const known = !r.hidden || discovered(INGREDIENTS[r.output].base);
    b.className="make-btn"+(known?"":" mystery");
    b.textContent = known ? ("製作 "+r.name) : "？ 似乎可調理……";
    b.onclick=()=>makeRecipe(m); box.appendChild(b);
  }
}
function renderSelected(){
  const panel=$("selPanel");
  const it=S.inventory.find(x=>x.uid===selectedUid);
  if(!it){ panel.hidden=true; return; }
  panel.hidden=false;
  const target = Math.max(it.ageDays, sliderToDays(+$("axis").value));
  const previewForm = resolveForm({...it, ageDays:target}, S.kitchenEra);
  const f=FORMS[previewForm];
  useArt($("selArt"), f.art); $("selHead").dataset.tag=f.tag;
  $("selName").textContent=f.name;
  $("selAge").textContent=formatAge(target)+(target>it.ageDays?"（預覽）":"");
  $("axisReadout").textContent=formatAge(target);
  $("ageBtn").disabled = target<=it.ageDays;
}
function renderPantry(){
  const row=$("pantryRow"); row.innerHTML=""; $("pantryEra").textContent=curEra().name;
  const commons=curEra().commons;
  $("pantryEmpty").hidden = commons.length>0;
  for(const id of commons){ const ing=INGREDIENTS[id]; const el=document.createElement("button");
    el.className="pantry-item"; el.dataset.tag="fresh";
    el.innerHTML=`<svg class="artwork" viewBox="0 0 100 100"><use href="#art-${ing.art||ing.forms[ing.base].art}"/></svg><span>${ing.name}</span>`;
    el.onclick=()=>collect(id); row.appendChild(el); }
}
function renderCodex(){
  const grid=$("codexGrid"); grid.innerHTML="";
  for(const f of ALL_FORMS){ const cell=document.createElement("div");
    if(discovered(f.formId)){ cell.className="codex-cell"; cell.dataset.tag=f.tag;
      cell.innerHTML=`<svg class="artwork" viewBox="0 0 100 100"><use href="#art-${f.art}"/></svg><small>${f.name}</small>`; }
    else{ cell.className="codex-cell locked"; cell.innerHTML=`<div class="q">？</div><small>未發現</small>`; }
    grid.appendChild(cell); }
  $("codexCount").textContent=codex.size; $("codexTotal").textContent=ALL_FORMS.length;
}
function renderTicks(){ const t=$("axisTicks"); t.innerHTML=""; for(const n of NODES){ const s=document.createElement("span"); s.textContent=n.label; t.appendChild(s);} }
function renderAll(){ renderFolio(); renderEraNav(); renderOrder(); renderInventory(); renderCraft(); renderSelected(); renderPantry(); renderCodex(); }

/* ───────── 動作 ───────── */
function collect(id){
  sfxClick();
  if(S.inventory.length>=20){ toast("調理之頁已滿，先丟棄一些吧。"); return; }
  const ing=INGREDIENTS[id]; const it={ uid:newUid(), id, formId:ing.base, ageDays:0, bornEra:S.kitchenEra };
  S.inventory.push(it); selectedUid=it.uid; $("axis").value=0;
  maybeDiscover(ing.base,false); renderInventory(); renderCraft(); renderSelected(); persist();
}
function selectItem(uid){ selectedUid=uid; const it=S.inventory.find(x=>x.uid===uid); $("axis").value=daysToSlider(it?it.ageDays:0); sfxClick(); renderInventory(); renderSelected(); ftueCheck(); }
function onAxisInput(){
  const it=S.inventory.find(x=>x.uid===selectedUid); if(!it) return;
  let d=sliderToDays(+$("axis").value);
  for(const n of NODES){ if(Math.abs(+$("axis").value - daysToSlider(n.d))<=18){ d=n.d; break; } }
  if(d<it.ageDays){ $("axis").value=daysToSlider(it.ageDays); }
  renderSelected(); ftueCheck();
}
function doAge(){
  const it=S.inventory.find(x=>x.uid===selectedUid); if(!it) return;
  let target=sliderToDays(+$("axis").value);
  for(const n of NODES){ if(Math.abs(+$("axis").value - daysToSlider(n.d))<=18){ target=n.d; break; } }
  if(target<=it.ageDays) return;
  sfxFlow(target-it.ageDays>3650);
  it.ageDays=target; it.formId=resolveForm(it, S.kitchenEra); S.stats.agings++;
  const main=$("pageMain"); main.classList.remove("flash"); void main.offsetWidth;
  maybeDiscover(it.formId,true);
  renderInventory(); renderCraft(); renderSelected(); persist();
}
function makeRecipe(m){
  const r=m.recipe;
  S.inventory = S.inventory.filter(it=> !m.consume.includes(it.uid));
  const out=INGREDIENTS[r.output]; const it={ uid:newUid(), id:r.output, formId:out.base, ageDays:0, bornEra:S.kitchenEra };
  S.inventory.push(it); selectedUid=it.uid; $("axis").value=0;
  sfxMake();
  maybeDiscover(out.base,true);
  renderInventory(); renderCraft(); renderSelected(); persist();
}
function discardSelected(){
  const it=S.inventory.find(x=>x.uid===selectedUid); if(!it) return;
  S.inventory = S.inventory.filter(x=>x.uid!==selectedUid); selectedUid=null;
  sfxSoft(); renderInventory(); renderCraft(); renderSelected(); persist();
}
function switchEra(eid){
  if(eid===S.kitchenEra) return;
  S.kitchenEra=eid; sfxFlow(false);
  const main=$("pageMain"); main.classList.remove("turning"); void main.offsetWidth; main.classList.add("turning");
  renderAll(); persist(); ftueCheck();
}
function maybeDiscover(formId, celebrate){
  if(discovered(formId)){ if(celebrate) sfxSoft(); return; }
  codex.add(formId); S.stats.discoveries++; renderCodex(); persist();
  if(celebrate) showDiscovery(FORMS[formId]); else sfxSoft();
  checkOrders(); ftueCheck();
}

/* ───────── 委託 ───────── */
function checkOrders(){
  const id=S.orders.active; if(!id) return;
  const o=ORDERS[id]; if(!o.goal()) return;
  S.orders.done.push(id); S.orders.active = o.next; o.reward();
  renderEraNav(); renderOrder(); renderPantry(); persist();
  if(o.done==="__ENDING__") showEnding(); else toast("「"+o.name+"」— "+o.done);
}

/* ───────── 發現 / toast / 結局 ───────── */
const discoveryEl=$("discovery"); let discoveryTimer=null;
function showDiscovery(form){
  useArt($("discoveryArt"),form.art); $("discoveryName").textContent=form.name;
  $("discoveryDesc").textContent=COPY[form.formId]||""; $("discoveryCard").dataset.tag=form.tag;
  discoveryEl.hidden=false; sfxStamp(); clearTimeout(discoveryTimer); discoveryTimer=setTimeout(()=>discoveryEl.hidden=true,2400);
}
discoveryEl.addEventListener("click",()=>discoveryEl.hidden=true);
let toastTimer=null;
function toast(msg){ const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.hidden=true,3200); }
function showEnding(){ $("endingText").textContent=ENDING_TEXT; $("ending").hidden=false; }
$("endingClose").addEventListener("click",()=>$("ending").hidden=true);

/* ───────── 設定 / 存檔 ───────── */
$("menuBtn").addEventListener("click",()=>{ $("vol").value=vol(); $("menu").hidden=false; });
$("closeMenu").addEventListener("click",()=>$("menu").hidden=true);
$("vol").addEventListener("input",e=>{ S.settings.volume=+e.target.value; persist(); });
$("exportBtn").addEventListener("click",()=>{ const data=JSON.stringify(S);
  navigator.clipboard?.writeText(data).catch(()=>{}); const blob=new Blob([data],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="chrono-cuisine-save.json"; a.click();
  alert("已謄抄副本（已複製到剪貼簿並下載檔案）。"); });
$("importBtn").addEventListener("click",()=>{ const raw=prompt("貼上先前謄抄的存檔內容："); if(!raw)return;
  try{ JSON.parse(raw); localStorage.setItem(SAVE_KEY,raw); alert("拓印還原成功，將重新展卷。"); location.reload(); }
  catch(e){ alert("這份拓本似乎殘缺，無法還原。"); } });
$("resetBtn").addEventListener("click",()=>{ if(confirm("確定焚去此書、從頭開始？此舉無法復原。")){ localStorage.removeItem(SAVE_KEY); location.reload(); } });

/* ───────── FTUE 新手引導（對齊《FTUE 腳本》六拍精簡為四步）───────── */
const FTUE_STEPS=[
  { target:"invGrid", caption:"先輕觸這瓶牛奶，把它拿起來。", done:()=> !!selectedUid },
  { target:"axis",    caption:"拖動下方的『歲月之軸』往右——讓牛奶經歷約一個月。", done:()=> ftueTargetDays()>=30 },
  { target:"ageBtn",  caption:"按下『熟成』，讓歲月真正流過。", done:()=> [...codex].some(f=> f.startsWith("cheese")) },
  { target:"eraNav",  caption:"你補回了第一頁！上方出現了書籤——翻頁，去別的紀元探索吧。", done:()=> S.kitchenEra!=="apocalypse" },
];
function ftueActive(){ return !S.flags.ftueDone; }
function ftueTargetDays(){ const it=S.inventory.find(x=>x.uid===selectedUid); if(!it) return 0;
  let d=sliderToDays(+$("axis").value); for(const n of NODES){ if(Math.abs(+$("axis").value-daysToSlider(n.d))<=18){d=n.d;break;} } return Math.max(it.ageDays,d); }
let ftueLast=-1;
function ftueRender(){
  document.querySelectorAll(".ftue-ring").forEach(e=>e.classList.remove("ftue-ring"));
  const cap=$("ftueCaption");
  if(!ftueActive()){ cap.hidden=true; return; }
  const i=S.flags.ftueStep, step=FTUE_STEPS[i];
  if(!step){ cap.hidden=true; return; }
  const tgt=$(step.target);
  if(tgt){ tgt.classList.add("ftue-ring"); if(i!==ftueLast) tgt.scrollIntoView({block:"center",behavior:"smooth"}); }
  $("ftueText").textContent=step.caption; cap.hidden=false; ftueLast=i;
}
function ftueCheck(){
  if(!ftueActive()) return;
  while(ftueActive()){
    const step=FTUE_STEPS[S.flags.ftueStep];
    if(!step){ ftueFinish(); return; }
    if(step.done()){ S.flags.ftueStep++; persist(); } else break;
  }
  if(S.flags.ftueStep>=FTUE_STEPS.length){ ftueFinish(); return; }
  ftueRender();
}
function ftueFinish(){ S.flags.ftueDone=true; persist(); document.querySelectorAll(".ftue-ring").forEach(e=>e.classList.remove("ftue-ring")); $("ftueCaption").hidden=true; }
$("ftueSkip").addEventListener("click", ftueFinish);

/* ───────── 綁定 + 啟動 ───────── */
$("axis").addEventListener("input",onAxisInput);
$("ageBtn").addEventListener("click",doAge);
$("discardBtn").addEventListener("click",discardSelected);
const APP_VERSION="0.3.0";                 // 介面版號（每完成一個編號功能就 +1）
$("version").textContent="v"+APP_VERSION;
selectedUid = (S.flags.ftueDone && S.inventory[0]) ? S.inventory[0].uid : null;  // FTUE 首次不自動選取，引導玩家自己點
renderTicks(); renderAll(); ftueCheck();

if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{})); }
