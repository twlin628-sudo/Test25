/* ════════════════════════════════════════════════════════════
   時空料理 — M2（完整核心迴圈）
   雙軸時間 + 條件熟成(持久化) + 紀元 + 庫存 + 配方 + 委託 + 結局
   純前端、零依賴。對齊《系統規格書》《內容聖經》《進程地圖》《敘事文案》。
   ════════════════════════════════════════════════════════════ */

/* ───────── 紀元 ───────── */
const ERAS = {
  apocalypse:{ id:"apocalypse", name:"文明終末", envTags:[],        tools:[],        commons:[],                          rares:[] },
  industrial:{ id:"industrial", name:"工業時代", envTags:["freeze"],tools:["oven"],  commons:["milk","dough","egg","meat"],rares:[] },
  medieval:  { id:"medieval",   name:"中世紀",   envTags:["warm"],  tools:["barrel"],commons:["grape","honey"],           rares:[] },
  egypt:     { id:"egypt",      name:"古埃及",   envTags:["dry"],   tools:["kiln"],  commons:["wheat","nilefish"],        rares:[] },
  stone:     { id:"stone",      name:"石器時代", envTags:["smoke"], tools:["smoker"],commons:["meat","berry","wildhoney"],rares:[] },
  future:    { id:"future",     name:"近未來",   envTags:["freeze","warm"], tools:["recombinator"], commons:["synthprotein"], rares:[] },
  // 遠征專屬紀元（不在一般翻頁清單）
  jurassic:  { id:"jurassic",   name:"侏儸紀",   envTags:["warm"],  tools:[],        commons:[],                          rares:["dragon","giant_egg","spice"], expedition:true },
};
const ERA_ORDER = ["apocalypse","industrial","medieval","egypt","stone","future"];
const ERA_UNLOCK = { egypt:0.40, stone:0.55, future:0.70 };   // 以圖鑑完成度解鎖
const EXPEDITIONS = ["jurassic"];   // #1：可遠征的古老紀元
const EXPED_CAP = 3;                 // 每趟遠征可採集稀有食材的份數
// #2 悖論
const PARADOX_PER_DUP = 25;   // 每次複製累積
const PARADOX_COOL = 5;       // 正常遊玩（熟成/採集/加工）自然冷卻
const PARADOX_CORRUPT = 80;   // 達此值，複製會吐出「時間殘影」
const PARADOX_MAX = 120;
// #3 時光能量
const ENERGY_MAX = 12;
const COST_EXPED = 4, COST_DUP = 3, COST_STAB = 2;   // 遠征 / 複製 / 穩定 的耗能
const REGEN_AGE = 1, REGEN_DISCOVER = 2, REGEN_ORDER = 5; // 熟成 / 發現 / 委託 的回氣
const LAY_COOLDOWN = 3;                              // #4 母雞產蛋冷卻（以動作計）
const TOOL_NAMES = { oven:"烤箱", barrel:"木桶", kiln:"陶窯", smoker:"煙燻架", recombinator:"分子重組器" };   // #5 工具顯示名

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
  /* #1 遠征：龍 */
  dragon:{ id:"dragon", name:"龍", base:"dragon.proto", forms:{
      "dragon.proto":{name:"龍祖先",art:"dragon",tag:"normal"}, "dragon.young":{name:"幼龍",art:"dragon",tag:"rare"},
      "dragon.elder":{name:"巨龍",art:"dragon",tag:"mythic"}, "dragon.fossil":{name:"龍化石",art:"dragon",tag:"fossil"} },
    transitions:[ {from:"dragon.proto",at:7,to:"dragon.young",requiresEnv:"warm"}, {from:"dragon.proto",at:30,to:"dragon.fossil"},
      {from:"dragon.young",at:365,to:"dragon.elder"} ]},
  dsoup:{ id:"dsoup", name:"龍肉湯", base:"dragon_soup", forms:{
      "dragon_soup":{name:"龍肉湯",art:"dragon_soup",tag:"mythic"} }, transitions:[] },
  /* #2 複製過載的副產物 */
  residue:{ id:"residue", name:"時間殘影", base:"residue", forms:{
      "residue":{name:"時間殘影",art:"residue",tag:"spoiled"} }, transitions:[] },
  /* #10 肉類（需 dry 或 smoke 環境）*/
  meat:{ id:"meat", name:"肉", base:"meat.fresh", forms:{
      "meat.fresh":{name:"鮮肉",art:"meat",tag:"fresh"}, "meat.dried":{name:"乾肉",art:"dried_meat",tag:"normal"},
      "meat.mummy":{name:"木乃伊肉",art:"mummy_meat",tag:"rare"}, "meat.fossil":{name:"化石肉",art:"mummy_meat",tag:"fossil"},
      "meat.rotten":{name:"腐肉",art:"meat",tag:"spoiled"} },
    transitions:[ {from:"meat.fresh",at:3,to:"meat.dried",requiresEnv:"dry"}, {from:"meat.fresh",at:3,to:"meat.dried",requiresEnv:"smoke"},
      {from:"meat.fresh",at:3,to:"meat.rotten"}, {from:"meat.dried",at:365,to:"meat.mummy"}, {from:"meat.mummy",at:36500,to:"meat.fossil"} ]},
  /* #11 古代小麥 */
  wheat:{ id:"wheat", name:"古代小麥", base:"wheat.fresh", forms:{
      "wheat.fresh":{name:"古代小麥",art:"wheat",tag:"fresh"}, "wheat.dust":{name:"塵",art:"dust",tag:"fossil"} },
    transitions:[ {from:"wheat.fresh",at:36500,to:"wheat.dust"} ]},
  /* #11 尼羅魚 */
  nilefish:{ id:"nilefish", name:"尼羅魚", base:"nilefish.fresh", forms:{
      "nilefish.fresh":{name:"尼羅魚",art:"nilefish",tag:"fresh"}, "nilefish.dried":{name:"魚乾",art:"dried_fish",tag:"normal"},
      "nilefish.aged":{name:"陳年鹹魚",art:"dried_fish",tag:"rare"}, "nilefish.rotten":{name:"腐魚",art:"nilefish",tag:"spoiled"} },
    transitions:[ {from:"nilefish.fresh",at:3,to:"nilefish.dried",requiresEnv:"dry"}, {from:"nilefish.fresh",at:3,to:"nilefish.dried",requiresEnv:"smoke"},
      {from:"nilefish.fresh",at:5,to:"nilefish.rotten"}, {from:"nilefish.dried",at:365,to:"nilefish.aged"} ]},
  /* 段二 #7 石器時代食材 */
  berry:{ id:"berry", name:"野果", base:"berry.fresh", forms:{
      "berry.fresh":{name:"野果",art:"berry",tag:"fresh"}, "berry.dried":{name:"野果乾",art:"raisin",tag:"normal"},
      "berry.dust":{name:"塵",art:"dust",tag:"fossil"} },
    transitions:[ {from:"berry.fresh",at:30,to:"berry.dried"}, {from:"berry.dried",at:3650,to:"berry.dust"} ]},
  wildhoney:{ id:"wildhoney", name:"野蜂蜜", base:"wildhoney.fresh", forms:{
      "wildhoney.fresh":{name:"野蜂蜜",art:"honey",tag:"fresh"}, "wildhoney.crystal":{name:"野生結晶蜜",art:"crystal_honey",tag:"normal"},
      "wildhoney.amber":{name:"原始琥珀",art:"amber_honey",tag:"mythic"} },
    transitions:[ {from:"wildhoney.fresh",at:365,to:"wildhoney.crystal"}, {from:"wildhoney.crystal",at:365000,to:"wildhoney.amber"} ]},
  candy:{ id:"candy", name:"蜜餞野果", base:"candy", forms:{
      "candy":{name:"蜜餞野果",art:"candy",tag:"rare"} }, transitions:[] },
  /* 段二 #8 補完侏儸紀 */
  giant_egg:{ id:"giant_egg", name:"巨蛋", base:"giant_egg.fresh", forms:{
      "giant_egg.fresh":{name:"巨蛋",art:"giant_egg",tag:"rare"}, "giant_egg.dragon":{name:"破殼巨龍",art:"dragon",tag:"mythic"} },
    transitions:[ {from:"giant_egg.fresh",at:14,to:"giant_egg.dragon",requiresEnv:"warm"} ]},
  spice:{ id:"spice", name:"史前香料", base:"spice.fresh", forms:{
      "spice.fresh":{name:"史前香料",art:"spice",tag:"rare"}, "spice.fossil":{name:"化石香料",art:"spice",tag:"fossil"} },
    transitions:[ {from:"spice.fresh",at:36500,to:"spice.fossil"} ]},
  /* 段三 #9 合成蛋白 */
  synthprotein:{ id:"synthprotein", name:"合成蛋白", base:"synthprotein.fresh", forms:{
      "synthprotein.fresh":{name:"合成蛋白",art:"synthprotein",tag:"fresh"}, "synthprotein.decayed":{name:"衰變蛋白",art:"synthprotein",tag:"spoiled"} },
    transitions:[ {from:"synthprotein.fresh",at:365000,to:"synthprotein.decayed"} ]},
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
  { id:"dragon_soup", name:"龍肉湯", tool:null, era:null, output:"dsoup", hidden:true,
    inputs:[ {match:{art:"dragon", tag:"mythic"}, count:1} ] },   // 巨龍 或 破殼巨龍 皆可
  { id:"ancient_bread", name:"古法麵包", tool:"kiln", era:"egypt", output:"bread",
    inputs:[ {match:{formId:"wheat.fresh"}, count:1} ] },
  { id:"candied_berry", name:"蜜餞野果", tool:null, era:null, output:"candy", hidden:true,
    inputs:[ {match:{formId:"berry.fresh"}, count:1}, {match:{formId:"wildhoney.fresh"}, count:1} ] },
  { id:"synth_meat", name:"重組鮮肉", tool:"recombinator", era:"future", output:"meat",
    inputs:[ {match:{formId:"synthprotein.fresh"}, count:1} ] },
  { id:"synth_dragon", name:"重組龍胚", tool:"recombinator", era:"future", output:"dragon", hidden:true,
    inputs:[ {match:{formId:"synthprotein.fresh"}, count:1}, {match:{formId:"spice.fresh"}, count:1} ] },
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
 "dragon.proto":"侏儸紀的孑遺。一隻蜷縮的幼小生命。","dragon.young":"溫暖讓牠舒展雙翼。幼龍。",
 "dragon.elder":"牠成了傳說本身——巨龍。","dragon.fossil":"沒有溫暖，牠終究成了化石。",
 "dragon_soup":"傳說中的龍肉湯。一勺，便是一個時代的力量。",
 "residue":"複製過了頭，時間吐出的殘渣。它什麼也不是。",
 "meat.fresh":"一塊鮮肉。要在乾燥或煙燻之地才存得住。","meat.dried":"水分抽乾，於是它能撐過歲月。乾肉。",
 "meat.mummy":"乾到極致，宛如法老的隨葬。","meat.fossil":"連時間都嚼不動了。","meat.rotten":"沒有乾燥，肉很快就壞了。",
 "wheat.fresh":"古代的麥子。文明的主食，自此而生。","wheat.dust":"麥子也終歸塵土。",
 "nilefish.fresh":"尼羅河的恩賜。","nilefish.dried":"日曬成乾，鹹香撲鼻。魚乾。","nilefish.aged":"陳年鹹魚，越陳越鮮。","nilefish.rotten":"離了水又沒晾乾，魚就臭了。",
 "berry.fresh":"林間野果，酸甜帶澀。","berry.dried":"曬乾的野果，甜味濃縮了。","berry.dust":"野果最終也化作塵。",
 "wildhoney.fresh":"野蜂築巢所釀，比馴養的更野、更香。","wildhoney.crystal":"野蜜也會結晶。","wildhoney.amber":"野性的盡頭，凝成原始琥珀。",
 "candy":"野果裹上野蜜——史前的甜點。",
 "giant_egg.fresh":"比人頭還大的蛋。裡頭睡著什麼？","giant_egg.dragon":"溫暖喚醒了牠——破殼而出的巨龍。",
 "spice.fresh":"史前的香料，氣味濃烈得不像這個世界。","spice.fossil":"連香氣都成了化石。",
 "synthprotein.fresh":"近未來的合成蛋白。無味，卻是萬物的基料。","synthprotein.decayed":"連合成物也會在漫長歲月裡崩解。",
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
const SAVE_KEY="chrono.save", SAVE_VERSION=7;
function defaultSave(){
  return { saveVersion:SAVE_VERSION, kitchenEra:"apocalypse",
    inventory:[{ uid:"i1", id:"milk", formId:"milk.fresh", ageDays:0, bornEra:"apocalypse" }],
    nextUid:2, codex:[], orders:{ active:"o_milk", done:[] },
    unlocked:{ actions:[], eras:["apocalypse"] }, expedition:null, paradox:0, energy:ENERGY_MAX, tools:{}, settings:{ volume:0.8 },
    flags:{ ftueDone:false, ftueStep:0 }, stats:{ agings:0, discoveries:0, paradoxPeak:0 } };
}
function loadSave(){
  try{ const raw=localStorage.getItem(SAVE_KEY); if(!raw) return defaultSave();
    let s=JSON.parse(raw);
    // 既有存檔向前遷移：已在玩的人跳過 FTUE
    if((s.saveVersion??0) < SAVE_VERSION) s = { ...defaultSave(), ...s, saveVersion:SAVE_VERSION, flags:{ ftueDone:true, ftueStep:0 } };
    if(!s.flags) s.flags = { ftueDone:true, ftueStep:0 };
    if(!s.tools) s.tools = {};
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
  sfxMake=()=>{tone("sine",330,440,.18,.2);tone("sine",440,660,.22,.18);},
  sfxWarp=()=>{tone("sawtooth",200,120,.3,.16);tone("sawtooth",212,128,.3,.1);};

/* ───────── DOM ───────── */
const $=id=>document.getElementById(id);
function useArt(svg,art){ svg.innerHTML=`<use href="#art-${art}"/>`; }
let selectedUid=null;

/* ───────── 渲染 ───────── */
function curEra(){ return ERAS[S.kitchenEra]; }
function renderFolio(){ $("folio").textContent = "殘頁 · "+curEra().name; document.getElementById("app").dataset.era = S.kitchenEra; }
function renderEraNav(){
  const nav=$("eraNav");
  if(S.expedition){ nav.hidden=true; return; }   // 遠征中不可翻頁，須先返回
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
  $("dupBtn").hidden = !S.unlocked.actions.includes("duplication");
  if(!$("dupBtn").hidden) $("dupBtn").textContent = "複製（耗能"+COST_DUP+"）";
  const isHen = it.formId==="hen.fresh";
  $("layBtn").hidden = !isHen;
  if(isHen){ const rest=(it.layRest||0)>0; $("layBtn").disabled=rest; $("layBtn").textContent= rest?"母雞休息中…":"產蛋"; }
}
function renderPantry(){
  const row=$("pantryRow"); row.innerHTML="";
  const onExped = !!S.expedition;
  const list = onExped ? curEra().rares : curEra().commons;
  $("pantryEra").textContent = curEra().name + (onExped ? `（稀有 · 剩 ${S.expedition.left}）` : "");
  $("pantryEmpty").hidden = list.length>0;
  for(const id of list){ const ing=INGREDIENTS[id]; const el=document.createElement("button");
    el.className="pantry-item"; el.dataset.tag = onExped ? "rare" : "fresh";
    if(onExped && S.expedition.left<=0) el.disabled=true;
    el.innerHTML=`<svg class="artwork" viewBox="0 0 100 100"><use href="#art-${ing.forms[ing.base].art}"/></svg><span>${ing.name}</span>`;
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
function renderAll(){ renderFolio(); renderEraNav(); renderExpedition(); renderParadox(); renderOrder(); renderInventory(); renderCraft(); renderSelected(); renderPantry(); renderTools(); renderCodex(); }

/* ───────── 動作 ───────── */
function collect(id){
  if(S.inventory.length>=20){ toast("調理之頁已滿，先丟棄一些吧。"); return; }
  if(S.expedition){ if(S.expedition.left<=0){ toast("此地能帶走的，已經足夠了。"); return; } S.expedition.left--; }
  sfxClick();
  const ing=INGREDIENTS[id]; const it={ uid:newUid(), id, formId:ing.base, ageDays:0, bornEra:S.kitchenEra };
  S.inventory.push(it); selectedUid=it.uid; $("axis").value=0;
  maybeDiscover(ing.base,false); tickLife(); coolParadox(); renderInventory(); renderCraft(); renderSelected(); renderPantry(); renderExpedition(); persist();
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
  maybeDiscover(it.formId,true); gainEnergy(REGEN_AGE); tickLife(); coolParadox();
  renderInventory(); renderCraft(); renderSelected(); persist();
}
function makeRecipe(m){
  const r=m.recipe;
  S.inventory = S.inventory.filter(it=> !m.consume.includes(it.uid));
  const out=INGREDIENTS[r.output];
  let yieldN=1;
  if(r.tool){ yieldN = wearStage(toolWear(r.tool)).yield; S.tools[r.tool] = toolWear(r.tool) + 1; }  // #5 工具磨損
  let last=null;
  for(let k=0;k<yieldN && S.inventory.length<20;k++){
    last={ uid:newUid(), id:r.output, formId:out.base, ageDays:0, bornEra:S.kitchenEra }; S.inventory.push(last);
  }
  if(last) selectedUid=last.uid; $("axis").value=0;
  sfxMake(); tickLife();
  maybeDiscover(out.base,true); coolParadox();
  renderInventory(); renderCraft(); renderSelected(); renderTools(); persist();
  if(yieldN>1) toast(`工具精煉——一次做出 ${yieldN} 份！`);
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
  codex.add(formId); S.stats.discoveries++; gainEnergy(REGEN_DISCOVER); renderCodex(); persist();
  if(celebrate) showDiscovery(FORMS[formId]); else sfxSoft();
  const hadExped=S.unlocked.actions.includes("expedition"), hadDup=S.unlocked.actions.includes("duplication"), eras0=[...S.unlocked.eras];
  ensureUnlocks();
  if(!hadExped && S.unlocked.actions.includes("expedition")){ renderExpedition(); toast("時之爐震動了——你已能『遠征』更古老的紀元。〔遠征已解鎖〕"); }
  if(!hadDup && S.unlocked.actions.includes("duplication")){ renderParadox(); renderSelected(); toast("你窺見了時間的裂縫——『複製』已解鎖。但小心悖論。"); }
  for(const e of S.unlocked.eras) if(!eras0.includes(e)){ renderEraNav(); toast("書頁間浮現了新的紀元——「"+ERAS[e].name+"」已可翻閱。"); }
  checkOrders(); ftueCheck();
}
function ensureUnlocks(){
  const hasTag=t=> [...codex].some(f=> FORMS[f] && FORMS[f].tag===t);
  if(!S.unlocked.actions.includes("expedition") && (hasTag("rare")||hasTag("mythic"))) S.unlocked.actions.push("expedition");
  if(!S.unlocked.actions.includes("duplication") && hasTag("mythic")) S.unlocked.actions.push("duplication");
  const pct = codex.size / ALL_FORMS.length;
  for(const [eid,th] of Object.entries(ERA_UNLOCK))
    if(pct>=th && !S.unlocked.eras.includes(eid)) S.unlocked.eras.push(eid);
}
/* ───────── 複製 + 悖論（#2）───────── */
function paradoxLvl(){ return S.paradox>=80?"lvl2":(S.paradox>=40?"lvl1":"lvl0"); }
function coolParadox(){ S.paradox=Math.max(0,S.paradox-PARADOX_COOL); renderParadox(); }
/* #3 能量 */
function energyActive(){ return S.unlocked.actions.includes("expedition")||S.unlocked.actions.includes("duplication"); }
function gainEnergy(n){ if(!energyActive()) return; S.energy=Math.min(ENERGY_MAX,(S.energy??ENERGY_MAX)+n); }
function spendEnergy(n){ if((S.energy??ENERGY_MAX)<n) return false; S.energy-=n; return true; }
function duplicate(){
  if(!S.unlocked.actions.includes("duplication")) return;
  const it=S.inventory.find(x=>x.uid===selectedUid); if(!it) return;
  if(S.inventory.length>=20){ toast("調理之頁已滿，先丟棄一些吧。"); return; }
  if(!spendEnergy(COST_DUP)){ toast("時光能量不足，無法複製。"); return; }
  const corrupt = S.paradox >= PARADOX_CORRUPT;
  const copy = corrupt ? { uid:newUid(), id:"residue", formId:"residue", ageDays:0, bornEra:S.kitchenEra }
                       : { ...it, uid:newUid() };
  S.inventory.push(copy);
  S.paradox = Math.min(PARADOX_MAX, S.paradox + PARADOX_PER_DUP);
  S.stats.paradoxPeak = Math.max(S.stats.paradoxPeak||0, S.paradox);
  selectedUid=copy.uid; $("axis").value=daysToSlider(copy.ageDays); sfxWarp();
  maybeDiscover(copy.formId,false);
  renderInventory(); renderCraft(); renderSelected(); renderParadox(); persist();
  if(corrupt) toast("時間扭曲了——複製出的，是一團殘影。");
}
function stabilize(){ if(S.paradox<=0) return; if(!spendEnergy(COST_STAB)){ toast("時光能量不足，無法穩定。"); return; } S.paradox=0; renderParadox(); renderSelected(); sfxSoft(); toast("時間線已撫平。"); persist(); }
function renderParadox(){   // 狀態列：時光能量 + 時空悖論
  const eShow = energyActive();
  const pShow = S.unlocked.actions.includes("duplication") || S.paradox>0;
  $("paradoxBar").hidden = !(eShow || pShow);
  // 能量
  $("energyText").hidden = !eShow;
  if(eShow) $("energyText").textContent = "時光能量 "+(S.energy??ENERGY_MAX)+"/"+ENERGY_MAX;
  // 悖論
  const lvl=paradoxLvl();
  document.getElementById("app").dataset.paradox=lvl; $("paradoxFx").dataset.lvl=lvl;
  $("paradoxText").hidden = !pShow;
  if(pShow){ const b=Math.max(0,Math.min(6,Math.round(S.paradox/20)));
    $("paradoxText").textContent="時空悖論 "+"▮".repeat(b)+"▯".repeat(6-b)+(S.paradox>=PARADOX_CORRUPT?"　瀕臨崩壞":""); }
  const stab = pShow && S.paradox>0;
  $("stabilizeBtn").hidden = !stab;
  if(stab) $("stabilizeBtn").textContent = "穩定時間線（耗能"+COST_STAB+"）";
}

/* ───────── #5 工具老化 ───────── */
function toolWear(tid){ return (S.tools && S.tools[tid]) || 0; }
function wearStage(uses){
  if(uses>=24) return { key:"rust",    name:"鏽蝕", yield:1 };
  if(uses>=12) return { key:"antique", name:"古董", yield:3 };
  if(uses>=4)  return { key:"old",     name:"順手", yield:2 };
  return            { key:"new",     name:"嶄新", yield:1 };
}
function maintainTool(tid){ S.tools[tid]=0; sfxSoft(); renderTools(); renderCraft(); persist(); toast("工具已保養如新。"); }
function renderTools(){
  const sect=$("toolSection"), row=$("toolRow");
  const tools = curEra().tools || [];
  if(!tools.length || S.expedition){ sect.hidden=true; return; }
  sect.hidden=false; row.innerHTML="";
  for(const tid of tools){
    const st=wearStage(toolWear(tid));
    const chip=document.createElement("div"); chip.className="tool-chip"; chip.dataset.wear=st.key;
    chip.innerHTML=`<strong>${TOOL_NAMES[tid]||tid}</strong><span>${st.name}${st.yield>1?` · 精煉 ×${st.yield}`:(st.key==="rust"?" · 加成已失":"")}</span>`;
    if(st.key==="rust"){ const b=document.createElement("button"); b.textContent="保養"; b.onclick=()=>maintainTool(tid); chip.appendChild(b); }
    row.appendChild(chip);
  }
}

/* ───────── #4 生命循環（母雞產蛋）───────── */
function tickLife(){ for(const it of S.inventory) if(it.layRest>0) it.layRest--; }
function layEgg(){
  const it=S.inventory.find(x=>x.uid===selectedUid); if(!it||it.formId!=="hen.fresh") return;
  if((it.layRest||0)>0){ toast("母雞正在休息……"); return; }
  if(S.inventory.length>=20){ toast("調理之頁已滿，先丟棄一些吧。"); return; }
  const egg={ uid:newUid(), id:"egg", formId:"egg.fresh", ageDays:0, bornEra:S.kitchenEra };
  S.inventory.push(egg); it.layRest=LAY_COOLDOWN; sfxClick(); toast("咯咯——母雞下了一顆蛋。");
  renderInventory(); renderSelected(); persist();
}
/* ───────── 遠征（#1）───────── */
function startExpedition(dest){
  if(S.expedition) return;
  if(!spendEnergy(COST_EXPED)){ toast("時光能量不足，無法遠征。讓歲月流過或有所發現以回氣。"); return; }
  S.expedition={ dest, from:S.kitchenEra, left:EXPED_CAP }; S.kitchenEra=dest; selectedUid=null; sfxFlow(true);
  const main=$("pageMain"); main.classList.remove("turning"); void main.offsetWidth; main.classList.add("turning");
  renderAll(); persist();
}
function returnExpedition(){
  if(!S.expedition) return;
  S.kitchenEra=S.expedition.from; S.expedition=null; selectedUid=null; sfxFlow(false);
  const main=$("pageMain"); main.classList.remove("turning"); void main.offsetWidth; main.classList.add("turning");
  renderAll(); persist();
}
function renderExpedition(){
  const banner=$("expedBanner"), sect=$("expedSection");
  if(S.expedition){
    banner.hidden=false; sect.hidden=true;
    $("expedBannerText").textContent="遠征中 · "+ERAS[S.expedition.dest].name+"（稀有採集剩 "+S.expedition.left+"）";
  }else{
    banner.hidden=true;
    if(S.unlocked.actions.includes("expedition")){
      sect.hidden=false; const row=$("expedRow"); row.innerHTML="";
      for(const eid of EXPEDITIONS){ const b=document.createElement("button"); b.className="exped-dest";
        b.innerHTML=`<strong>${ERAS[eid].name}</strong><span>採集稀有食材 · 耗能 ${COST_EXPED}</span>`; b.onclick=()=>startExpedition(eid); row.appendChild(b); }
    }else sect.hidden=true;
  }
}

/* ───────── 委託 ───────── */
function checkOrders(){
  const id=S.orders.active; if(!id) return;
  const o=ORDERS[id]; if(!o.goal()) return;
  S.orders.done.push(id); S.orders.active = o.next; o.reward(); gainEnergy(REGEN_ORDER);
  renderEraNav(); renderOrder(); renderPantry(); renderParadox(); persist();
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
$("expedReturn").addEventListener("click",returnExpedition);
$("dupBtn").addEventListener("click",duplicate);
$("stabilizeBtn").addEventListener("click",stabilize);
$("layBtn").addEventListener("click",layEgg);
const APP_VERSION="0.10.0";                // 段三：#9 近未來 + 分子重組器 + 合成蛋白
$("version").textContent="v"+APP_VERSION;
ensureUnlocks();                           // 既有存檔若已發現稀有，補上遠征解鎖
selectedUid = (S.flags.ftueDone && S.inventory[0]) ? S.inventory[0].uid : null;  // FTUE 首次不自動選取，引導玩家自己點
renderTicks(); renderAll(); ftueCheck();

if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{})); }
