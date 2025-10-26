-- Create table to track API rate limiting per user
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_user_endpoint_window 
ON public.api_rate_limits(user_id, endpoint, window_start);

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policy - users can only see their own rate limit records
CREATE POLICY "Users can view their own rate limits" 
ON public.api_rate_limits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create policy - service role can manage all rate limits (for edge functions)
CREATE POLICY "Service role can manage rate limits" 
ON public.api_rate_limits 
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_api_rate_limits_updated_at
BEFORE UPDATE ON public.api_rate_limits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to clean up old rate limit records (older than 24 hours)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_rate_limits 
  WHERE window_start < now() - interval '24 hours';
END;
$$;