import { Avatar, AvatarFallback, AvatarImage } from "@morpho-org/uikit/components/shadcn/avatar";
import { Input } from "@morpho-org/uikit/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@morpho-org/uikit/components/shadcn/select";
import { blo } from "blo";
import { Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { hashMessage, Address } from "viem";

import { type DisplayableCurators } from "@/lib/curators";

interface CuratorSelectProps {
  value?: string;
  onChange: (value: string) => void;
  curators: { [name: string]: DisplayableCurators[string] }[];
  className?: string;
}

export function CuratorSelect({ value, onChange, curators, className }: CuratorSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get unique curators from all rows
  const uniqueCurators = curators.reduce(
    (acc, rowCurators) => {
      Object.values(rowCurators).forEach((curator) => {
        if (!acc.some((c) => c.name === curator.name)) {
          acc.push(curator);
        }
      });
      return acc;
    },
    [] as DisplayableCurators[string][],
  );

  // Sort curators alphabetically by name
  uniqueCurators.sort((a, b) => a.name.localeCompare(b.name));

  // Filter curators based on search term
  const filteredCurators = uniqueCurators.filter((curator) =>
    curator.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);
    }
  }, [isOpen]);

  return (
    <Select
      value={value}
      onValueChange={onChange}
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setSearchTerm("");
      }}
    >
      <SelectTrigger className={`min-w-[180px] ${className}`}>
        <SelectValue placeholder="All Curators" />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search curators..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2 pl-8"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsOpen(false);
              } else {
                e.stopPropagation();
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
          />
        </div>
        <SelectItem value="all">All Curators</SelectItem>
        {filteredCurators.map((curator) => (
          <SelectItem key={curator.name} value={curator.name.toLowerCase()}>
            <div className="flex items-center gap-2">
              <Avatar className="h-4 w-4 rounded-full">
                <AvatarImage src={curator.imageSrc ?? ""} alt={curator.name} />
                <AvatarFallback delayMs={500}>
                  <img src={blo(hashMessage(curator.name).padEnd(42, "0").slice(0, 42) as Address)} />
                </AvatarFallback>
              </Avatar>
              {curator.name}
            </div>
          </SelectItem>
        ))}
        {filteredCurators.length === 0 && searchTerm && (
          <div className="text-muted-foreground px-2 py-3 text-sm">No curators found</div>
        )}
      </SelectContent>
    </Select>
  );
}
