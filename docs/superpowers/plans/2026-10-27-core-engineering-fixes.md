# แผนงานแก้ไขปัญหาเชิงวิศวกรรม Core Engineering (ข้อ 1 - 4)

> **สำหรับผู้ปฏิบัติงาน (Agentic Workers):** ทักษะย่อยที่จำเป็น: ใช้ superpowers:subagent-driven-development (แนะนำ) หรือ superpowers:executing-plans เพื่อปฏิบัติตามแผนงานทีละงาน โดยใช้เครื่องหมายถูก (`- [ ]`) ในการติดตามความคืบหน้า

**เป้าหมาย:** แก้ไขช่องโหว่ความปลอดภัย XSS, ความปลอดภัยและความโปร่งใสของ API Key, ความเสถียรของตัวอ่านสตรีม SSE, และการแยกเนื้อเรื่องออกจากข้อความแชทอย่างปลอดภัยโดยไม่ตัดบทสนทนาหรือเนื้อหานิยายทิ้ง

**สถาปัตยกรรม:** แยกหน้าที่ความปลอดภัยและกระบวนการจัดการข้อมูลระหว่าง `story-chat-core.js` (Core Domain Logic & Data Transformers), `app.js` (Frontend Presentation & Stream Consumer), และ `backend/src/` (SSE Stream Producer). ปรับฟังก์ชันการเรนเดอร์ให้ sanitize ข้อมูลนำเข้าด้วย `escapeHtml` ก่อนแปลงมาร์กดาวน์, สตรีม API Key ผ่าน Header `x-goog-api-key` แทน Query Parameter, จัดการ Buffer ของ SSE ตามข้อกำหนด Event Stream (`\n\n`), และให้ Backend ส่งผลลัพธ์แบบ Structured Chat/Canvas ในอีเวนต์ `done`

**เทคโนโลยีที่ใช้:** JavaScript (ES6+), Node.js, Express, Server-Sent Events (SSE), Google Gemini REST API

**เอกสารอ้างอิง:** [README.md](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/README.md), [app.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/app.js), [story-chat-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/story-chat-core.js)

## ข้อจำกัดระดับส่วนรวม (Global Constraints)

- ระบบต้องรันผ่านการทดสอบทั้งหมด `npm test` ได้ 100% โดยไม่ทำให้ Unit Test เดิมพัง (Backward Compatibility)
- ต้องไม่ทำลายโครงสร้างของ Story Canvas (`<story_canvas>...</story_canvas>`) และแท็กเดิม `[STORY_START]...[STORY_END]`
- ข้อความภาษาไทยและวรรณศิลป์ต้องคงอยู่อย่างครบถ้วน ไม่ถูกตัดทอนคำผิดเป้าหมาย
- เอกสาร โค้ดคอมเมนต์ และข้อความทั้งหมดต้องคงรูปแบบภาษาไทยที่ถูกต้อง

## จุดโฟกัสการตรวจสอบ (Review Focus)

1. ข้อความ AI ที่มี `<img src=x onerror=alert(1)>` หรือ `<script>` ต้องไม่ถูกรันเป็นโค้ดในเบราว์เซอร์ แต่แท็ก `<story_canvas>` และตัวหนา `**ข้อความ**` ต้องยังแสดงผลสวยงามได้ตามปกติ
2. ชื่อเรื่องนิยายที่มีอักขระพิเศษ เช่น `<script>` หรือเครื่องหมายคำพูด เมื่อส่งออกเป็นไฟล์ HTML ต้องไม่เกิดช่องโหว่ XSS ในไฟล์ที่ดาวน์โหลด
3. การเรียก Gemini API Direct ในโหมด Fallback ต้องไม่ส่ง API Key ไปทาง Query String (`?key=...`) ซึ่งเสี่ยงหลุดใน Network Logs
4. ก้อนข้อมูล SSE ที่ถูกหั่นครึ่งข้ามเครือข่าย ต้องไม่ถูกแปลงเป็น JSON ผิดพลาด หรือส่งเหตุการณ์ซ้ำซ้อน
5. บรรทัดบทสนทนานิยายที่ขึ้นต้นด้วย "สวัสดี", "ยินดี", "ข้าพเจ้า" หรือลงท้ายด้วย "หวังว่าจะ..." ต้องไม่ถูกระบบฟิลเตอร์ลบทิ้งออกจากหน้ากระดาษ

---

### งานที่ 1: แก้ไขช่องโหว่ XSS ใน formatAiResponseText, ข้อความหยุดการสร้าง และการส่งออก HTML

**ไฟล์:**
- แก้ไข: [story-chat-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/story-chat-core.js)
- แก้ไข: [app.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/app.js)
- ทดสอบ: [test-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/test-core.js)

**อินเทอร์เฟซ:**
- ให้บริการ: `StoryChatCore.escapeHtml(text)` คืนค่า string ที่ escape อักขระ `&`, `<`, `>`, `"`, `'`
- ให้บริการ: `StoryChatCore.formatAiResponseText(text)` แปลงข้อความอย่างปลอดภัยโดย escape HTML ก่อนเสมอ
- ใช้งานใน `app.js`: ใช้ `StoryChatCore.formatAiResponseText` หรือฟังก์ชัน local ที่ escape อย่างถูกต้อง
- ส่งออกไฟล์: `escapeHtml(title)` ใน `<title>` และ `<h1>` ของการส่งออก HTML

- [x] **ขั้นตอนที่ 1: เขียนแบบทดสอบดักจับ XSS ใน `test-core.js`**
  - เพิ่ม Suite 13 สำหรับทดสอบ `escapeHtml` และ `formatAiResponseText`
  - ตรวจสอบว่า `<img src=x onerror=alert(1)>` ถูกเปลี่ยนเป็น `&lt;img src=x onerror=alert(1)&gt;`
  - ตรวจสอบว่าแท็ก `<story_canvas>เนื้อเรื่อง</story_canvas>` ยังคงถูกแทนที่ด้วย badge class ได้ถูกต้อง
  - ตรวจสอบว่า `**ตัวหนา**` และ `*ตัวเอียง*` แสดงเป็น `<strong>` และ `<em>` ได้อย่างปลอดภัย

- [x] **ขั้นตอนที่ 2: รันการทดสอบเพื่อยืนยันว่าการทดสอบตรวจพบจุดบกพร่อง**
  - คำสั่ง: `node test-core.js`
  - ผลลัพธ์ที่คาดหวัง: FAIL หรือ `StoryChatCore.escapeHtml is not a function`

- [x] **ขั้นตอนที่ 3: พัฒนา `escapeHtml` และปรับปรุง `formatAiResponseText` ใน `story-chat-core.js` และ `app.js`**
  - เพิ่ม `escapeHtml` ใน `story-chat-core.js` และ export ออกมา
  - ปรับปรุง `formatAiResponseText` ให้ escape ก่อน แล้วจึง regex แทนที่ `<story_canvas>`, Markdown, และขึ้นบรรทัดใหม่
  - ปรับปรุงจุดบันทึกข้อความ "หยุดการสร้างแล้ว" (app.js บรรทัด ~1810) ให้เป็นสถานะหรือข้อความ clean ที่ปลอดภัย ไม่ยัดแท็ก `<span style="...">` ลงใน content ดิบ
  - ปรับปรุง `btnExportHtml` ให้ใช้ `escapeHtml(getCurrentDocTitle())` ใน `<title>` และ `<h1>` พร้อม sanitize ชื่อไฟล์

- [x] **ขั้นตอนที่ 4: รันการทดสอบและยืนยันผล**
  - คำสั่ง: `node test-core.js`
  - ผลลัพธ์ที่คาดหวัง: PASS ทุกการทดสอบ

---

### งานที่ 2: ปรับปรุงความปลอดภัยและความโปร่งใสของ API Key

**ไฟล์:**
- แก้ไข: [app.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/app.js)
- แก้ไข: [index.html](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/index.html)
- แก้ไข: [README.md](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/README.md)

**อินเทอร์เฟซ:**
- `callGeminiApi(prompt)`: เรียก endpoint `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent` โดยแนบ Header `x-goog-api-key: state.apiKey` แทน URL Query

- [x] **ขั้นตอนที่ 1: เขียนแบบทดสอบหรือตรวจสอบการทำงานของ Header ใน `callGeminiApi`**
  - ตรวจสอบ URL template ว่าไม่มีการใส่ `?key=${state.apiKey}` ใน query parameter อีกต่อไป
  - ตรวจสอบว่า Headers มีการส่ง `x-goog-api-key`

- [x] **ขั้นตอนที่ 2: ปรับปรุงโค้ดใน `app.js`**
  - แก้ไข `callGeminiApi` ใน `app.js`: ลบ `?key=...` ออกจาก URL และเพิ่ม `'x-goog-api-key': state.apiKey` ใน options.headers

- [x] **ขั้นตอนที่ 3: แก้ไขข้อความใน `index.html` และ `README.md` ให้สอดคล้องกับความเป็นจริง**
  - ใน `index.html` (modal-settings): เปลี่ยนข้อความแจ้งเตือนเป็น "คีย์จะถูกจัดเก็บในเครื่องของคุณ (Local Storage) และส่งตรงไปยัง Google Gemini API / Backend Proxy ผ่านช่องทางเข้ารหัส (HTTPS) เพื่อประมวลผลการสร้างเนื้อเรื่องเท่านั้น ไม่มีการบันทึกลงฐานข้อมูลส่วนกลาง"
  - ใน `README.md`: อธิบายชัดเจนถึง 2 รูปแบบ คือ (1) Server Proxy Mode ที่ใช้คีย์จาก `.env` ฝั่ง Backend และ (2) BYOK (Bring Your Own Key) ที่ผู้ใช้กรอกผ่านหน้าต่างการตั้งค่า

---

### งานที่ 3: ปรับปรุง SSE Parser ให้จัดการ Buffer แบบ Block (`\n\n`) และแจ้งเตือนข้อผิดพลาดเมื่อสตรีมถูกตัด

**ไฟล์:**
- แก้ไข: [story-chat-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/story-chat-core.js)
- แก้ไข: [app.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/app.js)
- ทดสอบ: [test-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/test-core.js)

**อินเทอร์เฟซ:**
- `StoryChatCore.parseSseBlocks(buffer)`: รับ buffer สตริง คืนค่า `{ events: Array, remainingBuffer: String }` โดยจะดึงเฉพาะอีเวนต์ที่จบด้วย `\n\n` ออกมาแปลง และเก็บเศษที่ยังไม่สมบูรณ์ไว้ใน `remainingBuffer`

- [x] **ขั้นตอนที่ 1: เขียนแบบทดสอบกรณี Buffer ไม่สมบูรณ์และกรณีขาดเครื่องหมาย `\n\n` ท้ายก้อน**
  - เพิ่มเคสทดสอบใน `test-core.js`: ส่งก้อน SSE ที่ถูกตัดครึ่งกลางข้อความ JSON `data: {"chun`
  - ยืนยันว่าฟังก์ชันไม่พยายาม parse เศษ JSON ที่ไม่สมบูรณ์ และเก็บเศษนั้นไว้ประมวลผลต่อเมื่อก้อนถัดไปมาถึง

- [x] **ขั้นตอนที่ 2: รันการทดสอบเพื่อยืนยันว่าการทดสอบล้มเหลว**
  - คำสั่ง: `node test-core.js`
  - ผลลัพธ์: FAIL ตามที่คาดหวัง

- [x] **ขั้นตอนที่ 3: พัฒนา `parseSseBlocks` ใน `story-chat-core.js` และปรับการอ่านใน `app.js`**
  - ใน `story-chat-core.js`: เพิ่ม `parseSseBlocks(buffer)` ที่หาตำแหน่ง `\n\n` สุดท้าย แล้วตัดเฉพาะก้อนสมบูรณ์มา parse
  - ใน `app.js`: ปรับลูป SSE ให้ประมวลผลเฉพาะก้อนอีเวนต์ที่สมบูรณ์
  - ใน `app.js`: ตรวจสอบสถานะเมื่อลูปสตรีมจบ หาก `!streamedSuccessfully` และไม่ได้มาจากการกด Abort ให้โยน Error "การเชื่อมต่อสตรีมถูกตัดก่อนเสร็จสิ้น" เพื่อให้ระบบแจ้งเตือนหรือเข้าสู่ Fallback แทนการปล่อยให้แชทค้างแบบข้อความขาดตอน

- [x] **ขั้นตอนที่ 4: รันการทดสอบและยืนยันผล**
  - คำสั่ง: `node test-core.js && npm test`
  - ผลลัพธ์: PASS ทั้งหมด

---

### งานที่ 4: ปรับปรุงการตัดคำนำหน้าของ cleanCanvasNovelContent และเพิ่ม Structured Output สำหรับ Chat/Canvas

**ไฟล์:**
- แก้ไข: [story-chat-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/story-chat-core.js)
- แก้ไข: [backend/src/routes/chat-routes.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/backend/src/routes/chat-routes.js)
- แก้ไข: [app.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/app.js)
- ทดสอบ: [test-core.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/test-core.js)
- ทดสอบ: [backend/test/server-e2e.test.js](file:///c:/Users/ADVANCE%20PC/Desktop/%E0%B9%81%E0%B8%AD%E0%B8%9B%E0%B9%81%E0%B8%8A%E0%B8%97%20%E0%B8%99%E0%B8%B4%E0%B8%A2%E0%B8%B2%E0%B8%A2/backend/test/server-e2e.test.js)

**อินเทอร์เฟซ:**
- `cleanCanvasNovelContent(text)`: ไม่ลบบรรทัดบทสนทนา (เครื่องหมายคำพูด `"`, `'`, `“`, `「`, `‘`, ขีดคำพูด `—`, `-`) และตรวจจับเฉพาะ meta chatter ที่คุยกับผู้ใช้
- Backend SSE `done` event: ส่ง `{ id, role, thinking_logs, story_output, chat_text, canvas_text, has_canvas, storage, timestamp }`

- [x] **ขั้นตอนที่ 1: เขียนแบบทดสอบคุ้มครองบทสนทนานิยายใน `test-core.js`**
  - เคส 1: บทสนทนาเปิดเรื่อง `"สวัสดีครับท่านแม่ทัพ" ชายหนุ่มเอ่ย...` ต้องไม่ถูกลบ
  - เคส 2: บทบรรยาย `"นี่คือสิ่งที่เจ้าตามหา..."` หรือ `"ยินดีที่ได้พบ..."` ต้องไม่ถูกลบ
  - เคส 3: ท้ายตอนที่มีบทสนทนา `"ข้าหวังว่าจะได้พบเจ้าอีก"` ต้องไม่ถูกลบ
  - เคส 4: Meta-commentary คุยกับนักเขียน เช่น `ยินดีต้อนรับสู่บทใหม่ นี่คือเนื้อเรื่องตามที่คุณขอ:` หรือ `หวังว่าจะชอบนะครับ ต้องการให้ปรับตรงไหนบอกได้เลย` ต้องยังถูกคลีนออกได้อย่างถูกต้อง

- [x] **ขั้นตอนที่ 2: รันการทดสอบเพื่อยืนยันจุดบกพร่อง**
  - คำสั่ง: `node test-core.js`
  - ผลลัพธ์: FAIL เนื่องจากโค้ดปัจจุบันลบบทสนทนาออก

- [x] **ขั้นตอนที่ 3: ปรับปรุง `cleanCanvasNovelContent` และ Smart Extractor ใน `story-chat-core.js`**
  - ตรวจสอบก่อนว่าบรรทัดขึ้นต้นด้วยเครื่องหมายคำพูดหรือขีดสนทนาหรือไม่ หากใช่ให้ข้ามการลบ
  - ปรับปรุงการตรวจสอบข้อความท้ายบรรทัด ไม่ใช้ `includes("หวังว่า")` แบบครอบจักรวาล ให้ใช้ regex เฉพาะเจาะจงกับคำพูดผู้ช่วย AI เช่น `/(หวังว่าคุณจะชอบ|หวังว่าจะถูกใจ|ต้องการให้(ผม|ฉัน|ดิฉัน|ข้าพเจ้า|AI)ช่วย|หากต้องการให้ปรับ|ชอบหรือไม่ครับ|ชอบหรือไม่คะ)/`
  - ปรับ Smart Extractor ให้ตรวจจับข้อความแนะนำ/หัวข้อโครงเรื่อง หากเป็นคำแนะนำจะไม่นำเข้า Canvas

- [x] **ขั้นตอนที่ 4: อัปเกรด Backend ให้ส่ง Structured Output ใน SSE `done` Event**
  - ใน `backend/src/routes/chat-routes.js`: คำนวณ `split = StoryChatCore.splitChatAndCanvasContent(finalResult.story_output, prompt)` แล้วส่ง `chat_text`, `canvas_text`, `has_canvas` ไปใน `sendSse('done', ...)`
  - ใน `app.js`: เมื่อได้รับ `event === 'done'` ให้นำ `data.chat_text` และ `data.canvas_text` ไปใช้งานโดยตรง ลดการเดาซ้ำซ้อน

- [x] **ขั้นตอนที่ 5: รันการทดสอบทั้งหมดของทั้งโปรเจกต์**
  - คำสั่ง: `npm test`
  - ผลลัพธ์: PASS 100% ทั้ง Core Unit Tests, Stream Parser Tests, Supabase DB Tests, และ E2E Server Tests
