-- Admin SELECT access for profiles, summaries, and whatsapp_groups

-- Profiles: allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Summaries: allow admins to view all summaries
CREATE POLICY "Admins can view all summaries"
ON public.summaries
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- WhatsApp groups: allow admins to view all groups
CREATE POLICY "Admins can view all whatsapp groups"
ON public.whatsapp_groups
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));
