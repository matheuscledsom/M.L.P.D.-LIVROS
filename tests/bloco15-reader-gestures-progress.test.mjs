import assert from 'node:assert/strict';
import test from 'node:test';

const {
  classifyTapZone,
  createTapGestureEngine,
  scrollContainerByViewportFraction,
  shouldIgnoreGestureTarget,
} = await import('../src/components/reader/useReaderGestures.js');

const {
  clampProgressPct,
  computeTelemetryEstimate,
  formatExactPercent,
  normalizeReaderSettings,
} = await import('../src/components/reader/useReaderProgress.js');

const {
  clearMemoryReaderStoreForTests,
  getBookEpubLocations,
  saveBookEpubLocations,
  saveBookFile,
} = await import('../src/services/readerStorage.js');

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('useReaderGestures: zonas 28%/72%, toque imediato lateral, duplo toque 260ms só no centro e long-press 900ms', async () => {
  assert.equal(classifyTapZone(0.1), 'left');
  assert.equal(classifyTapZone(0.279), 'left');
  assert.equal(classifyTapZone(0.5), 'center');
  assert.equal(classifyTapZone(0.721), 'right');
  assert.equal(classifyTapZone(0.95), 'right');

  // Alvos interativos são ignorados
  assert.equal(
    shouldIgnoreGestureTarget({
      closest: (sel) => (sel.includes('button') ? {} : null),
    }),
    true
  );
  assert.equal(
    shouldIgnoreGestureTarget({ closest: () => null }),
    false
  );

  const events = [];
  const engine = createTapGestureEngine({
    enabled: true,
    allowCenterDoubleTap: true,
    onLeftTap: () => events.push('left'),
    onRightTap: () => events.push('right'),
    onCenterTap: () => events.push('center-single'),
    onCenterDoubleTap: () => events.push('center-double'),
    onLongPressSettings: () => events.push('long-settings'),
  });

  // 1) Toques laterais agem IMEDIATAMENTE (sem aguardar janela de duplo toque)
  engine.onPointerDown({ pointerId: 1, clientX: 40, clientY: 200, timestamp: 100 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 42,
    clientY: 201,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 180,
  });
  engine.onPointerDown({ pointerId: 1, clientX: 350, clientY: 200, timestamp: 200 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 350,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 270,
  });
  assert.deepEqual(events, ['left', 'right']);

  // 2) Toque único no centro espera janela de 260ms
  events.length = 0;
  engine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 1000 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 201,
    clientY: 201,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 1080,
  });
  assert.deepEqual(events, []);
  await waitMs(290);
  assert.deepEqual(events, ['center-single']);

  // 3) Duplo toque no centro dispara apenas bookmark (cancela toggle barras)
  events.length = 0;
  engine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 2000 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 2060,
  });
  await waitMs(90);
  engine.onPointerDown({ pointerId: 1, clientX: 202, clientY: 200, timestamp: 2150 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 202,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 2210,
  });
  await waitMs(290);
  assert.deepEqual(events, ['center-double']);

  // 4) Movimento >= 10px ou duração >= 250ms não vira toque
  events.length = 0;
  engine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 3000 });
  engine.onPointerMove({ pointerId: 1, clientX: 215, clientY: 200 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 215,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 3080,
  });
  await waitMs(280);
  assert.deepEqual(events, []);

  // 5) Multi-toque (pinça) cancela gesto
  engine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 4000 });
  engine.onPointerDown({ pointerId: 2, clientX: 240, clientY: 200, timestamp: 4010 });
  engine.onPointerUp({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 4080,
  });
  engine.onPointerUp({
    pointerId: 2,
    clientX: 240,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 4090,
  });
  await waitMs(280);
  assert.deepEqual(events, []);

  // 6) Seleção ativa não interceptada e long-press >= 900ms sem seleção abre configurações
  events.length = 0;
  const selDoc = {
    defaultView: { getSelection: () => ({ toString: () => 'palavra selecionada' }) },
  };
  engine.onPointerDown({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    doc: selDoc,
    timestamp: 5000,
  });
  await waitMs(940);
  assert.deepEqual(events, []);
  engine.onPointerUp({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    doc: selDoc,
    timestamp: 5940,
  });

  // Sem seleção -> long-press >= 900ms dispara settings + vibrate(10)
  let vibrated = null;
  const origNav = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { vibrate: (ms) => { vibrated = ms; } },
  });
  try {
    engine.onPointerDown({ pointerId: 1, clientX: 30, clientY: 200, timestamp: 6000 });
    await waitMs(940);
    assert.deepEqual(events, ['long-settings']);
    assert.equal(vibrated, 10);
  } finally {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: origNav,
    });
    engine.destroy();
  }
});

test('rolagem contínua 90% da altura visível, config CBZ zoom sem conflito e toggle Gestos de toque', () => {
  const scrollCalls = [];
  const fakeContainer = {
    clientHeight: 800,
    scrollBy: (opts) => scrollCalls.push(opts),
  };
  scrollContainerByViewportFraction(fakeContainer, 1, 0.9);
  scrollContainerByViewportFraction(fakeContainer, -1, 0.9);
  assert.equal(scrollCalls[0].top, 720);
  assert.equal(scrollCalls[1].top, -720);

  // CBZ já ampliado (allowCenterDoubleTap: false) bloqueia duplo toque bookmark
  const cbzEvents = [];
  const cbzEngine = createTapGestureEngine({
    enabled: true,
    allowCenterDoubleTap: false,
    onCenterDoubleTap: () => cbzEvents.push('should-not-bookmark'),
    onCenterTap: () => cbzEvents.push('center'),
  });
  cbzEngine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 100 });
  cbzEngine.onPointerUp({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 160,
  });
  cbzEngine.onPointerDown({ pointerId: 1, clientX: 200, clientY: 200, timestamp: 220 });
  cbzEngine.onPointerUp({
    pointerId: 1,
    clientX: 200,
    clientY: 200,
    viewportLeft: 0,
    viewportWidth: 400,
    timestamp: 270,
  });
  assert.equal(cbzEvents.includes('should-not-bookmark'), false);
  cbzEngine.destroy();

  // Setting padrão Gestos de toque = ativo
  const def = normalizeReaderSettings({});
  assert.equal(def.touchGesturesEnabled, true);
  assert.equal(
    normalizeReaderSettings({ touchGesturesEnabled: false }).touchGesturesEnabled,
    false
  );
});

test('clamp 0..100, cache de locations EPUB no IndexedDB e métricas objetivas sem tempo restante', async () => {
  assert.equal(clampProgressPct(-10), 0);
  assert.equal(clampProgressPct(42.66), 42.7);
  assert.equal(clampProgressPct(99.96), 100);
  assert.equal(clampProgressPct(130), 100);
  assert.equal(formatExactPercent(99.96), '100%');
  assert.equal(formatExactPercent(12.34), '12.3%');

  const partial = computeTelemetryEstimate({
    position: { progressPct: 24.44, page: 0, totalPages: 0 },
  });
  assert.equal(partial.percentText, '24.4% lido · falta 75.6%');
  assert.equal(partial.pagesText, '');
  assert.equal(partial.hasTotalPages, false);

  clearMemoryReaderStoreForTests();
  await saveBookFile('work-epub-1', { fileName: 'DomCasmurro.epub', format: 'epub', size: 1024 });
  await saveBookEpubLocations('work-epub-1', {
    locationsJson: '["epubcfi(/6/2!/4/1:0)","epubcfi(/6/4!/4/1:0)"]',
    pageCount: 240,
  });
  const cached = await getBookEpubLocations('work-epub-1');
  assert.equal(cached.pageCount, 240);
  assert.ok(cached.locationsJson.includes('epubcfi'));
});
