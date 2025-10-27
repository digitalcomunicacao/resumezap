-- Drop the existing policy if it exists
DROP POLICY IF EXISTS "Only admins can view execution logs" ON public.scheduled_executions;

-- Recreate the policy
CREATE POLICY "Only admins can view execution logs"
  ON public.scheduled_executions
  FOR SELECT
  USING (false);