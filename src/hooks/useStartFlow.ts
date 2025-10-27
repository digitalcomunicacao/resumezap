import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export const useStartFlow = () => {
  const navigate = useNavigate();

  const startNow = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    navigate('/dashboard');
  };

  return { startNow };
};
