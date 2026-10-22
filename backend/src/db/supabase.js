/**
 * backend/src/db/supabase.js
 * ตัวเชื่อมต่อและจัดการฐานข้อมูล Supabase (ตาราง chat_history)
 * รองรับ Local In-Memory Fallback อัตโนมัติหากยังไม่ได้รัน SQL บนคลาวด์
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

let supabaseClient = null;

// Local Fallback Cache เพื่อให้แอปไม่หยุดทำงานแม้เน็ตหลุดหรือยังไม่ได้สร้างตาราง
const localChatStore = new Map();

function getSupabaseClient() {
  if (!supabaseClient && config.supabase.url && config.supabase.serviceRoleKey) {
    supabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * บันทึกข้อความแชทลงตาราง chat_history
 */
async function saveChatMessage({
  story_id,
  role = 'ai',
  user_message = '',
  thinking_logs = '',
  story_output = '',
  model_name = '',
}) {
  const client = getSupabaseClient();
  const record = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    story_id: String(story_id || 'default'),
    role: String(role),
    user_message: String(user_message || ''),
    thinking_logs: String(thinking_logs || ''),
    story_output: String(story_output || ''),
    model_name: String(model_name || config.ai.defaultModel),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (client) {
    try {
      const { data, error } = await client
        .from('chat_history')
        .insert([
          {
            story_id: record.story_id,
            role: record.role,
            user_message: record.user_message,
            thinking_logs: record.thinking_logs,
            story_output: record.story_output,
            model_name: record.model_name,
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return { success: true, data, storage: 'supabase' };
      }

      if (error) {
        console.warn(`[Supabase Notice] ${error.message} (กำลังใช้ Local Fallback เก็บข้อมูลชั่วคราว)`);
      }
    } catch (err) {
      console.warn(`[Supabase Warning] ${err.message}`);
    }
  }

  // บันทึกลง Local Store ในกรณี Fallback
  if (!localChatStore.has(record.story_id)) {
    localChatStore.set(record.story_id, []);
  }
  localChatStore.get(record.story_id).push(record);
  return { success: true, data: record, storage: 'local_fallback' };
}

/**
 * ดึงประวัติแชททั้งหมดของนิยายเรื่องหนึ่งๆ
 */
async function getChatHistoryByStoryId(story_id, limit = 100) {
  const client = getSupabaseClient();
  const sid = String(story_id || 'default');

  if (client) {
    try {
      const { data, error } = await client
        .from('chat_history')
        .select('*')
        .eq('story_id', sid)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (!error && Array.isArray(data) && data.length > 0) {
        return { success: true, history: data, storage: 'supabase' };
      }
      if (error && error.code !== 'PGRST116') {
        console.warn(`[Supabase Notice] ดึงข้อมูลไม่สำเร็จ: ${error.message}`);
      }
    } catch (err) {
      console.warn(`[Supabase Warning] ${err.message}`);
    }
  }

  // ดึงจาก Local Fallback
  const localList = localChatStore.get(sid) || [];
  return { success: true, history: localList.slice(-limit), storage: 'local_fallback' };
}

/**
 * ลบข้อความแชทรายตัวด้วย ID
 */
async function deleteChatMessage(id) {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { error } = await client.from('chat_history').delete().eq('id', id);
      if (!error) return { success: true, storage: 'supabase' };
    } catch (err) {
      console.warn(`[Supabase Warning] ${err.message}`);
    }
  }

  // ลบใน Local Store
  for (const [sid, list] of localChatStore.entries()) {
    const idx = list.findIndex((m) => m.id === id);
    if (idx !== -1) {
      list.splice(idx, 1);
      return { success: true, storage: 'local_fallback' };
    }
  }
  return { success: true };
}

/**
 * ล้างประวัติแชททั้งหมดของนิยายเรื่องนั้น
 */
async function clearStoryChatHistory(story_id) {
  const client = getSupabaseClient();
  const sid = String(story_id || 'default');

  if (client) {
    try {
      await client.from('chat_history').delete().eq('story_id', sid);
    } catch (err) {
      console.warn(`[Supabase Warning] ${err.message}`);
    }
  }

  localChatStore.delete(sid);
  return { success: true };
}

/**
 * ตรวจสอบความพร้อมใช้งานของ Supabase
 */
async function checkDatabaseHealth() {
  const client = getSupabaseClient();
  if (!client) {
    return { connected: false, message: 'ไม่ได้ตั้งค่า SUPABASE_URL หรือ SERVICE_KEY' };
  }

  try {
    const { count, error } = await client
      .from('chat_history')
      .select('*', { count: 'exact', head: true });

    if (error) {
      return {
        connected: true,
        hasTable: false,
        message: `เชื่อมต่อ Supabase ได้แล้ว แต่ตาราง chat_history ยังไม่ถูกสร้าง (${error.message})`,
      };
    }

    return {
      connected: true,
      hasTable: true,
      message: 'เชื่อมต่อ Supabase และพบตาราง chat_history เรียบร้อยแล้ว',
      totalRecords: count || 0,
    };
  } catch (err) {
    return { connected: false, message: err.message };
  }
}

module.exports = {
  getSupabaseClient,
  saveChatMessage,
  getChatHistoryByStoryId,
  deleteChatMessage,
  clearStoryChatHistory,
  checkDatabaseHealth,
  _localChatStore: localChatStore,
};
