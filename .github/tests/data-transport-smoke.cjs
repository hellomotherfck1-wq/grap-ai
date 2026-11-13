const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync('js/veri-koprusu.js', 'utf8');
new Function(source);

const saved = new Map();
const localStorage = {
  getItem: key => saved.has(key) ? saved.get(key) : null,
  setItem: (key, value) => saved.set(key, String(value)),
  removeItem: key => saved.delete(key),
  key: index => Array.from(saved.keys())[index] || null,
  get length() { return saved.size; }
};

const failures = [];
const calls = [];
let mode = 'fallback-success';

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

async function fakeFetch(url) {
  calls.push(String(url));
  if (mode === 'fallback-success') {
    if (String(url).startsWith('https://grafik-vekil.hellomotherfck1.workers.dev/')) {
      return response(503, 'worker unavailable');
    }
    if (String(url).startsWith('https://api.allorigins.win/')) {
      return response(200, JSON.stringify({ news: [{ title: 'Test' }] }));
    }
  }
  if (mode === 'all-fail') return response(503, 'provider unavailable');
  if (mode === 'all-success') return response(200, JSON.stringify({ news: [{ title: 'Fresh' }] }));
  throw new Error('Unexpected test URL: ' + url);
}

const window = {
  location: { href: 'https://example.test/' },
  localStorage,
  GrapAISystemMonitor: {
    apiFailure: (url, error, details) => failures.push({ url, message: error.message, details })
  }
};
const context = {
  window,
  fetch: fakeFetch,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  console
};
vm.runInNewContext(source, context);

(async () => {
  const transport = window.GrapAIDataTransport;
  assert.ok(transport && typeof transport.json === 'function' && typeof transport.text === 'function',
    'Shared JSON/text transport must be available');

  const url = 'https://query1.finance.yahoo.com/v1/finance/search?q=TEST';
  const options = { cacheTtlMs: 60000, staleMaxAgeMs: 3600000, timeoutMs: 1000,
    validate: value => !!(value && Array.isArray(value.news)) };

  const [first, parallel] = await Promise.all([
    transport.json(url, options),
    transport.json(url, options)
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), { news: [{ title: 'Test' }] });
  assert.deepEqual(JSON.parse(JSON.stringify(parallel)), { news: [{ title: 'Test' }] });
  assert.equal(calls.length, 2, 'Concurrent requests must share one in-flight fallback sequence');
  assert.ok(calls[0].startsWith('https://grafik-vekil.hellomotherfck1.workers.dev/'));
  assert.ok(calls[1].startsWith('https://api.allorigins.win/'));

  await transport.json(url, options);
  assert.equal(calls.length, 2, 'Fresh data must be served from cache without another API request');

  const secondUrl = 'https://www.kap.org.tr/tr/api/member/filter/TEST';
  await transport.json(secondUrl, options);
  assert.equal(calls.length, 3, 'A failed proxy must enter cooldown for subsequent requests');
  assert.ok(calls[2].startsWith('https://api.allorigins.win/'),
    'A proxy in cooldown must be skipped while the next provider is tried');

  mode = 'all-fail';
  const stale = await transport.json(url, {
    cacheTtlMs: 0,
    staleMaxAgeMs: 3600000,
    timeoutMs: 1000,
    validate: options.validate
  });
  assert.deepEqual(JSON.parse(JSON.stringify(stale)), { news: [{ title: 'Test' }] },
    'A recent successful response must be returned when all proxies fail');
  assert.equal(transport.info(url, 'json').stale, true,
    'The transport must expose when a stale cached response was used');
  assert.equal(failures.length, 0, 'Using a valid stale cache must not create a false API error');

  await assert.rejects(
    transport.json('https://news.google.com/rss/search?q=NO-CACHE', {
      cacheTtlMs: 0, staleMaxAgeMs: 0, timeoutMs: 1000
    }),
    /Veri aktarım servisleri yanıt vermedi/
  );
  assert.equal(failures.length, 1, 'A final failure without usable cache must be logged once');
  assert.equal(failures[0].details.service, 'shared-data-transport');
  assert.equal(failures[0].details.final, true);

  console.log('PASS shared data transport: fallback, in-flight dedupe, cache, stale-if-error, and final-only logging');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
