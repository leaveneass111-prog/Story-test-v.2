/**
 * backend/test/server-e2e.test.js
 * ทดสอบ End-to-End API Server: Health Check และ Real-time SSE Stream
 */

const assert = require('assert');
const { app, server } = require('../src/server');

async function runE2eTests() {
  console.log('========================================');
  console.log('🧪 รัน E2E Server & Streaming Test');
  console.log('========================================\n');

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`, err);
      failed++;
    }
  }

  // Test 1: GET /api/health
  await test('1. ตรวจสอบสถานะเซิร์ฟเวอร์ (GET /api/health)', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.service, 'novel-chat-backend');
    assert.ok(data.database, 'ต้องมีข้อมูลสถานะฐานข้อมูล');
  });

  // Test 2: POST /api/chat/stream (SSE Stream)
  await test('2. ทดสอบ Real-time SSE Stream (POST /api/chat/stream)', async () => {
    const res = await fetch(`${baseUrl}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        story_id: 'test-stream-story',
        prompt: 'ขอฉากเปิดเรื่องสั้นๆ',
        activeStyle: 'บรรยายเน้นอารมณ์',
        provider: 'mock',
      }),
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.headers.get('content-type').includes('text/event-stream'));

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let receivedThinkingEvents = 0;
    let receivedStoryEvents = 0;
    let receivedDoneEvent = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      let currentEvent = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event:')) {
          currentEvent = trimmed.replace(/^event:\s*/, '').trim();
        } else if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.replace(/^data:\s*/, '').trim();
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'thinking') {
              receivedThinkingEvents++;
            } else if (currentEvent === 'story') {
              receivedStoryEvents++;
            } else if (currentEvent === 'done') {
              receivedDoneEvent = true;
              assert.ok(data.thinking_logs !== undefined, 'event: done ต้องมี thinking_logs');
              assert.ok(data.story_output !== undefined, 'event: done ต้องมี story_output');
            }
          } catch (e) {}
        }
      }
    }

    assert.ok(receivedThinkingEvents > 0, 'ต้องได้รับ event: thinking อย่างน้อย 1 ครั้ง');
    assert.ok(receivedStoryEvents > 0, 'ต้องได้รับ event: story อย่างน้อย 1 ครั้ง');
    assert.ok(receivedDoneEvent, 'ต้องได้รับ event: done เพื่อระบุว่าสตรีมเสร็จสมบูรณ์');
  });

  // Test 3: GET /api/chat/history
  await test('3. ตรวจสอบการดึงประวัติแชท (GET /api/chat/history)', async () => {
    const res = await fetch(`${baseUrl}/api/chat/history?story_id=test-stream-story`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.success, 'ดึงประวัติสำเร็จ');
    assert.ok(Array.isArray(data.history), 'ประวัติเป็น Array');
    assert.ok(data.history.length >= 1, 'มีบันทึกที่เพิ่งสตรีมไป');
  });

  // ปิดเซิร์ฟเวอร์หลังทดสอบเสร็จ
  console.log('\n========================================');
  console.log(`📊 ผลการทดสอบ: ผ่าน ${passed} ข้อ | ไม่ผ่าน ${failed} ข้อ`);
  console.log('========================================');

  server.close(() => {
    process.exit(failed > 0 ? 1 : 0);
  });
  setTimeout(() => process.exit(failed > 0 ? 1 : 0), 500);
}

runE2eTests().catch((err) => {
  console.error(err);
  server.close();
  process.exit(1);
});
