import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLimit: number;
}

export const UpgradeModal = ({ open, onOpenChange, currentLimit }: UpgradeModalProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/');
    setTimeout(() => {
      const element = document.getElementById('pricing');
      element?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex justify-center mb-4">
            <Crown className="w-12 h-12 text-primary" />
          </div>
          <AlertDialogTitle className="text-center">
            Limite de Grupos Atingido
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Seu plano atual permite monitorar até {currentLimit} grupo{currentLimit > 1 ? 's' : ''}.
            Faça upgrade para desbloquear mais grupos e aproveitar todos os recursos premium!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleUpgrade}>
            Ver Planos
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
