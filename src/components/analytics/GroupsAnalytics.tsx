import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function GroupsAnalytics() {
  const [topGroups, setTopGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopGroups = async () => {
      try {
        const { data, error } = await supabase
          .from('summaries')
          .select('group_name, group_id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        const groupCounts = (data || []).reduce((acc: any, summary) => {
          const key = summary.group_id;
          if (!acc[key]) {
            acc[key] = {
              group_name: summary.group_name,
              group_id: summary.group_id,
              count: 0,
            };
          }
          acc[key].count++;
          return acc;
        }, {});

        const sorted = Object.values(groupCounts)
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 5);

        setTopGroups(sorted);
      } catch (error) {
        console.error('Error fetching groups data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopGroups();
  }, []);

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  if (topGroups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum grupo com resumos nos últimos 7 dias
      </div>
    );
  }

  const maxCount = Math.max(...topGroups.map(g => g.count), 1);

  return (
    <div className="space-y-4">
      {topGroups.map((group, index) => {
        const percentage = (group.count / maxCount) * 100;

        return (
          <div key={group.group_id} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {index + 1}
                </span>
                <span className="font-medium truncate max-w-[200px]">
                  {group.group_name}
                </span>
              </div>
              <span className="text-muted-foreground">{group.count} resumos</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
