// =============================================================================
// Telegram Direct File Downloader - Automated Integration Test
// Validates link parsing, Bot API connection, post resolution & direct streaming
// =============================================================================

const assert = require('assert');
const http = require('http');
const { parseTelegramLink } = require('./src/link-parser');
const { getMe, getChat } = require('./src/telegram-api');
const { resolveTelegramFile } = require('./src/resolver');
const { generateDownloadToken, verifyDownloadToken } = require('./src/token-manager');
const { createApiServer } = require('./src/api-server');

const TEST_PORT = 5099;

function httpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = [];
      res.on('data', chunk => data.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(data);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: buffer.toString('utf8'),
          rawBuffer: buffer
        });
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log(`
=============================================================================
🧪 RUNNING TELEGRAM DIRECT FILE DOWNLOADER TEST SUITE
=============================================================================
`);

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Test 1: Link Parsing
  // ---------------------------------------------------------------------------
  await test('1. Parse public Telegram post links correctly', () => {
    const p1 = parseTelegramLink('https://t.me/techiestorefiles/3');
    assert.strictEqual(p1.valid, true);
    assert.strictEqual(p1.type, 'channel_post');
    assert.strictEqual(p1.channelUsername, '@techiestorefiles');
    assert.strictEqual(p1.messageId, 3);

    const p2 = parseTelegramLink('t.me/techiemuthuraj/412');
    assert.strictEqual(p2.valid, true);
    assert.strictEqual(p2.messageId, 412);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Detect and Reject Invalid Links with Helpful Guidance
  // ---------------------------------------------------------------------------
  await test('2. Reject invalid links and identify private channel restriction format', () => {
    const invalid = parseTelegramLink('not-a-telegram-link');
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.error.includes('Unsupported link format'));

    const priv = parseTelegramLink('https://t.me/c/1234567890/45');
    assert.strictEqual(priv.valid, true);
    assert.strictEqual(priv.type, 'private_channel_post');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Telegram Bot API Authentication
  // ---------------------------------------------------------------------------
  await test('3. Telegram Bot Token authenticates successfully via getMe', async () => {
    const me = await getMe();
    assert.strictEqual(me.ok, true);
    assert.ok(me.result.is_bot, 'Must be a valid bot account');
    assert.strictEqual(me.result.username, 'techieverifybot');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Channel Access Verification
  // ---------------------------------------------------------------------------
  await test('4. Bot can retrieve channel info for @techiestorefiles', async () => {
    const chat = await getChat('@techiestorefiles');
    assert.strictEqual(chat.ok, true);
    assert.strictEqual(chat.result.username, 'techiestorefiles');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Post Resolution for Sample Channel File
  // ---------------------------------------------------------------------------
  await test('5. Resolve Telegram channel post https://t.me/techiestorefiles/3', async () => {
    const res = await resolveTelegramFile('https://t.me/techiestorefiles/3');
    assert.strictEqual(res.success, true);
    assert.ok(res.file.name, 'Resolved file must contain a filename');
    assert.ok(res.download_url, 'Must generate direct download URL');
    assert.ok(res.download_url.includes('/api/download/'), 'URL must route through download endpoint');
    assert.strictEqual(res.copy_link, res.download_url);
    // Bot token must NEVER be exposed in the download URL!
    assert.strictEqual(res.download_url.includes('8952851770'), false, 'Bot token must NOT be exposed in download link');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Cryptographic HMAC Token Security
  // ---------------------------------------------------------------------------
  await test('6. Download tokens are signed with HMAC and tamper-proof', () => {
    const token = generateDownloadToken({
      source: 'channel_post:@techiestorefiles/3:sample.apk',
      name: 'sample.apk',
      size: 1024,
      mime: 'application/vnd.android.package-archive'
    });

    const verified = verifyDownloadToken(token);
    assert.strictEqual(verified.valid, true);
    assert.strictEqual(verified.payload.name, 'sample.apk');

    // Tampered token test
    const tampered = token.slice(0, -4) + 'abcd';
    const failVerified = verifyDownloadToken(tampered);
    assert.strictEqual(failVerified.valid, false);
  });

  // ---------------------------------------------------------------------------
  // Test 7: HTTP API End-to-End Test (Resolve & Stream Download)
  // ---------------------------------------------------------------------------
  await test('7. End-to-end API resolution and binary stream download without redirection', async () => {
    const server = createApiServer();
    await new Promise(resolve => server.listen(TEST_PORT, resolve));

    try {
      // Step A: POST /api/resolve
      const resolveRes = await httpRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/api/resolve',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, JSON.stringify({ url: 'https://t.me/techiestorefiles/3' }));

      assert.strictEqual(resolveRes.statusCode, 200);
      const resolveData = JSON.parse(resolveRes.body);
      assert.strictEqual(resolveData.success, true);
      assert.ok(resolveData.download_url);

      const downloadPath = new URL(resolveData.download_url).pathname;

      // Step B: GET /api/download/:token
      const dlRes = await httpRequest({
        hostname: 'localhost',
        port: TEST_PORT,
        path: downloadPath,
        method: 'GET'
      });

      assert.strictEqual(dlRes.statusCode, 200);
      assert.ok(dlRes.headers['content-disposition'].includes('attachment'));
      assert.strictEqual(dlRes.headers['location'], undefined, 'Must NEVER redirect to t.me or external URL');
      assert.ok(dlRes.rawBuffer.length > 0, 'Must stream binary file bytes');

      // Check binary signature (PK.. for ZIP/APK)
      const isZipOrApk = dlRes.rawBuffer.slice(0, 4).toString('hex') === '504b0304';
      assert.strictEqual(isZipOrApk, true, 'Must deliver valid ZIP/APK archive binary bytes');

    } finally {
      await new Promise(resolve => server.close(resolve));
    }
  });

  console.log(`
=============================================================================
🏁 TEST RESULTS: ${passed}/${total} PASSED
=============================================================================
`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
