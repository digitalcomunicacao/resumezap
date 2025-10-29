import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { SummaryPreferences } from "@/components/settings/SummaryPreferences";
import { SummaryCustomization } from "@/components/SummaryCustomization";

const Settings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Resume Zap</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Configurações</h1>
            <p className="text-muted-foreground">
              Personalize sua experiência com o Resume Zap
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">Geral</TabsTrigger>
              <TabsTrigger value="summaries">Resumos</TabsTrigger>
              <TabsTrigger value="account">Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <Card className="shadow-soft">
                <GeneralSettings userId={user?.id || ''} />
              </Card>
            </TabsContent>

            <TabsContent value="summaries" className="space-y-4">
              <Card className="shadow-soft">
                <SummaryPreferences userId={user?.id || ''} />
              </Card>
              
              <SummaryCustomization userId={user?.id || ''} />
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <Card className="shadow-soft">
                <AccountSettings userId={user?.id || ''} />
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Settings;
