import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export const signUp = async (email: string, password: string, fullName: string) => {
  const redirectUrl = `${window.location.origin}/dashboard`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) return { data, error };

  // Garantir que o profile seja criado/atualizado com email e nome
  if (data.user) {
    // Aguardar trigger criar o profile
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: data.user.id,
        full_name: fullName,
        email: email 
      }, { onConflict: 'id' });

    if (profileError) console.error('❌ Erro ao criar/atualizar profile:', profileError);
  }

  return { data, error };
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  return { error };
};

export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
};
