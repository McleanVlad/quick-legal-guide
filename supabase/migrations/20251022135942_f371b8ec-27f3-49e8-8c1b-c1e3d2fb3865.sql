-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  title TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  recommendations JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies for conversations (public access for now - no auth required)
CREATE POLICY "Anyone can view conversations"
ON public.conversations FOR SELECT
USING (true);

CREATE POLICY "Anyone can create conversations"
ON public.conversations FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update conversations"
ON public.conversations FOR UPDATE
USING (true);

-- Create policies for messages (public access for now - no auth required)
CREATE POLICY "Anyone can view messages"
ON public.messages FOR SELECT
USING (true);

CREATE POLICY "Anyone can create messages"
ON public.messages FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
CREATE INDEX idx_conversations_created_at ON public.conversations(created_at);

-- Enable realtime for messages
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_conversations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_conversations_timestamp
BEFORE UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_conversations_updated_at();