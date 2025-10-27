import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const qualificationSchema = z.object({
  whatsapp: z.string().min(10, "WhatsApp é obrigatório").max(20, "WhatsApp inválido"),
  city: z.string().min(2, "Cidade é obrigatória"),
  profession: z.enum(["empresario", "diretor_gestor", "marketing_operacoes", "outros"]),
  company_revenue: z.string().optional(),
  company_employees: z.string().optional(),
}).refine((data) => {
  if (data.profession === "empresario" || data.profession === "diretor_gestor") {
    return data.company_revenue && data.company_employees;
  }
  return true;
}, {
  message: "Preencha todos os campos da empresa",
  path: ["company_employees"],
});

type QualificationData = z.infer<typeof qualificationSchema>;

interface LeadQualificationModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export const LeadQualificationModal = ({ onComplete, onSkip }: LeadQualificationModalProps) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<QualificationData>({
    resolver: zodResolver(qualificationSchema),
  });

  const profession = watch("profession");
  const company_revenue = watch("company_revenue");
  const company_employees = watch("company_employees");
  const needsCompanyInfo = profession === "empresario" || profession === "diretor_gestor";

  const isLastStepValid = () => {
    if (!needsCompanyInfo) return true;
    return company_revenue && company_employees;
  };

  const calculateLeadScore = (data: QualificationData): number => {
    let score = 0;

    if (data.profession === "empresario" || data.profession === "diretor_gestor") {
      score += 40;
    } else if (data.profession === "marketing_operacoes") {
      score += 10;
    }

    if (data.company_revenue) {
      if (data.company_revenue === "acima_5m") score += 40;
      else if (data.company_revenue === "1m_5m") score += 30;
      else if (data.company_revenue === "500k_1m") score += 20;
      else if (data.company_revenue === "100k_500k") score += 10;
    }

    if (data.company_employees) {
      if (data.company_employees === "acima_500") score += 30;
      else if (data.company_employees === "201_500") score += 20;
      else if (data.company_employees === "51_200") score += 15;
      else if (data.company_employees === "11_50") score += 10;
    }

    return score;
  };

  const onSubmit = async (data: QualificationData) => {
    console.log("🔍 Dados do formulário:", data);
    console.log("🔍 Precisa info da empresa:", needsCompanyInfo);
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      console.log("🔍 Usuário:", user);

      const leadScore = calculateLeadScore(data);
      console.log("🔍 Lead score calculado:", leadScore);

      const { error } = await supabase
        .from("lead_qualification")
        .insert({
          user_id: user.id,
          whatsapp: data.whatsapp,
          city: data.city,
          profession: data.profession,
          company_revenue: data.company_revenue || null,
          company_employees: data.company_employees || null,
          lead_score: leadScore,
        });

      if (error) throw error;

      toast.success("Dados salvos com sucesso!");
      onComplete();
    } catch (error: any) {
      console.error("❌ Error saving qualification:", error);
      toast.error(error.message || "Erro ao salvar dados");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = needsCompanyInfo ? 4 : 2;
  const progress = (step / totalSteps) * 100;

  const formatWhatsApp = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 11) {
      return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    }
    return cleaned.slice(0, 11);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <CardTitle>Fale um pouco sobre você</CardTitle>
          <CardDescription>
            Isso nos ajuda a personalizar sua experiência
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    placeholder="(11) 99999-9999"
                    {...register("whatsapp")}
                    onChange={(e) => {
                      const formatted = formatWhatsApp(e.target.value);
                      setValue("whatsapp", formatted);
                    }}
                  />
                  {errors.whatsapp && (
                    <p className="text-sm text-destructive mt-1">{errors.whatsapp.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" placeholder="São Paulo" {...register("city")} />
                  {errors.city && (
                    <p className="text-sm text-destructive mt-1">{errors.city.message}</p>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <Label htmlFor="profession">Profissão</Label>
                  <Select
                    onValueChange={(value) => setValue("profession", value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione sua profissão" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="empresario">Empresário</SelectItem>
                      <SelectItem value="diretor_gestor">Diretor ou Gestor</SelectItem>
                      <SelectItem value="marketing_operacoes">Profissional de Marketing e Operações</SelectItem>
                      <SelectItem value="outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.profession && (
                    <p className="text-sm text-destructive mt-1">{errors.profession.message}</p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && needsCompanyInfo && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <Label htmlFor="company_revenue">Faturamento da Empresa</Label>
                  <Select
                    onValueChange={(value) => setValue("company_revenue", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o faturamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ate_100k">Até R$ 100 mil</SelectItem>
                      <SelectItem value="100k_500k">R$ 100 mil - R$ 500 mil</SelectItem>
                      <SelectItem value="500k_1m">R$ 500 mil - R$ 1 milhão</SelectItem>
                      <SelectItem value="1m_5m">R$ 1 milhão - R$ 5 milhões</SelectItem>
                      <SelectItem value="acima_5m">Acima de R$ 5 milhões</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {step === 4 && needsCompanyInfo && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <Label htmlFor="company_employees">Número de Funcionários</Label>
                  <Select
                    onValueChange={(value) => setValue("company_employees", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a faixa" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ate_10">Até 10</SelectItem>
                      <SelectItem value="11_50">11 - 50</SelectItem>
                      <SelectItem value="51_200">51 - 200</SelectItem>
                      <SelectItem value="201_500">201 - 500</SelectItem>
                      <SelectItem value="acima_500">Acima de 500</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar
                </Button>
              )}

              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex-1"
                  disabled={step === 2 && !profession}
                >
                  Próximo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  className="flex-1" 
                  disabled={loading || !isLastStepValid()}
                >
                  {loading ? "Salvando..." : "Concluir"}
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              className="w-full"
            >
              Pular por enquanto
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
