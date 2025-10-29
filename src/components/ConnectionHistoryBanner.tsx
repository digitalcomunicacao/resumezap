import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConnectionHistoryBannerProps {
  summariesCount: number;
  groupsCount: number;
  whatsappConnected: boolean;
}

export const ConnectionHistoryBanner = ({
  summariesCount,
  groupsCount,
  whatsappConnected,
}: ConnectionHistoryBannerProps) => {
  const navigate = useNavigate();

  if (whatsappConnected || (summariesCount === 0 && groupsCount === 0)) {
    return null;
  }

  return (
    <Alert variant="default" className="border-primary/20 bg-primary/5">
      <History className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary">Seu histórico está seguro!</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 mt-2">
        <p className="text-sm text-muted-foreground">
          Você tem <strong>{summariesCount} resumos</strong> e{" "}
          <strong>{groupsCount} grupos configurados</strong> salvos.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => navigate("/connect-whatsapp")}
            size="sm"
            variant="default"
          >
            Reconectar WhatsApp
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};
