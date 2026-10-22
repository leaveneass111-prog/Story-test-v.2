-- ============================================================
-- SQL Schema: ตาราง chat_history สำหรับระบบนิยาย AI
-- ============================================================
-- รันคำสั่งนี้ใน Supabase SQL Editor:
-- https://supabase.com/dashboard/project/irfumfhbdzabnhfyafgk/sql/new

CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai', 'system')),
    user_message TEXT DEFAULT '',
    thinking_logs TEXT DEFAULT '',
    story_output TEXT DEFAULT '',
    model_name TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index สำหรับค้นหาประวัติตาม story_id เรียงตามลำดับเวลา
CREATE INDEX IF NOT EXISTS idx_chat_history_story_id_created 
ON public.chat_history (story_id, created_at ASC);

-- เปิดใช้งาน Row Level Security (RLS)
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- นโยบายสิทธิ์การเข้าถึงข้อมูล (Policies)
CREATE POLICY "Allow public select on chat_history"
ON public.chat_history FOR SELECT
USING (true);

CREATE POLICY "Allow public insert on chat_history"
ON public.chat_history FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update on chat_history"
ON public.chat_history FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete on chat_history"
ON public.chat_history FOR DELETE
USING (true);
