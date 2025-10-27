import { Button } from "@/components/ui/button";
import { MessageSquare, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import heroIllustration from "@/assets/hero-illustration.png";

export const Hero = () => {
  const navigate = useNavigate();

  const handleStartClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    navigate('/dashboard');
  };

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="container mx-auto px-4 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent border border-primary/20">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-accent-foreground">IA + WhatsApp = Produtividade</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight text-foreground">
              Resumos Inteligentes de{" "}
              <span className="text-primary">WhatsApp</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl">
              Transforme conversas intermináveis em resumos diários objetivos. 
              Economize tempo e nunca perca informações importantes dos seus grupos.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="hero" size="lg" className="group" onClick={handleStartClick}>
                <MessageSquare className="w-5 h-5 transition-transform group-hover:scale-110" />
                Começar Gratuitamente
              </Button>
              <Button variant="outline" size="lg" onClick={() => window.location.href = '#features'}>
                Ver Como Funciona
              </Button>
            </div>
            
            <div className="flex items-center gap-8 pt-4">
              <div>
                <div className="text-3xl font-bold text-primary">10k+</div>
                <div className="text-sm text-muted-foreground">Resumos gerados</div>
              </div>
              <div className="h-12 w-px bg-border" />
              <div>
                <div className="text-3xl font-bold text-primary">500+</div>
                <div className="text-sm text-muted-foreground">Usuários ativos</div>
              </div>
            </div>
          </div>
          
          <div className="relative animate-slide-up lg:animate-float">
            <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
            <img 
              src={heroIllustration} 
              alt="Resume Zap - Resumos de WhatsApp" 
              className="relative z-10 w-full h-auto rounded-2xl shadow-hover"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
