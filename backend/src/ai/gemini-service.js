/**
 * backend/src/ai/gemini-service.js
 * บริการเชื่อมต่อ Google Gemini API แบบ Real-time SSE Stream
 */

const config = require('../config');

/**
 * เรียก Gemini API แบบสตรีมมิ่ง
 * @param {object} params
 * @param {string} params.prompt - คำสั่งของผู้ใช้
 * @param {string} params.systemInstruction - ข้อมูลบริบทเรื่องและกฎการแต่ง
 * @param {Array} params.recentHistory - ประวัติการคุยย่อ
 * @param {string} params.apiKey - API Key (ถ้าไม่ส่งมาจะใช้จาก .env)
 * @param {string} params.model - ชื่อโมเดล (default: gemini-2.5-flash หรือ gemini-3.8-flash)
 * @param {StreamParser} params.parser - อินสแตนซ์ StreamParser
 */
async function streamGeminiChat({
  prompt,
  systemInstruction = '',
  recentHistory = '',
  apiKey = '',
  model = '',
  parser,
}) {
  const activeKey = config.resolveApiKey('gemini', apiKey);
  if (!activeKey) {
    throw new Error('ไม่พบ Gemini API Key กรุณาระบุใน backend/.env หรือส่งผ่านหน้าบ้าน');
  }

  const preferredModel = model || config.ai.defaultModel || 'gemini-3.8-flash';
  const modelsToTry = [
    preferredModel,
    preferredModel !== 'gemini-3.8-flash' ? 'gemini-3.8-flash' : null,
    preferredModel !== 'gemini-2.5-flash' ? 'gemini-2.5-flash' : null,
  ].filter(Boolean);

  const fullPrompt = [
    systemInstruction,
    recentHistory ? `\n[ประวัติการสนทนาล่าสุด]\n${recentHistory}` : '',
    `\n[คำสั่งของนักเขียน]\n${prompt}`,
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 4096,
      thinkingConfig: {
        includeThoughts: true,
      },
    },
  };

  let response = null;
  let lastError = null;

  for (const modelName of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName,
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(activeKey)}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        response = res;
        break;
      }

      const errText = await res.text().catch(() => '');
      lastError = new Error(`Gemini API (${modelName}) HTTP ${res.status}: ${errText}`);
      // หากเกิดข้อผิดพลาด 404 (เช่น โมเดลเลิกให้บริการ) ให้ลองโมเดลถัดไป
      if (res.status !== 404 && res.status !== 400) {
        throw lastError;
      }
    } catch (err) {
      lastError = err;
    }
  }

  if (!response) {
    throw lastError || new Error('ไม่สามารถเชื่อมต่อ Gemini API ได้');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // เก็บเศษบรรทัดสุดท้ายที่อาจยังไม่จบบรรทัด

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const jsonStr = trimmed.replace(/^data:\s*/, '');
      if (jsonStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(jsonStr);
        const parts = parsed.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
          if (!part.text) continue;
          const isNativeThought = !!part.thought;
          parser.feed(part.text, isNativeThought);
        }
      } catch (e) {
        // ข้ามบรรทัด JSON ที่ไม่สมบูรณ์
      }
    }
  }

  // ระบายสิ่งที่เหลือใน parser
  return parser.flush();
}

module.exports = { streamGeminiChat };
