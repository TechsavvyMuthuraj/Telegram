// =============================================================================
// techiemuthuraj Files - Automated Verification & Acceptance Test Suite
// Verifies all 11 criteria from the project specifications:
// 1. Valid token for correct file
// 2. Token used against wrong file (mismatch)
// 3. Invalid token (non-existent)
// 4. Expired token
// 5. Revoked token
// 6. Exhausted single-use download limit
// 7. Exhausted multi-use download limit
// 8. Atomic concurrent download race-condition prevention
// 9. Unauthorized admin API requests
// 10. Public token alteration prevention
// 11. HMAC signed download ticket verification & tamper resistance
// =============================================================================

const assert = require('assert');
const { 
  generateSecureToken, 
  hashToken, 
  signDownloadTicket, 
  verifyDownloadTicket 
} = require('../netlify/functions/utils/crypto');
const {
  createFile,
  getPublicFiles,
  createAccessTokens,
  verifyAndClaimDownload,
  revokeToken,
  getFileById,
  inMemoryStore
} = require('../netlify/functions/utils/db');
const verifyTokenHandler = require('../netlify/functions/verify-token').handler;
const filesHandler = require('../netlify/functions/files').handler;
const tokensHandler = require('../netlify/functions/tokens').handler;
const downloadHandler = require('../netlify/functions/download').handler;

let testsPassed = 0;
let testsFailed = 0;

function runTest(testName, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✓ PASS: ${testName}`);
      testsPassed++;
    })
    .catch((err) => {
      console.error(`  ✕ FAIL: ${testName}`);
      console.error(`    -> ${err.message}`);
      testsFailed++;
    });
}

async function executeTestSuite() {
  console.log('\n=============================================================================');
  console.log('🧪 RUNNING AUTOMATED SECURITY & FUNCTIONALITY TEST SUITE');
  console.log('=============================================================================\n');

  // Setup test files
  const testFileA = await createFile({
    file_code: 'TM-TEST-A01',
    title: 'Test Software Release A',
    category: 'Software',
    file_type: 'ZIP',
    file_size: '10 MB',
    source_type: 'direct_url',
    source_reference: 'https://example.com/files/release-a.zip',
    external_download_url: 'https://example.com/files/release-a.zip'
  });

  const testFileB = await createFile({
    file_code: 'TM-TEST-B02',
    title: 'Test APK Release B',
    category: 'APK',
    file_type: 'APK',
    file_size: '15 MB',
    source_type: 'direct_url',
    source_reference: 'https://example.com/files/release-b.apk',
    external_download_url: 'https://example.com/files/release-b.apk'
  });

  // ---------------------------------------------------------------------------
  // Test 1: Valid token for the correct file
  // ---------------------------------------------------------------------------
  await runTest('1. Valid token for the correct file succeeds and issues authorization', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-0001',
      max_downloads: 5,
      download_count: 0,
      expires_at: new Date(Date.now() + 86400000).toISOString()
    }]);

    const res = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.1' },
      body: JSON.stringify({ file_id: testFileA.id, token: rawToken })
    });

    assert.strictEqual(res.statusCode, 200, 'Expected status 200');
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.download_ticket, 'Expected download_ticket to be issued');
    assert.strictEqual(body.file.downloads_remaining, 4);
  });

  // ---------------------------------------------------------------------------
  // Test 2: Token used against the wrong file (mismatch)
  // ---------------------------------------------------------------------------
  await runTest('2. Token used against wrong file is rejected (TOKEN_FILE_MISMATCH)', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Token is tied to File A
    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-0002',
      max_downloads: 1
    }]);

    // Attempt to verify against File B
    const res = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.2' },
      body: JSON.stringify({ file_id: testFileB.id, token: rawToken })
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error_code, 'TOKEN_FILE_MISMATCH');
  });

  // ---------------------------------------------------------------------------
  // Test 3: Invalid token (non-existent)
  // ---------------------------------------------------------------------------
  await runTest('3. Non-existent invalid token is rejected (INVALID_TOKEN)', async () => {
    const res = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.3' },
      body: JSON.stringify({ file_id: testFileA.id, token: 'TM-FAKE-9999-0000' })
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error_code, 'INVALID_TOKEN');
  });

  // ---------------------------------------------------------------------------
  // Test 4: Expired token
  // ---------------------------------------------------------------------------
  await runTest('4. Expired token is rejected (TOKEN_EXPIRED)', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Created with past expiration
    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-EXPD',
      max_downloads: 5,
      expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
    }]);

    const res = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.4' },
      body: JSON.stringify({ file_id: testFileA.id, token: rawToken })
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error_code, 'TOKEN_EXPIRED');
  });

  // ---------------------------------------------------------------------------
  // Test 5: Revoked token
  // ---------------------------------------------------------------------------
  await runTest('5. Revoked token is rejected (TOKEN_REVOKED)', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await createAccessTokens([{
      id: 'revoked-test-id',
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-REVK',
      max_downloads: 5,
      is_revoked: true,
      revoked_reason: 'Admin security revocation test'
    }]);

    const res = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.5' },
      body: JSON.stringify({ file_id: testFileA.id, token: rawToken })
    });

    assert.strictEqual(res.statusCode, 403);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error_code, 'TOKEN_REVOKED');
  });

  // ---------------------------------------------------------------------------
  // Test 6: Single-use token used twice
  // ---------------------------------------------------------------------------
  await runTest('6. Single-use token exhausts limit after 1 use (DOWNLOAD_LIMIT_REACHED)', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-SNG1',
      max_downloads: 1,
      download_count: 0
    }]);

    // Use 1: Should succeed
    const res1 = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.6' },
      body: JSON.stringify({ file_id: testFileA.id, token: rawToken })
    });
    assert.strictEqual(res1.statusCode, 200, 'First download attempt must succeed');

    // Use 2: Must be rejected
    const res2 = await verifyTokenHandler({
      httpMethod: 'POST',
      headers: { 'client-ip': '192.0.2.6' },
      body: JSON.stringify({ file_id: testFileA.id, token: rawToken })
    });
    assert.strictEqual(res2.statusCode, 403, 'Second attempt must be rejected');
    const body2 = JSON.parse(res2.body);
    assert.strictEqual(body2.error_code, 'DOWNLOAD_LIMIT_REACHED');
  });

  // ---------------------------------------------------------------------------
  // Test 7: Limited-use token reaching exact limit
  // ---------------------------------------------------------------------------
  await runTest('7. Multi-use token allows exactly configured limit (3 downloads)', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-LIM3',
      max_downloads: 3,
      download_count: 0
    }]);

    // 1st download
    const r1 = await verifyAndClaimDownload({ fileId: testFileA.id, tokenHash });
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r1.downloads_remaining, 2);

    // 2nd download
    const r2 = await verifyAndClaimDownload({ fileId: testFileA.id, tokenHash });
    assert.strictEqual(r2.success, true);
    assert.strictEqual(r2.downloads_remaining, 1);

    // 3rd download (exact limit)
    const r3 = await verifyAndClaimDownload({ fileId: testFileA.id, tokenHash });
    assert.strictEqual(r3.success, true);
    assert.strictEqual(r3.downloads_remaining, 0);

    // 4th download (exceeded)
    const r4 = await verifyAndClaimDownload({ fileId: testFileA.id, tokenHash });
    assert.strictEqual(r4.success, false);
    assert.strictEqual(r4.error_code, 'DOWNLOAD_LIMIT_REACHED');
  });

  // ---------------------------------------------------------------------------
  // Test 8: Atomic concurrent download attempts
  // ---------------------------------------------------------------------------
  await runTest('8. Concurrent download attempts enforce limit atomically without race condition', async () => {
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);

    // Token allows exactly 2 downloads
    await createAccessTokens([{
      file_id: testFileA.id,
      token_hash: tokenHash,
      token_preview: 'TM-TEST-****-CONC',
      max_downloads: 2,
      download_count: 0
    }]);

    // Launch 10 simultaneous verification claims
    const promises = Array.from({ length: 10 }).map((_, i) => 
      verifyAndClaimDownload({ 
        fileId: testFileA.id, 
        tokenHash, 
        ipHash: `client-${i}` 
      })
    );

    const results = await Promise.all(promises);
    const successes = results.filter(r => r.success);
    const rejections = results.filter(r => !r.success && r.error_code === 'DOWNLOAD_LIMIT_REACHED');

    assert.strictEqual(successes.length, 2, 'Exactly 2 claims must succeed');
    assert.strictEqual(rejections.length, 8, 'Remaining 8 simultaneous claims must be rejected');
  });

  // ---------------------------------------------------------------------------
  // Test 9: Unauthorized admin API requests
  // ---------------------------------------------------------------------------
  await runTest('9. Unauthorized admin requests are rejected with 401', async () => {
    // Request without admin key
    const res = await tokensHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {}
    });
    assert.strictEqual(res.statusCode, 401, 'Must reject with 401 without auth header');

    // Request with wrong key
    const resWrong = await tokensHandler({
      httpMethod: 'GET',
      headers: { 'x-admin-key': 'wrong-password' },
      queryStringParameters: {}
    });
    assert.strictEqual(resWrong.statusCode, 401, 'Must reject with 401 on wrong secret key');
  });

  // ---------------------------------------------------------------------------
  // Test 10: Authorized admin API request succeeds
  // ---------------------------------------------------------------------------
  await runTest('10. Authorized admin request succeeds with valid ADMIN_SECRET_KEY', async () => {
    const adminKey = process.env.ADMIN_SECRET_KEY || 'default-admin-password-techiemuthuraj-2026';
    const res = await tokensHandler({
      httpMethod: 'GET',
      headers: { 'x-admin-key': adminKey },
      queryStringParameters: {}
    });
    assert.strictEqual(res.statusCode, 200, 'Must succeed with 200 when authenticated');
  });

  // ---------------------------------------------------------------------------
  // Test 11: HMAC Signed Download Ticket Verification & Tamper Resistance
  // ---------------------------------------------------------------------------
  await runTest('11. Tampered or forged download ticket is rejected with 403', async () => {
    const payload = { file_id: testFileA.id, authorized_at: Date.now() };
    const validTicket = signDownloadTicket(payload);

    // Valid ticket passes
    const validCheck = verifyDownloadTicket(validTicket);
    assert.ok(validCheck && validCheck.valid, 'Valid ticket must pass HMAC verification');

    // Tampered ticket (modify signature)
    const tamperedTicket = validTicket.slice(0, -4) + 'XXXX';
    const tamperedCheck = verifyDownloadTicket(tamperedTicket);
    assert.strictEqual(tamperedCheck, null, 'Tampered ticket must fail HMAC verification');

    // Tampered ticket passed to download endpoint returns 403
    const downloadRes = await downloadHandler({
      httpMethod: 'GET',
      queryStringParameters: { ticket: tamperedTicket }
    });
    assert.strictEqual(downloadRes.statusCode, 403, 'Endpoint must reject tampered ticket with 403');
  });

  // ---------------------------------------------------------------------------
  // Test 12: Telegram Webhook Channel Post Auto-Sync
  // ---------------------------------------------------------------------------
  await runTest('12. Telegram Webhook automatically registers channel documents into catalog', async () => {
    const webhookHandler = require('../netlify/functions/telegram-webhook').handler;
    const channelPostPayload = {
      channel_post: {
        message_id: 884,
        chat: { id: -100123456789, title: 'techiemuthuraj Official', username: 'techiemuthuraj' },
        document: {
          file_id: 'BQACAgUAAxkBAAICcGe_TEST_DOC_123',
          file_name: 'TurboSpeed_Optimizer_v2.apk',
          file_size: 15728640,
          mime_type: 'application/vnd.android.package-archive'
        },
        caption: 'TurboSpeed Optimizer v2.0 - High performance tuning tool'
      }
    };

    const res = await webhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify(channelPostPayload)
    });

    assert.strictEqual(res.statusCode, 200, 'Webhook must return 200 to Telegram');
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.synced_channel_post, true);

    // Verify file is in public catalog
    const files = await getPublicFiles();
    const createdFile = files.find(f => f.title.includes('TurboSpeed'));
    assert.ok(createdFile, 'Auto-registered file must be found in catalog');
    assert.strictEqual(createdFile.category, 'APK');
  });

  // ---------------------------------------------------------------------------
  // Test 13: Telegram Webhook Bot Message Command
  // ---------------------------------------------------------------------------
  await runTest('13. Telegram Webhook responds to direct bot /start and /help commands', async () => {
    const webhookHandler = require('../netlify/functions/telegram-webhook').handler;
    const botMessagePayload = {
      message: {
        message_id: 101,
        chat: { id: 987654321, type: 'private' },
        from: { id: 987654321, first_name: 'Alex' },
        text: '/start'
      }
    };

    const res = await webhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify(botMessagePayload)
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.ok, true);
  });

  // ---------------------------------------------------------------------------
  // Test 14: User Authentication Challenge Creation
  // ---------------------------------------------------------------------------
  await runTest('14. User can create Telegram login challenge with 6-digit PIN and deep-link', async () => {
    const userAuthHandler = require('../netlify/functions/user-auth').handler;
    const res = await userAuthHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create_challenge',
        username: 'techiemuthuraj'
      })
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(body.session_id.startsWith('TM-AUTH-'), 'Must produce TM-AUTH session ID');
    assert.strictEqual(body.code.length, 6, 'Must produce 6-digit PIN code');
    assert.strictEqual(body.claimed_username, 'techiemuthuraj');
    assert.ok(body.deep_link.includes(`start=auth_${body.code}`), 'Deep link must embed auth code');
  });

  // ---------------------------------------------------------------------------
  // Test 15: Imposter / Fake Account Detection and Blocking
  // ---------------------------------------------------------------------------
  await runTest('15. Fake/Imposter user is detected and rejected when Telegram account mismatches claimed username', async () => {
    const userAuthHandler = require('../netlify/functions/user-auth').handler;
    const webhookHandler = require('../netlify/functions/telegram-webhook').handler;

    // 1. Victim's account is claimed on website
    const createRes = await userAuthHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create_challenge',
        username: 'victim_real_user'
      })
    });
    const { session_id, code } = JSON.parse(createRes.body);

    // 2. Imposter clicks start from an account with a DIFFERENT username
    const imposterWebhook = {
      message: {
        message_id: 202,
        chat: { id: 11223344, type: 'private' },
        from: { id: 11223344, username: 'evil_imposter_bot', first_name: 'Imposter' },
        text: `/start auth_${code}`
      }
    };

    const webhookRes = await webhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify(imposterWebhook)
    });
    assert.strictEqual(webhookRes.statusCode, 200);

    // 3. Website polls for status - MUST be rejected as fake/imposter!
    const pollRes = await userAuthHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { session_id }
    });
    const pollBody = JSON.parse(pollRes.body);

    assert.strictEqual(pollBody.success, false, 'Imposter attempt must NOT succeed');
    assert.strictEqual(pollBody.status, 'rejected_fake', 'Status must be rejected_fake');
    assert.strictEqual(pollBody.error, 'IMPOSTER_MISMATCH', 'Error must be IMPOSTER_MISMATCH');
    assert.strictEqual(pollBody.claimed_username, 'victim_real_user');
    assert.strictEqual(pollBody.actual_username, 'evil_imposter_bot');
  });

  // ---------------------------------------------------------------------------
  // Test 16: Genuine Telegram Account Verification & Automatic Polling
  // ---------------------------------------------------------------------------
  await runTest('16. Genuine Telegram account is automatically verified, channel membership checked, and session token issued', async () => {
    const userAuthHandler = require('../netlify/functions/user-auth').handler;
    const webhookHandler = require('../netlify/functions/telegram-webhook').handler;

    // 1. Genuine user starts login on website
    const createRes = await userAuthHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        action: 'create_challenge',
        username: 'genuine_member_99'
      })
    });
    const { session_id, code } = JSON.parse(createRes.body);

    // 2. Genuine user taps Start in bot
    const genuineWebhook = {
      message: {
        message_id: 303,
        chat: { id: 55667788, type: 'private' },
        from: { id: 55667788, username: 'genuine_member_99', first_name: 'Genuine Member' },
        text: `/start auth_${code}`
      }
    };

    const webhookRes = await webhookHandler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify(genuineWebhook)
    });
    assert.strictEqual(webhookRes.statusCode, 200);

    // 3. Website automatically detects verification via polling
    const pollRes = await userAuthHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: { session_id }
    });
    const pollBody = JSON.parse(pollRes.body);

    assert.strictEqual(pollBody.success, true);
    assert.strictEqual(pollBody.status, 'verified', 'Session must be verified');
    assert.ok(pollBody.user, 'Must contain verified user payload');
    assert.strictEqual(pollBody.user.username, 'genuine_member_99');
    assert.strictEqual(pollBody.user.is_original, true, 'Account must be flagged as original');
    assert.strictEqual(pollBody.user.is_fake, false, 'Must not be fake');
    assert.ok(pollBody.token, 'Must issue signed authentication token');

    // 4. Validate user session token via GET /api/user-auth?action=me
    const meRes = await userAuthHandler({
      httpMethod: 'GET',
      headers: {
        'authorization': `Bearer ${pollBody.token}`
      },
      queryStringParameters: { action: 'me' }
    });
    const meBody = JSON.parse(meRes.body);
    assert.strictEqual(meBody.success, true);
    assert.strictEqual(meBody.authenticated, true);
    assert.strictEqual(meBody.user.username, 'genuine_member_99');
  });

  // ---------------------------------------------------------------------------
  // Test 17: User Management Detailed Information & Token Tracking
  // ---------------------------------------------------------------------------
  await runTest('17. User Management API returns comprehensive user details, token records, and logs', async () => {
    const usersHandler = require('../netlify/functions/users').handler;
    const adminKey = process.env.ADMIN_SECRET_KEY || 'default-admin-password-techiemuthuraj-2026';

    const res = await usersHandler({
      httpMethod: 'GET',
      headers: {
        'x-admin-key': adminKey
      }
    });

    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.users), 'Must return users array');
    assert.ok(body.users.length > 0, 'Users array should contain records');

    // Check that each user has detailed fields
    const firstUser = body.users[0];
    assert.ok(firstUser.identifier, 'User must have identifier');
    assert.ok(Array.isArray(firstUser.tokens), 'User must have assigned tokens list');
    assert.ok(Array.isArray(firstUser.downloads), 'User must have downloads history list');
    assert.strictEqual(typeof firstUser.is_blocked, 'boolean', 'is_blocked must be boolean');
    assert.strictEqual(typeof firstUser.is_channel_member, 'boolean', 'is_channel_member must be boolean');
  });

  // ---------------------------------------------------------------------------
  // Test 18: Admin Moderation (Block/Unblock & Notes Update)
  // ---------------------------------------------------------------------------
  await runTest('18. Admin can update user notes and toggle blocked status via PUT /api/users', async () => {
    const usersHandler = require('../netlify/functions/users').handler;
    const adminKey = process.env.ADMIN_SECRET_KEY || 'default-admin-password-techiemuthuraj-2026';

    // 1. Get first user
    const listRes = await usersHandler({
      httpMethod: 'GET',
      headers: { 'x-admin-key': adminKey }
    });
    const { users } = JSON.parse(listRes.body);
    const target = users[0];

    // 2. Toggle block
    const updateRes = await usersHandler({
      httpMethod: 'PUT',
      headers: {
        'x-admin-key': adminKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        id: target.id,
        action: 'toggle_block',
        is_blocked: true,
        notes: 'VIP tester moderated notes'
      })
    });

    assert.strictEqual(updateRes.statusCode, 200);
    const updateBody = JSON.parse(updateRes.body);
    assert.strictEqual(updateBody.success, true);
    assert.strictEqual(updateBody.user.is_blocked, true);
  });

  // ---------------------------------------------------------------------------
  // Test 19: Telegram Direct Download Generator
  // ---------------------------------------------------------------------------
  await runTest('19. Telegram Direct Download Generator resolves links and produces direct download stream', async () => {
    const directDlHandler = require('../netlify/functions/telegram-direct-download').handler;

    // 1. Resolve a catalog Telegram link
    const resolveRes = await directDlHandler({
      httpMethod: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        link: 'https://t.me/techiemuthuraj/412'
      })
    });

    assert.strictEqual(resolveRes.statusCode, 200);
    const resBody = JSON.parse(resolveRes.body);
    assert.strictEqual(resBody.success, true);
    assert.ok(resBody.direct_download_url, 'Must generate direct_download_url');
    assert.ok(resBody.file_name, 'Must extract file name');
    assert.ok(resBody.file_type, 'Must infer file type');

    // 2. Trigger direct download action
    const dlActionRes = await directDlHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {
        action: 'download',
        source: 'https://github.com/techiemuthuraj/demo-assets/archive/refs/heads/main.zip',
        name: 'test_direct_asset.zip'
      }
    });

    assert.strictEqual(dlActionRes.statusCode, 302, 'Download must return redirect to binary stream');
    assert.ok(dlActionRes.headers['Content-Disposition'].includes('attachment; filename='), 'Must set attachment header for immediate download');
  });

  // ---------------------------------------------------------------------------
  // Test 20: Admin User Management Delete (Single & Bulk)
  // ---------------------------------------------------------------------------
  await runTest('20. Admin can select and delete users individually and in bulk via DELETE /api/users', async () => {
    const usersHandler = require('../netlify/functions/users').handler;
    const adminKey = 'default-admin-password-techiemuthuraj-2026';

    // 1. Create 2 test users
    const u1Res = await usersHandler({
      httpMethod: 'POST',
      headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: '@test_delete_1', display_name: 'Delete User 1' })
    });
    assert.strictEqual(u1Res.statusCode, 201);
    const u1 = JSON.parse(u1Res.body).user;

    const u2Res = await usersHandler({
      httpMethod: 'POST',
      headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ identifier: '@test_delete_2', display_name: 'Delete User 2' })
    });
    assert.strictEqual(u2Res.statusCode, 201);
    const u2 = JSON.parse(u2Res.body).user;

    // 2. Delete single user
    const delSingleRes = await usersHandler({
      httpMethod: 'DELETE',
      headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ id: u1.id })
    });
    assert.strictEqual(delSingleRes.statusCode, 200);
    assert.strictEqual(JSON.parse(delSingleRes.body).success, true);

    // 3. Delete bulk users
    const delBulkRes = await usersHandler({
      httpMethod: 'DELETE',
      headers: { 'x-admin-key': adminKey, 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [u2.id] })
    });
    assert.strictEqual(delBulkRes.statusCode, 200);
    assert.strictEqual(JSON.parse(delBulkRes.body).success, true);
  });

  // ---------------------------------------------------------------------------
  // Test 21: Direct Telegram file download NEVER redirects to t.me
  // ---------------------------------------------------------------------------
  await runTest('21. Telegram file link generates direct file download without redirecting to channel', async () => {
    const directDlHandler = require('../netlify/functions/telegram-direct-download').handler;

    // Direct download action with a t.me link source
    const tgDlRes = await directDlHandler({
      httpMethod: 'GET',
      headers: {},
      queryStringParameters: {
        action: 'download',
        source: 'https://t.me/techiestorefiles/3',
        name: 'STORY_TV-12-10-2026-FIXED (1).apk'
      }
    });

    // CRITICAL: Must NOT redirect to t.me (statusCode 302 with Location: t.me)
    assert.notStrictEqual(tgDlRes.headers['Location'] || '', 'https://t.me/techiestorefiles/3', 'Must NEVER redirect to t.me page!');
    assert.strictEqual(tgDlRes.statusCode, 200, 'Must stream binary attachment directly with HTTP 200');
    assert.strictEqual(tgDlRes.headers['Content-Type'], 'application/vnd.android.package-archive', 'Must have APK content type');
    assert.ok(tgDlRes.headers['Content-Disposition'].includes('STORY_TV-12-10-2026-FIXED (1).apk'), 'Must have correct attachment filename');
    assert.ok(tgDlRes.body, 'Must return direct binary body payload');
    assert.strictEqual(tgDlRes.isBase64Encoded, true, 'Binary must be base64 encoded for download stream');
  });

  console.log('\n=============================================================================');
  console.log(`🏁 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('=============================================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

executeTestSuite();
