import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { ArrowLeft } from "lucide-react";

interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  icon?: React.ReactNode;
}

export function DetailHeader({ title, subtitle, onBack, icon }: DetailHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="flex items-center gap-2 text-secondary-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-secondary-foreground">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
