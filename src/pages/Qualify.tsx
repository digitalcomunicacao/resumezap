import { useNavigate } from "react-router-dom";
import { LeadQualificationModal } from "@/components/LeadQualificationModal";
import { toast } from "sonner";

const Qualify = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    toast.success("Cadastro completo! Bem-vindo ao Resume Zap!");
    navigate("/dashboard");
  };

  return <LeadQualificationModal onComplete={handleComplete} />;
};

export default Qualify;
