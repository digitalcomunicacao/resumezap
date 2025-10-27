import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useAnalytics() {
  const { user } = useAuth();

  const trackEvent = async (eventType: string, eventData?: any) => {
    if (!user) return;

    try {
      await supabase.from('analytics_events').insert({
        user_id: user.id,
        event_type: eventType,
        event_data: eventData || {},
      });
    } catch (error) {
      console.error('Error tracking event:', error);
    }
  };

  const updateLastSeen = async () => {
    if (!user) return;

    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  };

  useEffect(() => {
    if (user) {
      updateLastSeen();
      
      const interval = setInterval(() => {
        updateLastSeen();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user]);

  return { trackEvent };
}
