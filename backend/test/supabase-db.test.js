/**
 * backend/test/supabase-db.test.js
 * Unit Test สำหรับ Supabase Database Service
 */

const assert = require('assert');
const {
  saveChatMessage,
  getChatHistoryByStoryId,
  deleteChatMessage,
  clearStoryChatHistory,
  checkDatabaseHealth,
  _localChatStore,
} = require('../src/db/supabase');

async function runTests() {
  console.log('========================================');
  console.log('🧪 รัน Unit Test: Supabase DB Service');
  console.log('========================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`, err);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`, err);
      failed++;
    }
  }

  // Test 1: Check Database Health
  await testAsync('ตรวจสอบสถานะการเชื่อมต่อ Supabase', async () => {
    const health = await checkDatabaseHealth();
    assert.strictEqual(typeof health.connected, 'boolean');
    assert.ok(health.message, 'ต้องมีข้อความสถานะส่งกลับมา');
    console.log(`   ℹ️ Health Status: ${health.message}`);
  });

  // Test 2: Save Chat Message
  const testStoryId = `test-story-${Date.now()}`;
  let savedId = null;

  await testAsync('บันทึกข้อความแชท (saveChatMessage)', async () => {
    const result = await saveChatMessage({
      story_id: testStoryId,
      role: 'ai',
      user_message: 'ช่วยแต่งฉากเปิดเรื่องหน่อย',
      thinking_logs: '🧠 1. วิเคราะห์ตัวละคร 2. วางโครงฉาก',
      story_output: '[STORY_START] ในค่ำคืนที่ฝนพรำ... [STORY_END]',
      model_name: 'gemini-2.5-flash',
    });

    assert.ok(result.success, 'บันทึกสำเร็จ');
    assert.ok(result.data, 'มีข้อมูล record ส่งกลับมา');
    assert.strictEqual(result.data.story_id, testStoryId);
    assert.strictEqual(result.data.user_message, 'ช่วยแต่งฉากเปิดเรื่องหน่อย');
    assert.strictEqual(result.data.thinking_logs, '🧠 1. วิเคราะห์ตัวละคร 2. วางโครงฉาก');
    assert.ok(result.data.story_output.includes('ในค่ำคืนที่ฝนพรำ'));
    savedId = result.data.id;
  });

  // Test 3: Get Chat History by Story ID
  await testAsync('ดึงประวัติแชท (getChatHistoryByStoryId)', async () => {
    const result = await getChatHistoryByStoryId(testStoryId);
    assert.ok(result.success, 'ดึงสำเร็จ');
    assert.ok(Array.isArray(result.history), 'ผลลัพธ์เป็น Array');
    assert.ok(result.history.length >= 1, 'มีอย่างน้อย 1 ข้อความ');
    assert.strictEqual(result.history[0].story_id, testStoryId);
  });

  // Test 4: Delete Single Message
  await testAsync('ลบข้อความแชทรายตัว (deleteChatMessage)', async () => {
    if (savedId) {
      const delResult = await deleteChatMessage(savedId);
      assert.ok(delResult.success, 'ลบสำเร็จ');
    }
  });

  // Test 5: Clear Story History
  await testAsync('ล้างประวัติแชทของนิยายทั้งเรื่อง (clearStoryChatHistory)', async () => {
    await clearStoryChatHistory(testStoryId);
    const result = await getChatHistoryByStoryId(testStoryId);
    assert.strictEqual(result.history.length, 0, 'ประวัติถูกล้างเกลี้ยง');
  });

  console.log('\n========================================');
  console.log(`📊 ผลการทดสอบ: ผ่าน ${passed} ข้อ | ไม่ผ่าน ${failed} ข้อ`);
  console.log('========================================');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
