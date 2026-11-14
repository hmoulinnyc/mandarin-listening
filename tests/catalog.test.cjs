const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const catalog = read('data/library_zh.json');
const native = catalog.filter(v => v.kind === 'native');

function app() {
  const elements = new Map();
  const get = key => {
    if (!elements.has(key)) elements.set(key, {
      innerHTML: '', hidden: false, listeners: {},
      addEventListener(type, fn) { this.listeners[type] = fn; },
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

test('assessment uses measured clips and warns when a strong learner reaches its ceiling', async () => {
  const a = app();
  a.run('calibrationClip = () => {}');
  await a.run('renderLevel()');
  assert.ok(a.html().includes('not a CEFR placement test'));
  a.get('#cal-start').listeners.click();
  assert.equal(a.run('calib.pool.length'), catalog.length - native.length);
  assert.ok(a.run('calib.pool.every(hasMeasuredDifficulty)'));
  a.run(`for (let n = 0; n < CALIBRATION_CLIPS; n++) {
    const i = nextCalibrationIndex(), v = calib.pool[i];
    calib.used.add(v.id); calib.results.push({ id: v.id, wpm: v.wpm, u: 95, rated: 95 });
  } calibrationResult();`);
  assert.equal(a.run('calib.used.size'), 6);
  assert.ok(a.html().includes('above the range it can measure'));
  assert.ok(a.html().includes('Try native Mandarin challenges'));
  assert.ok(Number.isFinite(a.run('state.comfortWpm')));
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
