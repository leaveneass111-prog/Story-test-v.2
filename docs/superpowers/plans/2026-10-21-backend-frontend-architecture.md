# แผนการปรับปรุงสถาปัตยกรรมแยก Frontend-Backend และระบบ Real-time Thinking Stream

> **สำหรับ Agentic Workers:** สกิลที่จำเป็น: ใช้ `superpowers:subagent-driven-development` หรือ `superpowers:executing-plans` ในการดำเนินงานตามแผนนี้ทีละงาน ทุกขั้นตอนใช้รูปแบบ Checkbox (`- [ ]`) ในการติดตาม

**เป้าหมาย:** แยกสถาปัตยกรรมแอปนิยายออกเป็น Frontend (หน้าบ้าน) และ Backend (หลังบ้านด้วย Node.js) เชื่อมต่อ Supabase สำหรับเก็บประวัติการแชทในตาราง `chat_history` พร้อมฟังก์ชันสตรีมมิ่งที่คัดแยกขั้นตอนความคิด `<thinking>...</thinking>` ส่งไปอัปเดตกล่องสีเทาเข้มแบบเรียลไทม์ และพ่นเนื้อหานิยายลงกล่องแชทหลัก

**สถาปัตยกรรม:** 
- **Backend:** Node.js (Express), SSE (Server-Sent Events) สำหรับส่งข้อมูลแยก Channel (`thinking` vs `story`), Supabase Client (`@supabase/supabase-js`) สำหรับ CRUD ตาราง `chat_history`, และโมดูล AI สำหรับ Gemini / OpenRouter
- **Frontend:** Vanilla JS / HTML / CSS โดยปรับปรุง `story-chat-core.js` และ `app.js` ให้อ่าน SSE Stream ผ่าน Fetch ReadableStream และอัปเดตกล่องคิด (Dark Grey Tone `.thought-line`) และกล่องข้อความหลัก (`.msg-bubble`)

**Tech Stack:** Node.js v24, Express, @supabase/supabase-js, dotenv, cors, Vanilla JS, CSS3, SSE (Server-Sent Events)

**Spec / Blueprint:** [docs/ARCHITECTURE.md](file:///c:/Users/ADVANCE%20PC/Desktop/แอปแชท%20นิยาย/docs/ARCHITECTURE.md)

---

## ข้อกำหนดทั่วไป (Global Constraints)
1. ภาษาที่ใช้ในการสื่อสาร เอกสาร และการบันทึกผลการทดสอบต้องเป็น "ภาษาไทย"
2. API Key และ Service Role Key ต้องไม่ถูกส่งออกไปให้ฝั่งเบราว์เซอร์รับรู้ ให้เก็บรักษาไว้ในไฟล์ `backend/.env`
3. ต้องรองรับการดักจับความคิดทั้งแบบแท็ก `<thinking>...</thinking>` และแบบ Native Thought ของ Gemini
4. หากระบบฐานข้อมูลยังไม่พร้อมใช้งาน (เช่น ตารางยังไม่ได้สร้างใน Supabase) ระบบหลังบ้านต้องมี Local Fallback เพื่อไม่ให้เซิร์ฟเวอร์หยุดทำงานหรือขัดจังหวะการเขียนของผู้ใช้

---

## รายการงานย่อย (Tasks)

### Task 1: สร้างโปรเจกต์ Backend และโครงสร้าง Environment
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `backend/package.json`
- สร้าง: `backend/.env`
- สร้าง: `backend/.env.example`
- สร้าง: `backend/src/config.js`

- [ ] **Step 1.1:** สร้างไฟล์ `backend/package.json` กำหนด dependencies (express, @supabase/supabase-js, dotenv, cors)
- [ ] **Step 1.2:** ติดตั้ง dependencies ผ่าน `npm install` ในไดเรกทอรี `backend`
- [ ] **Step 1.3:** สร้างไฟล์ `backend/.env` บันทึกค่า SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY และพอร์ตเซิร์ฟเวอร์ (3001)
- [ ] **Step 1.4:** สร้างไฟล์ `backend/src/config.js` สำหรับโหลดและตรวจสอบค่า Configuration

---

### Task 2: วางระบบฐานข้อมูล Supabase (`chat_history`)
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `backend/src/db/schema.sql`
- สร้าง: `backend/src/db/supabase.js`
- สร้าง: `backend/test/supabase-db.test.js`

- [ ] **Step 2.1:** เขียนคำสั่ง DDL สร้างตาราง `chat_history` พร้อมฟิลด์ `id`, `story_id`, `role`, `user_message`, `thinking_logs`, `story_output`, `created_at` ใน `backend/src/db/schema.sql`
- [ ] **Step 2.2:** สร้างโมดูล `backend/src/db/supabase.js` มีฟังก์ชัน `saveChatMessage`, `getChatHistoryByStoryId`, `deleteChatMessage`, `clearStoryChatHistory`
- [ ] **Step 2.3:** เขียน Unit Test `backend/test/supabase-db.test.js` เพื่อทดสอบการบันทึกและดึงข้อมูล

---

### Task 3: ระบบ Thinking Process Streaming Parser และ AI Engine
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `backend/src/ai/stream-parser.js`
- สร้าง: `backend/src/ai/gemini-service.js`
- สร้าง: `backend/src/ai/openrouter-service.js`
- สร้าง: `backend/test/stream-parser.test.js`

- [ ] **Step 3.1:** สร้างโมดูล Pure Logic `backend/src/ai/stream-parser.js` สำหรับตัดแยก `<thinking>...</thinking>` ออกจากเนื้อหานิยายปกติ รองรับการตัดข้าม Chunk
- [ ] **Step 3.2:** เขียน Unit Test `backend/test/stream-parser.test.js` ครอบคลุมเคส Chunk ปกติ, Chunk ผ่ากลางแท็ก `<thin` `king>`, และ Native Thoughts
- [ ] **Step 3.3:** สร้างโมดูลเชื่อมต่อ AI สตรีมมิ่ง `gemini-service.js` และ `openrouter-service.js`

---

### Task 4: พัฒนา Express Server & SSE Streaming Endpoints
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `backend/src/routes/chat-routes.js`
- สร้าง: `backend/src/server.js`

- [ ] **Step 4.1:** สร้าง Endpoint `POST /api/chat/stream` ส่งสัญญาณ Server-Sent Events (SSE) แยกอีเวนต์ `event: thinking`, `event: story`, `event: done`, `event: error`
- [ ] **Step 4.2:** สร้าง Endpoint `GET /api/chat/history`, `DELETE /api/chat/history/:id`, `DELETE /api/chat/history/story/:story_id`
- [ ] **Step 4.3:** ประกอบร่าง Express Server ใน `backend/src/server.js` พร้อมระบบ CORS และ Health Check
- [ ] **Step 4.4:** รันเซิร์ฟเวอร์และทดสอบเรียกดูสถานะ `/api/health`

---

### Task 5: ปรับปรุง Frontend UI & Core Module เชื่อมต่อ SSE Stream
**ไฟล์ที่เกี่ยวข้อง:**
- ปรับปรุง: `story-chat-core.js`
- ปรับปรุง: `app.js`
- ปรับปรุง: `test-core.js`

- [ ] **Step 5.1:** ขยายฟังก์ชันใน `story-chat-core.js` ให้มีเครื่องมือช่วยจัดการสตรีมมิ่ง และรัน `node test-core.js` เพื่อตรวจสอบความถูกต้อง
- [ ] **Step 5.2:** ปรับปรุงฟังก์ชัน `sendUserMessage` ใน `app.js` ให้เชื่อมต่อไปยัง `http://localhost:3001/api/chat/stream` แบบ SSE Stream
- [ ] **Step 5.3:** เชื่อมโยงอีเวนต์ `thinking` ให้อัปเดตกล่องสีเทาเข้ม (`.thought-line`) และไทม์เมอร์แบบเรียลไทม์
- [ ] **Step 5.4:** เชื่อมโยงอีเวนต์ `story` ให้พ่นข้อความลง `.msg-bubble` กล่องแชทหลักทีละตัวอักษร
- [ ] **Step 5.5:** เมื่อสตรีมเสร็จ (`event: done`) ให้พับกล่องคิด สรุปเวลา และแสดงปุ่ม "+ แทรกลงในนิยาย" ทันที

---

### Task 6: การตรวจสอบความสมบูรณ์แบบ End-to-End และเอกสารสรุปผล
- [ ] **Step 6.1:** รัน Unit Test ทั้งหมดทั้งฝั่งหน้าบ้านและหลังบ้าน
- [ ] **Step 6.2:** ทดสอบการยิงสตรีมมิ่งจริงและตรวจสอบความถูกต้องของการแยก Thought Logs และ Story Output
- [ ] **Step 6.3:** จัดทำคู่มือและรายงานสรุปผลการเปลี่ยนผ่านสถาปัตยกรรม (Walkthrough)
