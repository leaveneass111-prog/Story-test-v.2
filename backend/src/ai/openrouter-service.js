/**
 * backend/src/ai/openrouter-service.js
 * บริการเชื่อมต่อ OpenRouter API แบบ Real-time SSE Stream
 */

const config = require('../config');

/**
 * เรียก OpenRouter API แบบสตรีมมิ่ง
 * @param {object} params
 */
async function streamOpenRouterChat({
  prompt,
  systemInstruction = '',
  recentHistory = '',
  apiKey = '',
  model = '',
  parser,
}) {
  const activeKey = config.resolveApiKey('openrouter', apiKey);
  if (!activeKey) {
    throw new Error('ไม่พบ OpenRouter API Key กรุณาระบุใน backend/.env หรือส่งผ่านหน้าบ้าน');
  }

  const modelToUse = model || 'deepseek/deepseek-r1' || 'anthropic/claude-3.5-sonnet';

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  if (recentHistory) {
    messages.push({ role: 'user', content: `[ประวัติการสนทนา]\n${recentHistory}` });
    messages.push({ role: 'assistant', content: 'รับทราบครับ ดำเนินการต่อจากบริบทนี้' });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeKey}`,
      'HTTP-Referer': 'http://localhost:3001',
      'X-Title': 'Novel AI Co-Writer',
    },
    body: JSON.stringify({
      model: modelToUse,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenRouter API Error (HTTP ${response.status}): ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;

      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') continue;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta || {};

        // กรณีโมเดลส่ง Reasoning / Thinking แยกมาโดยตรง (เช่น DeepSeek-R1)
        if (delta.reasoning_content || delta.reasoning) {
          const reasoningText = delta.reasoning_content || delta.reasoning;
          parser.feed(reasoningText, true);
        }

        // ข้อความเนื้อหาทั่วไป
        if (delta.content) {
          parser.feed(delta.content, false);
        }
      } catch (e) {
        // ข้ามบรรทัด JSON ที่ไม่สมบูรณ์
      }
    }
  }

  return parser.flush();
}

module.exports = { streamOpenRouterChat };
