# แผนการยกระดับสถาปัตยกรรมแอปเขียนนิยาย (Novel AI Architecture Upgrade Plan)

> **สำหรับระบบปฏิบัติการ:** แผนงานนี้จัดทำตามข้อกำหนดของ `superpowers:writing-plans` เพื่อยกระดับระบบแอปนิยายจาก Hybrid สู่ Local-first & RAG เต็มรูปแบบ โดยมี Task ที่ทดสอบได้อิสระในแต่ละขั้นตอน

**เป้าหมาย:** ยกระดับแอปเขียนนิยายและแชท AI ให้มีฟีเจอร์ควบคุมสตรีม (Abort, Regenerate, Edit), ระบบคำนวณ Context Budget และ Rolling Summary, สถาปัตยกรรม Local-First แบบไม่จำกัดความจุด้วย IndexedDB (Dexie.js) + OPFS, ระบบ Leader Election ป้องกันเปิดหลายแท็บชนกัน, และระบบค้นคืนความจำระยะยาว Vector RAG (Semantic Search)

**สถาปัตยกรรม:** 
1. **Frontend Interaction:** AbortController + Interactive Message Actions (Edit/Regenerate/Pin)
2. **Context Engine:** Pure Logic Module สำหรับ Token Budgeting, Rolling Summary (Delta tracking), และ Dynamic Injection
3. **Storage Tier:** Dexie.js (IndexedDB) รองรับ Auto-migration จาก localStorage + OPFS สำหรับไฟล์สื่อ + Web Locks API สำหรับ Leader Election
4. **Memory Tier (RAG):** Backend Vector Service (Embeddings + Vector Similarity Search Top-K Chunks)

**เทคโนโลยีที่ใช้:** Vanilla JavaScript (ES6+), Express.js (Node.js), Dexie.js (IndexedDB), Web Locks API, Server-Sent Events (SSE), Vector Embeddings / Similarity Search

---

## ข้อจำกัดร่วมกันของทั้งระบบ (Global Constraints)
1. **ภาษาที่ใช้สื่อสาร:** ภาษาไทยเป็นภาษาหลักในการแสดงผล UI, ข้อความแจ้งเตือน, Log, และเอกสาร
2. **Backward Compatibility:** ข้อมูลเดิมที่อยู่ใน `localStorage` และ `Supabase` ต้องสามารถถ่ายโอน (Migrate) ไปยัง `IndexedDB` ได้ 100% โดยไม่มีข้อมูลสูญหาย
3. **UI/UX Consistency:** คุมโทนสี Dark Grey Tones / Indigo / Modern Minimal ตามที่มีอยู่ใน `style.css`
4. **Offline Capability:** ฟังก์ชันหลักของหน้าเว็บ (การเขียนกระดาษ, การเปิดเรื่อง, การแก้ไขโน้ต) ต้องทำงานแบบออฟไลน์ได้โดยสมบูรณ์

---

## จุดเน้นย้ำในการตรวจทาน (Review Focus)
1. **การกดยกเลิกสตรีม (Abort Stream):** เมื่อผู้ใช้กดปุ่ม Abort ต้องหยุดสตรีมทันที ไม่มีการค้างของ Timer และไม่ทำให้ประวัติแชทเสียหาย
2. **การกู้คืนข้อมูลเดิม (Data Migration):** เมื่อผู้ใช้เดิมเปิดเว็บ ข้อมูลจาก `localStorage` ต้องถูกอ่านและบันทึกเข้า `IndexedDB` อัตโนมัติ โดยไม่เขียนทับหรือลบข้อมูลเก่า
3. **การเปิดหลายแท็บพร้อมกัน (Multi-Tab Race Condition):** เมื่อผู้ใช้เปิด 2 แท็บพร้อมกันและพิมพ์เขียน การบันทึกต้องไม่เกิดการแย่งชิง (Data Overwrite)
4. **โทเคนล้นงบประมาณ (Context Overflow):** ระบบ Context Builder ต้องตัดแบ่งโทเคนไม่ให้เกินขีดจำกัดสูงสุดของโมเดลเสมอ
5. **การทำงานของ Vector Search เมื่อไม่มีเน็ต:** หาก Vector Server ยังไม่เปิดใช้งาน ต้องมี Fallback กลับมาใช้ Manual Lorebook Injection ตามเดิมโดยไม่พัง

---

## รายการขั้นตอนการพัฒนา (Tasks Breakdown)

### เฟสที่ 1: ระดับเร่งด่วน — ควบคุมสตรีมมิ่งและการแก้ไขแชท (Quick Wins)

#### Task 1: ระบบหยุดสตรีมมิ่ง (Abort Streaming with AbortController)
**ไฟล์ที่เกี่ยวข้อง:**
- แก้ไข: `story-chat-core.js` (เพิ่มสถานะ stream abort)
- แก้ไข: `app.js` (ผูก `AbortController` เข้ากับ `fetch` ใน `sendUserMessage` และปุ่มหยุดบน UI)
- แก้ไข: `index.html` (เพิ่มปุ่มสี่เหลี่ยมหยุดสร้างใน dock)
- แก้ไข: `style.css` (สไตล์ปุ่ม `.btn-chat-abort`)
- ทดสอบ: `test-core.js`

- [ ] **Step 1: เขียน Unit Test สำหรับฟังก์ชันตรวจจับสถานะ Abort ใน `test-core.js`**
- [ ] **Step 2: รันการทดสอบและยืนยันผล**
- [ ] **Step 3: ปรับแต่ง `app.js` ให้สร้าง `activeAbortController = new AbortController()`**
- [ ] **Step 4: ผูก Event เมื่อผู้ใช้กดปุ่มหยุด -> เรียก `activeAbortController.abort()` และเคลียร์ Timer**
- [ ] **Step 5: ตรวจสอบความถูกต้องและทดสอบสตรีมจริง**

#### Task 2: ฟังก์ชันแต่งฉากนี้ใหม่ (Regenerate) และแก้ไขข้อความ (Edit Message)
**ไฟล์ที่เกี่ยวข้อง:**
- แก้ไข: `story-chat-core.js` (ฟังก์ชัน `prepareRegenerateChat`, `updateUserMessage`)
- แก้ไข: `app.js` (เพิ่มปุ่ม Regenerate ในกล่อง AI ล่าสุด และปุ่ม Edit ในกล่อง User)
- แก้ไข: `style.css` (ปุ่มแอ็กชันเพิ่มเติมใน `.msg-actions`)
- ทดสอบ: `test-core.js`

- [ ] **Step 1: เขียน Unit Test สำหรับ `prepareRegenerateChat` และ `updateUserMessage`**
- [ ] **Step 2: รันการทดสอบและยืนยันผล**
- [ ] **Step 3: เพิ่มปุ่ม 🔄 "สร้างใหม่" ในกล่องข้อความ AI ล่าสุด**
- [ ] **Step 4: เพิ่มปุ่ม ✏️ "แก้ไข" ในข้อความของผู้ใช้ เพื่อโหลดข้อความกลับมาที่ Input หรือแก้ไขทันที**
- [ ] **Step 5: ทดสอบการทำงานของปุ่มทั้งสอง**

---

### เฟสที่ 2: ระดับกลาง — บริหารจัดการ Context & Token และสรุปความจำสะสม

#### Task 3: ระบบคำนวณ Token Budget (Context Budgeting Engine)
**ไฟล์ที่เกี่ยวข้อง:**
- แก้ไข: `story-chat-core.js` (เพิ่มโมดูล `TokenEstimator` และ `ContextBudgetPlanner`)
- ทดสอบ: `test-core.js`

- [ ] **Step 1: เขียน Unit Test สำหรับการคำนวณ Token ของข้อความภาษาไทย/อังกฤษ**
- [ ] **Step 2: เขียนฟังก์ชันจัดสรรงบประมาณโทเคน (System: 15%, Lorebook: 25%, History: 20%, Canvas: 20%, Output: 20%)**
- [ ] **Step 3: รันการทดสอบ Unit Test ให้ผ่าน 100%**
- [ ] **Step 4: เชื่อมโยง `ContextBudgetPlanner` เข้ากับ `buildStoryContextPrompt`**

#### Task 4: กลไกปักหมุดข้อความสำคัญ (Pin Messages) & ระบบ Rolling Summary (Memory Delta)
**ไฟล์ที่เกี่ยวข้อง:**
- แก้ไข: `story-chat-core.js` (เพิ่มฟิลด์ `isPinned` ในข้อความ, ฟังก์ชัน `generateRollingSummaryPrompt`, `mergeMemoryDelta`)
- แก้ไข: `app.js` (ปุ่มปักหมุด 📌 บนข้อความแชท)
- แก้ไข: `style.css` (สไตล์ข้อความที่ถูกปักหมุด `.msg-pinned`)
- ทดสอบ: `test-core.js`

- [ ] **Step 1: เขียน Unit Test สำหรับกลไก Pin ข้อความ (ข้อความที่ปักหมุดจะไม่ถูกตัดทิ้ง)**
- [ ] **Step 2: เขียนฟังก์ชันสร้างโครง Prompt สำหรับ Rolling Summary เมื่อประวัติแชทยาวเกินเกณฑ์**
- [ ] **Step 3: รันการทดสอบและยืนยันผล**
- [ ] **Step 4: เพิ่มปุ่ม Pin ใน UI ช่องแชท**

---

### เฟสที่ 3: ระดับสูง — สถาปัตยกรรม Local-First แท้จริง และ Vector RAG

#### Task 5: ย้ายระบบจัดเก็บข้อมูลสู่ IndexedDB (Dexie.js) + OPFS
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `src/db/local-db.js` (Dexie Schema: `stories`, `chat_history`, `media_refs`, `settings`)
- แก้ไข: `index.html` (โหลด Dexie.js ผ่าน CDN / Local vendor)
- แก้ไข: `app.js` (เปลี่ยนจากการเรียก `localStorage` เป็นการเรียกผ่าน `LocalDB`)
- ทดสอบ: `test/local-db.test.js`

- [ ] **Step 1: เขียนโครงสร้าง Schema ของ Dexie.js พร้อมระบบ Data Migration จาก `localStorage`**
- [ ] **Step 2: เขียน Unit Test ตรวจสอบว่าข้อมูลเดิมจาก `localStorage` ถูกย้ายเข้า `IndexedDB` ครบถ้วน**
- [ ] **Step 3: รองรับ OPFS (Origin Private File System) สำหรับจัดเก็บภาพปกและไฟล์แนบ**
- [ ] **Step 4: ทดสอบการบันทึกและอ่านข้อมูลนิยายขนาดยาว**

#### Task 6: ระบบ Leader Election (Multi-Tab Protection)
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `src/sync/tab-coordinator.js` (ใช้ Web Locks API: `navigator.locks` และ `BroadcastChannel`)
- แก้ไข: `app.js` (ผูก TabCoordinator เข้ากับการบันทึก Auto-save)
- ทดสอบ: `test/tab-coordinator.test.js`

- [ ] **Step 1: เขียนตัวจัดการ Leader Election สำหรับเลือกแท็บหลัก (Leader Tab)**
- [ ] **Step 2: เขียนระบบ BroadcastChannel เพื่อส่งสัญญาณเตือนแท็บอื่นเมื่อมีการแก้ไขข้อมูล**
- [ ] **Step 3: ทดสอบการจำลองเปิด 2 แท็บพร้อมกันและตรวจสอบการป้องกัน Data Race**

#### Task 7: ระบบค้นคืนความจำระยะยาว Vector RAG (Semantic Chunks Retrieval)
**ไฟล์ที่เกี่ยวข้อง:**
- สร้าง: `backend/src/ai/embedding-service.js` (เชื่อมต่อโมเดล Embedding เช่น `text-embedding-bge-m3` หรือ Gemini Embedding)
- สร้าง: `backend/src/ai/vector-store.js` (จัดเก็บเวกเตอร์ในเครื่องด้วย `sqlite-vec` หรือ In-memory HNSW / Qdrant)
- แก้ไข: `backend/src/routes/chat-routes.js` (ดึง Top-K Chunks ก่อนส่งเข้า LLM)
- แก้ไข: `story-chat-core.js` (นำ Top-K Chunks ประกอบเข้า Context)
- ทดสอบ: `backend/test/vector-rag.test.js`

- [ ] **Step 1: เขียนบริการตัดแบ่งเนื้อหาเป็น Chunks (Text Chunking 500-1000 characters with overlap)**
- [ ] **Step 2: เขียนฟังก์ชันคำนวณ Cosine Similarity เพื่อดึง Top-K Chunks ที่เกี่ยวข้องกับคำสั่งล่าสุด**
- [ ] **Step 3: ทดสอบการทำงานของ Vector Search และตรวจสอบคะแนนความคล้ายคลึง**
- [ ] **Step 4: เชื่อมโยงเข้ากับท่อสตรีมมิ่งเพื่อส่งต่อให้ AI แต่งเรื่องได้อย่างแม่นยำ**

---

## แผนการส่งมอบงาน (Execution Strategy)
เราจะดำเนินการตามลำดับขั้นความสำคัญดังนี้:
1. **รอบที่ 1 (ทันที):** Task 1 + Task 2 (Quick Wins: Abort, Regenerate, Edit)
2. **รอบที่ 2:** Task 3 + Task 4 (Context Budgeting, Pinning & Rolling Summary)
3. **รอบที่ 3:** Task 5 + Task 6 (Dexie.js IndexedDB, OPFS & Leader Election)
4. **รอบที่ 4:** Task 7 (Vector RAG & Semantic Memory)
