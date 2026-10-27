/**
 * backend/src/config.js
 * จัดการโหลดและตรวจสอบค่า Environment Variables สำหรับระบบหลังบ้าน
 */

const path = require('path');
const dotenv = require('dotenv');

// โหลด .env จาก root ของ backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const config = {
  port: parseInt(process.env.PORT, 10) || 3001,
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    defaultModel: process.env.DEFAULT_MODEL || 'gemini-3.8-flash',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
  },
  /**
   * ดึง API Key ที่มีผลใช้งาน (優先 env, หากไม่มีจะใช้ key ที่ส่งมาจาก header หรือ request body)
   */
  resolveApiKey(provider, requestKey) {
    if (provider === 'openrouter') {
      return (process.env.OPENROUTER_API_KEY || '').trim() || (requestKey || '').trim();
    }
    return (process.env.GEMINI_API_KEY || '').trim() || (requestKey || '').trim();
  }
};

module.exports = config;
