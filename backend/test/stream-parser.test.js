/**
 * backend/test/stream-parser.test.js
 * Unit Test สำหรับ StreamParser (การดักจับและแยก Thinking Process)
 */

const assert = require('assert');
const StreamParser = require('../src/ai/stream-parser');

function runTests() {
  console.log('========================================');
  console.log('🧪 รัน Unit Test: Thinking Stream Parser');
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

  // Test 1: Simple <thinking>...</thinking>
  test('1. แยกแท็ก <thinking>...</thinking> พื้นฐานได้อย่างสมบูรณ์', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('<thinking>\n1. วิเคราะห์ตัวละคร เร็น\n2. กำหนดธีมฉากต่อสู้\n</thinking>\n');
    parser.feed('[STORY_START]\nแสงดาบสีครามวาบผ่านม่านหมอก...\n[STORY_END]');
    const result = parser.flush();

    assert.strictEqual(
      thoughtChunks.trim(),
      '1. วิเคราะห์ตัวละคร เร็น\n2. กำหนดธีมฉากต่อสู้',
    );
    assert.strictEqual(
      storyChunks.trim(),
      '[STORY_START]\nแสงดาบสีครามวาบผ่านม่านหมอก...\n[STORY_END]',
    );
    assert.strictEqual(result.thinking_logs, thoughtChunks.trim());
    assert.strictEqual(result.story_output, storyChunks.trim());
  });

  // Test 2: <think>...</think> (DeepSeek-R1 style)
  test('2. รองรับแท็ก <think>...</think> (สไตล์ DeepSeek-R1)', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('<think>กำลังคำนวณสำนวนที่เหมาะสม</think>');
    parser.feed('บทสนทนาอันอบอุ่นเริ่มต้นขึ้น');
    parser.flush();

    assert.strictEqual(thoughtChunks, 'กำลังคำนวณสำนวนที่เหมาะสม');
    assert.strictEqual(storyChunks, 'บทสนทนาอันอบอุ่นเริ่มต้นขึ้น');
  });

  // Test 3: Tag split across chunk boundary (<thin + king>)
  test('3. รองรับกรณีแท็กเปิดถูกผ่ากลางข้าม Chunk (<thin + king>)', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('เกริ่นนำก่อนคิด <thin');
    // ณ จุดนี้ buffer ต้องเก็บ "<thin" ไว้ และ storyChunks ต้องมีแค่ "เกริ่นนำก่อนคิด "
    assert.strictEqual(storyChunks, 'เกริ่นนำก่อนคิด ');
    assert.strictEqual(thoughtChunks, '');

    parser.feed('king>เริ่มคิดในใจ</thinking>เนื้อเรื่องต่อ');
    parser.flush();

    assert.strictEqual(thoughtChunks, 'เริ่มคิดในใจ');
    assert.strictEqual(storyChunks, 'เกริ่นนำก่อนคิด เนื้อเรื่องต่อ');
  });

  // Test 4: Closing tag split across chunk boundary (</think + ing>)
  test('4. รองรับกรณีแท็กปิดถูกผ่ากลางข้าม Chunk (</think + ing>)', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('<thinking>กำลังคิดฉากที่สอง</think');
    assert.strictEqual(thoughtChunks, 'กำลังคิดฉากที่สอง');

    parser.feed('ing>จบความคิดแล้ว เข้าสู่เนื้อเรื่อง');
    parser.flush();

    assert.strictEqual(thoughtChunks, 'กำลังคิดฉากที่สอง');
    assert.strictEqual(storyChunks, 'จบความคิดแล้ว เข้าสู่เนื้อเรื่อง');
  });

  // Test 5: Native Thought Parts (Gemini includeThoughts)
  test('5. รองรับ Native Thought Parts (isNativeThought = true)', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('Gemini Native Thought Chunk 1\n', true);
    parser.feed('Gemini Native Thought Chunk 2', true);
    parser.feed('เนื้อหานิยายตอนต่อไป');
    parser.flush();

    assert.strictEqual(
      thoughtChunks,
      'Gemini Native Thought Chunk 1\nGemini Native Thought Chunk 2',
    );
    assert.strictEqual(storyChunks, 'เนื้อหานิยายตอนต่อไป');
  });

  // Test 6: Pure Story (No thinking tags)
  test('6. กรณีไม่มีแท็กคิดเลย (Pure Story) ทำงานได้ปกติ', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('กาลครั้งหนึ่งนานมาแล้ว ');
    parser.feed('ในดินแดนอันไกลโพ้น...');
    const result = parser.flush();

    assert.strictEqual(thoughtChunks, '');
    assert.strictEqual(storyChunks, 'กาลครั้งหนึ่งนานมาแล้ว ในดินแดนอันไกลโพ้น...');
    assert.strictEqual(result.thinking_logs, '');
    assert.strictEqual(result.story_output, 'กาลครั้งหนึ่งนานมาแล้ว ในดินแดนอันไกลโพ้น...');
  });

  // Test 7: Unclosed thinking tag
  test('7. กรณีแท็กคิดเปิดแล้วไม่ปิด ถูก flush เข้า thinking_logs อย่างปลอดภัย', () => {
    let thoughtChunks = '';
    let storyChunks = '';

    const parser = new StreamParser({
      onThinking: (chunk) => (thoughtChunks += chunk),
      onStory: (chunk) => (storyChunks += chunk),
    });

    parser.feed('<thinking>คิดไปเรื่อยๆ จนจบสตรีม');
    const result = parser.flush();

    assert.strictEqual(thoughtChunks, 'คิดไปเรื่อยๆ จนจบสตรีม');
    assert.strictEqual(storyChunks, '');
    assert.strictEqual(result.thinking_logs, 'คิดไปเรื่อยๆ จนจบสตรีม');
  });

  console.log('\n========================================');
  console.log(`📊 ผลการทดสอบ: ผ่าน ${passed} ข้อ | ไม่ผ่าน ${failed} ข้อ`);
  console.log('========================================');

  if (failed > 0) process.exit(1);
}

runTests();
