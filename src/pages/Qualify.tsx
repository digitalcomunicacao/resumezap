import { useNavigate } from "react-router-dom";
import { LeadQualificationModal } from "@/components/LeadQualificationModal";
import { toast } from "sonner";

const Qualify = () => {
  const navigate = useNavigate();

  const handleComplete = () => {
    navigate("/dashboard");
  };

  const handleSkip = () => {
    toast.info("Escolha um plano para começar!");
    navigate("/#pricing");
  };

  return <LeadQualificationModal onComplete={handleComplete} onSkip={handleSkip} />;
};

export default Qualify;
