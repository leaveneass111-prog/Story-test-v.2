/**
 * backend/src/ai/stream-parser.js
 * ตัวแยกสตรีมความคิด (Thinking Process Stream Parser)
 * 
 * หน้าที่:
 * 1. ดักจับข้อความระหว่างแท็ก <thinking>...</thinking> หรือ <think>...</think>
 * 2. รองรับแท็กที่ถูกหั่นครึ่งข้าม Chunk (เช่น Chunk A จบด้วย "<thin", Chunk B ขึ้นต้นด้วย "king>")
 * 3. รองรับ Native Thought Parts (เช่น flag isThought จาก Gemini หรือ reasoning_content จาก OpenRouter)
 * 4. แยกส่งผ่าน Callback: onThinking(chunk) และ onStory(chunk) แบบเรียลไทม์
 */

class StreamParser {
  constructor({ onThinking = () => {}, onStory = () => {} } = {}) {
    this.onThinking = onThinking;
    this.onStory = onStory;

    this.isInsideThinking = false;
    this.buffer = ''; // เก็บข้อความที่อาจเป็นส่วนหนึ่งของแท็ก <...>
    this.accumulatedThinking = '';
    this.accumulatedStory = '';

    // รายการแท็กที่รองรับ
    this.openTags = ['<thinking>', '<think>', '[THOUGHT_START]'];
    this.closeTags = ['</thinking>', '</think>', '[THOUGHT_END]'];
  }

  /**
   * ป้อนข้อความ chunk ใหม่เข้ามาในตัวแยก
   * @param {string} rawChunk - ข้อความที่ได้รับจากสตรีม
   * @param {boolean} isNativeThought - ระบุว่าเป็นข้อความความคิดจาก Provider โดยตรงหรือไม่ (เช่น Gemini part.thought)
   */
  feed(rawChunk, isNativeThought = false) {
    if (!rawChunk) return;

    // ถ้า Provider ระบุชัดเจนว่าเป็น Native Thought ให้ส่งเข้า thinking โดยตรง
    if (isNativeThought) {
      this.accumulatedThinking += rawChunk;
      this.onThinking(rawChunk);
      return;
    }

    let text = this.buffer + rawChunk;
    this.buffer = '';

    while (text.length > 0) {
      if (!this.isInsideThinking) {
        // กำลังมองหาแท็กเปิด (เช่น <thinking>)
        let closestOpenTag = null;
        let lowestOpenIdx = -1;

        for (const tag of this.openTags) {
          const idx = text.toLowerCase().indexOf(tag.toLowerCase());
          if (idx !== -1 && (lowestOpenIdx === -1 || idx < lowestOpenIdx)) {
            lowestOpenIdx = idx;
            closestOpenTag = tag;
          }
        }

        if (lowestOpenIdx !== -1) {
          // มีข้อความเนื้อเรื่องอยู่ก่อนแท็กเปิด
          if (lowestOpenIdx > 0) {
            const storyPart = text.slice(0, lowestOpenIdx);
            this.accumulatedStory += storyPart;
            this.onStory(storyPart);
          }

          // สลับสถานะเข้าสู่โหมดคิด
          this.isInsideThinking = true;
          text = text.slice(lowestOpenIdx + closestOpenTag.length);
        } else {
          // ไม่พบแท็กเปิดสมบูรณ์ แต่ตรวจสอบว่าท้ายสตริงมี prefix ของแท็กที่ถูกหั่นครึ่งหรือไม่ (เช่น "<thin")
          const possiblePrefixIdx = this._findPossibleTagPrefix(text, this.openTags);
          if (possiblePrefixIdx !== -1) {
            const safeStory = text.slice(0, possiblePrefixIdx);
            if (safeStory) {
              this.accumulatedStory += safeStory;
              this.onStory(safeStory);
            }
            this.buffer = text.slice(possiblePrefixIdx);
            text = '';
          } else {
            // ไม่มีแท็กใดๆ ทั้งสิ้น ข้อความทั้งหมดคือเนื้อเรื่อง
            this.accumulatedStory += text;
            this.onStory(text);
            text = '';
          }
        }
      } else {
        // อยู่ในโหมดคิด (isInsideThinking === true) -> กำลังมองหาแท็กปิด (เช่น </thinking>)
        let closestCloseTag = null;
        let lowestCloseIdx = -1;

        for (const tag of this.closeTags) {
          const idx = text.toLowerCase().indexOf(tag.toLowerCase());
          if (idx !== -1 && (lowestCloseIdx === -1 || idx < lowestCloseIdx)) {
            lowestCloseIdx = idx;
            closestCloseTag = tag;
          }
        }

        if (lowestCloseIdx !== -1) {
          // มีข้อความความคิดอยู่ก่อนแท็กปิด
          if (lowestCloseIdx > 0) {
            const thinkingPart = text.slice(0, lowestCloseIdx);
            this.accumulatedThinking += thinkingPart;
            this.onThinking(thinkingPart);
          }

          // ปิดโหมดคิด สลับกลับสู่เนื้อเรื่องปกติ
          this.isInsideThinking = false;
          text = text.slice(lowestCloseIdx + closestCloseTag.length);
        } else {
          // ไม่พบแท็กปิดสมบูรณ์ ตรวจสอบว่าท้ายสตริงมี prefix ของแท็กปิดหรือไม่ (เช่น "</thin")
          const possiblePrefixIdx = this._findPossibleTagPrefix(text, this.closeTags);
          if (possiblePrefixIdx !== -1) {
            const safeThinking = text.slice(0, possiblePrefixIdx);
            if (safeThinking) {
              this.accumulatedThinking += safeThinking;
              this.onThinking(safeThinking);
            }
            this.buffer = text.slice(possiblePrefixIdx);
            text = '';
          } else {
            // ทั้งหมดคือข้อความความคิด
            this.accumulatedThinking += text;
            this.onThinking(text);
            text = '';
          }
        }
      }
    }
  }

  /**
   * สิ้นสุดสตรีม และระบายข้อความที่ค้างอยู่ใน Buffer
   */
  flush() {
    if (this.buffer) {
      if (this.isInsideThinking) {
        this.accumulatedThinking += this.buffer;
        this.onThinking(this.buffer);
      } else {
        this.accumulatedStory += this.buffer;
        this.onStory(this.buffer);
      }
      this.buffer = '';
    }

    return {
      thinking_logs: this.accumulatedThinking.trim(),
      story_output: this.accumulatedStory.trim(),
    };
  }

  /**
   * ค้นหาว่าสตริงตอนท้าย เป็นจุดเริ่มต้นของแท็กใดๆ หรือไม่
   * @private
   */
  _findPossibleTagPrefix(text, tagList) {
    // หาตำแหน่ง '<' หรือ '[' ล่าสุด
    const lastOpenBrace = Math.max(text.lastIndexOf('<'), text.lastIndexOf('['));
    if (lastOpenBrace === -1) return -1;

    const tail = text.slice(lastOpenBrace).toLowerCase();
    for (const tag of tagList) {
      if (tag.toLowerCase().startsWith(tail)) {
        return lastOpenBrace;
      }
    }
    return -1;
  }
}

module.exports = StreamParser;
