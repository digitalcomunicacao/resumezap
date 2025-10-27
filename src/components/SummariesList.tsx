import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, MessageSquare, Calendar, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Summary {
  id: string;
  group_id: string;
  group_name: string;
  summary_text: string;
  summary_date: string;
  message_count: number;
  created_at: string;
}

interface SummariesListProps {
  userId: string | undefined;
}

export const SummariesList = ({ userId }: SummariesListProps) => {
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [expandedSummaries, setExpandedSummaries] = useState<Set<string>>(new Set());

  const fetchSummaries = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("summaries")
        .select("*")
        .eq("user_id", userId)
        .order("summary_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSummaries(data || []);
    } catch (error) {
      console.error("Error fetching summaries:", error);
      toast.error("Erro ao carregar resumos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaries();
  }, [userId]);

  const handleGenerateSummaries = async () => {
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-summaries', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.summaries_count === 0) {
        // Check details for specific reasons
        const details = data.details || [];
        const noMessages = details.filter((d: any) => d.reason === 'no_messages').length;
        const noText = details.filter((d: any) => d.reason === 'no_text_messages').length;
        
        let description = "Nenhuma mensagem de texto encontrada no período (últimas 24h).";
        if (noMessages > 0) {
          description += ` ${noMessages} grupo(s) sem mensagens.`;
        }
        if (noText > 0) {
          description += ` ${noText} grupo(s) sem mensagens de texto.`;
        }
        description += " Dica: envie mensagens no grupo e tente novamente.";
        
        toast.info(description);
      } else {
        toast.success(`✅ ${data.summaries_count} resumo(s) gerado(s) com sucesso!`);
      }

      await fetchSummaries();
    } catch (error: any) {
      console.error("Error generating summaries:", error);
      toast.error("Erro ao gerar resumos: " + (error.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpand = (summaryId: string) => {
    setExpandedSummaries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId);
      } else {
        newSet.add(summaryId);
      }
      return newSet;
    });
  };

  const filteredSummaries = summaries.filter(summary => {
    const date = parseISO(summary.summary_date);
    switch (selectedPeriod) {
      case "today":
        return isToday(date);
      case "yesterday":
        return isYesterday(date);
      case "week":
        return isThisWeek(date, { locale: ptBR });
      case "month":
        return isThisMonth(date);
      default:
        return true;
    }
  });

  const groupedSummaries = filteredSummaries.reduce((acc, summary) => {
    const date = summary.summary_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(summary);
    return acc;
  }, {} as Record<string, Summary[]>);

  const getDateLabel = (dateString: string) => {
    const date = parseISO(dateString);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="week">Esta Semana</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleGenerateSummaries}
          disabled={generating}
          className="gap-2"
        >
          {generating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando resumos...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Gerar Resumos Agora
            </>
          )}
        </Button>
      </div>

      {Object.keys(groupedSummaries).length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum resumo ainda</h3>
            <p className="text-muted-foreground mb-4">
              Clique em "Gerar Resumos Agora" para começar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedSummaries).map(([date, dateSummaries]) => (
            <div key={date} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Calendar className="w-4 h-4" />
                {getDateLabel(date)}
              </div>

              <div className="space-y-3">
                {dateSummaries.map((summary) => {
                  const isExpanded = expandedSummaries.has(summary.id);
                  const textPreview = summary.summary_text.slice(0, 200);
                  const shouldShowExpand = summary.summary_text.length > 200;

                  return (
                    <Card key={summary.id} className="shadow-soft hover:shadow-hover transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {summary.group_name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base mb-1">
                              {summary.group_name}
                            </CardTitle>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MessageSquare className="w-3 h-3" />
                              {summary.message_count} mensagens
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="prose prose-sm max-w-none text-foreground/90">
                          <div className="whitespace-pre-wrap">
                            {isExpanded ? summary.summary_text : textPreview}
                            {!isExpanded && shouldShowExpand && "..."}
                          </div>
                        </div>
                        {shouldShowExpand && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpand(summary.id)}
                            className="mt-2 h-8 text-xs gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Ver menos
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Ver mais
                              </>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};