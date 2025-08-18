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

interface LoanTokenSelectProps {
  value?: string;
  onChange: (value: string) => void;
  tokens: Map<Address, Token>;
  className?: string;
}

export function LoanTokenSelect({ value, onChange, tokens, className }: LoanTokenSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const uniqueTokens = Array.from(tokens.values()).reduce((acc, token) => {
    const existing = acc.find(t => t.address.toLowerCase() === token.address.toLowerCase());
    if (!existing && token.symbol) {
      acc.push(token);
    }
    return acc;
  }, [] as Token[]);

  // Sort tokens alphabetically by symbol
  uniqueTokens.sort((a, b) => (a.symbol || '').localeCompare(b.symbol || ''));

  // Filter tokens based on search term
  const filteredTokens = uniqueTokens.filter(token => 
    token.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.address?.toLowerCase().includes(searchTerm.toLowerCase())
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
        <SelectValue placeholder="All Loan Tokens" />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(e) => e.preventDefault()}>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            type="text"
            placeholder="Search tokens..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 mb-2"
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
        <SelectItem value="all">All Loan Tokens</SelectItem>
        {filteredTokens.map((token) => (
          <SelectItem key={token.address} value={token.address.toLowerCase()}>
            <div className="flex items-center gap-2">
              <Avatar className="h-4 w-4 rounded-full">
                <AvatarImage src={token.imageSrc} alt={token.symbol} />
                <AvatarFallback delayMs={1000}>
                  <img src={blo(token.address)} />
                </AvatarFallback>
              </Avatar>
              {token.symbol}
            </div>
          </SelectItem>
        ))}
        {filteredTokens.length === 0 && searchTerm && (
          <div className="px-2 py-3 text-sm text-muted-foreground">No tokens found</div>
        )}
      </SelectContent>
    </Select>
  );
}
