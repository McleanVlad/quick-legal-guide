-- Fix critical security issue: Make user_id NOT NULL in conversations
ALTER TABLE conversations
  ALTER COLUMN user_id SET NOT NULL;