import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, MessageSquare, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function OverviewMetrics() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    trialsActive: 0,
    trialsPermanent: 0,
    trialsExpiring: 0,
    stripeSubscriptions: 0,
    conversionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [usersRes, trialsRes, stripeRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('manual_subscription, subscription_end_date').eq('manual_subscription', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).not('stripe_customer_id', 'is', null),
        ]);

        // Processar trials
        const trialsData = trialsRes.data || [];
        const now = new Date();
        const trialsPermanent = trialsData.filter(t => !t.subscription_end_date).length;
        const trialsExpiring = trialsData.filter(t => {
          if (!t.subscription_end_date) return false;
          const endDate = new Date(t.subscription_end_date);
          return endDate > now;
        }).length;

        const totalUsers = usersRes.count || 0;
        const stripeSubscriptions = stripeRes.count || 0;
        const conversionRate = totalUsers > 0 ? ((stripeSubscriptions / totalUsers) * 100) : 0;

        setMetrics({
          totalUsers,
          trialsActive: trialsData.length,
          trialsPermanent,
          trialsExpiring,
          stripeSubscriptions,
          conversionRate,
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const cards = [
    {
      title: "Total de Usuários",
      value: metrics.totalUsers,
      subtitle: "usuários cadastrados",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Trials Ativos",
      value: metrics.trialsActive,
      subtitle: `${metrics.trialsPermanent} permanentes, ${metrics.trialsExpiring} com prazo`,
      icon: Users,
      color: "text-yellow-500",
    },
    {
      title: "Assinaturas Pagas",
      value: metrics.stripeSubscriptions,
      subtitle: "via Stripe",
      icon: CreditCard,
      color: "text-green-500",
    },
    {
      title: "Taxa de Conversão",
      value: `${metrics.conversionRate.toFixed(1)}%`,
      subtitle: `${metrics.stripeSubscriptions} de ${metrics.totalUsers} usuários`,
      icon: MessageSquare,
      color: "text-purple-500",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-soft">
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
