import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground">Resume Zap</span>
        </div>
        
        <nav className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Funcionalidades
          </a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            Preços
          </a>
          <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
            FAQ
          </a>
        </nav>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm">
            Entrar
          </Button>
          <Button variant="default" size="sm">
            Começar Grátis
          </Button>
        </div>
      </div>
    </header>
  );
};
