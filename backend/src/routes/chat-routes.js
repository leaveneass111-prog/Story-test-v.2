/**
 * backend/src/routes/chat-routes.js
 * จัดการ Routing สำหรับ Real-time Thinking Stream และ Supabase Chat History
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const StreamParser = require('../ai/stream-parser');
const { streamGeminiChat } = require('../ai/gemini-service');
const { streamOpenRouterChat } = require('../ai/openrouter-service');
const { streamMockNovelChat } = require('../ai/mock-stream-service');
const {
  saveChatMessage,
  getChatHistoryByStoryId,
  deleteChatMessage,
  clearStoryChatHistory,
} = require('../db/supabase');

/**
 * POST /api/chat/stream
 * สตรีมข้อมูลความคิดและเนื้อหานิยายแบบ Server-Sent Events (SSE)
 */
router.post('/stream', async (req, res) => {
  const {
    story_id = 'default',
    prompt = '',
    systemInstruction = '',
    recentHistory = '',
    activeStyle = 'บรรยายเน้นอารมณ์',
    provider = config.ai.provider,
    model = '',
    apiKey = '',
  } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'กรุณาส่ง prompt คำสั่งของนักเขียน' });
  }

  // ตั้งค่า Header สำหรับ Server-Sent Events (SSE) และส่ง Header ทันที ไม่รอ Supabase บล็อก
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // ป้องกัน NGINX proxy buffer
  res.flushHeaders?.();

  // บันทึกข้อความของผู้ใช้ (User Message) ลงฐานข้อมูล Supabase แบบ Asynchronous ขนานไปกับการเริ่มสตรีม
  const userSavePromise = saveChatMessage({
    story_id,
    role: 'user',
    user_message: prompt,
    thinking_logs: '',
    story_output: '',
    model_name: model || config.ai.defaultModel,
  }).catch((err) => {
    console.warn('[Supabase Notice] บันทึก User message เบื้องหลังไม่สำเร็จ:', err.message);
  });

  // สร้างฟังก์ชันส่ง SSE Event
  const sendSse = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // สร้าง StreamParser สำหรับแยกแท็ก <thinking>
  const parser = new StreamParser({
    onThinking: (chunk) => {
      sendSse('thinking', { chunk });
    },
    onStory: (chunk) => {
      sendSse('story', { chunk });
    },
  });

  const effectiveProvider = (provider || config.ai.provider || 'gemini').toLowerCase();
  const effectiveKey = config.resolveApiKey(effectiveProvider, apiKey);

  try {
    let finalResult;

    if (effectiveProvider === 'openrouter' && effectiveKey) {
      finalResult = await streamOpenRouterChat({
        prompt,
        systemInstruction,
        recentHistory,
        apiKey: effectiveKey,
        model,
        parser,
      });
    } else if (effectiveProvider === 'gemini' && effectiveKey) {
      finalResult = await streamGeminiChat({
        prompt,
        systemInstruction,
        recentHistory,
        apiKey: effectiveKey,
        model,
        parser,
      });
    } else {
      // โหมดจำลองสตรีมมิ่งออฟไลน์ (กรณีไม่มีคีย์)
      finalResult = await streamMockNovelChat({
        prompt,
        activeStyle,
        parser,
      });
    }

    // บันทึกคำตอบของ AI ลงฐานข้อมูล Supabase
    const savedAiMsg = await saveChatMessage({
      story_id,
      role: 'ai',
      user_message: prompt,
      thinking_logs: finalResult.thinking_logs,
      story_output: finalResult.story_output,
      model_name: model || config.ai.defaultModel,
    });

    // ส่งสัญญาณว่าจบสตรีม พร้อมส่งผลรวมทั้งหมด
    sendSse('done', {
      id: savedAiMsg.data?.id,
      role: 'ai',
      thinking_logs: finalResult.thinking_logs,
      story_output: finalResult.story_output,
      storage: savedAiMsg.storage,
      timestamp: Date.now(),
    });

    res.end();
  } catch (err) {
    console.error('[Stream Error]', err);
    sendSse('error', {
      message: err.message || 'เกิดข้อผิดพลาดในการสตรีมข้อมูลจาก AI',
    });
    res.end();
  }
});

/**
 * GET /api/chat/history
 * ดึงประวัติการแชทของนิยายตาม story_id
 */
router.get('/history', async (req, res) => {
  const { story_id = 'default', limit = 100 } = req.query;
  const result = await getChatHistoryByStoryId(story_id, parseInt(limit, 10));
  res.json(result);
});

/**
 * POST /api/chat/history
 * บันทึกข้อความแชทใหม่ลง Supabase
 */
router.post('/history', async (req, res) => {
  const result = await saveChatMessage(req.body);
  res.json(result);
});

/**
 * DELETE /api/chat/history/:id
 * ลบข้อความแชทรายตัว
 */
router.delete('/history/:id', async (req, res) => {
  const result = await deleteChatMessage(req.params.id);
  res.json(result);
});

/**
 * DELETE /api/chat/history/story/:story_id
 * ล้างประวัติแชททั้งหมดของนิยาย
 */
router.delete('/history/story/:story_id', async (req, res) => {
  const result = await clearStoryChatHistory(req.params.story_id);
  res.json(result);
});

module.exports = router;
