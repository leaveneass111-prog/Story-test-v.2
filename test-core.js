/**
 * test-core.js
 * Automated Unit Test Suite สำหรับ Story & Chat Core Logic
 * รันด้วยคำสั่ง: node test-core.js
 */

const StoryChatCore = require('./story-chat-core.js');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ FAIL: ${testName}`);
    failedTests++;
  }
}

function runTests() {
  console.log('========================================');
  console.log('🧪 เริ่มต้นรัน Unit Test สำหรับ Story & Chat');
  console.log('========================================\n');

  // --- Suite 1: Default Story Creation ---
  console.log('[Suite 1: Story Initialization]');
  const defaultStory = StoryChatCore.createDefaultStory();
  assert(defaultStory && defaultStory.id, 'สร้าง Default Story ได้สำเร็จและมี ID');
  assert(defaultStory.title === 'การเดินทางข้ามมิติของเร็น', 'ชื่อเรื่องเริ่มต้นถูกต้อง');
  assert(defaultStory.characters.length === 2, 'มีตัวละครเริ่มต้น 2 ตัว');
  assert(defaultStory.chatMessages.length === 0, 'ข้อความแชทเริ่มต้นเป็นอาเรย์ว่าง');

  // --- Suite 2: Add New Story ---
  console.log('\n[Suite 2: Add New Story]');
  let stories = [defaultStory];
  const addResult = StoryChatCore.addNewStory(stories, 'ตำนานจอมเวทแห่งดวงดาว');
  stories = addResult.stories;
  assert(stories.length === 2, 'เพิ่มเรื่องใหม่แล้วจำนวนเรื่องเพิ่มเป็น 2');
  assert(addResult.newStory.title === 'ตำนานจอมเวทแห่งดวงดาว', 'ชื่อเรื่องใหม่ถูกต้อง');
  assert(addResult.activeStoryId === addResult.newStory.id, 'Active Story สลับไปยังเรื่องใหม่ทันที');
  assert(addResult.newStory.chatMessages.length === 0, 'เรื่องใหม่มีแชทว่างเปล่าแยกจากเรื่องเดิม');

  // --- Suite 3: Switch Story ---
  console.log('\n[Suite 3: Switch Story]');
  const switchResult = StoryChatCore.switchStory(stories, defaultStory.id);
  assert(switchResult.activeStoryId === defaultStory.id, 'สามารถสลับกลับมาเรื่องเดิมได้');
  assert(switchResult.story.title === defaultStory.title, 'ข้อมูลเรื่องเดิมคงอยู่ครบถ้วน');

  // --- Suite 4: Delete Story ---
  console.log('\n[Suite 4: Delete Story]');
  const deleteResult = StoryChatCore.deleteStory(stories, addResult.newStory.id, addResult.newStory.id);
  stories = deleteResult.stories;
  assert(stories.length === 1, 'ลบเรื่องที่ 2 แล้วเหลือ 1 เรื่อง');
  assert(deleteResult.activeStoryId === defaultStory.id, 'Active Story สลับมายังเรื่องที่เหลืออยู่โดยอัตโนมัติ');

  // Test edge case: delete last remaining story
  const deleteLastResult = StoryChatCore.deleteStory(stories, defaultStory.id, defaultStory.id);
  assert(deleteLastResult.stories.length === 1, 'เมื่อลบเรื่องสุดท้าย จะไม่พัง แต่จะรีเซ็ตเป็นเรื่องว่างใหม่');
  assert(deleteLastResult.isReset === true, 'สถานะระบุว่าเป็นการ Reset');

  // --- Suite 5: Chat Operations (New Chat & Delete Message) ---
  console.log('\n[Suite 5: Chat Operations]');
  let chatStory = StoryChatCore.createDefaultStory();
  chatStory.chatMessages = StoryChatCore.addChatMessage(chatStory.chatMessages, 'user', 'สวัสดีผู้ช่วย');
  chatStory.chatMessages = StoryChatCore.addChatMessage(chatStory.chatMessages, 'ai', 'สวัสดีครับ มีอะไรให้ช่วยไหม');
  chatStory.chatMessages = StoryChatCore.addChatMessage(chatStory.chatMessages, 'user', 'ช่วยแต่งบทสนทนาหน่อย');
  assert(chatStory.chatMessages.length === 3, 'เพิ่มข้อความแชท 3 ข้อความสำเร็จ');

  // Test delete single message
  const afterDeleteMsg = StoryChatCore.deleteChatMessage(chatStory.chatMessages, 1);
  assert(afterDeleteMsg.length === 2, 'ลบข้อความที่ตำแหน่ง index 1 แล้วเหลือ 2 ข้อความ');
  assert(afterDeleteMsg[0].content === 'สวัสดีผู้ช่วย', 'ข้อความแรกยังอยู่');
  assert(afterDeleteMsg[1].content === 'ช่วยแต่งบทสนทนาหน่อย', 'ข้อความที่ 3 ขยับขึ้นมาแทนที่');

  // Test Start New Chat (Clear all chat)
  const resetChatStory = StoryChatCore.startNewChat(chatStory);
  assert(resetChatStory.chatMessages.length === 0, 'เริ่มแชทใหม่แล้วประวัติแชทถูกล้างทั้งหมด (ความยาวเป็น 0)');

  // --- Suite 6: Notes Operations (Delete Characters, Locations, Timelines) ---
  console.log('\n[Suite 6: Notes Management & Deletion]');
  let testStory = StoryChatCore.createDefaultStory();
  const initialCharCount = testStory.characters.length;
  testStory.characters = StoryChatCore.deleteNoteItem(testStory.characters, 'c1');
  assert(testStory.characters.length === initialCharCount - 1, 'ลบตัวละคร c1 ออกได้สำเร็จ');
  assert(!testStory.characters.find(c => c.id === 'c1'), 'ไม่พบตัวละคร c1 ในรายการแล้ว');

  // Add & Delete Overview item
  const newOverview = StoryChatCore.addNoteItem(testStory.overview, { title: 'เป้าหมาย', desc: 'กอบกู้โลก' });
  assert(newOverview.length === 3, 'เพิ่มภาพรวมโครงเรื่องใหม่ได้สำเร็จ');
  const deletedOverview = StoryChatCore.deleteNoteItem(newOverview, newOverview[2].id);
  assert(deletedOverview.length === 2, 'ลบภาพรวมโครงเรื่องได้สำเร็จ');

  // --- Suite 7: Clear Canvas Content ---
  console.log('\n[Suite 7: Clear Canvas Content]');
  const clearedContent = StoryChatCore.clearCanvasContent();
  assert(clearedContent === '<p><br></p>', 'ล้างเนื้อหากระดาษเป็นแท็กว่างเริ่มต้นเรียบร้อย');

  // --- Suite 8: SSE Stream Parsing & State ---
  console.log('\n[Suite 8: SSE Stream Parsing & State Tracking]');
  const rawSse = 'event: thinking\ndata: {"chunk":"สมองกำลังคิด..."}\n\nevent: story\ndata: {"chunk":"บทที่ 1"}\n\nevent: done\ndata: {"thinking_logs":"สมองกำลังคิด...","story_output":"บทที่ 1"}\n\n';
  const parsedEvents = StoryChatCore.parseSseStreamChunk(rawSse);
  assert(parsedEvents.length === 3, 'ถอดรหัส SSE Chunks ได้ 3 อีเวนต์');
  assert(parsedEvents[0].event === 'thinking', 'อีเวนต์แรกคือ thinking');
  assert(parsedEvents[0].data.chunk === 'สมองกำลังคิด...', 'ข้อมูล chunk ของ thinking ถูกต้อง');
  assert(parsedEvents[1].event === 'story', 'อีเวนต์ที่สองคือ story');
  assert(parsedEvents[2].event === 'done', 'อีเวนต์สุดท้ายคือ done');

  let streamState = StoryChatCore.createStreamingState();
  assert(streamState.isThinking === true, 'เริ่มต้นอยู่ในสถานะคิด');
  streamState = StoryChatCore.appendStreamChunk(streamState, 'thinking', { chunk: 'ข้อ 1 ' });
  assert(streamState.thinking === 'ข้อ 1 ', 'สะสมข้อความความคิดสำเร็จ');
  streamState = StoryChatCore.appendStreamChunk(streamState, 'story', { chunk: 'เปิดฉาก' });
  assert(streamState.isThinking === false, 'เมื่อข้อความเรื่องมา เปลี่ยนสถานะคิดเป็น false');
  assert(streamState.story === 'เปิดฉาก', 'สะสมเนื้อเรื่องสำเร็จ');
  streamState = StoryChatCore.appendStreamChunk(streamState, 'done', { thinking_logs: 'ข้อ 1', story_output: 'เปิดฉากสมบูรณ์' });
  assert(streamState.isDone === true, 'สถานะเป็น done สำเร็จ');

  // ทดสอบ parseSseBlocks กับก้อนข้อมูลที่ถูกตัดครึ่งกลางอีเวนต์
  const partialSse = 'event: thinking\ndata: {"chunk":"สมองกำลังคิด..."}\n\nevent: story\ndata: {"chunk":"กำลัง';
  const blockResult1 = StoryChatCore.parseSseBlocks(partialSse);
  assert(blockResult1.events.length === 1, 'แยกได้เฉพาะอีเวนต์แรกที่สมบูรณ์ (1 อีเวนต์)');
  assert(blockResult1.events[0].event === 'thinking', 'อีเวนต์สมบูรณ์คือ thinking');
  assert(blockResult1.remainingBuffer === 'event: story\ndata: {"chunk":"กำลัง', 'เก็บเศษที่ยังไม่สมบูรณ์ไว้ใน remainingBuffer');

  // ก้อนข้อมูลถัดไปมาต่อจนครบ \n\n
  const nextChunk = blockResult1.remainingBuffer + 'เขียนฉากต่อ..."}\n\n';
  const blockResult2 = StoryChatCore.parseSseBlocks(nextChunk);
  assert(blockResult2.events.length === 1, 'ประมวลผลอีเวนต์ที่สมบูรณ์แล้วในรอบถัดไป');
  assert(blockResult2.events[0].event === 'story', 'อีเวนต์คือ story');
  assert(blockResult2.events[0].data.chunk === 'กำลังเขียนฉากต่อ...', 'เนื้อหา chunk สมบูรณ์ไร้การตกหล่น');
  assert(blockResult2.remainingBuffer === '', 'remainingBuffer ว่างเปล่า');

  // กรณี Buffer ไม่มี \n\n เลย
  const noNl = 'event: thinking\ndata: {"ch';
  const blockResult3 = StoryChatCore.parseSseBlocks(noNl);
  assert(blockResult3.events.length === 0, 'หากยังไม่ถึง \\n\\n จะไม่ parse ใดๆ');
  assert(blockResult3.remainingBuffer === noNl, 'คงค่า buffer เดิมทั้งหมดไว้');

  // --- Suite 9: Thinking Steps Extraction ---
  console.log('\n[Suite 9: Thinking Steps Extraction]');
  const sampleThinking = '🧠 1. ตรวจสอบ Lorebook\n🧠 2. วางโครงเรื่องฉาก\n💡 3. ขับเน้นอารมณ์';
  const steps = StoryChatCore.parseThinkingSteps(sampleThinking);
  assert(steps.length === 3, 'แยกขั้นตอนความคิดได้ 3 สเต็ป');
  assert(steps[0] === 'ตรวจสอบ Lorebook', 'ล้างอิโมจิและหมายเลขกำกับสเต็ปแรกได้สะอาด');
  assert(steps[1] === 'วางโครงเรื่องฉาก', 'สเต็ปที่สองถูกต้อง');

  // --- Suite 10: Prompt Rules (5 Rules Verification) ---
  console.log('\n[Suite 10: Story Context Prompt Rules Verification]');
  const promptOutput = StoryChatCore.buildStoryContextPrompt(defaultStory, 'เนื้อหาหน้ากระดาษจำลอง', 'บรรยายเน้นอารมณ์');
  assert(promptOutput.includes('คุณคือผู้ช่วยเขียนนิยาย'), 'Prompt มีบทบาทผู้ช่วยเขียนนิยาย');
  assert(promptOutput.includes('หากผู้ใช้ชวนคุย ปรึกษาพล็อต หรือวางโครงเรื่อง'), 'กฎข้อ 1: ชวนคุยปรึกษาพล็อตครบถ้วน');
  assert(promptOutput.includes('<story_canvas>...</story_canvas>'), 'กฎข้อ 2: แท็ก <story_canvas> ระบุครบถ้วน');
  assert(promptOutput.includes('ห้ามมีข้อความเกริ่นนำ คำทักทาย'), 'กฎข้อ 3: ห้ามมีข้อความเกริ่นนำครบถ้วน');
  assert(promptOutput.includes('ให้เริ่มบรรทัดแรกภายในแท็ก <story_canvas> ด้วยเนื้อหาหลักหรือหัวข้อแรกทันทีโดยไม่ต้องมีบทนำ'), 'กฎข้อ 4: เริ่มบรรทัดแรกทันทีครบถ้วน');
  assert(promptOutput.includes('ห้ามมีข้อความสรุปปิดท้ายหรือคำถามชวนคุย'), 'กฎข้อ 5: ห้ามมีสรุปปิดท้ายครบถ้วน');

  // --- Suite 11: Split Chat and Story Canvas Content ---
  console.log('\n[Suite 11: Split Chat and Story Canvas Content]');
  // Case A: AI ส่งทั้งข้อความทักทายสั้นๆ และแท็ก <story_canvas>
  const sampleAiResponseA = `แต่งบทที่ 1 ให้เรียบร้อยแล้วครับ ✨
<story_canvas>
สายฝนโปรยปรายลงบนพื้นถนนคอนกรีต เร็นกระชับเสื้อโค้ตตัวเก่าแล้วก้าวไปข้างหน้า
แสงสีฟ้าเรืองรองขึ้นจากฝ่ามือ
</story_canvas>`;
  const splitA = StoryChatCore.splitChatAndCanvasContent(sampleAiResponseA);
  assert(splitA.hasCanvasContent === true, 'ตรวจพบ Story Canvas สำเร็จ');
  assert(splitA.chatText.includes('แต่งบทที่ 1 ให้เรียบร้อยแล้วครับ'), 'ข้อความในช่องแชทขวามีเฉพาะคำตอบรับสั้นๆ');
  assert(!splitA.chatText.includes('สายฝนโปรยปราย'), 'ข้อความในช่องแชทขวาไม่มีเนื้อหานิยายมาปน');
  assert(splitA.canvasText.startsWith('สายฝนโปรยปราย'), 'เนื้อหาหน้ากระดาษขึ้นต้นบรรทัดแรกด้วยเนื้อเรื่องทันที');

  // Case B: AI แอบใส่คำเกริ่นนำและสรุปปิดท้ายในแท็ก <story_canvas> -> ระบบต้องคลีนออกอัตโนมัติ
  const sampleAiResponseB = `ยินดีครับ จัดเตรียมเนื้อหาให้แล้ว
<story_canvas>
ยินดีต้อนรับสู่บทใหม่ นี่คือเนื้อเรื่องตามที่คุณขอ:
เร็นก้าวเข้าสู่ประตูมิติด้วยความระมัดระวัง
หวังว่าจะชอบนะครับ ต้องการให้ปรับตรงไหนบอกได้เลย
</story_canvas>`;
  const splitB = StoryChatCore.splitChatAndCanvasContent(sampleAiResponseB);
  assert(splitB.hasCanvasContent === true, 'ตรวจพบ Story Canvas ที่มีคำเกริ่นนำ');
  assert(!splitB.canvasText.includes('ยินดีต้อนรับสู่บทใหม่'), 'ตัดคำเกริ่นนำด้านหน้าของ canvas สำเร็จ');
  assert(!splitB.canvasText.includes('หวังว่าจะชอบนะครับ'), 'ตัดข้อความสรุปปิดท้ายของ canvas สำเร็จ');
  assert(splitB.canvasText === 'เร็นก้าวเข้าสู่ประตูมิติด้วยความระมัดระวัง', 'เนื้อหาที่ส่งเข้ากระดาษตรงกลางเหลือเฉพาะเนื้อเรื่องแท้จริง');

  // Case C: ผู้ใช้ชวนคุย ปรึกษาพล็อต (ไม่มีแท็ก <story_canvas>)
  const sampleAiResponseC = `พล็อตเรื่องนี้น่าสนใจมากครับ ขอแนะนำให้เพิ่มตัวละครผู้พิทักษ์เข้ามาเป็นอุปสรรค`;
  const splitC = StoryChatCore.splitChatAndCanvasContent(sampleAiResponseC);
  assert(splitC.hasCanvasContent === false, 'กรณีปรึกษาพล็อต hasCanvasContent เป็น false');
  assert(splitC.canvasText === '', 'ไม่มีเนื้อหาเข้ากระดาษ');
  assert(splitC.chatText === sampleAiResponseC, 'ข้อความแชทแสดงคำปรึกษาตามปกติ');

  // Case D: AI ส่งมาแต่แท็ก <story_canvas> ไม่มีข้อความพูดคุยด้านนอก
  const sampleAiResponseD = `<story_canvas>
ฟ้าคำรามกึกก้องเหนือยอดหอคอยโบราณ
</story_canvas>`;
  const splitD = StoryChatCore.splitChatAndCanvasContent(sampleAiResponseD);
  assert(splitD.hasCanvasContent === true, 'ตรวจพบเนื้อหา canvas');
  assert(splitD.chatText.length > 0, 'มี fallback ข้อความตอบรับสั้นๆ สำหรับช่องแชทขวา');

  // Case E: Backward compatibility กับ [STORY_START]
  const sampleLegacy = `จัดให้ครับ
[STORY_START]
เนื้อเรื่องเวอร์ชันเก่า
[STORY_END]`;
  const splitE = StoryChatCore.splitChatAndCanvasContent(sampleLegacy);
  assert(splitE.hasCanvasContent === true, 'รองรับ Backward compatibility กับ [STORY_START]');
  assert(splitE.canvasText === 'เนื้อเรื่องเวอร์ชันเก่า', 'ดึงเนื้อหาเวอร์ชันเก่าได้ถูกต้อง');

  // Case F: AI ลืมใส่แท็ก <story_canvas> แต่ผู้ใช้สั่ง "แต่งต่อจากนี้" (Smart Story Extractor)
  const sampleAiResponseF = `ด้วยกระจกเงาใสสะอาดสะท้อนภาพเหตุการณ์ในอดีต เร็นมองดูฝ่ามือตัวเองที่ยังคงสั่นเทา\n\n"ที่นี่คือมิติกระจก..." เสียงใสของหญิงสาวดังขึ้น\n\nภาพในกระจกเริ่มสั่นไหวก่อนจะฉายความทรงจำเมื่อหลายปีก่อน`;
  const splitF = StoryChatCore.splitChatAndCanvasContent(sampleAiResponseF, 'แต่งต่อจากนี้');
  assert(splitF.hasCanvasContent === true, 'Smart Extractor: ตรวจจับเนื้อเรื่องได้สำเร็จแม้ AI ลืมใส่แท็ก');
  assert(splitF.canvasText.includes('ด้วยกระจกเงาใสสะอาด'), 'ดึงเนื้อเรื่องส่งเข้า Canvas สำเร็จ');
  assert(splitF.chatText.includes('นำเนื้อเรื่องส่งลงหน้ากระดาษ'), 'ข้อความแชทแจ้งสถานะการส่งลงกระดาษเรียบร้อย');

  // Case G: คุ้มครองบทสนทนานิยายแท้จริงที่ขึ้นต้นด้วยคำพูด เช่น "สวัสดี", "ยินดี", "ข้าพเจ้า" หรือลงท้ายด้วย "หวังว่า"
  const sampleNovelWithDialogue = `<story_canvas>
"สวัสดีครับท่านแม่ทัพ" ชายหนุ่มเอ่ยทักทายพลางประสานมือคำนับ
"ยินดีที่ได้พบอีกครั้ง" แม่ทัพตอบกลับด้วยรอยยิ้ม
"ข้าหวังว่าจะได้ร่วมรบเคียงบ่าเคียงไหล่กับท่านอีก"
</story_canvas>`;
  const splitG = StoryChatCore.splitChatAndCanvasContent(sampleNovelWithDialogue);
  assert(splitG.canvasText.includes('"สวัสดีครับท่านแม่ทัพ"'), 'ไม่ลบบทสนทนาที่ขึ้นต้นด้วย "สวัสดี"');
  assert(splitG.canvasText.includes('"ยินดีที่ได้พบอีกครั้ง"'), 'ไม่ลบบทสนทนาที่ขึ้นต้นด้วย "ยินดี"');
  assert(splitG.canvasText.includes('"ข้าหวังว่าจะได้ร่วมรบเคียงบ่าเคียงไหล่กับท่านอีก"'), 'ไม่ลบบทสนทนาท้ายเรื่องที่มีคำว่า "หวังว่า"');

  // Case H: ข้อเสนอแนะหรือคำแนะนำแบบรายการ ต้องไม่ถูก Smart Extractor ดันเข้ากระดาษ
  const sampleAdvice = `ข้อเสนอแนะในการพัฒนาโครงเรื่อง:\n1. เพิ่มมิติให้ตัวร้ายมีเป้าหมายที่เข้าใจได้\n2. ขยายความสัมพันธ์ระหว่างตัวละครเอก\n3. ปรับระดับความตึงเครียดของฉากไคลแม็กซ์`;
  const splitH = StoryChatCore.splitChatAndCanvasContent(sampleAdvice, 'แต่งต่อ');
  assert(splitH.hasCanvasContent === false, 'คำแนะนำและข้อเสนอแนะโครงเรื่องต้องไม่ถูกส่งเข้าหน้ากระดาษ');
  assert(splitH.chatText === sampleAdvice, 'คำแนะนำแสดงในช่องแชทตามปกติ');

  // --- Suite 12: Regenerate & Edit Message Functions ---
  console.log('\n[Suite 12: Regenerate & Edit Message Verification]');
  
  // Test prepareRegenerateChat
  const emptyRegen = StoryChatCore.prepareRegenerateChat([]);
  assert(emptyRegen.updatedMessages.length === 0, 'กรณีแชทว่าง คืนอาเรย์ว่าง');
  assert(emptyRegen.lastUserPrompt === null, 'กรณีแชทว่าง lastUserPrompt เป็น null');

  let testChat = [
    { role: 'user', content: 'ช่วยแต่งฉากเปิดเรื่องหน่อย' },
    { role: 'ai', content: 'ท้องฟ้ายามเย็นเป็นสีเลือด...' },
  ];
  const regenResult1 = StoryChatCore.prepareRegenerateChat(testChat);
  assert(regenResult1.updatedMessages.length === 1, 'ดึงข้อความ AI ตัวล่าสุดออก เหลือ 1 ข้อความ');
  assert(regenResult1.lastUserPrompt === 'ช่วยแต่งฉากเปิดเรื่องหน่อย', 'ดึงคำสั่งเดิมของผู้ใช้มาได้ถูกต้อง');

  // Test Multiple Turns
  testChat = [
    { role: 'user', content: 'เทิร์น 1' },
    { role: 'ai', content: 'ตอบเทิร์น 1' },
    { role: 'user', content: 'เทิร์น 2 แต่งต่อ' },
    { role: 'ai', content: 'ตอบเทิร์น 2' },
  ];
  const regenResult2 = StoryChatCore.prepareRegenerateChat(testChat);
  assert(regenResult2.updatedMessages.length === 3, 'เอา AI เทิร์น 2 ออก เหลือ 3 ข้อความ');
  assert(regenResult2.lastUserPrompt === 'เทิร์น 2 แต่งต่อ', 'ชี้ไปยังคำสั่งผู้ใช้ของเทิร์น 2');

  // Test editChatMessage
  const editedChat = StoryChatCore.editChatMessage(testChat, 2, 'เทิร์น 2 เปลี่ยนใจขอเป็นแฟนตาซี');
  assert(editedChat[2].content === 'เทิร์น 2 เปลี่ยนใจขอเป็นแฟนตาซี', 'แก้ไขเนื้อหาข้อความใน index ที่ระบุได้สำเร็จ');
  assert(testChat[2].content === 'เทิร์น 2 แต่งต่อ', 'ฟังก์ชันเป็น Pure function ไม่แก้ไขต้นฉบับโดยตรง');

  const invalidEdit = StoryChatCore.editChatMessage(testChat, 99, 'ข้อความนอกขอบเขต');
  assert(invalidEdit.length === testChat.length, 'กรณี index เกินขอบเขต อาเรย์ไม่พังและมีขนาดเท่าเดิม');

  // --- Suite 13: XSS Prevention & HTML Sanitization ---
  console.log('\n[Suite 13: XSS Prevention & HTML Sanitization]');
  const rawXssScript = '<script>alert("xss")</script>';
  const escapedScript = StoryChatCore.escapeHtml(rawXssScript);
  assert(escapedScript === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;', 'escapeHtml แปลงแท็ก script และ quotes ได้อย่างปลอดภัย');

  const rawXssImg = '<img src=x onerror=alert(1)>';
  const escapedImg = StoryChatCore.escapeHtml(rawXssImg);
  assert(escapedImg === '&lt;img src=x onerror=alert(1)&gt;', 'escapeHtml แปลงแท็ก img onerror สำเร็จ');

  const formattedXss = StoryChatCore.formatAiResponseText('คำตอบ AI: <img src=x onerror=alert(1)> และ **ตัวหนา**');
  assert(!formattedXss.includes('<img'), 'formatAiResponseText ต้องไม่มีแท็ก <img> ดิบหลุดรอด');
  assert(formattedXss.includes('&lt;img src=x onerror=alert(1)&gt;'), 'formatAiResponseText ต้อง escape แท็กรูปภาพที่ไม่ปลอดภัย');
  assert(formattedXss.includes('<strong>ตัวหนา</strong>'), 'formatAiResponseText ยังแปลงมาร์กดาวน์ตัวหนาได้อย่างถูกต้อง');

  const formattedCanvas = StoryChatCore.formatAiResponseText('ข้อความ <story_canvas>เนื้อหานิยาย</story_canvas> ปิดท้าย <script>x()</script>');
  assert(formattedCanvas.includes('story-canvas-tag-badge'), 'formatAiResponseText แปลงแท็ก story_canvas เป็น badge ได้ถูกต้อง');
  assert(!formattedCanvas.includes('<script>'), 'formatAiResponseText ต้องไม่มีแท็ก script ดิบหลุดรอด');
  assert(formattedCanvas.includes('&lt;script&gt;x()&lt;/script&gt;'), 'formatAiResponseText ต้อง escape แท็ก script');

  // --- Final Summary ---
  console.log('\n========================================');
  console.log(`📊 ผลการทดสอบ: ผ่าน ${passedTests} ข้อ | ไม่ผ่าน ${failedTests} ข้อ`);
  console.log('========================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests();
