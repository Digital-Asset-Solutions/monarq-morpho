import { TableHead } from "@morpho-org/uikit/components/shadcn/table";
import { ChevronUp, ChevronDown } from "lucide-react";

export type SortDirection = "asc" | "desc" | null;

export interface SortableTableHeadProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort: { column: string | null; direction: SortDirection };
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTableHead({ children, sortKey, currentSort, onSort, className }: SortableTableHeadProps) {
  const isActive = currentSort.column === sortKey;
  const showUpArrow = isActive && currentSort.direction === "asc";
  const showDownArrow = isActive && currentSort.direction === "desc";

  return (
    <TableHead
      className={`${className} hover:bg-primary/80 cursor-pointer select-none transition-colors`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1 text-xs font-light">
        {children}
        <div className="flex h-4 w-4 flex-col items-center justify-center">
          <ChevronUp className={`h-3 w-3 ${showUpArrow ? "opacity-100" : "opacity-30"}`} />
          <ChevronDown className={`-mt-1 h-3 w-3 ${showDownArrow ? "opacity-100" : "opacity-30"}`} />
        </div>
      </div>
    </TableHead>
  );
}

export function useSorting<T>(
  data: T[],
  sortConfig: { column: string | null; direction: SortDirection },
  getSortValue: (item: T, column: string) => number,
) {
  if (!sortConfig.column || !sortConfig.direction) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aValue = getSortValue(a, sortConfig.column!);
    const bValue = getSortValue(b, sortConfig.column!);

    if (sortConfig.direction === "asc") {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });
}

export function createSortHandler(
  currentSort: { column: string | null; direction: SortDirection },
  setSort: (sort: { column: string | null; direction: SortDirection }) => void,
) {
  return (column: string) => {
    if (currentSort.column === column) {
      // Cycle through: asc -> desc -> null
      if (currentSort.direction === "asc") {
        setSort({ column, direction: "desc" });
      } else if (currentSort.direction === "desc") {
        setSort({ column: null, direction: null });
      } else {
        setSort({ column, direction: "asc" });
      }
    } else {
      setSort({ column, direction: "asc" });
    }
  };
}
