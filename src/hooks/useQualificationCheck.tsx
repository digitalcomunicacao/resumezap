import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useQualificationCheck = () => {
  const [isQualified, setIsQualified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkQualification();
  }, []);

  const checkQualification = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsQualified(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("lead_qualification")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.log("Usuário ainda não qualificado");
        setIsQualified(false);
      } else {
        setIsQualified(!!data);
      }
    } catch (error) {
      console.error("Erro ao verificar qualificação:", error);
      setIsQualified(false);
    } finally {
      setLoading(false);
    }
  };

  return { isQualified, loading, refetch: checkQualification };
};
