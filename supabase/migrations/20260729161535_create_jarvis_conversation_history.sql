/*
# Create conversation_history table (single-tenant, no auth)

1. New Tables
- `conversation_history`
  - `id` (uuid, primary key)
  - `role` (text: 'user' or 'jarvis')
  - `text` (text, the message content)
  - `created_at` (timestamp)

2. Security
- Enable RLS on `conversation_history`.
- Allow anon + authenticated full CRUD because the app has no sign-in (intentionally public/shared data).

3. Notes
- This is a single-tenant Jarvis assistant with no user accounts.
- All conversation logs are shared and accessible via the anon key.
*/

CREATE TABLE IF NOT EXISTS conversation_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user', 'jarvis')),
  text text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversation" ON conversation_history;
CREATE POLICY "anon_select_conversation" ON conversation_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversation" ON conversation_history;
CREATE POLICY "anon_insert_conversation" ON conversation_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversation" ON conversation_history;
CREATE POLICY "anon_delete_conversation" ON conversation_history FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON conversation_history (created_at DESC);
