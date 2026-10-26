/**
 * story-chat-core.js
 * Core Pure Logic Module สำหรับระบบจัดการนิยายหลายเรื่อง, แชท AI และการจัดการข้อมูล
 * รองรับทั้ง Node.js (สำหรับ Automated Unit Testing) และ Browser
 */

const StoryChatCore = (() => {
  // สร้าง Story เริ่มต้น
  function createDefaultStory(customProps = {}) {
    return {
      id: customProps.id || "story-" + Date.now(),
      title: customProps.title || "การเดินทางข้ามมิติของเร็น",
      content:
        customProps.content ||
        `<h1>บทที่ 1: แสงสว่างที่ปลายอุโมงค์</h1>
<p>สายฝนในยามค่ำคืนกระหน่ำเทลงมาบนถนนคอนกรีตที่แตกระแหงของเขตเมืองเก่า เสียงฟ้าร้องคำรามกึกก้องสะท้อนไปทั่วตึกระฟ้าที่ทอดตัวยาวสู่ม่านเมฆสีเทาหม่น <strong>เร็น</strong> กระชับเสื้อโค้ตตัวเก่าสีเข้มให้แนบแน่นขึ้น ขณะที่ก้าวเท้าหลบแอ่งน้ำขังด้วยความเร่งรีบ</p>
<p>ในมือขวาของเขาคือวัตถุโลหะทรงแปดเหลี่ยมขนาดเท่าฝ่ามือ มันกำลังเปล่งแสงเรืองรองสีฟ้าครามจางๆ เป็นจังหวะสม่ำเสมอราวกับมีหัวใจเต้นอยู่ภายใน สิ่งประดิษฐ์ที่ถูกขนานนามว่า <em>"แกนผลึกดารา"</em> ชิ้นนี้ ไม่ควรจะถูกเปิดใช้งานในโลกมนุษย์</p>`,
      characters: customProps.characters || [
        {
          id: "c1",
          name: "เร็น (Ren)",
          role: "ตัวเอก (Protagonist)",
          desc: "นักเดินทางข้ามมิติผู้ถือครองแกนผลึกดารา นิสัยสุขุม รอบคอบแต่รักความยุติธรรม",
        },
        {
          id: "c2",
          name: "คาร่า (Kara)",
          role: "ผู้ติดตาม / นักเวท",
          desc: "ผู้พิทักษ์แห่งหอคอยดวงดาว ฉลาดหลักแหลม มีพลังในการเปิดประตูมิติ",
        },
      ],
      locations: customProps.locations || [
        {
          id: "l1",
          name: "เขตเมืองเก่าไซออน",
          type: "เมือง / ซากโบราณ",
          desc: "นครหลวงที่ล่มสลาย เต็มไปด้วยเทคโนโลยีโบราณและฝนกรดตกตลอดปี",
        },
      ],
      timelines: customProps.timelines || [
        {
          id: "t1",
          title: "การค้นพบแกนผลึกดารา",
          time: "ค.ศ. 2142",
          desc: "เร็นขุดพบวัตถุลึกลับในซากวิหารใต้ดิน",
        },
      ],
      overview: customProps.overview || [
        {
          id: "o1",
          title: "แนวเรื่อง (Genre)",
          desc: "ไซไฟ-แฟนตาซี / ผจญภัยข้ามมิติ",
        },
        {
          id: "o2",
          title: "แก่นเรื่อง (Theme)",
          desc: "การเสียสละเพื่อปกป้องโลกและความจริงในอดีต",
        },
      ],
      chatMessages: customProps.chatMessages || [],
      createdAt: customProps.createdAt || Date.now(),
      updatedAt: customProps.updatedAt || Date.now(),
    };
  }

  // เพิ่มเรื่องใหม่
  function addNewStory(stories, title = "นิยายเรื่องใหม่") {
    const newStory = {
      id: "story-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      title: title.trim() || "นิยายเรื่องใหม่",
      content: `<h1>บทที่ 1: การเริ่มต้น</h1><p>เริ่มต้นเขียนจินตนาการของคุณที่นี่...</p>`,
      characters: [],
      locations: [],
      timelines: [],
      overview: [
        {
          id: "o-" + Date.now(),
          title: "แนวเรื่อง (Genre)",
          desc: "ยังไม่ได้ระบุ",
        },
      ],
      chatMessages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updatedStories = [...stories, newStory];
    return {
      stories: updatedStories,
      newStory,
      activeStoryId: newStory.id,
    };
  }

  // สลับเรื่อง
  function switchStory(stories, targetStoryId) {
    const found = stories.find((s) => s.id === targetStoryId);
    if (!found) {
      throw new Error(`ไม่พบเรื่องรหัส: ${targetStoryId}`);
    }
    return {
      activeStoryId: found.id,
      story: found,
    };
  }

  // ลบเรื่อง
  function deleteStory(stories, activeStoryId, storyIdToDelete) {
    if (stories.length <= 1) {
      const resetStory = createDefaultStory({
        title: "นิยายเรื่องใหม่",
        content: `<h1>บทที่ 1: การเริ่มต้น</h1><p>เริ่มต้นเขียนจินตนาการของคุณที่นี่...</p>`,
        characters: [],
        locations: [],
        timelines: [],
        overview: [],
        chatMessages: [],
      });
      return {
        stories: [resetStory],
        activeStoryId: resetStory.id,
        isReset: true,
      };
    }

    const filtered = stories.filter((s) => s.id !== storyIdToDelete);
    let newActiveId = activeStoryId;
    if (activeStoryId === storyIdToDelete) {
      newActiveId = filtered[0].id;
    }
    return {
      stories: filtered,
      activeStoryId: newActiveId,
      isReset: false,
    };
  }

  // จัดการแชท: เริ่มแชทใหม่
  function startNewChat(story) {
    return {
      ...story,
      chatMessages: [],
      updatedAt: Date.now(),
    };
  }

  // ลบข้อความแชทรายตัว
  function deleteChatMessage(chatMessages, messageIndex) {
    if (messageIndex < 0 || messageIndex >= chatMessages.length) {
      return [...chatMessages];
    }
    const updated = [...chatMessages];
    updated.splice(messageIndex, 1);
    return updated;
  }

  // เพิ่มข้อความแชท (รองรับ thinking_config / thinking process)
  function addChatMessage(chatMessages, role, content, thinking = "") {
    const msg = { role, content, timestamp: Date.now() };
    if (thinking) msg.thinking = thinking;
    return [...chatMessages, msg];
  }

  // เตรียมสร้างข้อความ AI ใหม่ (Regenerate)
  function prepareRegenerateChat(chatMessages) {
    if (!chatMessages || chatMessages.length === 0) {
      return { updatedMessages: [], lastUserPrompt: null };
    }
    const msgs = [...chatMessages];
    const lastMsg = msgs[msgs.length - 1];

    if (lastMsg && lastMsg.role === "ai") {
      msgs.pop(); // นำข้อความ AI เดิมออกเพื่อสร้างใหม่
    }

    // ค้นหาข้อความของ user ตัวล่าสุดที่จะนำมาเจนซ้ำ
    const lastUserMsg = msgs.slice().reverse().find((m) => m.role === "user");
    const lastUserPrompt = lastUserMsg ? lastUserMsg.content : null;

    return {
      updatedMessages: msgs,
      lastUserPrompt,
    };
  }

  // แก้ไขข้อความในประวัติแชท
  function editChatMessage(chatMessages, messageIndex, newContent) {
    if (messageIndex < 0 || messageIndex >= chatMessages.length) {
      return [...chatMessages];
    }
    const updated = [...chatMessages];
    updated[messageIndex] = {
      ...updated[messageIndex],
      content: newContent,
      updatedAt: Date.now(),
    };
    return updated;
  }

  // ล้างเนื้อหากระดาษ (Clear Canvas)
  function clearCanvasContent() {
    return "<p><br></p>";
  }

  // ลบรายการโน้ต (Character, Location, Timeline, Overview)
  function deleteNoteItem(items, itemId) {
    return items.filter((item) => item.id !== itemId);
  }

  // เพิ่มรายการโน้ต
  function addNoteItem(items, newItem) {
    return [...items, { ...newItem, id: newItem.id || "item-" + Date.now() }];
  }

  // ประกอบร่างบริบททั้งหมดของเรื่อง (Data Flow Context Builder) สำหรับส่งให้ AI
  function buildStoryContextPrompt(story, plainCanvasText, activeStyle) {
    const overviewStr =
      (story.overview || []).map((o) => `- ${o.title}: ${o.desc}`).join("\n") ||
      "- ไม่ได้ระบุ";
    const charStr =
      (story.characters || [])
        .map(
          (c) => `- ${c.name} (${c.role || "ไม่ระบุบทบาท"}): ${c.desc || ""}`,
        )
        .join("\n") || "- ไม่ได้ระบุ";
    const locStr =
      (story.locations || [])
        .map((l) => `- ${l.name} (${l.type || "สถานที่"}): ${l.desc || ""}`)
        .join("\n") || "- ไม่ได้ระบุ";
    const timeStr =
      (story.timelines || [])
        .map(
          (t) => `- [${t.time || "ไม่ระบุเวลา"}] ${t.title}: ${t.desc || ""}`,
        )
        .join("\n") || "- ไม่ได้ระบุ";

    // ดึงเฉพาะ 3,500 ตัวอักษรท้ายสุด เพื่อให้ AI โฟกัสกับฉากล่าสุดเสมอ
    const recentNovelText = (plainCanvasText || "").trim().slice(-3500);

    return `คุณคือผู้ช่วยเขียนนิยาย
ชื่อเรื่อง: "${story.title || "นิยายไม่มีชื่อ"}"
สไตล์การเขียนที่ต้องการ: "${activeStyle || "บรรยายเน้นอารมณ์"}"

[ฐานข้อมูลโลกนิยาย (Lorebook & Notes)]
1. ภาพรวมโครงเรื่อง:
${overviewStr}

2. ตัวละคร:
${charStr}

3. สถานที่:
${locStr}

4. ช่วงเวลาและเหตุการณ์สำคัญ:
${timeStr}

[เนื้อหานิยายตอนล่าสุดบนหน้ากระดาษ]
"""
${recentNovelText || "(หน้ากระดาษยังว่างเปล่า)"}
"""

[กฎเหล็กในการทำงาน 5 ข้ออย่างเคร่งครัด]
1. หากผู้ใช้ชวนคุย ปรึกษาพล็อต หรือวางโครงเรื่อง ให้ตอบกลับตามปกติเพื่อแสดงในช่องแชท
2. หากผู้ใช้สั่งให้ "เขียนเนื้อเรื่อง", "แต่งต่อ", "แต่งต่อจากนี้", "เขียนต่อ", "แต่งฉาก...", "แต่งบทที่...", "เขียนลงกระดาษ", "ขอฉากต่อไป", "เพิ่มบทสนทนา", หรือ "เล่าต่อ" ให้คุณพูดคุยตอบรับสั้นๆ แล้วนำเนื้อหานิยายทั้งหมดใส่ไว้ในแท็ก <story_canvas>...</story_canvas> เสมอ ห้ามนำเนื้อหานิยายมาปนในข้อความแชทปกติ
3. ภายในแท็ก <story_canvas> ห้ามมีข้อความเกริ่นนำ คำทักทาย การรับคำสั่ง หรือการอธิบายแนวคิดใดๆ ก่อนเข้าเนื้อหาเด็ดขาด (เช่น ห้ามใช้คำว่า "ข้าพเจ้ายินดี...", "สำหรับนิยายสไตล์นี้...", "นี่คือโครงร่าง...")
4. ให้เริ่มบรรทัดแรกภายในแท็ก <story_canvas> ด้วยเนื้อหาหลักหรือหัวข้อแรกทันทีโดยไม่ต้องมีบทนำ
5. ห้ามมีข้อความสรุปปิดท้ายหรือคำถามชวนคุยต่อท้ายเนื้อหาภายในแท็ก <story_canvas>`;
  }

  // ทำความสะอาดเนื้อหานิยายก่อนส่งลงหน้ากระดาษตามกฎข้อ 3, 4, 5
  function cleanCanvasNovelContent(text) {
    if (!text) return "";
    let lines = text.trim().split("\n");

    // กรองบรรทัดเกริ่นนำด้านหน้า (Leading greetings / pleasantries)
    while (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (!firstLine) {
        lines.shift();
        continue;
      }
      if (
        firstLine.startsWith("ข้าพเจ้า") ||
        firstLine.startsWith("ยินดี") ||
        firstLine.startsWith("สำหรับนิยาย") ||
        firstLine.startsWith("นี่คือ") ||
        firstLine.startsWith("ต่อไปนี้คือ") ||
        firstLine.startsWith("บทนี้จะเล่า") ||
        firstLine.startsWith("ขอต้อนรับ") ||
        firstLine.startsWith("สวัสดี") ||
        firstLine.startsWith("รับทราบ") ||
        firstLine.startsWith("ได้เลยครับ") ||
        firstLine.startsWith("ได้เลยค่ะ") ||
        firstLine.startsWith("แต่งต่อให้") ||
        firstLine.startsWith("เขียนต่อให้") ||
        firstLine.startsWith("จัดให้ครับ") ||
        firstLine.startsWith("จัดให้ค่ะ")
      ) {
        lines.shift();
      } else {
        break;
      }
    }

    // กรองบรรทัดสรุปปิดท้ายหรือคำถามชวนคุย (Trailing summaries / questions)
    while (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      if (!lastLine) {
        lines.pop();
        continue;
      }
      if (
        lastLine.includes("หวังว่า") ||
        lastLine.includes("ต้องการให้") ||
        lastLine.includes("ชอบหรือไม่") ||
        lastLine.includes("มีอะไรให้ช่วย") ||
        lastLine.includes("สามารถแจ้งได้") ||
        lastLine.includes("สามารถปรับ") ||
        lastLine.startsWith("---") ||
        lastLine.startsWith("💡")
      ) {
        lines.pop();
      } else {
        break;
      }
    }

    return lines.join("\n").trim();
  }

  // แยกข้อความพูดคุยในช่องแชท (chatText) กับเนื้อเรื่องที่ต้องส่งเข้ากระดาษตรงกลาง (canvasText)
  function splitChatAndCanvasContent(rawAiText, userPrompt = "") {
    if (!rawAiText) {
      return { chatText: "", canvasText: "", hasCanvasContent: false };
    }

    // ตัด Thinking blocks ออก
    let cleanText = rawAiText
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/\[THOUGHT_START\][\s\S]*?\[THOUGHT_END\]/gi, "")
      .trim();

    // 1. ตรวจสอบแท็ก <story_canvas>...</story_canvas> ตามข้อกำหนดหลัก
    const canvasMatch = cleanText.match(
      /<story_canvas>([\s\S]*?)<\/story_canvas>/i,
    );
    if (canvasMatch) {
      const rawStory = canvasMatch[1] || "";
      const canvasText = cleanCanvasNovelContent(rawStory);
      let chatText = cleanText
        .replace(/<story_canvas>[\s\S]*?<\/story_canvas>/gi, "")
        .trim();

      if (!chatText) {
        chatText = "นำเนื้อเรื่องส่งลงหน้ากระดาษตรงกลางเรียบร้อยแล้วครับ ✍️✨";
      }

      return {
        chatText,
        canvasText,
        hasCanvasContent: canvasText.length > 0,
      };
    }

    // 2. ตรวจสอบ Backward compatibility กับแท็ก [STORY_START] ... [STORY_END]
    const legacyMatch = cleanText.match(
      /\[STORY_START\]([\s\S]*?)\[STORY_END\]/i,
    );
    if (legacyMatch) {
      const rawStory = legacyMatch[1] || "";
      const canvasText = cleanCanvasNovelContent(rawStory);
      let chatText = cleanText
        .replace(/\[STORY_START\][\s\S]*?\[STORY_END\]/gi, "")
        .trim();

      if (!chatText) {
        chatText = "นำเนื้อเรื่องส่งลงหน้ากระดาษตรงกลางเรียบร้อยแล้วครับ ✍️✨";
      }

      return {
        chatText,
        canvasText,
        hasCanvasContent: canvasText.length > 0,
      };
    }

    // 3. Smart Story Extractor Fallback: กรณีโมเดล AI ลืมใส่แท็ก <story_canvas>
    // ตรวจสอบว่าคำสั่งของผู้ใช้ หรือคำตอบของ AI เป็นเนื้อหานิยายที่ควรส่งลงกระดาษตรงกลางหรือไม่
    const p = (userPrompt || "").trim().toLowerCase();
    const isWritingCommand =
      p.length > 0 &&
      /(แต่งต่อ|แต่งเนื้อเรื่อง|เขียนต่อ|เขียนฉาก|แต่งฉาก|แต่งบท|เขียนบท|ลงกระดาษ|ขอฉาก|เพิ่มบทสนทนา|เล่าต่อ|เกลาสำนวน|ฉากต่อไป|แต่งอีก|แต่งให้)/i.test(
        p,
      );

    const hasNovelDialogue = /["'“「][^"'”」]{2,}["'”」]/.test(cleanText);
    const hasNarrativeParagraphs =
      cleanText.split(/\n\n+/).length >= 2 && cleanText.length > 70;
    const isNotPureAdvice =
      !/^(ข้อเสนอแนะ|คำแนะนำ|แนวทางการพัฒนา|ไอเดียพล็อต|จุดเปลี่ยนสำคัญ|ความเห็นเกี่ยวกับ)/i.test(
        cleanText.trim(),
      );

    if (
      (isWritingCommand || (hasNovelDialogue && hasNarrativeParagraphs)) &&
      isNotPureAdvice
    ) {
      const canvasText = cleanCanvasNovelContent(cleanText);
      if (canvasText.length > 20) {
        return {
          chatText: "นำเนื้อเรื่องส่งลงหน้ากระดาษตรงกลางเรียบร้อยแล้วครับ ✍️✨",
          canvasText,
          hasCanvasContent: true,
          autoExtracted: true,
        };
      }
    }

    // 4. กรณีไม่มีแท็กเนื้อเรื่อง และไม่ใช่การสั่งแต่งเรื่อง (เป็นการคุยปรึกษาพล็อต หรือถามตอบทั่วไป)
    return {
      chatText: cleanText,
      canvasText: "",
      hasCanvasContent: false,
    };
  }

  // สกัดเฉพาะเนื้อหานิยายล้วนๆ เวลาผู้ใช้กดปุ่ม "+ แทรกลงในนิยาย" หรือคัดลอก
  function extractPureStoryContent(rawAiText) {
    if (!rawAiText) return "";
    const splitResult = splitChatAndCanvasContent(rawAiText);
    if (splitResult.hasCanvasContent) {
      return splitResult.canvasText;
    }

    // ถ้าไม่มีแท็ก ให้ตัดย่อหน้าที่เป็นคำพูดทักทาย/คำแนะนำของ AI ออกโดยอัตโนมัติ
    const lines = splitResult.chatText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        if (!t) return true;
        if (
          t.startsWith("นี่คือข้อเสนอแนะ") ||
          t.startsWith("ขอต่อเรื่องราว") ||
          t.startsWith("วิเคราะห์จากบริบท")
        )
          return false;
        if (
          t.startsWith("💡") ||
          t.startsWith("คำแนะนำสำหรับฉากต่อไป") ||
          t.startsWith("ต้องการให้ผมช่วย")
        )
          return false;
        return true;
      });
    return lines.join("\n").trim() || splitResult.chatText.trim();
  }

  // แยกและถอดรหัสบรรทัด Server-Sent Events (SSE)
  function parseSseStreamChunk(rawChunkText) {
    if (!rawChunkText) return [];
    const events = [];
    const lines = rawChunkText.split("\n");
    let currentEvent = "message";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        currentEvent = "message";
        continue;
      }
      if (trimmed.startsWith("event:")) {
        currentEvent = trimmed.replace(/^event:\s*/, "").trim();
      } else if (trimmed.startsWith("data:")) {
        const dataStr = trimmed.replace(/^data:\s*/, "").trim();
        try {
          const parsedData = JSON.parse(dataStr);
          events.push({ event: currentEvent, data: parsedData });
        } catch (e) {
          events.push({ event: currentEvent, data: { raw: dataStr } });
        }
      }
    }
    return events;
  }

  // สร้างสถานะเริ่มต้นสำหรับตัวรับสตรีมมิ่งหน้าบ้าน
  function createStreamingState() {
    return {
      thinking: "",
      story: "",
      isThinking: true,
      isDone: false,
      startTime: Date.now(),
      elapsedSec: "0.0s",
    };
  }

  // อัปเดตสถานะสตรีมมิ่งตามประเภทของอีเวนต์
  function appendStreamChunk(streamState, eventType, data = {}) {
    const updated = { ...streamState };
    if (eventType === "thinking" && data.chunk) {
      updated.thinking += data.chunk;
      updated.isThinking = true;
    } else if (eventType === "story" && data.chunk) {
      updated.story += data.chunk;
      updated.isThinking = false;
    } else if (eventType === "done") {
      updated.isDone = true;
      updated.isThinking = false;
      if (data.thinking_logs) updated.thinking = data.thinking_logs;
      if (data.story_output) updated.story = data.story_output;
      const totalMs = Date.now() - updated.startTime;
      updated.elapsedSec = (totalMs / 1000).toFixed(1) + "s";
    }
    return updated;
  }

  // สกัดขั้นตอนการคิดออกเป็นแต่ละข้อความย่อยสำหรับแสดงในกล่อง Dark Grey Tones
  function parseThinkingSteps(thinkingText, isWorking = false) {
    if (!thinkingText) {
      return isWorking
        ? [
            "วิเคราะห์ธีมเรื่องและบริบทล่าสุดใน Lorebook",
            "ตรวจสอบข้อมูลตัวละครและสถานที่",
            "รังสรรค์วรรณศิลป์ตามขั้นตอนความคิด",
          ]
        : [];
    }

    const lines = thinkingText
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith("[Gemini") &&
          !l.startsWith("[thinking_config") &&
          !l.startsWith("<thinking>") &&
          !l.startsWith("</thinking>") &&
          !l.startsWith("<think>") &&
          !l.startsWith("</think>"),
      );

    if (lines.length > 0) {
      return lines
        .map((l) => l.replace(/^[^\p{L}\p{M}]+/u, "").trim())
        .filter(Boolean);
    }
    return [thinkingText.trim()];
  }

  return {
    createDefaultStory,
    addNewStory,
    switchStory,
    deleteStory,
    startNewChat,
    deleteChatMessage,
    addChatMessage,
    prepareRegenerateChat,
    editChatMessage,
    clearCanvasContent,
    deleteNoteItem,
    addNoteItem,
    buildStoryContextPrompt,
    cleanCanvasNovelContent,
    splitChatAndCanvasContent,
    extractPureStoryContent,
    parseSseStreamChunk,
    createStreamingState,
    appendStreamChunk,
    parseThinkingSteps,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = StoryChatCore;
}
