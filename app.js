/* ════════════════════════════════════════════════════════════
   時空料理 — 第一版（M1 垂直切片）
   純前端、零依賴。資料 / 引擎 / UI / 存檔 / 音效 同檔（首版求簡，日後依架構文件拆模組）。
   ════════════════════════════════════════════════════════════ */

/* ───────── 資料（對齊《內容聖經》數值；M1 取無條件食材）───────── */
const INGREDIENTS = {
  milk: { id:"milk", name:"牛奶", art:"milk", states:[
    { fromDay:0,     formId:"milk.fresh",   name:"牛奶",     art:"milk",          tag:"fresh"   },
    { fromDay:7,     formId:"milk.spoiled", name:"腐敗牛奶", art:"milk",          tag:"spoiled" },
    { fromDay:30,    formId:"cheese.fresh", name:"起司",     art:"cheese",        tag:"normal"  },
    { fromDay:365,   formId:"cheese.aged",  name:"陳年起司", art:"cheese",        tag:"rare"    },
    { fromDay:36500, formId:"cheese.fossil",name:"化石起司", art:"cheese",        tag:"fossil"  },
  ]},
  grape:{ id:"grape", name:"葡萄", art:"grape", states:[
    { fromDay:0,     formId:"grape.fresh",  name:"葡萄",         art:"grape",      tag:"fresh"   },
    { fromDay:7,     formId:"raisin.fresh", name:"葡萄乾",       art:"raisin",     tag:"normal"  },
    { fromDay:90,    formId:"raisin.dry",   name:"乾癟葡萄乾",   art:"raisin",     tag:"spoiled" },
    { fromDay:3650,  formId:"dust.generic", name:"塵",           art:"dust",       tag:"fossil"  },
  ]},
  honey:{ id:"honey", name:"蜂蜜", art:"honey", states:[
    { fromDay:0,      formId:"honey.fresh",  name:"蜂蜜",     art:"honey",         tag:"fresh"  },
    { fromDay:365,    formId:"honey.crystal",name:"結晶蜂蜜", art:"crystal_honey", tag:"normal" },
    { fromDay:36500,  formId:"honey.ancient",name:"古代蜂蜜", art:"crystal_honey", tag:"rare"   },
    { fromDay:365000, formId:"honey.amber",  name:"琥珀蜂蜜", art:"amber_honey",   tag:"mythic" },
  ]},
};

/* 形態描述（《敘事與文案聖經》§4.2 節選） */
const COPY = {
  "milk.fresh":"尋常的雪白之液。一切的起點。",
  "milk.spoiled":"過了頭。但別急著倒掉——壞，有時也是一種路。",
  "cheese.fresh":"乳之凝華。月餘可成。",
  "cheese.aged":"歲月為它鍍上金邊。愈陳，愈貴。",
  "cheese.fossil":"堅如磐石。已非食物，卻仍是某些古法的材料。",
  "grape.fresh":"飽滿的一串。陽光封存其中。",
  "raisin.fresh":"水分褪去，甜味留下。",
  "raisin.dry":"再乾一些，便所剩無幾了。",
  "dust.generic":"萬物的終點，也是某些開始。",
  "honey.fresh":"金黃黏稠。據說它永不腐壞。",
  "honey.crystal":"時間讓它凝成糖砂。",
  "honey.ancient":"蜜不會壞。它只會變得更老、更貴。",
  "honey.amber":"蜜的盡頭，是琥珀。連光都被封在裡面。",
};

/* 歲月之軸節點（ageDays / 標籤） */
const NODES = [
  { d:0,       label:"今日" },
  { d:30,      label:"一月" },
  { d:365,     label:"一年" },
  { d:36500,   label:"百年" },
  { d:365000,  label:"千年" },
  { d:1095000, label:"三千年" },
];
const MAX_DAYS = 1095000;
const SLIDER_MAX = 1000;

/* ───────── 引擎（純函式）───────── */
function resolveForm(ingredient, ageDays){
  let cur = ingredient.states[0];
  for(const b of ingredient.states){ if(ageDays >= b.fromDay) cur = b; else break; }
  return cur;
}
// 對數映射：slider 0..1000 ↔ ageDays 0..MAX
function sliderToDays(v){
  const p = v / SLIDER_MAX;
  if(p <= 0) return 0;
  return Math.round(Math.pow(10, p * Math.log10(MAX_DAYS + 1)) - 1);
}
function daysToSlider(d){
  if(d <= 0) return 0;
  return Math.round(SLIDER_MAX * Math.log10(d + 1) / Math.log10(MAX_DAYS + 1));
}
function formatAge(d){
  if(d <= 0) return "此刻";
  if(d < 30)    return d + " 天";
  if(d < 365)   return Math.round(d/30)  + " 個月";
  if(d < 36500) return Math.round(d/365) + " 年";
  return Math.round(d/365).toLocaleString() + " 年";
}

/* ───────── 存檔 ───────── */
const SAVE_KEY = "chrono.save";
const SAVE_VERSION = 1;
function defaultSave(){
  return { saveVersion:SAVE_VERSION, codex:[], settings:{ volume:0.8 },
           bench:null, stats:{ agings:0, discoveries:0 } };
}
let save = loadSave();
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return defaultSave();
    let s = JSON.parse(raw);
    if((s.saveVersion ?? 0) < SAVE_VERSION) s = { ...defaultSave(), ...s, saveVersion:SAVE_VERSION };
    if(!Array.isArray(s.codex)) s.codex = [];
    if(!s.settings) s.settings = { volume:0.8 };
    return s;
  }catch(e){ return defaultSave(); }
}
function persist(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){} }
const codex = new Set(save.codex);
function discovered(formId){ return codex.has(formId); }

/* ───────── 音效（Web Audio，合成；iOS 需手勢解鎖）───────── */
let actx = null;
function ensureAudio(){
  if(!actx){ const AC = window.AudioContext || window.webkitAudioContext; if(AC) actx = new AC(); }
  if(actx && actx.state === "suspended") actx.resume();
}
document.addEventListener("pointerdown", ensureAudio, { once:false, passive:true });
function vol(){ return save.settings.volume ?? 0.8; }
function tone(type, f0, f1, dur, peak){
  if(!actx || vol() <= 0) return;
  const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if(f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(Math.max(.0001, peak * vol()), t);
  g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(actx.destination); o.start(t); o.stop(t + dur + .02);
}
function noiseSweep(dur, peak){
  if(!actx || vol() <= 0) return;
  const t = actx.currentTime, len = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate), ch = buf.getChannelData(0);
  for(let i=0;i<len;i++) ch[i] = (Math.random()*2-1) * (1 - i/len);
  const src = actx.createBufferSource(); src.buffer = buf;
  const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(1400, t + dur);
  const g = actx.createGain(); g.gain.value = peak * vol();
  src.connect(f).connect(g).connect(actx.destination); src.start();
}
const sfxClick   = ()=> tone("triangle", 420, 260, .06, .25);
const sfxFlow    = (big)=> noiseSweep(big ? 1.2 : .6, .25);
const sfxStamp   = ()=>{ tone("triangle", 200, 90, .18, .6); tone("sine", 880, 560, .25, .18); };
const sfxSoft    = ()=> tone("sine", 240, 200, .14, .12);

/* ───────── 狀態（執行期）───────── */
let bench = null;      // { id, ageDays }
let targetDays = 0;    // 滑桿預覽的目標年齡

/* ───────── DOM ───────── */
const $ = (id)=> document.getElementById(id);
const benchEl=$("bench"), benchEmpty=$("benchEmpty"), benchItem=$("benchItem"),
      benchArt=$("benchArt"), benchName=$("benchName"), benchAge=$("benchAge"),
      axisSection=$("axisSection"), axis=$("axis"), axisReadout=$("axisReadout"),
      axisTicks=$("axisTicks"), ageBtn=$("ageBtn"),
      pantryRow=$("pantryRow"), codexGrid=$("codexGrid"),
      codexCount=$("codexCount"), codexTotal=$("codexTotal");

function useArt(svgEl, art){ svgEl.innerHTML = `<use href="#art-${art}"/>`; }

/* 全部形態（圖鑑用） */
const ALL_FORMS = [];
for(const ing of Object.values(INGREDIENTS)) for(const s of ing.states) ALL_FORMS.push(s);

/* ───────── 渲染 ───────── */
function renderPantry(){
  pantryRow.innerHTML = "";
  for(const ing of Object.values(INGREDIENTS)){
    const el = document.createElement("button");
    el.className = "pantry-item"; el.dataset.tag = "fresh";
    el.innerHTML = `<svg class="artwork" viewBox="0 0 100 100"><use href="#art-${ing.art}"/></svg><span>${ing.name}</span>`;
    el.addEventListener("click", ()=> takeIngredient(ing.id));
    pantryRow.appendChild(el);
  }
}
function renderTicks(){
  axisTicks.innerHTML = "";
  for(const n of NODES){ const s = document.createElement("span"); s.textContent = n.label; axisTicks.appendChild(s); }
}
function renderCodex(){
  codexGrid.innerHTML = "";
  for(const f of ALL_FORMS){
    const cell = document.createElement("div");
    if(discovered(f.formId)){
      cell.className = "codex-cell"; cell.dataset.tag = f.tag;
      cell.innerHTML = `<svg class="artwork" viewBox="0 0 100 100"><use href="#art-${f.art}"/></svg><small>${f.name}</small>`;
    }else{
      cell.className = "codex-cell locked";
      cell.innerHTML = `<div class="q">？</div><small>未發現</small>`;
    }
    codexGrid.appendChild(cell);
  }
  codexCount.textContent = codex.size;
  codexTotal.textContent = ALL_FORMS.length;
}
function renderBench(){
  if(!bench){ benchItem.hidden = true; benchEmpty.hidden = false; axisSection.hidden = true; return; }
  benchEmpty.hidden = true; benchItem.hidden = false; axisSection.hidden = false;
  const ing = INGREDIENTS[bench.id];
  const form = resolveForm(ing, targetDays);
  useArt(benchArt, form.art);
  benchItem.dataset.tag = form.tag;
  benchName.textContent = form.name;
  benchAge.textContent = formatAge(targetDays) + (targetDays > bench.ageDays ? "（預覽）" : "");
  axisReadout.textContent = formatAge(targetDays);
  ageBtn.disabled = targetDays <= bench.ageDays;
}

/* ───────── 動作 ───────── */
function takeIngredient(id){
  sfxClick();
  bench = { id, ageDays:0 };
  targetDays = 0;
  axis.value = 0;
  renderBench();
  maybeDiscover(resolveForm(INGREDIENTS[id], 0), false); // 拾取即認識其新鮮形態
}
function onAxisInput(){
  if(!bench) return;
  let d = sliderToDays(+axis.value);
  // 節點吸附（滑桿空間內接近即吸附）
  for(const n of NODES){
    if(Math.abs(+axis.value - daysToSlider(n.d)) <= 18){ d = n.d; break; }
  }
  targetDays = Math.max(bench.ageDays, d);
  renderBench();
}
function doAge(){
  if(!bench || targetDays <= bench.ageDays) return;
  const big = (targetDays - bench.ageDays) > 3650;
  sfxFlow(big);
  bench.ageDays = targetDays;
  save.stats.agings++;
  const form = resolveForm(INGREDIENTS[bench.id], bench.ageDays);
  benchEl.classList.remove("flash"); void benchEl.offsetWidth; benchEl.classList.add("flash");
  maybeDiscover(form, true);
  renderBench(); persist();
}
function maybeDiscover(form, celebrate){
  if(discovered(form.formId)){ if(celebrate) sfxSoft(); return; }
  codex.add(form.formId); save.codex = [...codex]; save.stats.discoveries++;
  renderCodex(); persist();
  if(celebrate) showDiscovery(form); else sfxSoft();
}

/* ───────── 發現橫幅 ───────── */
const discoveryEl=$("discovery"), discoveryArt=$("discoveryArt"),
      discoveryName=$("discoveryName"), discoveryDesc=$("discoveryDesc");
let discoveryTimer = null;
function showDiscovery(form){
  useArt(discoveryArt, form.art);
  discoveryName.textContent = form.name;
  discoveryDesc.textContent = COPY[form.formId] || "";
  discoveryEl.querySelector(".discovery-card").dataset.tag = form.tag;
  discoveryEl.hidden = false;
  sfxStamp();
  clearTimeout(discoveryTimer);
  discoveryTimer = setTimeout(hideDiscovery, 2400);
}
function hideDiscovery(){ discoveryEl.hidden = true; }
discoveryEl.addEventListener("click", hideDiscovery);

/* ───────── 設定 / 存檔 ───────── */
const menu=$("menu");
$("menuBtn").addEventListener("click", ()=>{ $("vol").value = vol(); menu.hidden = false; });
$("closeMenu").addEventListener("click", ()=> menu.hidden = true);
$("vol").addEventListener("input", e=>{ save.settings.volume = +e.target.value; persist(); });
$("exportBtn").addEventListener("click", ()=>{
  const data = JSON.stringify(save);
  navigator.clipboard?.writeText(data).catch(()=>{});
  const blob = new Blob([data], { type:"application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = "chrono-cuisine-save.json"; a.click();
  alert("已謄抄副本（已複製到剪貼簿並下載檔案）。");
});
$("importBtn").addEventListener("click", ()=>{
  const raw = prompt("貼上先前謄抄的存檔內容：");
  if(!raw) return;
  try{
    const s = JSON.parse(raw);
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
    alert("拓印還原成功，將重新展卷。"); location.reload();
  }catch(e){ alert("這份拓本似乎殘缺，無法還原。"); }
});
$("resetBtn").addEventListener("click", ()=>{
  if(confirm("確定焚去此書、從頭開始？此舉無法復原。")){
    localStorage.removeItem(SAVE_KEY); location.reload();
  }
});

/* ───────── 綁定 + 啟動 ───────── */
axis.addEventListener("input", onAxisInput);
ageBtn.addEventListener("click", doAge);
renderPantry(); renderTicks(); renderCodex(); renderBench();

/* PWA */
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=> navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
