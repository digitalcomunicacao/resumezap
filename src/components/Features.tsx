import { Card, CardContent } from "@/components/ui/card";
import { Brain, Clock, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "IA Avançada",
    description: "Algoritmos de processamento de linguagem natural que entendem contexto e extraem o essencial.",
  },
  {
    icon: Clock,
    title: "Resumos Diários",
    description: "Receba automaticamente todos os dias um resumo objetivo de cada grupo monitorado.",
  },
  {
    icon: Shield,
    title: "100% Seguro",
    description: "Seus dados são criptografados e nunca compartilhados. Privacidade é nossa prioridade.",
  },
  {
    icon: Zap,
    title: "Conexão Rápida",
    description: "Conecte seu WhatsApp em segundos com QR Code. Sem complicação, sem instalação.",
  },
];

export const Features = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Por que escolher o Resume Zap?
          </h2>
          <p className="text-xl text-muted-foreground">
            Tecnologia de ponta para transformar grupos de WhatsApp em fontes organizadas de informação
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index}
              className="border-primary/10 bg-gradient-card hover:border-primary/30 transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="pt-6 space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
