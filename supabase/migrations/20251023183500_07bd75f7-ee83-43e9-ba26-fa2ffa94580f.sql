-- Fix messages table RLS policies to require authentication
-- Step 1: Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view messages" ON public.messages;
DROP POLICY IF EXISTS "Anyone can create messages" ON public.messages;

-- Step 2: Delete orphaned conversations and messages (no user_id)
-- First delete messages from conversations without users
DELETE FROM public.messages 
WHERE conversation_id IN (
  SELECT id FROM public.conversations WHERE user_id IS NULL
);

-- Then delete the orphaned conversations
DELETE FROM public.conversations WHERE user_id IS NULL;

-- Step 3: Make user_id NOT NULL now that data is clean
ALTER TABLE public.conversations
  ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Add foreign key constraint for data integrity
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Step 5: Add authenticated user policies that check conversation ownership
CREATE POLICY "Users can view their own conversation messages" 
ON public.messages
FOR SELECT 
USING (
  conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages into their own conversations" 
ON public.messages
FOR INSERT 
WITH CHECK (
  conversation_id IN (
    SELECT id FROM public.conversations WHERE user_id = auth.uid()
  )
);