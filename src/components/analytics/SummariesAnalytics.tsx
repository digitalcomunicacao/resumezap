import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

export function SummariesAnalytics() {
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDailyData = async () => {
      try {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          return format(date, 'yyyy-MM-dd');
        });

        const promises = last7Days.map(async (date) => {
          const { count } = await supabase
            .from('summaries')
            .select('id', { count: 'exact', head: true })
            .eq('summary_date', date);

          return { date, count: count || 0 };
        });

        const results = await Promise.all(promises);
        setDailyData(results);
      } catch (error) {
        console.error('Error fetching summaries data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDailyData();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  const maxCount = Math.max(...dailyData.map(d => d.count), 1);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {dailyData.map((day) => {
          const percentage = (day.count / maxCount) * 100;
          const displayDate = format(new Date(day.date), "dd 'de' MMM", { locale: ptBR });

          return (
            <div key={day.date} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{displayDate}</span>
                <span className="font-medium">{day.count} resumos</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
