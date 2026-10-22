/**
 * backend/src/routes/health-routes.js
 * Endpoint สำหรับตรวจเช็กความสมบูรณ์ของระบบหลังบ้านและการเชื่อมต่อ Supabase
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const { checkDatabaseHealth } = require('../db/supabase');

router.get('/', async (req, res) => {
  const dbHealth = await checkDatabaseHealth();

  res.json({
    status: 'ok',
    service: 'novel-chat-backend',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    config: {
      port: config.port,
      aiProvider: config.ai.provider,
      defaultModel: config.ai.defaultModel,
      hasGeminiEnvKey: !!config.ai.geminiApiKey,
      hasOpenRouterEnvKey: !!config.ai.openRouterApiKey,
      hasSupabaseConfig: !!(config.supabase.url && config.supabase.serviceRoleKey),
    },
    database: dbHealth,
  });
});

module.exports = router;
