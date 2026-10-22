/**
 * backend/src/server.js
 * เซิร์ฟเวอร์หลัก Express สำหรับ Novel AI Chat & Co-Writer
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const chatRoutes = require('./routes/chat-routes');
const healthRoutes = require('./routes/health-routes');

const app = express();

// ================= Middlewares =================
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger ย่อ
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (!req.path.startsWith('/static')) {
      const duration = Date.now() - start;
      console.log(`[${req.method}] ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// ================= API Routes =================
app.use('/api/chat', chatRoutes);
app.use('/api/health', healthRoutes);

// ================= Static Files (Frontend) =================
// บริการไฟล์หน้าบ้านจาก root เพื่อให้สามารถเปิด http://localhost:3001 ได้โดยตรง
const frontendPath = path.resolve(__dirname, '../../');
app.use(express.static(frontendPath));

// Fallback Route สำหรับหน้าเว็บ
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// ================= Error Handler =================
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ================= Start Server =================
const server = app.listen(config.port, () => {
  console.log('========================================================');
  console.log('🚀 Novel AI Backend Server ทำงานสำเร็จแล้ว!');
  console.log(`📡 URL เซิร์ฟเวอร์: http://localhost:${config.port}`);
  console.log(`🔌 Health Check:  http://localhost:${config.port}/api/health`);
  console.log(`💬 Stream Endpoint: POST http://localhost:${config.port}/api/chat/stream`);
  console.log(`🗄️ Supabase URL:   ${config.supabase.url || '(ยังไม่ได้ระบุ)'}`);
  console.log(`🤖 AI Provider:    ${config.ai.provider} (${config.ai.defaultModel})`);
  console.log('========================================================');
});

module.exports = { app, server };
