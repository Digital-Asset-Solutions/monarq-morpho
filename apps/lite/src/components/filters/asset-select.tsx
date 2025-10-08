import { Avatar, AvatarFallback, AvatarImage } from "@morpho-org/uikit/components/shadcn/avatar";
import { Input } from "@morpho-org/uikit/components/shadcn/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@morpho-org/uikit/components/shadcn/select";
import { Token } from "@morpho-org/uikit/lib/utils";
import { blo } from "blo";
import { Search } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Address } from "viem";

interface AssetSelectProps {
  value?: string;
  onChange: (value: string) => void;
  tokens: Map<Address, Token>;
  placeholder: string;
  className?: string;
  customAllPlaceholder?: string;
}

export function AssetSelect({
  value,
  onChange,
  tokens,
  placeholder,
  className,
  customAllPlaceholder = "All Assets",
}: AssetSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const uniqueTokens = Array.from(tokens.values()).reduce((acc, token) => {
    const existing = acc.find((t) => t.address?.toLowerCase() === token.address?.toLowerCase());
    if (!existing && token.symbol) {
      acc.push(token);
    }
    return acc;
  }, [] as Token[]);

  // Sort tokens alphabetically by symbol
  uniqueTokens.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

  // Filter tokens based on search term
  const filteredTokens = uniqueTokens.filter(
    (token) =>
      token.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.address?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Auto-focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small delay to ensure the content is rendered
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
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="relative">
          <Search className="text-muted-foreground absolute left-2 top-2.5 h-4 w-4" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="mb-2 pl-8"
            onKeyDown={(e) => {
              // Prevent the select from closing on certain keys
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
        <SelectItem value="all">{customAllPlaceholder}</SelectItem>
        {filteredTokens.map((token) => (
          <SelectItem key={token.address} value={token.address?.toLowerCase()}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 rounded-full">
                <AvatarImage src={token.imageSrc} alt={token.symbol} />
                <AvatarFallback delayMs={1000}>
                  <img src={blo(token.address || "")} />
                </AvatarFallback>
              </Avatar>
              {token.symbol}
            </div>
          </SelectItem>
        ))}
        {filteredTokens.length === 0 && searchTerm && (
          <div className="text-muted-foreground px-2 py-3 text-sm">No assets found</div>
        )}
      </SelectContent>
    </Select>
  );
}
