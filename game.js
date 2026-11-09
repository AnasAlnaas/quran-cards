/* ===========================================================
   بطاقات القرآن — منطق اللعبة (على محرّك «بطاقات الأخلاق»)
   البطاقات تُولَّد في المتصفح من نصّ المصحف (mushaf.js) بالرواية والأجزاء المختارة،
   مع البطاقات المكتوبة يدوياً (cards.js) — انظر gen.js
   =========================================================== */

/* ألوان اللاعبين: ستّ درجات متباينة فيما بينها وعن أرضية الصفحة البنّية العسلية */
const COLORS = ["#E7B24A","#FF7A85","#6FD8A6","#7CC7F5","#F59DC2","#C9A8FF"];
const OK_COLOR = "#6FD8A6", NO_COLOR = "#FF7A85";
const AR     = ["١","٢","٣","٤","٥","٦"];
const ORD    = ["الأول","الثاني","الثالث","الرابع","الخامس","السادس"];
const LEVELS = ["المرحلة الأولى","المرحلة الثانية","المرحلة الثالثة","المرحلة الرابعة",
                "المرحلة الخامسة","المرحلة السادسة","المرحلة السابعة","المرحلة الثامنة"];
const TIERS  = [
  {key:"easy",   label:"سهل"},
  {key:"medium", label:"متوسط"},
  {key:"hard",   label:"صعب"}
];
/* مستوى الصعوبة: «متدرّج» يوزّع المستويات على المراحل، والبقية تثبّت مستوى واحداً */
const DIFFS = [
  {k:"ramp",   label:"متدرّج", note:"سهل ← صعب"},
  {k:"easy",   label:"سهل"},
  {k:"medium", label:"متوسط"},
  {k:"hard",   label:"صعب"}
];
/* الروايتان: قالون افتراضاً في كل زيارة */
const RIWAYAT = [
  {k:"q", label:"قالون", note:"عن نافع"},
  {k:"h", label:"حفص",   note:"عن عاصم"}
];
/* الأجزاء: المتاح منها يُختار متعدّداً، والباقي «قريباً».
   أسماؤها بالسور كما تُعرف في الحلقات: الجزء الذي يبدأ بأول سورة يُسمّى بها
   (جزء عمّ، جزء تبارك)، والذي يبدأ في أثنائها بموضعه منها (ربع يس، نصف الكهف).
   أمّا أجزاء السبع الطوال (١–١١) فبأول كلماتها كما جرت العادة. */
const JUZ_LABELS = [
  "جزء الم","جزء سيقول","جزء تلك الرسل","جزء لن تنالوا","جزء والمحصنات","جزء لا يحب الله",
  "جزء وإذا سمعوا","جزء ولو أننا","جزء قال الملأ","جزء واعلموا","جزء يعتذرون",
  "جزء هود","نصف يوسف","جزء الحجر","جزء الإسراء","نصف الكهف","جزء الأنبياء","جزء المؤمنون",
  "ربع الفرقان","نصف النمل","نصف العنكبوت","نصف الأحزاب","ربع يس","نصف الزمر","آخر فصلت",
  "جزء الأحقاف","نصف الذاريات","جزء قد سمع","جزء تبارك","جزء عمّ"];
const JUZ_READY = [30, 29, 28, 27, 26, 25];
const juzLabel = j => JUZ_LABELS[j - 1];
/* في الشريط العلوي: الأسماء إن كانا جزأين أو أقلّ، وإلا الأرقام («الأجزاء ٢٥–٣٠» إن تتابعت) */
function juzSummary(list){
  const j = list.slice().sort((x, y) => x - y);
  if(j.length <= 2) return j.slice().reverse().map(juzLabel).join('، ');
  const run = j.every((x, i) => i === 0 || x === j[i - 1] + 1);
  return 'الأجزاء ' + (run ? `${toAr(j[0])}–${toAr(j[j.length - 1])}` : j.map(toAr).join('، '));
}
/* درجة الحديث تظهر شارةً بعد الإجابة وفي المراجعة (للبطاقات التي فيها حديث) */
const GRADES = {
  mt:{label:"متفق عليه",   cls:"g-mt"},
  bk:{label:"صحيح البخاري", cls:"g-sh"},
  ms:{label:"صحيح مسلم",   cls:"g-sh"},
  sh:{label:"صحيح",        cls:"g-sn"},
  hs:{label:"حسن",         cls:"g-hs"}
};
const gradeTag = q => {
  const g = GRADES[q.g];
  return g ? `<span class="grade ${g.cls}">${g.label}</span>` : '';
};
const TIMES = [
  {v:5,  label:"٥ ثوانٍ",  note:"سريعة"},
  {v:20, label:"٢٠ ثانية"},
  {v:30, label:"٣٠ ثانية"},
  {v:45, label:"٤٥ ثانية"},
  {v:0,  label:"بلا مؤقّت"}
];
/* متى يتحوّل المؤقّت إلى اللون التحذيري: نسبةً إلى طول الوقت،
   وإلا لم يظهر التحذير أصلاً في الجولات السريعة */
const warnAt = () => qTime <= 10 ? 2 : Math.min(8, Math.round(qTime / 4));

const PREFS_KEY = 'quran.prefs';
const SEEN_KEY  = 'quran.seen';
const GAME_KEY  = 'quran.game';

let nPlayers = 4, nLevels = 4, qTime = 30, diff = "ramp";
let rw = "q", juz = [30];       // الرواية (لا تُحفظ: قالون في كل زيارة) والأجزاء المختارة
let BANK = { easy: [], medium: [], hard: [] };
let useSound = true, hideNote = false, bigText = false, preferFresh = true;
let players = [], level = 0, turn = 0, cards = [], locked = false;
let pools = {}, history = [];
let timerId = null, left = 0, timerCb = null, paused = false, wasTicking = false;
let curOrder = null;
let modalOk = null, modalCancel = null, modalPrev = null;
/* إنقاذ السؤال: إذا أخطأ اللاعب حاول التالي — الصواب نصف نقطة (له أو يُؤثر بها أخاه)، والخطأ ناقص نقطة */
let useSteal = true, usePractice = true;
let stealing = null;          // {by, pick} أثناء محاولة الإنقاذ
let pendingSteal = null;      // {i, order, pick} بعد الخطأ وقبل قرار الإنقاذ
let helpThisQ = false;        // استُعملت المساعدة في هذا السؤال؟
/* جولة مراجعة الأخطاء بعد المباراة */
let practice = null;          // {list, idx, right, order}
const STEAL_WIN = 0.5, STEAL_LOSS = -1;

const $ = id => document.getElementById(id);
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
/* النقاط قد تكون أنصافاً أو سالبة: ٢½، ½، −١ */
function pts(n){
  const neg = n < 0, a = Math.abs(n), w = Math.floor(a + 1e-9), h = a - w > 0.25;
  const body = w === 0 && h ? '½' : toAr(w) + (h ? '½' : '');
  return (neg ? '−' : '') + body;
}
/* الآيات ﴿…﴾ والكلمات القرآنية بخط مصحف الرواية المختارة، والحديث «…» بخط النسخ */
const fmt = s => esc(s)
  .replace(/﴿[^﴾]*﴾/g, m => `<span class="ay">${m}</span>`)
  .replace(/\uE000([^\uE001]*)\uE001/g, (_, m) => `<span class="ay w">${m}</span>`)
  .replace(/«[^»]*»/g, m => `<span class="dz">${m}</span>`);

/* نجمة ثمانية (خاتم) من مربّعين متقاطعين، كعلامة الأحزاب في المصحف:
   مخطّطة على ظهر البطاقة، ومصمتة في الشعار الصغير */
function star(solid){
  const c = '#FFFFFF';
  const sq = `<rect x="22" y="22" width="56" height="56" rx="3"/>`;
  const p = sq + `<g transform="rotate(45 50 50)">${sq}</g>`;
  return solid
    ? `<svg viewBox="0 0 100 100" aria-hidden="true">
        <g fill="${c}" fill-opacity=".55">${p}</g>
        <circle cx="50" cy="50" r="12" fill="${c}"/></svg>`
    : `<svg viewBox="0 0 100 100" aria-hidden="true">
        <g fill="none" stroke="${c}" stroke-width="2">${p}</g>
        <circle cx="50" cy="50" r="46" fill="none" stroke="${c}" stroke-width="1.4" stroke-opacity=".5"/>
        <circle cx="50" cy="50" r="16" fill="none" stroke="${c}" stroke-width="1.6"/>
        <circle cx="50" cy="50" r="6" fill="${c}"/></svg>`;
}
const EMBLEM = star(false);
const MARK   = star(true);
const show = id => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
/* بطاقة زائدة دائماً على عدد اللاعبين، فيختار آخر لاعب أيضاً ولا تُفرض عليه البطاقة الأخيرة */
const cardsPerLevel = () => Math.max(4, nPlayers + 1);
const tierOf = i => diff === "ramp"
  ? Math.min(2, Math.floor(i * 3 / nLevels))
  : TIERS.findIndex(t => t.key === diff);
const qid = q => q.id;
/* تمييز العدد في العربية: ١ مفرد، ٢ مثنّى، ٣–١٠ جمع، و١١ فما فوق مفرد منصوب */
function qN(n){                         // مبتدأ: «فيه ستة أسئلة»
  if(n === 1) return 'سؤال واحد';
  if(n === 2) return 'سؤالان';
  const r = n % 100;
  return toAr(n) + ' ' + (r >= 3 && r <= 10 ? 'أسئلة' : 'سؤالاً');
}
function qOn(n){                        // بعد حرف جرّ: «يجيب على سؤالين»
  if(n === 1) return 'سؤال واحد';
  if(n === 2) return 'سؤالين';
  const r = n % 100;
  return toAr(n) + ' ' + (r >= 3 && r <= 10 ? 'أسئلة' : 'سؤالاً');
}
const mq = q => { try { return window.matchMedia(q).matches; } catch(e){ return false; } };
const narrow  = () => mq('(max-width: 820px)');
const reduced = () => mq('(prefers-reduced-motion: reduce)');

/* ================= التخزين =================
   مجرّد الوصول إلى localStorage يرمي استثناءً في المتصفحات التي تمنع
   بيانات المواقع أو في وضع التصفّح الخاص، فلا بد أن يقع داخل try نفسه. */
function store(kind){
  try { return kind === 'local' ? window.localStorage : window.sessionStorage; }
  catch(e){ return null; }
}
function readJSON(kind, key){
  try { const s = store(kind); return s ? JSON.parse(s.getItem(key) || 'null') : null; }
  catch(e){ return null; }
}
function writeJSON(kind, key, val){
  try { const s = store(kind); if(s) s.setItem(key, JSON.stringify(val)); } catch(e){}
}
function dropKey(kind, key){
  try { const s = store(kind); if(s) s.removeItem(key); } catch(e){}
}

function savePrefs(){
  writeJSON('local', PREFS_KEY,
    { nPlayers, nLevels, juz, qTime, diff, useSound, hideNote, bigText, preferFresh, useSteal, usePractice });
}
function loadPrefs(){
  const p = readJSON('local', PREFS_KEY);
  if(!p) return;
  if([1,2,3,4,5,6].includes(p.nPlayers))            nPlayers = p.nPlayers;
  if([2,3,4,5,6,7,8].includes(p.nLevels))           nLevels  = p.nLevels;
  if(Array.isArray(p.juz)){
    const j = p.juz.filter(x => JUZ_READY.includes(x));
    if(j.length) juz = j;
  }
  if(TIMES.some(t => t.v === p.qTime))              qTime    = p.qTime;
  if(DIFFS.some(d => d.k === p.diff))               diff     = p.diff;
  if(typeof p.useSound    === 'boolean') useSound    = p.useSound;
  if(typeof p.hideNote    === 'boolean') hideNote    = p.hideNote;
  if(typeof p.bigText     === 'boolean') bigText     = p.bigText;
  if(typeof p.preferFresh === 'boolean') preferFresh = p.preferFresh;
  if(typeof p.useSteal    === 'boolean') useSteal    = p.useSteal;
  if(typeof p.usePractice === 'boolean') usePractice = p.usePractice;
}

function loadSeen(){ return readJSON('local', SEEN_KEY) || {}; }
function markSeen(q){
  if(!preferFresh) return;
  const seen = loadSeen();
  seen[qid(q)] = 1;
  // دار كامل على البنك؟ ابدأ دورة جديدة
  if(Object.keys(seen).length >= bankTotal()) { dropKey('local', SEEN_KEY); return; }
  writeJSON('local', SEEN_KEY, seen);
}
const bankTotal = () => BANK.easy.length + BANK.medium.length + BANK.hard.length;

function saveGame(){
  if(!players.length) return;
  writeJSON('session', GAME_KEY, {
    v:1, nPlayers, nLevels, rw, juz, qTime, diff, useSound, hideNote, bigText, preferFresh, useSteal, usePractice,
    players: players.map(p => ({name:p.name, score:p.score, right:p.right, help:p.help, asked:p.asked, ithar:p.ithar || 0})),
    level, turn,
    cards: cards.map(c => ({q:c.q, opened:c.opened, by:c.by, ok:c.ok})),
    history
  });
}
const loadGame  = () => readJSON('session', GAME_KEY);
const clearGame = () => dropKey('session', GAME_KEY);

/* ================= شاشة الإعداد ================= */
function buildSegments(){
  $('segPlayers').innerHTML = [1,2,3,4,5,6].map(n =>
    `<button type="button" role="radio" aria-checked="${n===nPlayers}" data-n="${n}" class="${n===nPlayers?'on':''}">${toAr(n)}</button>`).join('');
  $('segLevels').innerHTML = [2,3,4,5,6,7,8].map(n =>
    `<button type="button" role="radio" aria-checked="${n===nLevels}" data-n="${n}" class="${n===nLevels?'on':''}">${toAr(n)}</button>`).join('');
  $('segTime').innerHTML = TIMES.map(t =>
    `<button type="button" role="radio" aria-checked="${t.v===qTime}" data-v="${t.v}" class="${t.v===qTime?'on':''}">` +
    `${t.label}${t.note ? `<small>${t.note}</small>` : ''}</button>`).join('');
  $('segDiff').innerHTML = DIFFS.map(d => {
    // عدد أسئلة المستوى ضمن الموضوع المختار
    const n = d.k === "ramp" ? null : BANK[d.k].length;
    return `<button type="button" role="radio" aria-checked="${d.k===diff}" data-k="${d.k}" class="${d.k===diff?'on':''}">` +
           `${d.label}<small>${d.note || toAr(n)}</small></button>`;
  }).join('');

  $('segRw').innerHTML = RIWAYAT.map(r =>
    `<button type="button" role="radio" aria-checked="${r.k===rw}" data-k="${r.k}" class="${r.k===rw?'on':''}">` +
    `${r.label}<small>${r.note}</small></button>`).join('');
  $('segRw').querySelectorAll('button').forEach(b => b.onclick = () => {
    if(rw === b.dataset.k) return;
    rw = b.dataset.k; rebuildBank(); buildSegments(); updateMeta();
  });
  buildJuz();

  $('segPlayers').querySelectorAll('button').forEach(b => b.onclick = () => {
    nPlayers = +b.dataset.n; buildSegments(); buildNames(); updateMeta(); savePrefs();
  });
  $('segLevels').querySelectorAll('button').forEach(b => b.onclick = () => {
    nLevels = +b.dataset.n; buildSegments(); updateMeta(); savePrefs();
  });
  $('segDiff').querySelectorAll('button').forEach(b => b.onclick = () => {
    diff = b.dataset.k; buildSegments(); updateMeta(); savePrefs();
  });
  $('segTime').querySelectorAll('button').forEach(b => b.onclick = () => {
    qTime = +b.dataset.v; buildSegments(); savePrefs();
  });
}

/* اختيار الأجزاء: متعدّد، ولا بد من جزء واحد على الأقل */
function buildJuz(){
  const ready = JUZ_READY.slice().sort((a, b) => b - a);
  $('segJuz').innerHTML = ready.map(j => {
    const on = juz.includes(j);
    return `<button type="button" role="checkbox" aria-checked="${on}" data-j="${j}" class="${on?'on':''}">` +
           `${juzLabel(j)}<small>الجزء ${toAr(j)}</small></button>`;
  }).join('');
  $('segJuz').querySelectorAll('button').forEach(b => b.onclick = () => {
    const j = +b.dataset.j;
    if(juz.includes(j)){
      if(juz.length === 1){ $('juzWarn').hidden = false; return; }   // آخر جزء مختار لا يُلغى
      juz = juz.filter(x => x !== j);
    } else juz = juz.concat(j).sort((a, b) => b - a);
    $('juzWarn').hidden = true;
    rebuildBank(); buildSegments(); updateMeta(); savePrefs();
  });
  $('juzSoon').innerHTML = Array.from({length:30}, (_, i) => 30 - i)
    .filter(j => !JUZ_READY.includes(j))
    .map(j => `<span class="soon">${toAr(j)} · ${juzLabel(j)}</span>`).join('');
}

/* يُبنى البنك من المصحف بالرواية والأجزاء المختارة، مع البطاقات اليدوية */
function rebuildBank(){
  BANK = QGEN.toTiers(QGEN.buildBank(MUSHAF, rw, juz, HAND));
  document.body.classList.toggle('rw-h', rw === 'h');
  document.body.classList.toggle('rw-q', rw === 'q');
  newPools();
  $('bankCount').textContent = toAr(bankTotal());
  $('rwSource').textContent = MUSHAF[rw].label;
}

function buildNames(){
  const old = Array.from({length:6}, (_,i) => { const el = $('pn'+i); return el ? el.value : ''; });
  $('players').innerHTML = Array.from({length:nPlayers}, (_,i) => `
    <label class="pfield" style="--pc:${COLORS[i]}">
      <span class="dot">${AR[i]}</span>
      <input id="pn${i}" maxlength="14" placeholder="اللاعب ${ORD[i]}" autocomplete="off" value="${esc(old[i] || '')}">
    </label>`).join('');
}

function updateMeta(){
  const tiers = Array.from({length:nLevels}, (_,i) => TIERS[tierOf(i)].label);
  $('meta').innerHTML = `كل لاعب يجيب على <b>${qOn(nLevels)}</b> — ` + (diff === "ramp"
    ? `تسلسل المراحل: <b>${tiers.join(' ← ')}</b>`
    : `كل المراحل بمستوى: <b>${tiers[0]}</b>`);
  updateTopicWarn();
}

/* المستويات الثلاثة فيها مئات البطاقات في كل جزء، فلا نقص يُحذَّر منه.
   يبقى الفحص احتياطاً لبنكٍ صغير (جزء جديد قليل البطاقات مثلاً). */
function updateTopicWarn(){
  const el = $('topicWarn');
  if(!el) return;
  const per = cardsPerLevel();
  // كم بطاقة تحتاجها الجولة كلها من كل مستوى
  const demand = {};
  for(let i = 0; i < nLevels; i++){
    const k = TIERS[tierOf(i)].key;
    demand[k] = (demand[k] || 0) + per;
  }
  const msgs = [];
  TIERS.forEach(t => {
    if(!demand[t.key]) return;
    const have = BANK[t.key].length;
    if(have < per)
      msgs.push(`مستوى «${t.label}» فيه ${qN(have)} فقط، فستُكمَّل البطاقات الناقصة من المستويات الأخرى`);
    else if(have < demand[t.key])
      msgs.push(`مستوى «${t.label}» فيه ${qN(have)} وتحتاج الجولة ${toAr(demand[t.key])}، فسيتكرّر بعضها في المراحل اللاحقة`);
  });
  el.hidden = msgs.length === 0;
  if(msgs.length) el.textContent = msgs.join('. ') + '.';
}

function bindChip(id, get, set){
  const el = $(id);
  el.classList.toggle('on', get());
  el.setAttribute('aria-checked', String(get()));
  el.onclick = () => {
    const v = !get();
    set(v);
    el.classList.toggle('on', v);
    el.setAttribute('aria-checked', String(v));
    savePrefs();
  };
}

/* ================= إدارة بنك الأسئلة ================= */
const poolFor = tierKey => BANK[tierKey];
/* بالتناوب بين الأنواع: سؤال من كل نوع في كل دورة، فلا يطغى نوعٌ كثير البطاقات
   («في أيّ سورة؟» مئات) على الأنواع القليلة */
function byKind(list){
  const by = {};
  shuffle(list).forEach(q => (by[q.k] = by[q.k] || []).push(q));
  const lanes = Object.values(by), out = [];
  while(lanes.some(l => l.length)) shuffle(lanes).forEach(l => { if(l.length) out.push(l.shift()); });
  return out;
}
/* الحفظ أولاً: ثلاث بطاقات حفظ ثم بطاقة معرفة (معانٍ، قصص، من القائل، فضائل،
   عدد الآيات، ترتيب السور)، حتى تنفد بطاقات المعرفة */
const MEMO_RUN = 3;
function interleave(list){
  const memo = byKind(list.filter(q => q.m)), other = byKind(list.filter(q => !q.m)), out = [];
  while(memo.length || other.length){
    for(let n = 0; n < MEMO_RUN && memo.length; n++) out.push(memo.shift());
    if(other.length) out.push(other.shift());
  }
  return out;
}
function orderPool(list){
  if(!preferFresh) return interleave(list);
  const seen = loadSeen();
  return interleave(list.filter(q => !seen[qid(q)])).concat(interleave(list.filter(q => seen[qid(q)])));
}
function newPools(){
  pools = {};
  TIERS.forEach(t => { pools[t.key] = orderPool(poolFor(t.key)); });
}

/* يُرجع `count` سؤالاً مختلفاً — لا تكرار داخل المرحلة الواحدة أبداً */
function draw(tierKey, count){
  const used = new Set(), out = [];
  const pull = src => {
    while(out.length < count && src.length){
      const q = src.shift();
      if(!q || used.has(qid(q))) continue;
      used.add(qid(q)); out.push(q);
    }
  };
  if(!pools[tierKey]) pools[tierKey] = orderPool(poolFor(tierKey));
  pull(pools[tierKey]);                                   // المخزون الجاري
  if(out.length < count){                                 // نفد: أعِد خلط الباب، فتتكرّر أسئلته
    pools[tierKey] = orderPool(poolFor(tierKey));
    pull(pools[tierKey]);
  }
  if(out.length < count) pull(shuffle(TIERS.flatMap(t => BANK[t.key])));   // المستوى أصغر من عدد البطاقات
  if(out.length < count) pull(shuffle(BANK[tierKey]));     // احتياط أخير
  return out;
}

/* ================= سير اللعب ================= */
$('start').onclick = () => {
  players = Array.from({length:nPlayers}, (_,i) => ({
    name: ($('pn'+i).value || '').trim() || ('اللاعب ' + ORD[i]),
    color: COLORS[i],
    score: 0,           // النقاط، وفيها أنصاف الإنقاذ وخصمه
    right: 0,           // إجاباته الصحيحة في دوره
    asked: 0,
    help: true          // مساعدة واحدة في اللعبة كاملة، لا تتجدد مع المراحل
  }));
  history = [];
  newPools();
  level = 0;
  hideResume();
  startLevel();
};

function startLevel(){
  turn = 0;
  locked = false;
  const tier = TIERS[tierOf(level)];
  cards = draw(tier.key, cardsPerLevel()).map(q => ({q, opened:false, by:null, ok:false}));
  show('game');
  renderHUD(); renderScores(); renderBoard(); renderTurn();
  saveGame();
  flash(LEVELS[level], `مستوى ${tier.label} — ${toAr(nPlayers)} ${nPlayers===1?'لاعب':'لاعبين'}`, 1500);
}

function renderHUD(){
  const tier = TIERS[tierOf(level)];
  $('stage').innerHTML =
    `${LEVELS[level]}<span class="tag t${tierOf(level)}">${tier.label}</span>` +
    `<small>المرحلة ${toAr(level+1)} من ${toAr(nLevels)} · رواية ${RIWAYAT.find(r => r.k === rw).label} · ${juzSummary(juz)}</small>`;
  $('rail').innerHTML = Array.from({length:nLevels}, (_,i) =>
    `<span class="bar ${i<level?'done':''} ${i===level?'now':''}"></span>`).join('');
}

function renderScores(){
  $('scores').innerHTML = players.map((p,i) => `
    <div class="sc ${i===turn?'active':''}" style="--pc:${p.color}">
      <span class="av">${AR[i]}</span>
      <span class="nm">${esc(p.name)}</span>
      <span class="lf ${p.help ? '' : 'used'}" title="${p.help ? 'مساعدة متاحة' : 'استُخدمت المساعدة'}">50:50</span>
      <span class="pt">${pts(p.score)}</span>
    </div>`).join('');
}

function renderTurn(){
  const p = players[turn];
  if(!p) return;
  $('turnbar').innerHTML =
    `<span>الدور الآن لـ <b style="--tc:${p.color}">${esc(p.name)}</b> — اختر بطاقة</span>`;
}

function renderBoard(){
  const n = cardsPerLevel();
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  $('board').style.gridTemplateColumns = narrow()
    ? 'repeat(2, 1fr)'
    : `repeat(${Math.min(cols,4)}, 1fr)`;

  $('board').innerHTML = cards.map((c,i) => {
    if(!c.opened) return `
      <button class="card" data-i="${i}" aria-label="بطاقة رقم ${toAr(i+1)}">
        <div class="inner">
          <div class="face back">
            <span class="num">${String(i+1).padStart(2,'0')}</span>
            ${EMBLEM}
          </div>
          <div class="face front"></div>
        </div>
      </button>`;
    const p = players[c.by] || {name:'', color:'#B3A283'};
    const col = c.ok ? OK_COLOR : NO_COLOR;
    return `
      <button class="card flipped" disabled data-i="${i}"
        aria-label="بطاقة ${toAr(i+1)} — ${esc(p.name)} ${c.ok ? 'أصاب' : 'أخطأ'}">
        <div class="inner">
          <div class="face back"></div>
          <div class="face front" style="--fc:${col};--wc:${p.color}">
            <span class="mark" aria-hidden="true">${c.ok ? '✔' : '✕'}</span>
            <span class="res">${c.ok ? 'نقطة' : 'بلا نقطة'}</span>
            <span class="who">${esc(p.name)}</span>
          </div>
        </div>
      </button>`;
  }).join('');

  $('board').querySelectorAll('.card:not([disabled])')
    .forEach(b => b.onclick = () => openCard(+b.dataset.i));
}

function openCard(i){
  if(locked || paused) return;
  locked = true;
  const el = $('board').querySelector(`.card[data-i="${i}"]`);
  el.classList.add('flipped');
  el.disabled = true;
  setTimeout(() => askQuestion(i), 380);
}

function askQuestion(i){
  const q = cards[i].q, p = players[turn];
  if(!p){ locked = false; return; }
  markSeen(q);
  stealing = null; pendingSteal = null; helpThisQ = false;
  $('stealbar').hidden = true;
  $('choicebar').hidden = true;
  $('next').hidden = false;
  $('pauseQ').textContent = 'إيقاف';
  $('qwho').innerHTML = `<span class="av" style="--tc:${p.color}">${AR[turn]}</span> ${esc(p.name)}`;
  $('qtext').innerHTML = fmt(q.q);
  $('verdict').classList.remove('on');

  const order = shuffle(q.a.map((t,k) => ({t, ok: k === q.c})));
  $('answers').innerHTML = order.map((o,k) =>
    `<button class="ans" data-k="${k}"><span class="k">${AR[k]}</span><span>${fmt(o.t)}</span></button>`).join('');
  $('answers').querySelectorAll('.ans').forEach(b =>
    b.onclick = () => selectPick(+b.dataset.k));

  setupLifeline(order);
  openOverlay();
  beginPicking(i, order);
}

/* ================= الاختيار المؤجَّل =================
   يختار اللاعب إجابة فتُعلَّم اختياراً له، ويستطيع تغييرها حتى ينتهي الوقت،
   ثم يُحكم على آخر اختيار. وبلا مؤقّت: يكشف زرّ «اكشف الإجابة» النتيجة. */
let picking = null;           // {i, order, pick}
function beginPicking(i, order){
  picking = { i, order, pick: -1 };
  $('answers').querySelectorAll('.ans').forEach(b => b.classList.remove('picked'));
  $('pickhint').textContent = qTime
    ? 'اختر إجابتك — تستطيع تغييرها، وتُكشف النتيجة عند انتهاء الوقت'
    : 'اختر إجابتك — تستطيع تغييرها، ثم اضغط «اكشف الإجابة»';
  $('pickhint').hidden = false;
  $('reveal').hidden = !!qTime;
  $('reveal').disabled = true;
  startTimer(() => finishPicking());
}
function selectPick(k){
  if(!picking || paused) return;
  const btns = [...$('answers').querySelectorAll('.ans')];
  if(!btns[k] || btns[k].disabled) return;
  picking.pick = k;
  btns.forEach((b, j) => {
    b.classList.toggle('picked', j === k);
    b.setAttribute('aria-pressed', String(j === k));
  });
  $('pickhint').textContent = qTime
    ? 'اختيارك محفوظ — تستطيع تغييره حتى ينتهي الوقت'
    : 'اختيارك محفوظ — تستطيع تغييره قبل الكشف';
  $('reveal').disabled = false;
}
function finishPicking(){
  if(!picking) return;
  const { i, order, pick } = picking;
  picking = null;
  $('pickhint').hidden = true;
  $('reveal').hidden = true;
  $('answers').querySelectorAll('.ans').forEach(b => {
    b.classList.remove('picked'); b.removeAttribute('aria-pressed');
  });
  answer(i, order, pick);
}
$('reveal').onclick = () => { if(picking && picking.pick >= 0 && !paused) finishPicking(); };

/* ================= النافذة والتركيز ================= */
function openOverlay(){
  $('overlay').classList.add('on');
  $('overlay').setAttribute('aria-hidden', 'false');
  $('wrap').setAttribute('inert', '');
  $('wrap').setAttribute('aria-hidden', 'true');
  document.body.classList.add('locked');
  const first = $('answers').querySelector('.ans');
  if(first) first.focus();
}
function closeOverlay(){
  stopTimer();
  $('overlay').classList.remove('on');
  $('overlay').setAttribute('aria-hidden', 'true');
  $('wrap').removeAttribute('inert');
  $('wrap').removeAttribute('aria-hidden');
  if(!$('modal').classList.contains('on')) document.body.classList.remove('locked');
}

function trapTab(e, box){
  if(e.key !== 'Tab') return;
  const list = [...box.querySelectorAll('button:not([disabled]),input,select,textarea,[href]')]
    .filter(el => el.offsetWidth || el.offsetHeight || el === document.activeElement);
  if(!list.length) return;
  const first = list[0], last = list[list.length - 1];
  if(e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
}

/* ================= نافذة الرسائل / التأكيد ================= */
function openModal(o){
  $('mtitle').textContent = o.title;
  $('mtext').textContent  = o.text || '';
  $('mok').textContent     = o.ok || 'حسناً';
  $('mcancel').textContent = o.cancel || '';
  $('mcancel').style.display = o.cancel ? '' : 'none';
  modalOk = o.onOk || closeModal;
  modalCancel = o.onCancel || closeModal;
  modalPrev = document.activeElement;
  if($('overlay').classList.contains('on')) $('overlay').setAttribute('inert', '');
  $('wrap').setAttribute('inert', '');
  $('modal').classList.add('on');
  $('modal').setAttribute('aria-hidden', 'false');
  document.body.classList.add('locked');
  $('mok').focus();
}
function closeModal(){
  $('modal').classList.remove('on');
  $('modal').setAttribute('aria-hidden', 'true');
  $('overlay').removeAttribute('inert');
  if(!$('overlay').classList.contains('on')){
    $('wrap').removeAttribute('inert');
    document.body.classList.remove('locked');
  }
  if(modalPrev && modalPrev.focus) { try { modalPrev.focus(); } catch(e){} }
}
$('mok').onclick     = () => { const f = modalOk;     if(f) f(); };
$('mcancel').onclick = () => { const f = modalCancel; if(f) f(); };

/* ================= الإيقاف المؤقّت ================= */
function doPause(){
  if(paused || !$('game').classList.contains('on')) return;
  paused = true;
  wasTicking = timerId !== null;
  stopTimer();
  freezeBar();
  openModal({
    title: 'اللعبة متوقفة',
    text : 'السؤال مخفيّ حتى الاستئناف — والمؤقّت واقف.',
    ok   : 'استئناف اللعب',
    onOk : doResume
  });
}
function doResume(){
  paused = false;
  closeModal();
  if(wasTicking){ unfreezeBar(); runTimer(); }
  wasTicking = false;
}
function freezeBar(){
  const fill = $('tfill');
  fill.style.transition = 'none';
  fill.style.transform = `scaleX(${qTime ? Math.max(left,0)/qTime : 1})`;
}
function unfreezeBar(){
  const fill = $('tfill');
  requestAnimationFrame(() => { fill.style.transition = 'transform 1s linear'; });
}
$('pause').onclick  = doPause;
$('pauseQ').onclick = () => practice ? endPractice() : doPause();

/* ================= إنهاء الجولة ================= */
$('quit').onclick = () => openModal({
  title : 'إنهاء الجولة؟',
  text  : 'ستُعرض النتيجة على ما لُعب حتى الآن، مع مراجعة الأسئلة.',
  ok    : 'إنهاء وعرض النتيجة',
  cancel: 'متابعة اللعب',
  onOk  : () => { closeModal(); closeOverlay(); locked = false; stealing = null; pendingSteal = null; picking = null; finish(); },
  onCancel: closeModal
});

/* ================= المساعدة: حذف إجابتين خاطئتين ================= */
function setupLifeline(order){
  curOrder = order;
  const p = players[turn];
  $('lifewrap').style.display = 'flex';
  $('lifeline').disabled = !p.help;
  $('lifetext').textContent = p.help ? 'احذف إجابتين خاطئتين' : 'استُخدمت مساعدتك';
}

function useLifeline(){
  const p = players[turn];
  if(!p || !p.help || !curOrder || paused) return;
  if($('verdict').classList.contains('on')) return;   // بعد الإجابة لا مساعدة
  p.help = false;
  helpThisQ = true;

  const wrong = shuffle(curOrder.map((o,k) => o.ok ? -1 : k).filter(k => k >= 0));
  const btns = $('answers').querySelectorAll('.ans');
  wrong.slice(0, 2).forEach(k => {
    if(btns[k]){ btns[k].classList.add('gone'); btns[k].disabled = true; }
    // حُذف الخيار الذي كان قد اختاره؟ يرجع بلا اختيار
    if(picking && picking.pick === k){
      picking.pick = -1;
      btns[k].classList.remove('picked');
      $('reveal').disabled = true;
      $('pickhint').textContent = 'حُذف اختيارك — اختر من جديد';
    }
  });

  $('lifeline').disabled = true;
  $('lifetext').textContent = 'حُذفت إجابتان';
  renderScores();
  saveGame();
}
$('lifeline').addEventListener('click', useLifeline);

/* ================= المؤقّت ================= */
function startTimer(onEnd){
  stopTimer();
  timerCb = onEnd;
  const fill = $('tfill'), clock = $('clock');
  fill.classList.remove('warn'); clock.classList.remove('warn');
  if(!qTime){
    clock.style.display = 'none';
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    return;
  }
  clock.style.display = '';
  left = qTime;
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(1)';
  clock.textContent = toAr(left);
  requestAnimationFrame(() => { fill.style.transition = 'transform 1s linear'; });
  runTimer();
}
function runTimer(){
  stopTimer();
  if(!qTime) return;
  timerId = setInterval(tick, 1000);
}
function stopTimer(){
  if(timerId){ clearInterval(timerId); timerId = null; }
}
function tick(){
  left--;
  const fill = $('tfill'), clock = $('clock');
  clock.textContent = toAr(Math.max(left, 0));
  fill.style.transform = `scaleX(${Math.max(left,0)/qTime})`;
  if(left === warnAt()){ fill.classList.add('warn'); clock.classList.add('warn'); }
  if(left <= 0){
    stopTimer();
    const cb = timerCb; timerCb = null;
    if(cb) cb();
  }
}

/* ================= الإجابة ================= */
const nextIdx = () => (turn + 1) % nPlayers;

/* كشف الإجابة الصحيحة والمصدر */
function reveal(i, order){
  const btns = [...$('answers').querySelectorAll('.ans')];
  btns.forEach(b => b.disabled = true);
  const correctIdx = order.findIndex(o => o.ok);
  if(btns[correctIdx]) btns[correctIdx].classList.add('right');
  $('grade').innerHTML = hideNote ? '' : gradeTag(cards[i].q);
  $('note').innerHTML = hideNote ? '' : fmt(cards[i].q.n || '');
  $('stealbar').hidden = true;
  $('next').hidden = false;
  $('verdict').classList.add('on');
  $('next').focus();
}

function answer(i, order, pick){
  stopTimer();
  timerCb = null;
  $('lifewrap').style.display = 'none';
  const btns = [...$('answers').querySelectorAll('.ans')];
  btns.forEach(b => b.disabled = true);

  const correctIdx = order.findIndex(o => o.ok);
  const ok = pick === correctIdx;
  if(pick >= 0 && !ok) btns[pick].classList.add('wrong');
  const picked = pick >= 0 ? order[pick].t : null;

  /* ——— محاولة إنقاذ السؤال ——— */
  if(stealing){
    const sp = players[stealing.by], fp = players[stealing.from];
    const h = { lv: level, pi: stealing.by, q: cards[i].q, ok, picked, steal: true };
    history.push(h);
    stealing = null;
    beep(ok);
    if(!ok){
      sp.score += STEAL_LOSS;
      $('vhead').className = 'vhead bad';
      $('vhead').textContent = `${pick < 0 ? 'انتهى الوقت' : 'لم ينجح الإنقاذ'} — ناقص نقطة على ${sp.name}`;
      reveal(i, order);
      renderScores();
      saveGame();
      return;
    }
    // نجح الإنقاذ: لمن نصف النقطة؟ لنفسه، أو يُؤثر بها أخاه الذي أخطأ
    $('vhead').className = 'vhead good';
    $('vhead').textContent = `أنقذتَ السؤال يا ${sp.name}! لمن نصف النقطة؟`;
    $('keep').innerHTML  = `لي <small>+½ لـ ${esc(sp.name)}</small>`;
    $('ithar').innerHTML = `أُؤثِر بها أخي <small>+½ لـ ${esc(fp.name)}</small>`;
    const choose = gave => {
      if(!$('choicebar').hidden){
        $('choicebar').hidden = true;
        h.gave = gave;
        if(gave){ fp.score += STEAL_WIN; sp.ithar = (sp.ithar || 0) + 1; }
        else sp.score += STEAL_WIN;
        $('vhead').textContent = gave
          ? `آثَر ${sp.name} أخاه ${fp.name} بنصف النقطة — جزاك الله خيراً`
          : `أنقذ ${sp.name} السؤال — نصف نقطة له`;
        reveal(i, order);
        renderScores();
        saveGame();
      }
    };
    $('keep').onclick  = () => choose(false);
    $('ithar').onclick = () => choose(true);
    // الإجابة الصحيحة تظهر الآن، والمصدر بعد الاختيار
    const btns = [...$('answers').querySelectorAll('.ans')];
    btns[order.findIndex(o => o.ok)].classList.add('right');
    $('grade').innerHTML = ''; $('note').innerHTML = '';
    $('stealbar').hidden = true;
    $('next').hidden = true;
    $('choicebar').hidden = false;
    $('verdict').classList.add('on');
    $('keep').focus();
    return;
  }

  /* ——— إجابة صاحب الدور ——— */
  const p = players[turn];
  p.asked++;
  if(ok){ p.score++; p.right++; }
  cards[i].opened = true;
  cards[i].by = turn;
  cards[i].ok = ok;
  history.push({ lv: level, pi: turn, q: cards[i].q, ok, picked });

  $('vhead').className = 'vhead ' + (ok ? 'good' : 'bad');
  $('vhead').textContent = ok
    ? `أحسنت يا ${p.name} — نقطة لك!`
    : (pick < 0 ? 'انتهى الوقت!' : 'إجابة غير صحيحة');
  beep(ok);
  renderScores();
  saveGame();

  // لا محاولة ثانية إن استُعملت المساعدة: يبقى خيار واحد فتصير النقطة مجّانية
  if(!ok && useSteal && nPlayers > 1 && !helpThisQ){
    // لا تُكشف الإجابة بعد: للاعب التالي أن يحاول
    const sp = players[nextIdx()];
    pendingSteal = { i, order, pick };
    $('grade').innerHTML = '';
    $('note').innerHTML = '';
    $('steal').innerHTML = `ينقذ السؤال <b style="color:${sp.color}">${esc(sp.name)}</b> <small>صواب: +½ (له أو لأخيه) · خطأ: −١</small>`;
    $('stealbar').hidden = false;
    $('next').hidden = true;
    $('verdict').classList.add('on');
    $('steal').focus();
    return;
  }
  reveal(i, order);
}

function startSteal(){
  if(!pendingSteal) return;
  const { i, order, pick } = pendingSteal;
  pendingSteal = null;
  const by = nextIdx(), sp = players[by];
  stealing = { by, from: turn };
  $('verdict').classList.remove('on');
  $('stealbar').hidden = true;
  $('qwho').innerHTML = `<span class="av" style="--tc:${sp.color}">${AR[by]}</span> ${esc(sp.name)} <span class="stealtag">إنقاذ السؤال</span>`;
  // أعِد تفعيل الخيارات الباقية: لا الخاطئ المختار، ولا ما حذفته المساعدة
  $('answers').querySelectorAll('.ans').forEach((b, k) => {
    if(k !== pick && !b.classList.contains('gone')) b.disabled = false;
  });
  const first = $('answers').querySelector('.ans:not([disabled])');
  if(first) first.focus();
  beginPicking(i, order);
}
function skipSteal(){
  if(!pendingSteal) return;
  const { i, order } = pendingSteal;
  pendingSteal = null;
  reveal(i, order);
}
$('steal').onclick   = startSteal;
$('nosteal').onclick = skipSteal;

$('next').onclick = () => {
  if(practice){ practiceNext(); return; }
  closeOverlay();
  turn++;
  if(turn >= nPlayers){
    level++;
    if(level >= nLevels){ finish(); return; }
    renderBoard();                       // locked يبقى مفعّلاً حتى تبدأ المرحلة
    const tier = TIERS[tierOf(level)];
    flash(LEVELS[level], `مستوى ${tier.label}`, 1500, startLevel);
    return;
  }
  locked = false;
  renderBoard(); renderScores(); renderTurn();
  saveGame();
};

/* ================= لوحة المفاتيح ================= */
document.addEventListener('keydown', e => {
  if($('modal').classList.contains('on')){
    trapTab(e, $('modal'));
    if(e.key === 'Escape' && $('mcancel').style.display !== 'none'){
      e.preventDefault(); $('mcancel').click();
    }
    return;
  }
  if(e.key === 'p' || e.key === 'P' || e.key === 'ط'){
    if($('game').classList.contains('on')){ e.preventDefault(); doPause(); }
    return;
  }
  if(!$('overlay').classList.contains('on')) return;
  trapTab(e, $('overlay'));

  if(!$('choicebar').hidden) return;     // بانتظار اختيار: لي أو أُؤثر بها أخي
  if(!$('stealbar').hidden){             // بانتظار قرار الإنقاذ
    if(e.key === 'r' || e.key === 'R' || e.key === 'ق'){ e.preventDefault(); startSteal(); }
    else if(e.key === 'Enter' && document.activeElement !== $('nosteal')){ e.preventDefault(); startSteal(); }
    return;
  }
  if(e.key === 'Enter' && picking && picking.pick >= 0 && !$('reveal').hidden){
    e.preventDefault();                  // بلا مؤقّت: Enter يكشف الإجابة
    $('reveal').click();
    return;
  }
  if(e.key === 'Enter' && $('verdict').classList.contains('on') && !$('next').hidden){
    e.preventDefault();                  // وإلا فعّل المتصفح الزر مرة ثانية فتُتخطّى نوبة لاعب
    $('next').click();
    return;
  }
  if(e.key === 'h' || e.key === 'H' || e.key === 'ا'){
    const btn = $('lifeline');
    if($('lifewrap').style.display !== 'none' && !btn.disabled){ e.preventDefault(); btn.click(); }
    return;
  }
  const k = AR.indexOf(e.key) >= 0 ? AR.indexOf(e.key) : (+e.key - 1);
  if(k >= 0 && k <= 3){
    const b = $('answers').querySelectorAll('.ans')[k];
    if(b && !b.disabled){ e.preventDefault(); b.click(); }
  }
});

/* ================= الفاصل والنتائج ================= */
function flash(big, sub, ms, then){
  $('flashBig').textContent = big;
  $('flashSub').textContent = sub;
  $('flash').classList.add('on');
  setTimeout(() => { $('flash').classList.remove('on'); if(then) then(); }, ms);
}

function finish(){
  clearGame();
  // الترتيب بالنقاط (وفيها الإنقاذ)، ثم بنسبة الإصابة في الدور
  const ranked = players.map((p,i) => ({...p, idx:i, pct: p.asked ? Math.round(p.right / p.asked * 100) : 0}))
                        .sort((a,b) => (b.asked > 0) - (a.asked > 0) || b.score - a.score || b.pct - a.pct);
  const played = ranked.filter(p => p.asked > 0);
  const key = p => p.score * 1000 + p.pct;
  // لا نجمة إن تساوى الجميع أو لم يلعب أحد
  const hasWinner = played.length > 1 && played.some(p => key(p) < key(played[0]));
  const total = players.reduce((s,p) => s + p.right, 0);
  const asked = players.reduce((s,p) => s + p.asked, 0);
  const overall = asked ? Math.round(total / asked * 100) : 0;
  const steals = history.filter(h => h.steal);

  $('resTitle').textContent = nPlayers === 1 ? 'نتيجتك' : 'النتيجة النهائية';
  $('resSub').textContent = (nPlayers === 1
    ? `أجبت على ${qOn(asked)} — نسبتك ${toAr(overall)}٪`
    : `الإجابات الصحيحة ${toAr(total)} من ${toAr(asked)} — نسبة المجموعة ${toAr(overall)}٪`) +
    (steals.length ? ` · محاولات الإنقاذ ${toAr(steals.length)}، نجح منها ${toAr(steals.filter(h => h.ok).length)}` +
      (steals.some(h => h.gave) ? `، وآثَر فيها ${toAr(steals.filter(h => h.gave).length)}` : '') : '');

  const maxScore = Math.max(1, ...played.map(p => p.score));
  let place = 0, prev = null;
  $('podium').innerHTML = ranked.map((p,i) => {
    if(key(p) !== prev){ place = i + 1; prev = key(p); }
    const top = hasWinner && place === 1 && p.asked > 0;
    const w = p.asked ? Math.max(0, Math.round(p.score / maxScore * 100)) : 0;
    return `<div class="row ${top ? 'first' : ''}" style="--pc:${p.color}">
      <span class="rank">${top ? '★' : (p.asked ? AR[place-1] : '—')}</span>
      <span class="rname"><span class="av">${AR[p.idx]}</span>${esc(p.name)}
        ${p.asked && p.help ? '<span class="kept">لم يستخدم مساعدته</span>' : ''}
        ${p.ithar ? `<span class="kept ithar">آثَر أخاه${p.ithar > 1 ? ' ×' + toAr(p.ithar) : ''}</span>` : ''}</span>
      <span class="pct">${p.asked ? pts(p.score) : '—'}<small>${
        p.asked ? `نقطة · أصاب ${toAr(p.right)} من ${toAr(p.asked)}` : 'لم يلعب'}</small></span>
      <span class="track"><i data-w="${w}"></i></span>
    </div>`;
  }).join('');

  renderReview();
  const wrongs = wrongList();
  $('practiceBtn').hidden = !(usePractice && wrongs.length);
  $('practiceBtn').textContent = `راجعوا الأخطاء (${toAr(wrongs.length)})`;
  show('results');
  window.scrollTo(0, 0);
  requestAnimationFrame(() => {
    $('podium').querySelectorAll('.track i').forEach(el => el.style.width = el.dataset.w + '%');
  });
  if(played.length && played[0].pct >= 50) confetti();
}

/* ================= جولة مراجعة الأخطاء =================
   الأسئلة التي أخطأ فيها صاحب الدور (أيّاً كانت نتيجة الإنقاذ)، بلا مؤقّت ولا نقاط */
function wrongList(){
  const seen = new Set(), out = [];
  history.forEach(h => {
    if(h.steal || h.ok || seen.has(qid(h.q))) return;
    seen.add(qid(h.q)); out.push(h.q);
  });
  return out;
}
function startPractice(){
  const list = shuffle(wrongList());
  if(!list.length) return;
  practice = { list, idx: 0, right: 0, order: null };
  $('pauseQ').textContent = 'إغلاق';
  showPractice();
  openOverlay();
}
function showPractice(){
  const q = practice.list[practice.idx];
  stopTimer();
  $('clock').style.display = 'none';
  $('tfill').style.transition = 'none';
  $('tfill').style.transform = 'scaleX(1)';
  $('lifewrap').style.display = 'none';
  $('stealbar').hidden = true;
  $('pickhint').hidden = true;
  $('reveal').hidden = true;
  picking = null;
  $('next').hidden = false;
  $('verdict').classList.remove('on');
  $('qwho').innerHTML = `<span class="stealtag">مراجعة الأخطاء</span> ${toAr(practice.idx + 1)} من ${toAr(practice.list.length)}`;
  $('qtext').innerHTML = fmt(q.q);
  const order = shuffle(q.a.map((t,k) => ({t, ok: k === q.c})));
  practice.order = order;
  $('answers').innerHTML = order.map((o,k) =>
    `<button class="ans" data-k="${k}"><span class="k">${AR[k]}</span><span>${fmt(o.t)}</span></button>`).join('');
  $('answers').querySelectorAll('.ans').forEach(b => b.onclick = () => practiceAnswer(+b.dataset.k));
  const first = $('answers').querySelector('.ans');
  if(first) first.focus();
}
function practiceAnswer(pick){
  const q = practice.list[practice.idx], order = practice.order;
  const btns = [...$('answers').querySelectorAll('.ans')];
  btns.forEach(b => b.disabled = true);
  const correctIdx = order.findIndex(o => o.ok);
  const ok = pick === correctIdx;
  btns[correctIdx].classList.add('right');
  if(!ok) btns[pick].classList.add('wrong');
  if(ok) practice.right++;
  $('vhead').className = 'vhead ' + (ok ? 'good' : 'bad');
  $('vhead').textContent = ok ? 'أحسنتم — رسخت الآن!' : 'ما زالت تحتاج مراجعة';
  $('grade').innerHTML = gradeTag(q);
  $('note').innerHTML = fmt(q.n || '');
  $('next').textContent = practice.idx + 1 < practice.list.length ? 'التالي' : 'إنهاء المراجعة';
  $('verdict').classList.add('on');
  beep(ok);
  $('next').focus();
}
function practiceNext(){
  practice.idx++;
  if(practice.idx < practice.list.length){ showPractice(); return; }
  const r = practice.right, n = practice.list.length;
  endPractice();
  openModal({
    title: 'انتهت المراجعة',
    text : `أجبتم صواباً عن ${toAr(r)} من ${toAr(n)} في جولة المراجعة.`,
    ok   : 'حسناً'
  });
}
function endPractice(){
  practice = null;
  $('next').textContent = 'التالي';
  $('pauseQ').textContent = 'إيقاف';
  $('clock').style.display = '';
  closeOverlay();
}
$('practiceBtn').onclick = startPractice;

function renderReview(){
  const onlyWrong = $('rvToggle').getAttribute('aria-pressed') === 'true';
  const list = onlyWrong ? history.filter(h => !h.ok) : history;
  $('rvToggle').textContent = onlyWrong ? 'الأخطاء فقط' : 'كل الأسئلة';

  if(!list.length){
    $('rvlist').innerHTML = `<p class="rvempty">${
      onlyWrong ? 'ما وقع خطأ واحد — أحسنتم!' : 'لم يُجب على أي سؤال بعد.'}</p>`;
    return;
  }
  $('rvlist').innerHTML = list.map(h => {
    const p = players[h.pi] || {name:'', color:'#B3A283'};
    const correct = h.q.a[h.q.c];
    return `<div class="rv" style="--pc:${p.color};--rc:${h.ok ? OK_COLOR : NO_COLOR}">
      <div class="top"><span class="av">${AR[h.pi]}</span>${esc(p.name)}${h.steal
        ? ` <span class="stealtag">إنقاذ ${h.ok ? (h.gave ? '— آثَر به أخاه' : '+½') : '−١'}</span>` : ''} · ${LEVELS[h.lv]} · ${TIERS[tierOf(h.lv)].label}${gradeTag(h.q)}</div>
      <div class="q">${fmt(h.q.q)}</div>
      <div class="ok">الإجابة الصحيحة: ${fmt(correct)}</div>
      ${h.ok ? '' : `<div class="no">${h.picked === null ? 'انتهى الوقت دون إجابة' : 'اختار: ' + fmt(h.picked)}</div>`}
      ${h.q.n ? `<div class="nt">${fmt(h.q.n)}</div>` : ''}
    </div>`;
  }).join('');
}

$('rvToggle').onclick = () => {
  const now = $('rvToggle').getAttribute('aria-pressed') === 'true';
  $('rvToggle').setAttribute('aria-pressed', String(!now));
  renderReview();
};

$('again').onclick = () => {
  players.forEach(p => { p.score = 0; p.right = 0; p.asked = 0; p.ithar = 0; p.help = true; });
  history = [];
  newPools();
  level = 0;
  startLevel();
};
$('reset').onclick = () => { clearGame(); show('setup'); window.scrollTo(0, 0); };

function confetti(){
  if(reduced()) return;
  for(let i = 0; i < 70; i++){
    const d = document.createElement('div');
    d.className = 'conf';
    d.style.background = COLORS[i % COLORS.length];
    d.style.insetInlineStart = Math.random() * 100 + 'vw';
    d.style.animation = `fall ${2.4 + Math.random()*2}s ${Math.random()*1.2}s ease-in forwards`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 6500);
  }
}

/* ================= الصوت ================= */
let actx;
function beep(ok){
  if(!useSound) return;
  try{
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if(actx.state === 'suspended') actx.resume();
    const notes = ok ? [523, 659, 784] : [220, 175];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      const t0 = actx.currentTime + i * 0.11;
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.30);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + 0.32);
    });
  }catch(e){}
}

/* ================= استئناف جولة غير مكتملة ================= */
function hideResume(){ $('resumeBar').classList.remove('on'); }

function offerResume(){
  const s = loadGame();
  if(!s || s.v !== 1 || !s.players || !s.players.length || s.level >= s.nLevels) return;
  const r = RIWAYAT.find(x => x.k === s.rw) || RIWAYAT[0];
  $('resumeInfo').textContent =
    `${toAr(s.players.length)} ${s.players.length === 1 ? 'لاعب' : 'لاعبين'} · ` +
    `المرحلة ${toAr(s.level + 1)} من ${toAr(s.nLevels)} · رواية ${r.label}`;
  $('resumeBar').classList.add('on');
  $('resumeGo').onclick   = () => restore(s);
  $('resumeDrop').onclick = () => { clearGame(); hideResume(); };
}

function restore(s){
  nPlayers = s.nPlayers; nLevels = s.nLevels; qTime = s.qTime;
  rw = RIWAYAT.some(r => r.k === s.rw) ? s.rw : 'q';
  juz = Array.isArray(s.juz) ? s.juz.filter(x => JUZ_READY.includes(x)) : [];
  if(!juz.length) juz = [30];
  rebuildBank();
  diff = DIFFS.some(d => d.k === s.diff) ? s.diff : "ramp";   // الجولات المحفوظة قبل الميزة
  useSound = s.useSound; hideNote = s.hideNote; preferFresh = s.preferFresh;
  if(typeof s.useSteal    === 'boolean') useSteal    = s.useSteal;
  if(typeof s.usePractice === 'boolean') usePractice = s.usePractice;
  setBig(!!s.bigText);
  players = s.players.map((p,i) => ({ ...p, color: COLORS[i], asked: p.asked || 0,
                                       right: typeof p.right === 'number' ? p.right : p.score }));
  level = s.level; turn = s.turn; history = s.history || [];
  cards = (s.cards || []).map(c => ({ q:c.q, opened:c.opened, by:c.by, ok:c.ok }));

  newPools();                                   // لا تُعِد طرح ما سُئل في هذه الجولة
  const done = new Set(history.map(h => qid(h.q)));
  cards.forEach(c => done.add(qid(c.q)));
  Object.keys(pools).forEach(k => { pools[k] = pools[k].filter(q => !done.has(qid(q))); });

  locked = false;
  hideResume();
  buildSegments(); buildNames(); updateMeta();
  show('game');
  renderHUD(); renderScores(); renderBoard(); renderTurn();
  window.scrollTo(0, 0);
}

function setBig(v){
  bigText = v;
  document.body.classList.toggle('big', v);
  const el = $('chipBig');
  el.classList.toggle('on', v);
  el.setAttribute('aria-checked', String(v));
}

/* ================= سماء الليل =================
   نجوم بأحجام وإضاءات مختلفة على لوحة ثابتة، وعددها بحسب مساحة الشاشة؛
   تُرسم مرّة وتُعاد عند تغيّر المقاس فقط. وبضع نجوم تتلألأ بـCSS. */
function drawSky(){
  const cv = $('sky');
  if(!cv || !cv.getContext) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth, h = window.innerHeight;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  const x = cv.getContext('2d');
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const n = Math.round(w * h / 2600);
  for(let i = 0; i < n; i++){
    const r = Math.random() < .92 ? Math.random() * .8 + .25 : Math.random() * .9 + 1;
    x.globalAlpha = Math.random() * .6 + (r > 1 ? .4 : .15);
    /* معظمها أبيض، وقليل منها مائل إلى الزرقة أو الدفء كالنجوم الحقيقية */
    const t = Math.random();
    x.fillStyle = t < .1 ? '#CFE0FF' : t < .16 ? '#FFE9D2' : '#FFFFFF';
    x.beginPath(); x.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2); x.fill();
  }
  x.globalAlpha = 1;
}
function placeTwinkles(){
  const box = $('twinkles');
  if(!box) return;
  box.innerHTML = Array.from({length: 14}, () =>
    `<span class="twinkle" style="top:${(Math.random()*96+2).toFixed(1)}%;left:${(Math.random()*96+2).toFixed(1)}%;` +
    `--tw:${(3 + Math.random()*4).toFixed(1)}s;--td:${(-Math.random()*6).toFixed(1)}s"></span>`).join('');
}

/* ================= التشغيل ================= */
function fatal(msg){
  const box = document.querySelector('#setup .panel');
  if(!box) return;
  box.innerHTML =
    `<h2>تعذّر تحميل اللعبة</h2>` +
    `<p class="hint">${esc(msg)}</p>` +
    `<div class="center"><button class="btn" id="retry" type="button">أعد المحاولة</button></div>`;
  // بلا onclick داخل السطر: سياسة أمان المحتوى تمنع النصوص المضمّنة
  const b = document.getElementById('retry');
  if(b) b.addEventListener('click', () => location.reload());
}

function boot(){
  document.querySelectorAll('[data-mark]').forEach(el => { el.innerHTML = MARK; });
  drawSky(); placeTwinkles();
  if(typeof MUSHAF === 'undefined' || typeof HAND === 'undefined' || typeof QGEN === 'undefined'){
    fatal('لم تصل ملفات المصحف والأسئلة. تحقّق من الاتصال بالإنترنت ثم أعد المحاولة.');
    return;
  }
  loadPrefs();
  rebuildBank();
  setBig(bigText);
  bindChip('chipSound', () => useSound,    v => useSound = v);
  bindChip('chipNote',  () => hideNote,    v => hideNote = v);
  bindChip('chipFresh', () => preferFresh, v => preferFresh = v);
  bindChip('chipSteal', () => useSteal,    v => useSteal = v);
  bindChip('chipPractice', () => usePractice, v => usePractice = v);
  $('chipBig').classList.toggle('on', bigText);
  $('chipBig').setAttribute('aria-checked', String(bigText));
  $('chipBig').onclick = () => { setBig(!bigText); savePrefs(); };

  buildSegments();
  buildNames();
  updateMeta();
  offerResume();

  let lastNarrow = narrow();
  let skyT = null;
  window.addEventListener('resize', () => {
    clearTimeout(skyT); skyT = setTimeout(drawSky, 150);   // السماء تُعاد بعد انتهاء تغيير المقاس
    const n = narrow();
    if(n === lastNarrow) return;   // تغيّر الارتفاع فقط (شريط عنوان الجوال) — لا تُعِد بناء اللوح
    lastNarrow = n;
    if($('game').classList.contains('on') && !$('overlay').classList.contains('on')) renderBoard();
  });

  if('serviceWorker' in navigator && location.protocol === 'https:'){
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
}

try { boot(); } catch(e){
  console.error('بطاقات القرآن — خطأ في التشغيل:', e);
  fatal('حدث خطأ غير متوقّع أثناء التشغيل.');
}
