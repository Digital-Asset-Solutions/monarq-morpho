import { Input } from "@morpho-org/uikit/components/shadcn/input";
import { Search } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder = "Search...", className }: SearchBarProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="text-muted-foreground absolute left-3 h-4 w-4" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus:bg-background py-2 pl-10 pr-4 shadow-none"
      />
    </div>
  );
}
