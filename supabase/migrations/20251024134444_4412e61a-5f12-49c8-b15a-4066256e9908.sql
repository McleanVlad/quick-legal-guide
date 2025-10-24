-- Make user_id NOT NULL in conversations
ALTER TABLE conversations
  ALTER COLUMN user_id SET NOT NULL;

-- Add DELETE RLS policies for conversations
CREATE POLICY "Users can delete their own conversations"
ON conversations
FOR DELETE
USING (auth.uid() = user_id);

-- Add DELETE RLS policy for messages
CREATE POLICY "Users can delete messages in their own conversations"
ON messages
FOR DELETE
USING (conversation_id IN (
  SELECT id FROM conversations WHERE user_id = auth.uid()
));