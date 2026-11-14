// Luisteren: comprehensible-input practice with real videos.
// Everything is in the target language except short glosses on the goal phrases.

// Two ways to run: locally with server.py (all features), or as a standalone published site
// (window.APP_CONFIG = {static: true, lang, base, tabs}): one language, progress kept in the browser,
// and nothing that needs the Mac (Claude, Whisper, new voices).
const CONFIG = window.APP_CONFIG || {};
const STATIC = !!CONFIG.static;
const asset = path => (CONFIG.base || '/') + path;

// Each language keeps its own goals, scenes, words and hours. The choice is remembered per browser.
const LANGUAGES = {
  nl: { tag: 'NL', name: 'Dutch', voice: 'nl-NL', accents: { flemish: 'Flemish' } },
  ar: { tag: 'AR', name: 'Arabic', voice: 'ar' },
  pt: { tag: 'PT', name: 'Portuguese', voice: 'pt-BR', accents: { brazilian: 'Brazilian', european: 'European' } },
  fr: { tag: 'FR', name: 'French', voice: 'fr-FR' },
  zh: { tag: '中文', name: 'Mandarin', voice: 'zh-CN' },
};
const LEVELS = ['Complete beginner', 'Beginner', 'Intermediate', 'Intermediate/Advanced', 'Advanced'];
const LANG = CONFIG.lang || (() => { try { const l = localStorage.getItem('lang'); return LANGUAGES[l] ? l : 'nl'; } catch (e) { return 'nl'; } })();
function switchLanguage(lang) {
  try { localStorage.setItem('lang', lang); } catch (e) { /* storage blocked */ }
  location.hash = '#goals';
  location.reload();
}
const DELAY_SECONDS = 1.5;      // "delayed" captions appear this long after the line is spoken
const ROADMAP = [0, 50, 150, 300, 600, 1000, 1500];  // hours for levels 1–7
const MANUAL_KINDS = { conversation: 'Conversation', video: 'Other video', audio: 'Podcast / audio', tutor: 'Tutor session', other: 'Other' };

let goals, library, lexicon, state;
let byId = {};
let player = null, watchTimers = [], watchCtx = null;
let scenesData = null, sceneHandle = null;

// ---------- helpers ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toLocaleDateString('sv');  // YYYY-MM-DD in local time
const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtHours = s => (s / 3600).toFixed(s < 36000 ? 1 : 0);
const WORD_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]+(?:'[a-z]+)?/g;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// Each view gets a fresh <main> so listeners from the previous render don't pile up.
function freshMain() {
  const old = $('#main');
  const m = old.cloneNode(false);
  old.replaceWith(m);
  return m;
}

// Text-to-speech fallback for when no video says a phrase yet. Uses the system's
// Dutch voices (on a Mac: Xander for the Netherlands, Ellen for Flemish).
function pickVoice(voices, lang) {
  // Prefer the natural-sounding downloadable voices over the robotic compact ones.
  const rank = v => (/premium/i.test(v.name) ? 3 : /enhanced|verbeterd|siri|neural|natural/i.test(v.name) ? 2 : 1) + (v.lang.replace('_', '-') === lang ? 10 : 0);
  return voices.filter(v => v.lang.startsWith(lang.slice(0, 2))).sort((a, b) => rank(b) - rank(a))[0] || null;
}

// Natural audio first (ElevenLabs recordings: from the server's cache locally, or the files shipped
// with the published site); the system voice is the fallback.
let currentAudio = null, audioFiles = null;
async function fetchAudio(kind, text) {
  if (!STATIC) return fetch(`/api/tts?lang=${LANG}&kind=${kind}&text=${encodeURIComponent(text)}`);
  if (!audioFiles) audioFiles = await fetch(asset(`data/audio/${LANG}/manifest.json`)).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const file = audioFiles[`${kind}|${text}`];
  return file ? fetch(asset(`data/audio/${LANG}/${file}`)) : { ok: false };
}
async function speak(text, { flemish = false, slow = false } = {}) {
  if (currentAudio) currentAudio.pause();
  if (window.speechSynthesis) speechSynthesis.cancel();
  const kind = flemish ? 'flemish' : 'nl';
  try {
    const r = await fetchAudio(kind, text);
    if (r.ok) {
      const blob = await r.blob();
      currentAudio = new Audio(URL.createObjectURL(blob));
      currentAudio.playbackRate = slow ? 0.75 : 1;
      await ScenePlayer.level(currentAudio, `${kind}|${text}`, blob);
      await currentAudio.play();
      return;
    }
  } catch (e) { /* fall through to the system voice */ }
  speakSystem(text, { flemish, slow });
}

function speakSystem(text, { flemish = false, slow = false } = {}) {
  if (!window.speechSynthesis) { toast('This browser can’t speak.'); return; }
  const lang = LANG === 'ar' ? (/[\u0600-\u06FF]/.test(text) ? 'ar' : 'en-US') : LANG === 'nl' && flemish ? 'nl-BE' : LANGUAGES[LANG].voice;
  const u = new SpeechSynthesisUtterance(text.replace(/_{2,}/g, '…').replace(/\s*\/\s*/g, ', '));
  const voices = speechSynthesis.getVoices();
  u.voice = pickVoice(voices, lang);
  u.lang = lang;
  u.rate = slow ? 0.65 : 0.9;
  speechSynthesis.speak(u);
}

function sayButtons(text, flemish = false) {
  const t = esc(text);
  return `<span class="say"><button data-say="${t}" ${flemish ? 'data-flemish="1"' : ''} title="Listen">▶</button><button data-say="${t}" data-slow="1" ${flemish ? 'data-flemish="1"' : ''} title="Listen slowly">🐢</button></span>`;
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-say]');
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  speak(b.dataset.say, { flemish: !!b.dataset.flemish, slow: !!b.dataset.slow });
}, true);

function route() {
  const [path, query] = location.hash.slice(1).split('?');
  const [view, arg] = (path || 'feed').split('/');
  return { view, arg, params: new URLSearchParams(query || '') };
}

// ---------- state ----------
function defaultState() {
  return {
    vocabSize: goals.startingVocab || 1000,
    comfortWpm: goals.startingWpm || 75,
    words: {},
    watched: {},
    log: [],
    goals: {},
    vocabHistory: [],
    settings: { captionMode: 'delayed', speed: 1 },
  };
}

// Progress: a file on the Mac via the server, or this browser's storage on the published site.
const STATE_KEY = `luisteren-state-${LANG}`;
function loadState() {
  if (!STATIC) return fetch(`/api/state?lang=${LANG}`).then(r => (r.ok ? r.json() : null));
  try { return Promise.resolve(JSON.parse(localStorage.getItem(STATE_KEY))); } catch (e) { return Promise.resolve(null); }
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (STATIC) {
      try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { toast('This browser won’t save progress (private mode?).'); }
      return;
    }
    fetch(`/api/state?lang=${LANG}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) })
      .catch(() => toast('Could not save. Is the server running?'));
  }, 400);
}

function addLog(kind, seconds, note) {
  const d = today();
  if (kind === 'app') {
    const entry = state.log.find(e => e.date === d && e.kind === 'app');
    if (entry) entry.seconds += seconds;
    else state.log.push({ date: d, kind: 'app', seconds });
  } else {
    state.log.push({ date: d, kind, seconds, note: note || '' });
  }
  save();
}

// ---------- difficulty ----------
// Speaking speed is the strongest signal (it cleanly separates Dutchly's labelled
// levels); word coverage against a frequency list is the secondary one.
function isKnown(w) {
  const mine = state.words[w];
  if (mine) return mine.status === 'known';
  const lx = lexicon[w];
  if (!lx) return false;
  return (lx[0] > 0 && lx[0] <= state.vocabSize) || lx[1] === 1;
}

function coverage(v) {
  let known = 0, total = 0;
  for (const [w, c] of Object.entries(v.words)) {
    total += c;
    if (isKnown(w) || /^\d/.test(w)) known += c;
  }
  return total ? known / total : 0;
}

function assess(v) {
  const cov = coverage(v);
  const speed = v.wpm / state.comfortWpm;
  // Slow speech leaves room for the visuals to explain new words, so it
  // forgives lower coverage (beginner videos are full of concrete nouns).
  const eff = cov + Math.max(0, 1 - speed) * 0.2;
  let band;
  if (speed > 1.4 || eff < 0.72) band = 'hard';
  else if (speed > 1.15 || eff < 0.8) band = 'stretch';
  else if (speed < 0.7 && eff >= 0.88) band = 'easy';
  else band = 'right';
  const fit = Math.abs(speed - 1) + Math.max(0, 0.86 - eff) * 3;
  return { cov, speed, band, fit };
}

const BAND_LABEL = { easy: 'Easy', right: 'Just right', stretch: 'Stretch', hard: 'Hard' };
const speedLabel = wpm => (wpm < 70 ? 'slow' : wpm < 100 ? 'relaxed' : wpm < 130 ? 'natural' : 'fast');

function topicScore(v, topic) {
  return topic.keywords.reduce((n, k) => n + (v.words[k] || 0), 0);
}

function allTopics() {
  return goals.stages.flatMap(s => s.topics || []);
}

// ---------- boot ----------
function setupLanguageSwitch() {
  const tag = document.querySelector('.lang-tag');
  if (tag) tag.textContent = LANGUAGES[LANG].tag;
  const nav = document.querySelector('nav');
  if (STATIC) {
    // The published site is one language, without the tabs that need the Mac.
    nav.querySelectorAll('[data-nav]').forEach(a => { if (CONFIG.tabs && !CONFIG.tabs.includes(a.dataset.nav)) a.remove(); });
    if (CONFIG.title) document.querySelector('.brand').firstChild.textContent = CONFIG.title + ' ';
    return;
  }
  const sel = document.createElement('select');
  sel.id = 'lang-switch';
  sel.setAttribute('aria-label', 'Language');
  sel.innerHTML = Object.entries(LANGUAGES).map(([k, v]) => `<option value="${k}" ${k === LANG ? 'selected' : ''}>${v.name}</option>`).join('');
  sel.addEventListener('change', () => switchLanguage(sel.value));
  nav.after(sel);
}

async function boot() {
  setupLanguageSwitch();
  const get = url => fetch(url).then(r => (r.ok ? r.json() : null));
  [goals, library, lexicon, state] = await Promise.all([
    get(asset(`goals/${LANG}.json`)),
    get(asset(`data/library_${LANG}.json`)),
    get(asset(`data/lexicon_${LANG}.json`)),
    loadState(),
  ]);
  goals = goals || { stages: [] };
  library = library || [];
  lexicon = lexicon || {};
  state = Object.assign(defaultState(), state || {});
  library.forEach(v => (byId[v.id] = v));
  window.addEventListener('hashchange', render);
  document.addEventListener('click', e => {
    if (!e.target.closest('#popup') && !e.target.closest('.w')) closePopup();
  });
  render();
}

function render() {
  teardownWatch();
  teardownCalibration();
  if (sceneHandle) { sceneHandle.stop(); sceneHandle = null; }
  closePopup();
  const { view } = route();
  document.querySelectorAll('[data-nav]').forEach(a =>
    a.classList.toggle('active', a.dataset.nav === (view === 'watch' ? 'feed' : view)));
  stopSayRecording();
  const views = { feed: renderFeed, watch: renderWatch, level: renderLevel, plan: renderPlan, goals: renderGoals, scenes: renderScenes, say: renderSay, words: renderWords, log: renderLog };
  (views[view] || renderFeed)();
  window.scrollTo(0, 0);
}

// ---------- feed ----------
function renderFeed() {
  freshMain();
  const { params } = route();
  const f = {
    show: params.get('show') || 'zone',
    channel: params.get('channel') || '',
    topic: params.get('topic') || '',
    accent: params.get('accent') || '',
    level: params.get('level') || '',
    sort: params.get('sort') || 'fit',
  };
  const levels = LEVELS.filter(l => library.some(v => v.level === l));
  const accentNames = LANGUAGES[LANG].accents || {};
  const accents = [...new Set(library.map(v => v.variant).filter(a => accentNames[a]))];
  const topic = allTopics().find(t => t.id === f.topic);
  let items = library.map(v => ({ v, a: assess(v), w: state.watched[v.id] }));
  if (f.channel) items = items.filter(x => x.v.channel === f.channel);
  if (f.accent) items = items.filter(x => x.v.variant === f.accent);
  if (f.level) items = items.filter(x => x.v.level === f.level);
  if (topic) items = items.filter(x => topicScore(x.v, topic) >= 3);
  let hidden = 0;
  if (f.show === 'zone') {
    const before = items.length;
    items = items.filter(x => x.a.band === 'right' || x.a.band === 'stretch');
    hidden = before - items.length;
  }
  if (f.show === 'unwatched') items = items.filter(x => !x.w);
  if (f.sort === 'fit') items.sort((a, b) => a.a.fit - b.a.fit);
  if (f.sort === 'easy') items.sort((a, b) => a.v.wpm - b.v.wpm);
  if (f.sort === 'hard') items.sort((a, b) => b.v.wpm - a.v.wpm);
  if (topic) items.sort((a, b) => topicScore(b.v, topic) - topicScore(a.v, topic));

  const channels = [...new Set(library.map(v => v.channel))];
  const opt = (val, label, cur) => `<option value="${esc(val)}" ${val === cur ? 'selected' : ''}>${esc(label)}</option>`;

  $('#main').innerHTML = `
    <div class="feed-head">
      <div>
        <h1>${topic ? esc(topic.name) : 'What to watch'}</h1>
        <div class="muted small">${library.length} videos in your library · tuned for ~${state.comfortWpm} words/min and ~${state.vocabSize.toLocaleString()} known words</div>
      </div>
      <div class="filters">
        <select data-f="show">${opt('zone', 'In my zone', f.show)}${opt('unwatched', 'Unwatched', f.show)}${opt('all', 'Everything', f.show)}</select>
        <select data-f="channel">${opt('', 'All channels', f.channel)}${channels.map(c => opt(c, c, f.channel)).join('')}</select>
        ${levels.length > 1 ? `<select data-f="level">${opt('', 'Any level', f.level)}${levels.map(l => opt(l, l, f.level)).join('')}</select>` : ''}
        ${accents.length > 1 ? `<select data-f="accent">${opt('', 'Any accent', f.accent)}${accents.map(a => opt(a, accentNames[a], f.accent)).join('')}</select>` : ''}
        ${allTopics().length ? `<select data-f="topic">${opt('', 'Any topic', f.topic)}${allTopics().map(t => opt(t.id, t.name, f.topic)).join('')}</select>` : ''}
        <select data-f="sort">${opt('fit', 'Best fit', f.sort)}${opt('easy', 'Slowest first', f.sort)}${opt('hard', 'Fastest first', f.sort)}</select>
      </div>
    </div>
    ${hidden ? `<div class="zone-note">${hidden} video${hidden === 1 ? '' : 's'} outside your zone (too fast or too easy) are hidden. <a href="#feed?${new URLSearchParams({ ...Object.fromEntries(route().params), show: 'all' })}">Show everything</a>. Fast ones work well as clips: search a phrase under My words.</div>` : ''}
    ${library.length === 0 ? (LANG === 'nl'
      ? `<div class="zone-note">Your library is empty. Run <code>.venv/bin/python ingest.py ${LANG}</code> to fetch videos.</div>`
      : `<div class="zone-note">No ${LANGUAGES[LANG].name} videos yet. For now, practice with <a href="#goals">Goals</a> and <a href="#scenes">Scenes</a>.</div>`) : ''}
    <div class="grid">
      ${items.map(({ v, a, w }) => `
        <a class="card" href="#watch/${v.id}">
          <img loading="lazy" src="https://i.ytimg.com/vi/${v.id}/mqdefault.jpg" alt="">
          <div class="body">
            <div class="title">${esc(v.title)}</div>
            <div class="meta">${esc(v.channel)} · ${fmtTime(v.duration)}${accentNames[v.variant] ? ' · ' + accentNames[v.variant] : ''}${v.level ? ' · ' + esc(v.level) : ''}</div>
            <div class="meta">
              <span class="pill ${a.band}">${BAND_LABEL[a.band]}</span>
              <span class="pill plain">${v.wpm} wpm · ${speedLabel(v.wpm)}</span>
              <span class="pill plain">${Math.round(a.cov * 100)}% familiar words</span>
              ${w ? `<span class="pill plain">✓ watched${w.understood != null ? ` · ${w.understood}% understood` : ''}</span>` : ''}
            </div>
          </div>
        </a>`).join('') || '<p class="muted">Nothing matches. Try "Everything".</p>'}
    </div>`;

  document.querySelectorAll('[data-f]').forEach(sel => sel.addEventListener('change', () => {
    const p = new URLSearchParams(route().params);
    sel.value ? p.set(sel.dataset.f, sel.value) : p.delete(sel.dataset.f);
    location.hash = `feed?${p}`;
  }));
}

// ---------- find my level ----------
// A handful of ~75-second clips, from easier to harder depending on how each one went. The learner
// rates how much they understood (and, where prepared, answers one quick question about it), and
// the comfortable speed and vocabulary are estimated from that.
const CALIBRATION_CLIPS = 6, CLIP_SECONDS = 75;
let calib = null, calPlayer = null, calibQuestions = null;

function clipWindow(lines) {
  if (!lines.length) return null;
  let i = Math.floor(lines.length * 0.3);
  const start = lines[i].s, out = [];
  while (i < lines.length && lines[i].s < start + CLIP_SECONDS) out.push(lines[i++]);
  if (out.length < 3) return null;
  const end = out[out.length - 1].e;
  const words = out.reduce((n, l) => n + (l.w ? l.w.filter(w => CJK.test(w)).length : (l.t.match(WORD_RE) || []).length), 0);
  return { start, end, wpm: Math.round(words / Math.max(1, end - start) * 60) };
}

function teardownCalibration() {
  if (calPlayer && calPlayer.destroy) calPlayer.destroy();
  calPlayer = null;
}

async function renderLevel() {
  freshMain();
  if (calibQuestions === null) calibQuestions = await fetch(asset(`data/calibration_${LANG}.json`)).then(r => (r.ok ? r.json() : {})).catch(() => ({}));
  const pool = library.filter(v => v.duration >= 150).sort((a, b) => a.wpm - b.wpm);
  const last = state.level;
  $('#main').innerHTML = `
    <div class="level">
      <h1>Find my level</h1>
      <p class="lede">You'll listen to ${CALIBRATION_CLIPS} short clips (about a minute each) from real ${esc(LANGUAGES[LANG].name)} videos, with no captions.
        After each one, say how much you understood. Each clip adapts to the last, and at the end you get a plan of videos pitched for you.</p>
      ${last ? `<div class="zone-note">Last result (${esc(last.date)}): comfortable around <b>${last.comfortWpm} words/min</b>. <a href="#plan">See my plan</a></div>` : ''}
      ${pool.length < CALIBRATION_CLIPS + 2
        ? `<div class="zone-note">Not enough videos yet to calibrate (${pool.length}). More arrive every day; check back soon.</div>`
        : `<button class="primary big" id="cal-start">${last ? 'Recalibrate' : 'Start'} · about 8 minutes</button>`}
    </div>`;
  const startBtn = $('#cal-start');
  if (startBtn) startBtn.addEventListener('click', () => {
    calib = { pool, used: new Set(), results: [], idx: Math.floor(pool.length / 2), step: pool.length / 4 };
    calibrationClip();
  });
}

function nextCalibrationIndex() {
  const { pool, results, used } = calib;
  if (results.length) {
    const u = results[results.length - 1].u, step = Math.max(1, Math.round(calib.step));
    calib.idx += u >= 80 ? step : u < 50 ? -step : Math.max(1, Math.round(step / 2));
    calib.step = Math.max(1, calib.step / 2);
  }
  calib.idx = Math.min(pool.length - 1, Math.max(0, calib.idx));
  // Nearest clip not used yet, preferring the direction we were moving.
  for (let d = 0; d < pool.length; d++) {
    for (const j of [calib.idx + d, calib.idx - d]) {
      if (j >= 0 && j < pool.length && !used.has(pool[j].id)) { calib.idx = j; return j; }
    }
  }
  return -1;
}

async function calibrationClip() {
  teardownCalibration();
  freshMain();
  if (calib.results.length >= CALIBRATION_CLIPS) return calibrationResult();
  const i = nextCalibrationIndex();
  if (i < 0) return calibrationResult();
  const v = calib.pool[i];
  calib.used.add(v.id);
  const lines = await fetch(asset(`data/transcripts/${LANG}/${v.id}.json`)).then(r => (r.ok ? r.json() : [])).catch(() => []);
  const q = calibQuestions[v.id];
  const win = q ? { start: q.start, end: q.end, wpm: q.wpm || v.wpm } : clipWindow(lines);
  if (!win) return calibrationClip();
  const n = calib.results.length + 1;
  $('#main').innerHTML = `
    <div class="level">
      <div class="cal-progress"><div style="width:${((n - 1) / CALIBRATION_CLIPS) * 100}%"></div></div>
      <h1>Clip ${n} of ${CALIBRATION_CLIPS}</h1>
      <p class="muted">Press play and just listen; there are no captions on purpose. It stops by itself after about a minute.</p>
      <div class="video-wrap"><div id="cal-yt"></div>
        <div id="sub-mask" class="sub-mask" hidden title="Drag to move, drag the bottom edge to resize">
          <span class="sub-mask-label">subtitles hidden · drag to fit</span><span class="sub-mask-grip"></span>
        </div>
      </div>
      <div class="controls"><button id="maskBtn">🙈 Hide video subs</button><button id="cal-replay">⟲ Play the clip again</button></div>
      <div class="box cal-rate">
        <h2>How much did you understand?</h2>
        <div class="filters">${UNDERSTOOD.map(([p, l]) => `<button data-u="${p}">${l}</button>`).join('')}</div>
        <div id="cal-q"></div>
      </div>
    </div>`;
  setupSubMask(v);
  // The clip's own captions are hidden: YouTube's are turned off and the app shows none.
  await loadYT();
  calPlayer = new YT.Player('cal-yt', {
    videoId: v.id,
    playerVars: { start: Math.floor(win.start), end: Math.ceil(win.end), cc_load_policy: 0, iv_load_policy: 3, rel: 0, modestbranding: 1, hl: LANG },
    events: { onReady: () => { try { calPlayer.unloadModule('captions'); } catch (e) { /* none */ } } },
  });
  $('#cal-replay').addEventListener('click', () => { if (calPlayer && calPlayer.seekTo) { calPlayer.seekTo(win.start, true); calPlayer.playVideo(); } });
  document.querySelectorAll('[data-u]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-u]').forEach(x => { x.classList.toggle('on', x === b); x.disabled = true; });
    // The video's overall speed, the same measure the feed and the plan compare against.
    const result = { id: v.id, wpm: v.wpm, clipWpm: win.wpm, u: Number(b.dataset.u), rated: Number(b.dataset.u) };
    if (calPlayer && calPlayer.pauseVideo) calPlayer.pauseVideo();
    if (q && q.question) askCalibrationQuestion(q, result); else finishClip(result);
  }));
}

// One multiple-choice question in English: a check on the self-rating, since it's easy to overrate.
function askCalibrationQuestion(q, result) {
  const box = $('#cal-q');
  box.innerHTML = `<h2 style="margin-top:16px">Quick check: ${esc(q.question)}</h2>
    <div class="cal-options">${q.options.map((o, k) => `<button data-o="${k}">${esc(o)}</button>`).join('')}</div>`;
  box.querySelectorAll('[data-o]').forEach(b => b.addEventListener('click', () => {
    const right = Number(b.dataset.o) === q.answer;
    box.querySelectorAll('[data-o]').forEach(x => { x.disabled = true; if (Number(x.dataset.o) === q.answer) x.classList.add('right'); });
    if (!right) { b.classList.add('wrong'); result.u = Math.min(result.u, 40); }
    result.checked = right;
    box.insertAdjacentHTML('beforeend', `<p class="muted small">${right ? 'Right!' : 'Not quite. That clip will count as harder for you.'}</p>`);
    finishClip(result);
  }));
}

function finishClip(result) {
  calib.results.push(result);
  const box = $('#cal-q');
  box.insertAdjacentHTML('beforeend', `<button class="primary" id="cal-next" style="margin-top:12px">${calib.results.length >= CALIBRATION_CLIPS ? 'See my level' : 'Next clip →'}</button>`);
  $('#cal-next').addEventListener('click', calibrationClip);
}

// The comfortable speed sits between the fastest clip understood well and the slowest one that wasn't.
function estimateLevel(results) {
  const good = results.filter(r => r.u >= 75), poor = results.filter(r => r.u < 75);
  const fastestGood = good.length ? Math.max(...good.map(r => r.wpm)) : null;
  const slowerPoor = poor.filter(r => fastestGood == null || r.wpm > fastestGood).map(r => r.wpm);
  let wpm;
  if (fastestGood == null) wpm = Math.min(...results.map(r => r.wpm)) * 0.85;
  else if (!slowerPoor.length) wpm = fastestGood * 1.1;
  else wpm = (fastestGood + Math.min(...slowerPoor)) / 2;
  // Vocabulary: the size at which the hardest well-understood video's words are ~90% familiar.
  let vocab = state.vocabSize;
  const anchor = good.length ? byId[good.sort((a, b) => b.wpm - a.wpm)[0].id] : null;
  if (anchor) {
    const saved = state.vocabSize;
    let lo = 200, hi = 30000;
    while (hi - lo > 100) { state.vocabSize = Math.round((lo + hi) / 2); if (coverage(anchor) >= 0.9) hi = state.vocabSize; else lo = state.vocabSize; }
    vocab = hi;
    state.vocabSize = saved;
  }
  return { comfortWpm: Math.round(wpm), vocabSize: vocab };
}

function calibrationResult() {
  teardownCalibration();
  const est = estimateLevel(calib.results);
  state.comfortWpm = est.comfortWpm;
  state.vocabSize = est.vocabSize;
  state.level = { date: today(), ...est, clips: calib.results };
  state.vocabHistory.push({ date: today(), size: est.vocabSize, wpm: est.comfortWpm, note: 'calibration' });
  state.plan = buildPlan(state.plan ? state.plan.minutesPerDay : 30);
  save();
  freshMain();
  $('#main').innerHTML = `
    <div class="level">
      <h1>Your level</h1>
      <div class="stats">
        <div class="stat"><div class="v">~${est.comfortWpm}</div><div class="k">words per minute you follow comfortably</div></div>
        <div class="stat"><div class="v">~${est.vocabSize.toLocaleString()}</div><div class="k">common words you likely know</div></div>
      </div>
      <div class="box">
        <h2>Your clips</h2>
        ${calib.results.map((r, k) => `<div class="cal-row"><span>${k + 1}. ${esc(byId[r.id].channel)}</span><span class="muted">${r.wpm} wpm</span>
          <span class="pill ${r.u >= 75 ? 'right' : r.u >= 50 ? 'stretch' : 'hard'}">${understoodLabel(r.rated)}${r.checked === false ? ' · check missed' : ''}</span></div>`).join('')}
      </div>
      <p>Your feed and a 7-day plan are now pitched at this level, aiming for the sweet spot where you understand about 75–90%.</p>
      <a class="primary big" href="#plan">See my plan →</a>
    </div>`;
}

// ---------- plan ----------
// A week of videos at the learner's level: mostly "just right", some easy ones for flow, a few stretches,
// mixed across channels, filling the daily minutes they chose.
function buildPlan(minutesPerDay) {
  const fresh = library.filter(v => !(state.watched[v.id] && state.watched[v.id].seconds > 30)).map(v => ({ v, a: assess(v) }));
  const byChannelTurns = list => {  // alternate channels so a day isn't five videos from one source
    const groups = {};
    list.forEach(x => (groups[x.v.channel] = groups[x.v.channel] || []).push(x));
    const out = [], queues = Object.values(groups);
    while (queues.some(q => q.length)) queues.forEach(q => q.length && out.push(q.shift()));
    return out;
  };
  const band = b => byChannelTurns(fresh.filter(x => x.a.band === b).sort((p, q) => p.a.fit - q.a.fit));
  const budget = minutesPerDay * 60 * 7;
  const picked = [];
  const take = (list, seconds) => { let t = 0; for (const x of list) { if (t >= seconds) break; if (!picked.includes(x)) { picked.push(x); t += x.v.duration; } } return t; };
  let used = take(band('right'), budget * 0.7);
  used += take(band('easy'), budget * 0.2);
  used += take(band('stretch'), budget * 0.1);
  if (used < budget) used += take(band('stretch'), budget - used);  // not enough "just right" yet
  // Spread over 7 days, alternating kinds, filling each day to about the daily minutes.
  const order = byChannelTurns(picked);
  const days = Array.from({ length: 7 }, () => []);
  let d = 0, dayTime = 0;
  for (const x of order) {
    if (dayTime >= minutesPerDay * 60 && d < 6) { d++; dayTime = 0; }
    days[d].push(x.v.id);
    dayTime += x.v.duration;
  }
  return { created: today(), minutesPerDay, days };
}

const planDone = id => {
  const w = state.watched[id];
  return !!w && (w.understood != null || w.done || w.seconds >= 0.6 * (byId[id] ? byId[id].duration : 1e9));
};

function renderPlan() {
  freshMain();
  if (!state.plan) state.plan = buildPlan(30), save();
  const plan = state.plan;
  const ids = plan.days.flat().filter(id => byId[id]);
  const done = ids.filter(planDone).length;
  const dayNow = Math.min(6, Math.max(0, Math.round((new Date(today()) - new Date(plan.created)) / 864e5)));
  $('#main').innerHTML = `
    <div class="plan-head">
      <div>
        <h1>My plan</h1>
        <div class="muted small">${state.level ? `Pitched at ~${state.comfortWpm} words/min (from your level check on ${esc(state.level.date)}).` : 'Based on a starting estimate. <a href="#level">Find your level</a> for a better fit.'}</div>
      </div>
      <div class="filters">
        <select id="plan-min">${[15, 30, 45, 60].map(m => `<option value="${m}" ${m === plan.minutesPerDay ? 'selected' : ''}>${m} min a day</option>`).join('')}</select>
        <button id="plan-new">New plan</button>
      </div>
    </div>
    <div class="box" style="margin-bottom:16px">
      <div class="muted small">${done} of ${ids.length} videos done this week</div>
      <div class="progress"><div style="width:${ids.length ? (done / ids.length) * 100 : 0}%"></div></div>
    </div>
    ${ids.length ? plan.days.map((day, k) => day.length ? `
      <section class="plan-day ${k === dayNow ? 'today' : ''}">
        <h2>Day ${k + 1}${k === dayNow ? ' · today' : ''} <span class="muted small">${Math.round(day.reduce((t, id) => t + (byId[id] ? byId[id].duration : 0), 0) / 60)} min</span></h2>
        ${day.filter(id => byId[id]).map(id => {
          const v = byId[id], a = assess(v), isDone = planDone(id);
          return `<div class="plan-item ${isDone ? 'done' : ''}">
            <a href="#watch/${id}"><img loading="lazy" src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt=""></a>
            <a class="plan-title" href="#watch/${id}"><b>${esc(v.title)}</b><span class="muted small">${esc(v.channel)} · ${fmtTime(v.duration)}</span></a>
            <span class="pill ${a.band}">${BAND_LABEL[a.band]}</span>
            <button data-done="${id}" title="Mark as done">${isDone ? '✓' : '○'}</button>
          </div>`;
        }).join('')}
      </section>` : '').join('') : `<div class="zone-note">No videos at your level yet. The library grows every day.</div>`}`;
  $('#plan-min').addEventListener('change', e => { state.plan = buildPlan(Number(e.target.value)); save(); renderPlan(); });
  $('#plan-new').addEventListener('click', () => { state.plan = buildPlan(plan.minutesPerDay); save(); renderPlan(); toast('New plan made from videos you haven’t watched.'); });
  $('#main').addEventListener('click', e => {
    const id = e.target.dataset.done;
    if (!id) return;
    const w = state.watched[id] || (state.watched[id] = { seconds: 0 });
    w.done = !planDone(id);
    if (!w.done) { w.understood = null; w.seconds = Math.min(w.seconds, 30); }
    save();
    renderPlan();
  });
}

// ---------- watch ----------
// After a video: how much was understood. Feeds the difficulty model and the plan.
const UNDERSTOOD = [[5, 'Almost nothing'], [25, 'A few words'], [50, 'The gist'], [75, 'Most of it'], [95, 'Nearly all']];
const understoodLabel = pct => (UNDERSTOOD.find(([p]) => p === pct) || [0, ''])[1];
const CJK = /[\u4e00-\u9fff]/;

// A caption line as tappable words. Chinese lines come pre-split into words (w) with pinyin (p),
// shown as pinyin over characters, characters only, or pinyin only.
function lineSpans(line) {
  if (!line.w) return wordSpans(line.t);
  const show = state.settings.zhShow || 'both';
  return line.w.map((w, i) => {
    if (!CJK.test(w)) return esc(w);
    const py = (line.p && line.p[i]) || '';
    const cls = state.words[w] ? 'mine' : (!isKnown(w) && lexicon[w] ? 'unknown' : '');
    const inner = show === 'pinyin' ? esc(py) : show === 'chars' ? esc(w) : `<ruby>${esc(w)}<rt>${esc(py)}</rt></ruby>`;
    return `<span class="w zh ${cls}" data-w="${esc(w)}" data-py="${esc(py)}">${inner}</span>`;
  }).join('');
}

function wordSpans(text) {
  return esc(text).replace(WORD_RE, w => {
    const lw = w.toLowerCase();
    const cls = state.words[lw] ? 'mine' : (!isKnown(lw) && lexicon[lw] ? 'unknown' : '');
    return `<span class="w ${cls}" data-w="${esc(lw)}">${w}</span>`;
  });
}

async function renderWatch() {
  freshMain();
  const { arg: id, params } = route();
  const v = byId[id];
  if (!v) { $('#main').innerHTML = '<p>Video not found.</p>'; return; }
  const lines = await fetch(asset(`data/transcripts/${LANG}/${id}.json`)).then(r => r.json());
  const a = assess(v);
  const watched = state.watched[id] || (state.watched[id] = { seconds: 0 });
  const mode = state.settings.captionMode;

  // "Words to watch for": the most frequent unfamiliar words in this video.
  const pinyinOf = {};
  lines.forEach(l => (l.w || []).forEach((w, i) => { if (l.p && l.p[i]) pinyinOf[w] = l.p[i]; }));
  const preview = Object.entries(v.words)
    .filter(([w]) => !isKnown(w) && lexicon[w] && lexicon[w][0] > 0 && (LANG === 'zh' || w.length > 2))
    .sort((x, y) => y[1] - x[1]).slice(0, 10);

  $('#main').innerHTML = `
    <div class="watch">
      <div>
        <div class="video-wrap"><div id="yt"></div>
          <div id="sub-mask" class="sub-mask" hidden title="Drag to move, drag the bottom edge to resize">
            <span class="sub-mask-label">subtitles hidden · drag to fit</span><span class="sub-mask-grip"></span>
          </div>
        </div>
        <div id="caption" class="caption"></div>
        <div class="controls">
          <div class="seg" id="modes">
            ${['always', 'delayed', 'peek', 'off'].map(m => `<button data-mode="${m}" class="${m === mode ? 'on' : ''}">${{ always: 'Captions on', delayed: 'Delayed', peek: 'Peek', off: 'Off' }[m]}</button>`).join('')}
          </div>
          <button id="peekBtn" title="Hold to show the caption">Hold to peek <span class="kbd">C</span></button>
          ${LANG === 'zh' ? `<div class="seg" id="zhShow">${[['both', '拼音+汉字'], ['chars', '汉字'], ['pinyin', 'pīnyīn']].map(([k, l]) => `<button data-zh="${k}" class="${(state.settings.zhShow || 'both') === k ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
          <span class="sep"></span>
          <button id="back5" title="Replay the last 5 seconds">⟲ 5s <span class="kbd">R</span></button>
          <button id="loopBtn" title="Repeat the current line">Loop line <span class="kbd">L</span></button>
          <select id="speed">${[0.75, 0.85, 1].map(s => `<option value="${s}" ${s === state.settings.speed ? 'selected' : ''}>${s}×</option>`).join('')}</select>
          <button id="maskBtn" title="Cover subtitles burned into the video picture (e.g. English)">🙈 Hide video subs</button>
          <span class="sep"></span>
          <button id="recBtn" title="Shadow: record yourself repeating the line">🎙 Shadow</button>
          <button id="cmpBtn" disabled title="Play the original line, then your recording">▶ Compare</button>
        </div>
        <div class="rate">
          <span class="muted">How much did you understand?</span>
          ${UNDERSTOOD.map(([p, l]) => `<button data-rate="${p}" class="${watched.understood === p ? 'on' : ''}" title="about ${p}%">${l}</button>`).join('')}
        </div>
      </div>
      <div class="side">
        <div class="box">
          <h2>${esc(v.title)}</h2>
          <div class="meta" style="margin-bottom:8px">${esc(v.channel)} · ${fmtTime(v.duration)}${v.level ? ' · ' + esc(v.level) : ''}</div>
          <div class="meta">
            <span class="pill ${a.band}">${BAND_LABEL[a.band]}</span>
            <span class="pill plain">${v.wpm} wpm</span>
            <span class="pill plain">${Math.round(a.cov * 100)}% familiar</span>
          </div>
          ${v.autoCaptions ? '<p class="muted small" style="margin:8px 0 0">Auto-generated captions, so expect some mistakes.</p>' : ''}
        </div>
        ${preview.length ? `<div class="box">
          <h2>Words to watch for</h2>
          <p class="muted small" style="margin:0 0 8px">Unfamiliar words that come up most. Tap one for a picture or a ${LANGUAGES[LANG].name} definition.</p>
          <div class="chips">${preview.map(([w, c]) => `<span class="chip w" data-w="${esc(w)}" data-py="${esc(pinyinOf[w] || '')}">${esc(w)}${pinyinOf[w] ? ` <span class="n">${esc(pinyinOf[w])}</span>` : ''}<span class="n">×${c}</span></span>`).join('')}</div>
        </div>` : ''}
        <div class="box">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h2 style="margin:0">Transcript</h2>
            <button id="trBtn" class="small">${mode === 'always' ? 'Hide' : 'Show'}</button>
          </div>
          <div id="transcript" class="transcript" ${mode === 'always' ? '' : 'hidden'} style="margin-top:8px">
            ${lines.map((l, i) => `<div class="ln" data-i="${i}"><span class="ts" data-seek="${l.s}">${fmtTime(l.s)}</span><span>${lineSpans(l)}</span></div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  watchCtx = { id, lines, loop: null, peeking: false, pending: 0, rec: null, recUrl: null, recLine: null, stopAt: null, lastIdx: -1 };
  setupPlayer(id, Number(params.get('t')) || watched.lastPos || 0);
  bindWatchControls(v);
}

function lineAt(lines, t) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].s <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise(resolve => {
    window.onYouTubeIframeAPIReady = resolve;
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  });
}

async function setupPlayer(id, start) {
  await loadYT();
  if (!watchCtx || watchCtx.id !== id) return;
  player = new YT.Player('yt', {
    videoId: id,
    playerVars: { start: Math.floor(start), cc_load_policy: 0, iv_load_policy: 3, rel: 0, modestbranding: 1, hl: LANG },
    events: {
      onReady: () => {
        player.setPlaybackRate(state.settings.speed);
        try { player.unloadModule('captions'); } catch (e) { /* YouTube's own captions stay off */ }
      },
      onStateChange: e => { if (e.data === YT.PlayerState.ENDED) promptRating(); },
      onError: () => toast('This video can’t be embedded. Try another one.'),
    },
  });
  watchTimers.push(setInterval(tickCaption, 150));
  watchTimers.push(setInterval(tickWatchTime, 1000));
}

function tickCaption() {
  if (!player || !player.getCurrentTime || !watchCtx) return;
  const ctx = watchCtx;
  const t = player.getCurrentTime();
  const mode = state.settings.captionMode;

  if (ctx.stopAt != null && t >= ctx.stopAt) {  // end of the "compare" playback
    ctx.stopAt = null;
    player.pauseVideo();
    if (ctx.recUrl) new Audio(ctx.recUrl).play();
  }
  if (ctx.loop && t >= ctx.loop.e + 0.15) player.seekTo(ctx.loop.s, true);

  const spokenIdx = lineAt(ctx.lines, t);
  const showIdx = mode === 'delayed' ? lineAt(ctx.lines, t - DELAY_SECONDS) : spokenIdx;
  const cap = $('#caption');
  if (!cap) return;
  if (showIdx !== ctx.lastIdx || cap.dataset.mode !== mode) {
    ctx.lastIdx = showIdx;
    cap.dataset.mode = mode;
    cap.innerHTML = mode === 'off' || showIdx < 0 ? '' : lineSpans(ctx.lines[showIdx]);
  }
  cap.classList.toggle('blur', mode === 'peek' && !ctx.peeking);

  const tr = $('#transcript');
  if (tr && !tr.hidden && spokenIdx !== ctx.trIdx) {
    ctx.trIdx = spokenIdx;
    tr.querySelectorAll('.ln.cur').forEach(n => n.classList.remove('cur'));
    const cur = tr.querySelector(`.ln[data-i="${spokenIdx}"]`);
    if (cur) {
      cur.classList.add('cur');
      // Scroll only the transcript box: scrollIntoView would also scroll the page, making it jump every line.
      const top = cur.offsetTop - tr.offsetTop;
      if (top < tr.scrollTop || top + cur.offsetHeight > tr.scrollTop + tr.clientHeight) tr.scrollTop = top - tr.clientHeight / 3;
    }
  }
}

function tickWatchTime() {
  if (!player || !player.getPlayerState || !watchCtx) return;
  if (player.getPlayerState() === YT.PlayerState.PLAYING) watchCtx.pending += 1;
  if (watchCtx.pending >= 10) flushWatchTime();
}

function flushWatchTime() {
  if (!watchCtx) return;
  const w = state.watched[watchCtx.id];
  if (watchCtx.pending > 0) {
    w.seconds += watchCtx.pending;
    addLog('app', watchCtx.pending);
    watchCtx.pending = 0;
  }
  if (player && player.getCurrentTime) {
    const pos = player.getCurrentTime();
    const dur = byId[watchCtx.id].duration;
    w.lastPos = pos > dur - 20 ? 0 : Math.floor(pos);
  }
  save();
}

function teardownWatch() {
  if (watchCtx) flushWatchTime();
  watchTimers.forEach(clearInterval);
  watchTimers = [];
  if (watchCtx && watchCtx.rec && watchCtx.rec.state === 'recording') watchCtx.rec.stop();
  if (player && player.destroy) player.destroy();
  player = null;
  watchCtx = null;
  document.onkeydown = document.onkeyup = null;
}

function currentLine() {
  if (!player || !watchCtx) return null;
  const i = lineAt(watchCtx.lines, player.getCurrentTime());
  return i >= 0 ? watchCtx.lines[i] : null;
}

// Some channels burn subtitles into the picture (the Easy Languages channels add an English line under
// the target-language one). A blurred band covers them; its place is remembered per channel.
const BURNED_IN_ENGLISH = /^Easy /;
function setupSubMask(v) {
  const mask = $('#sub-mask'), btn = $('#maskBtn'), wrap = mask.parentElement;
  state.settings.subMask = state.settings.subMask || {};
  // Default: just the second (English) subtitle line of an Easy Languages video.
  const m = Object.assign({ on: BURNED_IN_ENGLISH.test(v.channel), top: 85, height: 6.5 }, state.settings.subMask[v.channel]);
  const apply = () => {
    mask.hidden = !m.on;
    mask.style.top = m.top + '%';
    mask.style.height = m.height + '%';
    btn.classList.toggle('on', m.on);
  };
  const persist = () => { state.settings.subMask[v.channel] = { ...m }; save(); };
  apply();
  btn.addEventListener('click', () => {
    m.on = !m.on; apply(); persist();
    if (m.on) toast('Drag the band over the subtitles you want hidden. This channel will remember it.');
  });
  mask.addEventListener('pointerdown', e => {
    e.preventDefault();
    mask.setPointerCapture(e.pointerId);
    const resizing = e.target.classList.contains('sub-mask-grip');
    const y0 = e.clientY, top0 = m.top, h0 = m.height, H = wrap.clientHeight;
    const move = ev => {
      const d = ((ev.clientY - y0) / H) * 100;
      if (resizing) m.height = Math.min(45, Math.max(3, h0 + d));
      else m.top = Math.min(100 - m.height, Math.max(0, top0 + d));
      apply();
    };
    const up = () => { mask.removeEventListener('pointermove', move); mask.removeEventListener('pointerup', up); persist(); };
    mask.addEventListener('pointermove', move);
    mask.addEventListener('pointerup', up);
  });
}

function bindWatchControls(v) {
  const ctx = watchCtx;
  setupSubMask(v);
  $('#modes').addEventListener('click', e => {
    const m = e.target.closest('[data-mode]');
    if (!m) return;
    state.settings.captionMode = m.dataset.mode;
    document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('on', b === m));
    save();
  });
  const peek = on => (ctx.peeking = on);
  const pb = $('#peekBtn');
  pb.addEventListener('mousedown', () => peek(true));
  pb.addEventListener('mouseup', () => peek(false));
  pb.addEventListener('mouseleave', () => peek(false));

  const back5 = () => player && player.seekTo(Math.max(0, player.getCurrentTime() - 5), true);
  const toggleLoop = () => {
    ctx.loop = ctx.loop ? null : currentLine();
    $('#loopBtn').classList.toggle('on', !!ctx.loop);
    if (ctx.loop) toast('Looping this line. Press L again to stop.');
  };
  $('#back5').addEventListener('click', back5);
  $('#loopBtn').addEventListener('click', toggleLoop);
  $('#speed').addEventListener('change', e => {
    state.settings.speed = Number(e.target.value);
    player && player.setPlaybackRate(state.settings.speed);
    save();
  });
  $('#recBtn').addEventListener('click', toggleRecording);
  $('#cmpBtn').addEventListener('click', () => {
    if (!ctx.recLine) return;
    player.seekTo(ctx.recLine.s, true);
    player.playVideo();
    ctx.stopAt = ctx.recLine.e;
  });
  $('#trBtn').addEventListener('click', e => {
    const tr = $('#transcript');
    tr.hidden = !tr.hidden;
    e.target.textContent = tr.hidden ? 'Show' : 'Hide';
    ctx.trIdx = -1;
  });
  $('#transcript').addEventListener('click', e => {
    const ts = e.target.closest('[data-seek]');
    if (ts && player) player.seekTo(Number(ts.dataset.seek), true);
  });
  document.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => rate(v.id, Number(b.dataset.rate))));
  const zh = $('#zhShow');
  if (zh) zh.addEventListener('click', e => {
    const b = e.target.closest('[data-zh]');
    if (!b) return;
    state.settings.zhShow = b.dataset.zh;
    zh.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    save();
    ctx.lastIdx = -2;  // redraw the caption now
    $('#transcript').querySelectorAll('.ln').forEach((n, i) => { n.lastElementChild.innerHTML = lineSpans(ctx.lines[i]); });
  });
  $('#main').addEventListener('click', e => {
    const w = e.target.closest('.w');
    if (w) { e.stopPropagation(); openWordPopup(w.dataset.w, w, currentLine()); }
  });

  document.onkeydown = e => {
    if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (k === 'c') peek(true);
    if (k === 'r') back5();
    if (k === 'l' && !e.repeat) toggleLoop();
  };
  document.onkeyup = e => { if (e.key.toLowerCase() === 'c') peek(false); };
}

async function toggleRecording() {
  const ctx = watchCtx;
  const btn = $('#recBtn');
  if (ctx.rec && ctx.rec.state === 'recording') { ctx.rec.stop(); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    toast('Microphone access was blocked.');
    return;
  }
  ctx.recLine = ctx.loop || currentLine();
  if (!ctx.recLine) { stream.getTracks().forEach(t => t.stop()); toast('Play the video to a line first.'); return; }
  if (!ctx.loop) { ctx.loop = ctx.recLine; $('#loopBtn').classList.add('on'); }
  const chunks = [];
  ctx.rec = new MediaRecorder(stream);
  ctx.rec.ondataavailable = e => chunks.push(e.data);
  ctx.rec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    if (ctx.recUrl) URL.revokeObjectURL(ctx.recUrl);
    ctx.recUrl = URL.createObjectURL(new Blob(chunks, { type: ctx.rec.mimeType }));
    btn.classList.remove('on');
    btn.textContent = '🎙 Shadow';
    $('#cmpBtn').disabled = false;
    toast('Recorded. Press Compare to hear the original, then you.');
  };
  ctx.rec.start();
  btn.classList.add('on');
  btn.textContent = '■ Stop';
  toast('Recording. Speak along with the looping line.');
}

function promptRating() {
  if (!watchCtx || state.watched[watchCtx.id].rating) return;
  toast('Done! How was it? Rate it below.');
  $('.rate').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function rate(id, pct) {
  const w = state.watched[id] || (state.watched[id] = { seconds: 0 });
  const first = w.understood == null && !w.rating;
  w.understood = pct;
  w.ratedAt = today();
  // Each rating nudges your estimated level so the feed follows you. The sweet spot is ~75–90%.
  if (first) {
    const v = byId[id];
    if (pct >= 95) { state.comfortWpm = Math.max(state.comfortWpm, v.wpm) + 6; state.vocabSize += 150; }
    else if (pct >= 75) { state.comfortWpm += 2; state.vocabSize += 30; }
    else if (pct >= 50) { state.comfortWpm = Math.max(40, state.comfortWpm - 2); }
    else { state.comfortWpm = Math.max(40, Math.min(state.comfortWpm, v.wpm) - 6); state.vocabSize = Math.max(300, state.vocabSize - 150); }
    state.vocabHistory.push({ date: today(), size: state.vocabSize, wpm: state.comfortWpm });
  }
  document.querySelectorAll('[data-rate]').forEach(b => b.classList.toggle('on', Number(b.dataset.rate) === pct));
  save();
  toast(first ? `Thanks. Feed tuned to ~${state.comfortWpm} wpm.` : 'Rating updated.');
}

// ---------- word popup ----------
function openWordPopup(word, anchor, line) {
  if (player && player.pauseVideo) player.pauseVideo();
  const lx = lexicon[word];
  const mine = state.words[word];
  const pop = $('#popup');
  pop.innerHTML = `
    <div class="word">${esc(word)}${anchor.dataset.py ? ` <span class="muted" style="font-size:16px;font-weight:400">${esc(anchor.dataset.py)}</span>` : ''}</div>
    <div class="muted small">${lx && lx[0] ? `#${lx[0].toLocaleString()} most common word` : 'Rare word'}${lx && lx[1] ? ' · looks like English' : ''}${mine ? ` · in my words (${mine.status})` : ''}</div>
    <div class="actions">
      <a target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&hl=${LANG === 'zh' ? 'zh-CN' : LANG}&q=${encodeURIComponent(word)}">🖼 Picture</a>
      <a target="_blank" rel="noopener" href="${LANG === 'zh' ? `https://www.mdbg.net/chinese/dictionary?wdqb=${encodeURIComponent(word)}` : `https://${LANG}.wiktionary.org/wiki/${encodeURIComponent(word)}`}">📖 Meaning</a>
      <button data-act="save">${mine ? '★ Saved' : '☆ Save word'}</button>
      <button data-act="known">✓ I know it</button>
      <a href="#words?q=${encodeURIComponent(word)}">🔎 Other clips</a>
      <button data-say="${esc(word)}">🔊 Listen</button>
      <button data-act="close">Close</button>
    </div>`;
  const r = anchor.getBoundingClientRect();
  pop.hidden = false;
  pop.style.left = Math.min(window.innerWidth - 276, Math.max(8, r.left)) + 'px';
  pop.style.top = (r.bottom + 8 + 220 > window.innerHeight ? r.top - pop.offsetHeight - 8 : r.bottom + 8) + 'px';
  pop.onclick = e => {
    const act = e.target.dataset.act;
    if (act === 'save') {
      state.words[word] = state.words[word] || { status: 'learning', added: today(), source: 'video', context: line ? line.t : '', vid: watchCtx && watchCtx.id, s: line ? line.s : 0 };
      save(); toast(`Saved "${word}"`);
    }
    if (act === 'known') {
      state.words[word] = Object.assign(state.words[word] || { added: today(), source: 'video' }, { status: 'known' });
      save(); toast(`Marked "${word}" as known`);
    }
    if (act) { closePopup(); if (watchCtx) watchCtx.lastIdx = -2; }
  };
}

function closePopup() {
  const pop = $('#popup');
  if (pop) pop.hidden = true;
}

// ---------- goals ----------
function renderGoals() {
  freshMain();
  const gs = id => state.goals[id] || (state.goals[id] = { used: {}, milestone: null });
  const hear = q => `<a class="chip" href="#words?q=${encodeURIComponent(q)}" title="Hear it in real videos">🔎 hear it</a>`;

  $('#main').innerHTML = `
    <div class="goal-head">
      <h1>Goal</h1>
      <p style="font-size:17px;margin:4px 0 0">${esc(goals.goal)}</p>
    </div>
    ${goals.stages.map(st => {
      const g = gs(st.id);
      const phrases = st.phrases || [];
      const used = phrases.filter((_, i) => g.used[i]).length;
      return `<section class="stage">
        <h2>${esc(st.name)}</h2>
        <p class="why">${esc(st.why)}</p>
        ${phrases.length ? `
          <div class="small muted">${used} of ${phrases.length} used in a real conversation</div>
          <div class="progress"><div style="width:${(used / phrases.length) * 100}%"></div></div>
          ${phrases.map((p, i) => `
            <div class="phrase">
              <div>
                <div class="nl">${esc(p.nl)}</div>
                <div class="gl">${esc(p.gloss)}${p.flemish ? ` · ${esc(goals.regionalLabel || 'Flemish')}: <i>${esc(p.flemish)}</i> ${sayButtons(p.flemishSay || p.flemish, true)}` : ''}</div>
              </div>
              <span style="display:flex;gap:6px;align-items:center">${sayButtons(p.say || p.nl)}${library.length ? hear(p.search || p.nl) : ''}</span>
              <label><input type="checkbox" data-stage="${st.id}" data-i="${i}" ${g.used[i] ? 'checked' : ''}> used it</label>
            </div>`).join('')}` : ''}
        ${st.words ? `<h2 style="margin-top:16px">Words</h2><div class="chips">${st.words.map(w => `<span class="chip"><button class="mini" data-say="${esc(w.say || w.nl)}" title="Listen">▶</button> <a href="#words?q=${encodeURIComponent(w.nl)}" title="Hear it in real videos">${esc(w.nl)}</a> <span class="n">${esc(w.gloss)}</span></span>`).join('')}</div>` : ''}
        ${st.recognize ? `<h2 style="margin-top:16px">Recognize (${esc(goals.regionalName || 'Flemish')})</h2><div class="chips">${st.recognize.map(w => `<span class="chip"><button class="mini" data-say="${esc(w.say || w.nl)}" data-flemish="1" title="Listen">▶</button> ${esc(w.nl)} <span class="n">${esc(w.gloss)}</span></span>`).join('')}</div>` : ''}
        ${st.topics ? `<div class="topics">${st.topics.map(t => {
          const n = library.filter(v => topicScore(v, t) >= 3).length;
          return `<a class="topic" href="#feed?show=all&topic=${t.id}"><b>${esc(t.name)}</b><div class="muted small">${esc(t.gloss)} · ${n} video${n === 1 ? '' : 's'}</div></a>`;
        }).join('')}</div>` : ''}
        <label class="milestone">
          <input type="checkbox" data-milestone="${st.id}" ${g.milestone ? 'checked' : ''}>
          <span><b>Milestone</b>: ${esc(st.milestone)}${g.milestone ? `<br><span class="muted small">Reached ${esc(g.milestone)} 🎉</span>` : ''}</span>
        </label>
      </section>`;
    }).join('')}`;

  $('#main').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.stage) {
      const g = gs(t.dataset.stage);
      if (t.checked) g.used[t.dataset.i] = today(); else delete g.used[t.dataset.i];
    }
    if (t.dataset.milestone) gs(t.dataset.milestone).milestone = t.checked ? today() : null;
    save();
    renderGoals();
  });
}

// ---------- scenes ----------
// Plays one line and resolves when it has finished, so a scene can run line by line.
function playAndWait(kind, text, { slow = false } = {}) {
  stopAudio();
  return new Promise(async resolve => {
    try {
      const r = await fetchAudio(kind, text);
      if (r.ok) {
        const blob = await r.blob();
        currentAudio = new Audio(URL.createObjectURL(blob));
        currentAudio.playbackRate = slow ? 0.75 : 1;
        currentAudio.onended = currentAudio.onerror = currentAudio.onpause = () => resolve();
        await ScenePlayer.level(currentAudio, `${kind}|${text}`, blob);
        await currentAudio.play();
        ScenePlayer.watchdog(currentAudio, resolve);
        return;
      }
    } catch (e) { /* fall back to the system voice */ }
    if (!window.speechSynthesis) return resolve();
    speakSystem(text, { flemish: kind === 'flemish', slow });
    const poll = setInterval(() => { if (!speechSynthesis.speaking) { clearInterval(poll); resolve(); } }, 200);
  });
}

function stopAudio() {
  if (currentAudio) currentAudio.pause();
  if (window.speechSynthesis) speechSynthesis.cancel();
}

async function renderScenes() {
  freshMain();
  if (!scenesData) scenesData = await fetch(asset(`goals/${LANG}_scenes.json`)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!scenesData) {
    $('#main').innerHTML = `<h1>Scenes</h1><div class="zone-note" style="margin-top:12px">No ${LANGUAGES[LANG].name} scenes yet. Ask Claude to write some, for a friend or a situation you choose.</div>`;
    return;
  }
  $('#main').innerHTML = `<h1>Scenes with ${esc(scenesData.friend)}</h1><div id="scenes" style="margin-top:12px;max-width:760px"></div>`;
  sceneHandle = ScenePlayer.mount($('#scenes'), {
    scenes: scenesData.scenes,
    friend: scenesData.friend,
    lang: ScenePlayer.LANGS[LANG],
    play: playAndWait,
    stop: stopAudio,
    canRecord: !!(navigator.mediaDevices && window.MediaRecorder),
    transcribe: async wav => {
      const r = await fetch(`/api/transcribe?lang=${LANG}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
      if (!r.ok) throw new Error('transcribe failed');
      return (await r.json()).text;
    },
    coach: async prompt => {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw new Error('coach unavailable');
      return r.json();
    },
    onLearned: ({ nl, script, en, scene }) => {
      const key = nl.toLowerCase().replace(/[.!?]+$/, '');
      state.words[key] = Object.assign(state.words[key] || {}, { status: 'learning', added: today(), source: 'scene', note: en, context: `scene: ${scene}`, script: script || undefined });
      save();
    },
    onResult: (id, stats) => {
      state.scenes = state.scenes || {};
      state.scenes[id] = { ...stats, date: today(), times: ((state.scenes[id] || {}).times || 0) + 1 };
      save();
    },
  });
}

// ---------- say anything ----------
// Type (or translate from English) any text, hear it, record yourself saying it, and get a word check.
const VARIETIES = {
  nl: [['nl', 'Dutch (the Netherlands)']],
  pt: [['br', 'Brazilian Portuguese'], ['pt', 'European Portuguese (Portugal)']],
  ar: [['ar', 'simple spoken Modern Standard Arabic without case endings, understood everywhere']],
};
let sayRec = null;
function stopSayRecording() {
  if (sayRec && sayRec.state === 'recording') sayRec.stop();
  sayRec = null;
}

function sayPrompt(task, text, variety) {
  const L = ScenePlayer.LANGS[LANG] || {};
  const script = L.romanized ? ', "script": string' : '';
  return [
    task === 'translate'
      ? `Translate this English into natural, everyday ${variety}, the way a native speaker would say it in conversation. Keep it simple; split it into short sentences.`
      : `A learner wrote this in ${variety}. Correct it into natural, everyday ${variety}, keeping their meaning; split it into short sentences.`,
    L.romanized ? `Write each sentence romanized (like "${L.romanExample}") and also in ${L.script} script.` : '',
    L.learner || '',
    '', `Text: """${text}"""`, '',
    `Reply with only this JSON object: {"sentences": [{"text": string${script}, "en": string}], "note": string | null}`,
    '- en: the English meaning of each sentence.',
    task === 'translate'
      ? `- note: one short tip in English (max 25 words)${LANG === 'pt' ? ', e.g. where a Spanish speaker would say it differently' : ''}, or null.`
      : '- note: one short sentence in English on the main corrections, or null if it was already correct.',
  ].filter(Boolean).join('\n');
}

function splitSentences(text) {
  return (text.match(/[^.!?…]+[.!?…]*/g) || []).map(s => s.trim()).filter(Boolean).map(t => ({ text: t, en: '' }));
}

function renderSay() {
  freshMain();
  const name = LANGUAGES[LANG].name;
  const varieties = VARIETIES[LANG] || [[LANG, name]];
  const draft = (() => { try { return JSON.parse(localStorage.getItem('say-draft-' + LANG)) || {}; } catch (e) { return {}; } })();
  $('#main').innerHTML = `
    <h1>Say anything</h1>
    <p class="muted" style="margin:4px 0 16px">Type something you want to say, or write it in English and get it in ${esc(name)}. Then listen, say it, and see what was understood.</p>
    <div class="box say-input">
      <div class="filters" style="margin-bottom:10px">
        <span class="seg" id="say-mode">
          <button data-mode="translate" class="${draft.mode !== 'target' ? 'on' : ''}">English → ${esc(name)}</button>
          <button data-mode="target" class="${draft.mode === 'target' ? 'on' : ''}">${esc(name)}</button>
        </span>
        ${varieties.length > 1 ? `<select id="say-variety">${varieties.map(([k, label]) => `<option value="${k}" ${k === draft.variety ? 'selected' : ''}>${esc(label.split(' (')[0])}</option>`).join('')}</select>` : ''}
      </div>
      <textarea id="say-text" rows="3" placeholder="e.g. I went climbing with a friend yesterday and I'm still tired.">${esc(draft.text || '')}</textarea>
      <div class="filters" style="margin-top:10px">
        <button class="primary" id="say-go">Translate</button>
        <span class="muted small" id="say-status"></span>
      </div>
    </div>
    <div id="say-out" style="margin-top:16px"></div>`;

  const modeBtns = document.querySelectorAll('#say-mode button');
  let mode = draft.mode === 'target' ? 'target' : 'translate';
  const go = $('#say-go');
  const setMode = m => {
    mode = m;
    modeBtns.forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    go.textContent = m === 'translate' ? 'Translate' : 'Check & listen';
    $('#say-text').placeholder = m === 'translate' ? "e.g. I went climbing with a friend yesterday and I'm still tired." : `Type in ${name}…`;
  };
  setMode(mode);
  modeBtns.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  const saveDraft = () => {
    try { localStorage.setItem('say-draft-' + LANG, JSON.stringify({ mode, text: $('#say-text').value, variety: ($('#say-variety') || {}).value })); } catch (e) { /* storage blocked */ }
  };
  $('#say-text').addEventListener('input', saveDraft);

  go.addEventListener('click', async () => {
    const text = $('#say-text').value.trim();
    if (!text) return;
    saveDraft();
    const vKey = ($('#say-variety') || {}).value || varieties[0][0];
    const variety = (varieties.find(v => v[0] === vKey) || varieties[0])[1];
    const status = $('#say-status');
    go.disabled = true;
    status.textContent = mode === 'translate' ? 'Translating…' : 'Checking…';
    let result = null;
    try {
      const r = await fetch('/api/coach', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: sayPrompt(mode, text, variety) }) });
      if (r.ok) result = await r.json();
    } catch (e) { /* handled below */ }
    go.disabled = false;
    if (!result || !Array.isArray(result.sentences) || !result.sentences.length) {
      if (mode === 'translate') { status.textContent = 'Couldn’t reach Claude to translate. Is the server running from its terminal tab?'; return; }
      result = { sentences: splitSentences(text), note: null };  // still let you hear and practice your own text
      status.textContent = 'Couldn’t check it with Claude, so here it is as you wrote it.';
    } else status.textContent = '';
    renderSaySentences(result, vKey);
  });
}

function renderSaySentences(result, vKey) {
  // A fresh container each time, so a second translation doesn't stack click handlers.
  const old = $('#say-out');
  const out = old.cloneNode(false);
  old.replaceWith(out);
  const L = ScenePlayer.LANGS[LANG] || {};
  const audioOf = s => s.script || s.text;
  const voiceNote = LANG === 'pt' && vKey === 'pt' ? '<p class="muted small">The voice is Brazilian, so European pronunciation will differ.</p>' : '';
  out.innerHTML = `
    ${result.note ? `<div class="zone-note">💡 ${esc(result.note)}</div>` : ''}
    ${voiceNote}
    <div class="box">
      <div class="filters" style="justify-content:space-between;margin-bottom:6px">
        <h2 style="margin:0">Your text</h2>
        <span class="filters"><button id="say-all">▶ Play all</button><button id="say-save-all">☆ Save all</button></span>
      </div>
      ${result.sentences.map((s, i) => `
        <div class="say-row" data-i="${i}">
          <div class="say-line">
            <div class="say-text">${s.text.split(/\s+/).map((w, k) => `<span class="say-word" data-k="${k}" title="Hear this word">${esc(w)}</span>`).join(' ')}</div>
            ${L.romanized && s.script ? `<div class="say-script" dir="rtl">${esc(s.script)}</div>` : ''}
            ${s.en ? `<div class="muted small">${esc(s.en)}</div>` : ''}
            <div class="say-fb"></div>
          </div>
          <div class="say-actions">
            <button data-act="play" title="Listen">▶</button>
            <button data-act="slow" title="Listen slowly">🐢</button>
            <button data-act="pieces" title="Word by word, then the whole sentence">🧩</button>
            <button data-act="rec" title="Record yourself">🎙</button>
            <button data-act="cmp" title="Model, then you" disabled>▶ me</button>
            <button data-act="save" title="Save to My words">☆</button>
          </div>
        </div>`).join('')}
    </div>`;

  const recordings = {};
  const sentence = i => result.sentences[i];
  const saveOne = (i, quiet) => {
    const s = sentence(i);
    const key = s.text.toLowerCase().replace(/[.!?…]+$/, '');
    state.words[key] = Object.assign(state.words[key] || {}, { status: 'learning', added: today(), source: 'say', note: s.en || '', script: s.script || undefined });
    save();
    const b = out.querySelector(`.say-row[data-i="${i}"] [data-act="save"]`);
    if (b) b.textContent = '★';
    if (!quiet) toast('Saved to My words');
  };

  $('#say-all').addEventListener('click', async () => {
    for (let i = 0; i < result.sentences.length; i++) {
      const row = out.querySelector(`.say-row[data-i="${i}"]`);
      row.classList.add('playing');
      await playAndWait('nl', audioOf(sentence(i)));
      row.classList.remove('playing');
      if (!document.body.contains(row)) return;
    }
  });
  $('#say-save-all').addEventListener('click', () => { result.sentences.forEach((_, i) => saveOne(i, true)); toast(`Saved ${result.sentences.length} to My words`); });

  // Tapping a word plays just that stretch of the sentence's own recording.
  const times = {};
  const wordTimes = async i => {
    if (!times[i]) {
      const s = sentence(i);
      const r = await fetch(`/api/words?lang=${LANG}&kind=nl&text=${encodeURIComponent(audioOf(s))}&shown=${encodeURIComponent(s.text)}`);
      times[i] = r.ok ? await r.json() : [];
    }
    return times[i];
  };
  const playWord = async (i, k, row) => {
    const t = (await wordTimes(i))[k];
    const span = row.querySelector(`.say-word[data-k="${k}"]`);
    if (!t) { toast('Couldn’t find that word in the recording.'); return; }
    span.classList.add('on');
    await playSegment(audioOf(sentence(i)), t.s, t.e);
    span.classList.remove('on');
  };

  out.addEventListener('click', async e => {
    const word = e.target.closest('.say-word');
    if (word) { const row = word.closest('.say-row'); playWord(Number(row.dataset.i), Number(word.dataset.k), row); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn || !btn.closest('.say-row')) return;
    const row = btn.closest('.say-row');
    const i = Number(row.dataset.i);
    const s = sentence(i);
    const act = btn.dataset.act;
    if (act === 'play') playAndWait('nl', audioOf(s));
    if (act === 'slow') playAndWait('nl', audioOf(s), { slow: true });
    if (act === 'save') saveOne(i);
    if (act === 'pieces') {
      const words = await wordTimes(i);
      for (let k = 0; k < words.length; k++) {
        if (!document.body.contains(row)) return;
        await playWord(i, k, row);
        await new Promise(r => setTimeout(r, 350));
      }
      if (words.length) await playAndWait('nl', audioOf(s));
    }
    if (act === 'cmp' && recordings[i]) {
      await playAndWait('nl', audioOf(s));
      (await ScenePlayer.level(new Audio(recordings[i].url), recordings[i].url, recordings[i].blob)).play();
    }
    if (act === 'rec') recordSentence(i, s, row, btn, recordings);
  });
}

// Play only [start, end] seconds of a phrase's recording (a little padding so words aren't clipped).
const clipUrls = {};
async function playSegment(text, start, end) {
  stopAudio();
  if (!clipUrls[text]) {
    const r = await fetchAudio('nl', text);
    if (!r.ok) return;
    clipUrls[text] = URL.createObjectURL(await r.blob());
  }
  const a = currentAudio = new Audio(clipUrls[text]);
  await ScenePlayer.level(a, `nl|${text}`);
  await new Promise(res => (a.readyState >= 1 ? res() : a.addEventListener('loadedmetadata', res, { once: true })));
  a.currentTime = Math.max(0, start - 0.06);
  return new Promise(resolve => {
    const stopAt = Math.max(end, start + 0.25) + 0.08;  // short words like "o" still get an audible clip
    const finish = () => { clearInterval(timer); clearTimeout(giveUp); a.pause(); resolve(); };
    const timer = setInterval(() => { if (a.currentTime >= stopAt || a.paused || a.ended) finish(); }, 20);
    const giveUp = setTimeout(finish, (end - start + 2) * 1000);  // the browser blocked or stalled playback
    a.play().catch(finish);
  });
}

async function recordSentence(i, s, row, btn, recordings) {
  const fb = row.querySelector('.say-fb');
  if (sayRec && sayRec.state === 'recording') { sayRec.stop(); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true } }); }
  catch (e) { fb.textContent = 'Microphone access is blocked here. Open the app in Safari or Chrome to record.'; return; }
  stopAudio();
  const chunks = [];
  sayRec = new MediaRecorder(stream);
  sayRec.ondataavailable = ev => chunks.push(ev.data);
  sayRec.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    btn.textContent = '🎙'; btn.classList.remove('on');
    const blob = new Blob(chunks, { type: sayRec ? sayRec.mimeType : 'audio/webm' });
    if (recordings[i]) URL.revokeObjectURL(recordings[i].url);
    recordings[i] = { blob, url: URL.createObjectURL(blob) };
    row.querySelector('[data-act="cmp"]').disabled = false;
    fb.textContent = 'Listening to your recording…';
    try {
      const r = await fetch(`/api/transcribe?lang=${LANG}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: await ScenePlayer.toWav16k(blob) });
      const heard = r.ok ? (await r.json()).text : '';
      if (!heard) { fb.textContent = 'Couldn’t hear any words. Try again, a bit closer to the mic.'; return; }
      showSayCheck(fb, s, heard);
    } catch (e) { fb.textContent = 'Speech check isn’t available right now. Use ▶ me to compare by ear.'; }
  };
  sayRec.start();
  btn.textContent = '■'; btn.classList.add('on');
  fb.textContent = 'Recording… say the sentence, then tap ■.';
}

function showSayCheck(fb, s, heard) {
  const L = ScenePlayer.LANGS[LANG] || {};
  // Whisper writes Arabic in script, so compare script with script there.
  const target = L.romanized && s.script ? s.script : s.text;
  const r = ScenePlayer.judge(heard, { nl: target }, L.romanized && s.script ? null : L);
  const label = { exact: '✓ Understood perfectly', close: '≈ Almost: check the marked words', different: '✗ Not quite: listen again and retry' }[r.verdict];
  const words = r.ops.map(o => o.type === 'missing'
    ? `<span class="say-w missing" title="missing">[${esc(o.t)}]</span>`
    : `<span class="say-w ${o.type}" title="${o.type === 'near' ? `close to “${esc(o.t)}”` : o.type === 'wrong' ? `expected “${esc(o.t)}”` : ''}">${esc(o.a)}</span>`).join(' ');
  fb.innerHTML = `<div class="say-check ${r.verdict}"><b>${label}</b><div>Heard: ${words}</div></div>`;
}

// ---------- words ----------
async function renderWords() {
  freshMain();
  const q = route().params.get('q') || '';
  const words = Object.entries(state.words).sort((a, b) => (b[1].added || '').localeCompare(a[1].added || ''));
  $('#main').innerHTML = `
    <div class="two">
      <div>
        <div class="box" style="margin-bottom:20px">
          <h2>Heard a new word?</h2>
          <p class="muted small" style="margin:0 0 10px">After a "Hoe zeg je…?" with a friend, log it here. The app finds it in real videos so you hear it again in other voices.</p>
          <form class="row" id="capture">
            <input type="text" id="cw" placeholder="woord" autocomplete="off" required>
            <input type="text" id="cn" placeholder="hint (optional)" autocomplete="off">
            <button class="primary">Save</button>
          </form>
        </div>
        <div class="box">
          <h2>My words <span class="muted small">${words.length}</span></h2>
          ${words.length ? `<table>
            <tr><th>Word</th><th>From</th><th>Status</th><th></th></tr>
            ${words.map(([w, d]) => `<tr>
              <td><button class="mini" data-say="${esc(d.script || w)}" title="Listen">▶</button> <a href="#words?q=${encodeURIComponent(w)}"><b>${esc(w)}</b></a>${d.note ? `<div class="muted small">${esc(d.note)}</div>` : ''}${d.context ? `<div class="muted small">"${esc(d.context)}"</div>` : ''}</td>
              <td class="small muted">${d.source === 'conversation' ? '💬 conversation' : '▶ video'}<br>${esc(d.added || '')}</td>
              <td><button class="small" data-toggle="${esc(w)}">${d.status === 'known' ? '✓ known' : 'learning'}</button></td>
              <td><button class="small" data-del="${esc(w)}" title="Remove">✕</button></td>
            </tr>`).join('')}
          </table>` : '<p class="muted">No words yet. Save them from a video or a conversation.</p>'}
        </div>
      </div>
      <div class="box">
        <h2>Hear it in real videos</h2>
        <form class="row" id="search" style="margin-bottom:8px">
          <input type="text" id="sq" value="${esc(q)}" placeholder="woord of zin…" autocomplete="off">
          <button>Search</button>
        </form>
        <div id="hits">${q ? '<p class="muted">Searching…</p>' : '<p class="muted small">Search any word or phrase to get clips where people actually say it.</p>'}</div>
      </div>
    </div>`;

  $('#capture').addEventListener('submit', e => {
    e.preventDefault();
    const w = $('#cw').value.trim().toLowerCase();
    if (!w) return;
    state.words[w] = Object.assign(state.words[w] || {}, { status: 'learning', added: today(), source: 'conversation', note: $('#cn').value.trim() });
    save();
    location.hash = `words?q=${encodeURIComponent(w)}`;
    if (route().params.get('q') === w) renderWords();
  });
  $('#search').addEventListener('submit', e => {
    e.preventDefault();
    location.hash = `words?q=${encodeURIComponent($('#sq').value.trim())}`;
  });
  $('#main').addEventListener('click', e => {
    const t = e.target.dataset.toggle, d = e.target.dataset.del;
    if (t) { state.words[t].status = state.words[t].status === 'known' ? 'learning' : 'known'; save(); renderWords(); }
    if (d && confirm(`Remove "${d}"?`)) { delete state.words[d]; save(); renderWords(); }
  });

  if (!q) return;
  const hits = STATIC ? await searchLocal(q) : await fetch(`/api/search?lang=${LANG}&q=${encodeURIComponent(q)}`).then(r => r.json());
  // Easiest videos first, so the word shows up in the most understandable context.
  hits.sort((a, b) => (byId[a.id] ? assess(byId[a.id]).fit : 9) - (byId[b.id] ? assess(byId[b.id]).fit : 9));
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  $('#hits').innerHTML = hits.length ? `<p class="muted small">${hits.length} clip${hits.length === 1 ? '' : 's'}, easiest videos first</p>` + hits.map(h => `
    <div class="hit"><a href="#watch/${h.id}?t=${Math.max(0, Math.floor(h.s) - 2)}">
      <div>${esc(h.t).replace(re, '<mark>$1</mark>')}</div>
      <div class="muted small">${esc(h.channel)} · ${esc(h.title)} · ${fmtTime(h.s)}</div>
    </a></div>`).join('') : `<p class="muted">No video says this yet. The library grows every day. Meanwhile, listen to it: ${sayButtons(q)}</p>`;
}

// The published site has no server, so phrase search runs over the transcripts here.
let allLines = null;
async function searchLocal(q) {
  if (!allLines) {
    allLines = [];
    await Promise.all(library.map(async v => {
      const lines = await fetch(asset(`data/transcripts/${LANG}/${v.id}.json`)).then(r => (r.ok ? r.json() : [])).catch(() => []);
      lines.forEach(l => allLines.push({ id: v.id, s: l.s, t: l.t, low: l.t.toLowerCase(), title: v.title, channel: v.channel }));
    }));
  }
  const needle = q.toLowerCase().trim(), perVideo = {}, hits = [];
  for (const l of allLines) {
    if (l.low.includes(needle) && (perVideo[l.id] = (perVideo[l.id] || 0) + 1) <= 3) hits.push(l);
    if (hits.length >= 60) break;
  }
  return hits;
}

// ---------- hours log ----------
function renderLog() {
  freshMain();
  const total = state.log.reduce((n, e) => n + e.seconds, 0);
  const level = ROADMAP.filter(h => total / 3600 >= h).length;
  const next = ROADMAP[level];
  const byDay = {};
  state.log.forEach(e => (byDay[e.date] = (byDay[e.date] || 0) + e.seconds));
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    return d.toLocaleDateString('sv');
  });
  const max = Math.max(600, ...days.map(d => byDay[d] || 0));
  const weekSecs = days.slice(7).reduce((n, d) => n + (byDay[d] || 0), 0);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (byDay[days[i]]) streak++;
    else if (i < days.length - 1) break;
  }
  const manual = state.log.map((e, i) => ({ e, i })).filter(x => x.e.kind !== 'app').reverse().slice(0, 20);

  $('#main').innerHTML = `
    <h1 style="margin-bottom:16px">Hours</h1>
    <div class="stats">
      <div class="stat"><div class="v">${fmtHours(total)}h</div><div class="k">total input</div></div>
      <div class="stat"><div class="v">Level ${level}</div><div class="k">${next ? `next at ${next}h` : 'top of the roadmap'}</div></div>
      <div class="stat"><div class="v">${Math.round(weekSecs / 60)} min</div><div class="k">last 7 days</div></div>
      <div class="stat"><div class="v">${streak} day${streak === 1 ? '' : 's'}</div><div class="k">streak</div></div>
      <div class="stat"><div class="v">~${state.comfortWpm}</div><div class="k">comfortable wpm</div></div>
    </div>
    <div class="two">
      <div class="box">
        <h2>Last 14 days</h2>
        <div class="bars">${days.map(d => `<div class="b" title="${d}: ${Math.round((byDay[d] || 0) / 60)} min"><div style="height:${byDay[d] ? Math.max(3, (byDay[d] / max) * 100) : 0}%"></div><span>${d.slice(8)}</span></div>`).join('')}</div>
      </div>
      <div class="box">
        <h2>Add time from outside the app</h2>
        <p class="muted small" style="margin:0 0 10px">A conversation with your roommate counts too.</p>
        <form class="row" id="manual">
          <input type="number" id="mm" min="1" max="600" placeholder="min" style="width:80px" required>
          <select id="mk">${Object.entries(MANUAL_KINDS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select>
          <input type="text" id="mn" placeholder="note (optional)">
          <button class="primary">Add</button>
        </form>
        ${manual.length ? `<table style="margin-top:12px">${manual.map(({ e, i }) => `<tr><td class="small">${esc(e.date)}</td><td>${Math.round(e.seconds / 60)} min</td><td class="small">${esc(MANUAL_KINDS[e.kind] || e.kind)}${e.note ? ` · ${esc(e.note)}` : ''}</td><td><button class="small" data-dellog="${i}">✕</button></td></tr>`).join('')}</table>` : ''}
      </div>
    </div>`;

  $('#manual').addEventListener('submit', e => {
    e.preventDefault();
    addLog($('#mk').value, Number($('#mm').value) * 60, $('#mn').value.trim());
    renderLog();
  });
  $('#main').addEventListener('click', e => {
    const i = e.target.dataset.dellog;
    if (i != null) { state.log.splice(Number(i), 1); save(); renderLog(); }
  });
}

window.addEventListener('beforeunload', () => {
  if (!watchCtx) return;
  flushWatchTime();
  if (STATIC) { try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ } return; }
  navigator.sendBeacon(`/api/state?lang=${LANG}`, new Blob([JSON.stringify(state)], { type: 'application/json' }));
});

boot();
