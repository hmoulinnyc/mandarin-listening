const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('data/library_zh.json');
const native = catalog.filter(v => v.kind === 'native');
const bank = read('data/calibration_zh.json');

function app() {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, {
      innerHTML: '', hidden: false, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
      insertAdjacentHTML(position, html) { this.innerHTML += html; },
      closest() { return get(key + ':box'); },
    });
    return elements.get(key);
  };
  const ctx = vm.createContext({
    window: { APP_CONFIG: { static: true, lang: 'zh', base: './' }, addEventListener() {} },
    document: { addEventListener() {}, querySelector: get, querySelectorAll: () => [] },
    location: { hash: '#feed' }, URLSearchParams, console, Date,
    setTimeout, clearTimeout, setInterval, clearInterval,
    fetch: async url => ({ ok: true, json: async () => read(url.replace(/^\.\//, '')) }),
    inputCatalog: structuredClone(catalog), inputGoals: read('goals/zh.json'), inputLexicon: read('data/lexicon_zh.json'),
  });
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8').replace(/\bboot\(\);\s*$/, '');
  vm.runInContext(source, ctx);
  const run = code => vm.runInContext(code, ctx);
  run(`library = inputCatalog; goals = inputGoals; lexicon = inputLexicon;
    byId = Object.fromEntries(library.map(v => [v.id, v])); state = defaultState();
    freshMain = () => {}; save = () => {}; toast = () => {};`);
  return { ctx, run, get, html: () => get('#main').innerHTML };
}

test('catalog entries have valid playback metadata and honest transcript availability', () => {
  assert.equal(new Set(catalog.map(v => v.id)).size, catalog.length);
  assert.ok(native.length > 0);
  assert.ok(new Set(native.map(v => v.channel)).size >= 4);
  for (const video of catalog) {
    assert.match(video.id, /^[\w-]{11}$/);
    assert.ok(video.title && video.channel && video.duration > 0);
    if (video.transcriptAvailable === false) {
      assert.equal(video.wpm, null);
      assert.equal(video.tokens, 0);
      assert.deepEqual(video.words, {});
      assert.equal(video.youtubeCaptions, video.captionLanguages.length > 0);
      continue;
    }
    const lines = read(`data/transcripts/zh/${video.id}.json`);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      assert.ok(line.e > line.s && line.s >= 0 && line.e <= video.duration);
      if (i) assert.ok(lines[i - 1].s <= line.s, `${video.id}: captions out of order`);
      assert.equal(line.w.length, line.p.length);
    }
  }
});

test('beginner labels and timestamp repair no longer inflate assessment difficulty', () => {
  for (const id of ['dezZqONwmWQ', 'Tl2FxsgeTPg']) assert.equal(catalog.find(v => v.id === id).level, 'Beginner');
  const video = catalog.find(v => v.id === 'NdwR3zhDX0Y');
  const lines = read(`data/transcripts/zh/${video.id}.json`);
  const counts = {};
  for (const line of lines) for (const word of line.w) {
    if (/[\u4e00-\u9fff]/.test(word)) counts[word] = (counts[word] || 0) + 1;
  }
  const tokens = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.deepEqual(video.words, counts);
  assert.equal(video.tokens, tokens);
  assert.equal(video.wpm, Math.round(tokens / (Math.max(...lines.map(l => l.e)) - lines[0].s) * 60));
  assert.ok(video.wpm < 70);
});

test('native challenges are discoverable without fabricated speed or coverage', () => {
  const a = app();
  a.ctx.location.hash = '#feed?show=challenge';
  a.run('renderFeed()');
  for (const video of native) assert.ok(a.html().includes(`#watch/${video.id}`));
  for (const video of catalog.filter(v => v.kind !== 'native')) assert.ok(!a.html().includes(`#watch/${video.id}`));
  assert.ok(!/null wpm|0% familiar|NaN/.test(a.html()));
  a.ctx.location.hash = '#feed';
  a.run('renderFeed()');
  assert.ok(a.html().includes('Try native Mandarin challenges'));
  for (const video of native) assert.ok(!a.html().includes(`#watch/${video.id}`));
});

test('native feedback preserves measured estimates and can make a challenge eligible for the plan', () => {
  const a = app();
  const before = a.run('JSON.stringify([state.comfortWpm, state.vocabSize, state.vocabHistory])');
  const id = native[0].id;
  assert.equal(a.run(`assess(byId['${id}']).cov`), null);
  assert.ok(!a.run('buildPlan(30).days.flat()').includes(id));
  a.run(`rate('${id}', 95)`);
  assert.equal(a.run('JSON.stringify([state.comfortWpm, state.vocabSize, state.vocabHistory])'), before);
  assert.equal(a.run(`state.watched['${id}'].understood`), 95);
  assert.ok(a.run('buildPlan(30).days.flat()').includes(id));
  a.run(`rate('${id}', 40)`);
  assert.ok(!a.run('buildPlan(30).days.flat()').includes(id));
  a.run(`rate('hiUEpqL77-Y', 95)`);
  assert.ok(a.run('state.comfortWpm') > 120);
});

async function startAssessment(a, hard = false) {
  a.ctx.location.hash = '#level';
  a.run('calibrationClip = () => {}');
  await a.run('renderLevel()');
  a.get(hard ? '#cal-hard' : '#cal-start').listeners.click();
}

function simulate(a, understanding = 95, checked = true) {
  a.ctx.testUnderstanding = understanding;
  a.ctx.testChecked = checked;
  return a.run(`(() => {
    const i = nextCalibrationIndex();
    if (i < 0) return null;
    const v = calib.pool[i], q = v.assessmentQuestion;
    calib.used.add(v.id);
    const answers = q?.native ? [testChecked, testChecked] : [testChecked];
    const result = { id: v.id, tier: v.assessmentTier, native: !!q?.native,
      start: q?.start, end: q?.end, wpm: v.wpm, rated: testUnderstanding,
      u: q?.native ? scoreCalibrationAnswers(testUnderstanding, answers) : testChecked ? testUnderstanding : Math.min(testUnderstanding, 40),
      checked: testChecked, answers };
    calib.results.push(result);
    return result;
  })()`);
}

test('native assessment questions have bounded, verified passages and detail/inference checks', () => {
  const windows = [];
  for (const [id, primary] of Object.entries(bank)) {
    if (!primary.native) continue;
    const video = catalog.find(v => v.id === id);
    assert.ok(video && video.kind === 'native');
    for (const q of [primary, ...(primary.alternates || [])]) {
      assert.ok(q.end > q.start && q.end <= video.duration && q.start >= 0);
      assert.ok(q.end - q.start >= 60 && q.end - q.start <= 100);
      assert.ok([3, 4].includes(q.tier) && q.verifiedOn && q.source.summary);
      assert.ok(q.source.url.includes(id));
      assert.deepEqual(q.questions.map(x => x.kind).sort(), ['detail', 'inference']);
      for (const item of q.questions) {
        assert.equal(item.options.length, 4);
        assert.equal(new Set(item.options).size, 4);
        assert.ok(Number.isInteger(item.answer) && item.answer >= 0 && item.answer < 4 && item.explanation);
      }
      windows.push(id + ':' + q.start);
    }
  }
  assert.equal(windows.length, 6);
  assert.equal(new Set(windows).size, windows.length);
});

test('strong standard assessment reaches independent native sources and updates feed and plan', async () => {
  const a = app();
  await startAssessment(a);
  assert.ok(a.html().includes('not a CEFR placement test'));
  for (let n = 0; n < 6; n++) if (!simulate(a)) break;
  assert.equal(a.run('calib.used.size'), a.run('calib.results.length'));
  assert.ok(a.run('calib.results.filter(r => r.native).length') >= 4);
  assert.equal(a.run('calib.results[0].tier'), 2);
  a.run('calibrationResult()');
  assert.equal(a.run('state.level.nativeTier'), 4);
  assert.ok(a.html().includes('highest native band'));
  assert.ok(a.html().includes('Watch native Mandarin'));
  assert.ok(Number.isFinite(a.run('state.comfortWpm')));
  assert.ok(a.run('state.plan.days.flat().some(id => byId[id].kind === "native")'));
  assert.ok(a.run('state.plan.days.flat().every(id => byId[id].kind === "native")'));
  a.ctx.location.hash = '#feed';
  a.run('renderFeed()');
  assert.ok(native.some(v => a.html().includes(`#watch/${v.id}`)));
  assert.ok(catalog.filter(v => v.kind !== 'native').every(v => !a.html().includes(`#watch/${v.id}`)));
});

test('older mixed plans are rebuilt for a supported native result without implying a new speed estimate', () => {
  const a = app();
  a.run(`state.level={version:2,nativeTier:4,date:'2026-11-14',clips:[]};
    state.plan={created:'2026-11-14',minutesPerDay:30,days:[['NdwR3zhDX0Y']]}; renderPlan();`);
  assert.ok(a.run('state.plan.days.flat().every(id => byId[id].kind === "native")'));
  assert.ok(a.html().includes('Native arguments and explanations, from your listening check'));
  assert.ok(!a.html().includes('Pitched at ~120'));
});

test('hard entry can assess native speech without altering old numerical estimates', async () => {
  const a = app();
  const before = a.run('JSON.stringify([state.comfortWpm, state.vocabSize, state.vocabHistory])');
  await startAssessment(a, true);
  for (let n = 0; n < 6; n++) if (!simulate(a)) break;
  assert.ok(a.run('calib.results.every(r => r.native)'));
  a.run('calibrationResult()');
  assert.equal(a.run('state.level.nativeTier'), 4);
  assert.equal(a.run('JSON.stringify([state.comfortWpm, state.vocabSize, state.vocabHistory])'), before);
  assert.ok(a.html().includes('previous speed and vocabulary estimates are unchanged'));
});

test('weak answers step down to easier speech instead of pushing through native clips', async () => {
  const a = app();
  await startAssessment(a, true);
  const tiers = [];
  for (let n = 0; n < 6; n++) {
    const r = simulate(a, 25, false);
    if (!r) break;
    tiers.push(r.tier);
  }
  assert.deepEqual(tiers.slice(0, 4), [3, 2, 1, 0]);
  assert.equal(a.run('estimateLevel(calib.results).nativeTier'), 0);
});

test('high self-ratings cannot override missed native questions or duplicate sources', () => {
  const a = app();
  assert.equal(a.run('scoreCalibrationAnswers(95, [true, false])'), 50);
  assert.equal(a.run('scoreCalibrationAnswers(25, [true, true])'), 25);
  assert.equal(a.run('scoreCalibrationAnswers(95, [false, false])'), 0);
  const pass = `{id:'e4E10QJszvg',native:true,tier:4,u:95,checked:true}`;
  assert.equal(a.run(`estimateLevel([${pass},${pass}]).nativeTier`), 0);
  assert.equal(a.run(`estimateLevel([${pass},{id:'gevH3h-5p6A',native:true,tier:4,u:95,checked:true}]).nativeTier`), 4);
});

test('repeat assessments rotate a verified alternate without repeating a source in one session', async () => {
  const a = app();
  a.run(`state.level = {version:2,nativeTier:3,clips:[{id:'tzctX3Vyi90',start:614}]}`);
  await startAssessment(a, true);
  assert.equal(a.run('calib.pool.find(v => v.id === "tzctX3Vyi90").assessmentQuestion.start'), 1199);
  for (let n = 0; n < 6; n++) if (!simulate(a)) break;
  assert.equal(a.run('calib.used.size'), a.run('calib.results.length'));
});

test('failed native checks and old saved levels do not promote unproven challenges', () => {
  const a = app();
  a.run(`state.level = {nativeTier:4,clips:[]}`);
  assert.equal(a.run('assess(byId["e4E10QJszvg"]).band'), 'hard');
  a.run(`state.level = {version:2,nativeTier:4,clips:[{id:'e4E10QJszvg',native:true,u:50}]}`);
  assert.equal(a.run('assess(byId["e4E10QJszvg"]).band'), 'hard');
  assert.equal(a.run('assess(byId["gevH3h-5p6A"]).band'), 'right');
});

test('no completed clips leaves previous progress and plan untouched', () => {
  const a = app();
  a.run(`state.level = {date:'2026-11-01',comfortWpm:150}; state.plan = {days:[['hiUEpqL77-Y']]};
    calib = {results:[],failures:['missing'],used:new Set(),pool:[]};`);
  const before = a.run('JSON.stringify(state)');
  a.run('calibrationResult()');
  assert.equal(a.run('JSON.stringify(state)'), before);
  assert.ok(a.html().includes('No result saved'));
});

test('native questions withhold feedback until both answers are collected', () => {
  const a = app();
  const box = a.get('#cal-q');
  let buttons;
  const newButtons = () => buttons = Array.from({length:4}, (_, n) => ({
    dataset:{o:String(n)}, listeners:{}, classList:{add(){}},
    addEventListener(type, fn) { this.listeners[type] = fn; },
  }));
  newButtons();
  box.querySelectorAll = () => buttons;
  a.run(`calib={results:[]}; calibQuestions=inputQuestions; testResult={id:'tzctX3Vyi90',rated:95};
    askCalibrationQuestion(calibQuestions['tzctX3Vyi90'], testResult);`.replace('inputQuestions', JSON.stringify(bank)));
  buttons[bank.tzctX3Vyi90.questions[0].answer].listeners.click();
  assert.equal(a.run('calib.results.length'), 0);
  assert.ok(!box.innerHTML.includes(bank.tzctX3Vyi90.questions[0].explanation));
  newButtons();
  a.get('#cal-q-next').listeners.click();
  buttons[(bank.tzctX3Vyi90.questions[1].answer + 1) % 4].listeners.click();
  assert.equal(a.run('calib.results.length'), 1);
  assert.equal(a.run('calib.results[0].u'), 50);
  assert.ok(box.innerHTML.includes('1/2 correct'));
});

test('late caption modules are disabled and replay remains bounded by the excerpt end', async () => {
  const a = app();
  a.run('actualCalibrationClip = calibrationClip');
  await startAssessment(a, true);
  a.run('calibrationClip = actualCalibrationClip; setupSubMask = () => {}; loadYT = async () => {}');
  const unloaded = [], timers = [];
  let config, time = 0, paused = 0;
  const player = {
    unloadModule(name) { unloaded.push(name); },
    getCurrentTime() { return time; },
    pauseVideo() { paused++; },
    seekTo(t) { time = t; },
    playVideo() { config.events.onStateChange({data:1,target:player}); },
    destroy() {},
  };
  a.ctx.setInterval = fn => { timers.push(fn); return timers.length; };
  a.ctx.clearInterval = () => {};
  a.ctx.YT = { PlayerState:{PLAYING:1}, Player:function(id, options) { config = options; return player; } };
  await a.run('calibrationClip()');
  assert.equal(config.playerVars.start, bank.tzctX3Vyi90.start);
  assert.equal(config.playerVars.end, bank.tzctX3Vyi90.end);
  config.events.onReady({target:player});
  config.events.onApiChange({target:player});
  a.get('#cal-replay').listeners.click();
  assert.equal(time, bank.tzctX3Vyi90.start);
  assert.equal(a.run('calib.played'), 'tzctX3Vyi90');
  assert.deepEqual(unloaded, ['captions','captions','captions']);
  time = bank.tzctX3Vyi90.end + 1;
  timers[0]();
  assert.equal(paused, 1);
  a.run('teardownCalibration()');
});

test('untranscribed playback skips missing assets and hides transcript-only tools', async () => {
  const a = app();
  a.ctx.location.hash = '#watch/' + native[0].id;
  a.ctx.fetch = () => { throw Error('Should not fetch a nonexistent transcript'); };
  a.run('setupPlayer = () => {}; bindWatchControls = () => {}');
  await a.run('renderWatch()');
  assert.ok(a.html().includes('no app transcript, pinyin'));
  assert.ok(a.html().includes('CC button'));
  assert.equal(a.run('watchCtx.lines.length'), 0);
  for (const id of ['#modes', '#loopBtn', '#recBtn', '#trBtn']) assert.equal(a.get(id).hidden, true);
  assert.equal(a.get('#transcript:box').hidden, true);
});
