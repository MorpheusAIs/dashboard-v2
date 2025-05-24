import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons"
import { useNetworkInfo } from "@/app/hooks/useNetworkInfo"
import { cn } from "@/lib/utils"

export interface SelectFilterOption {
  value: string
  label: string
}

export interface DataFiltersProps {
  // Name filter
  nameFilter?: string
  onNameFilterChange?: (value: string) => void
  nameFilterLabel?: string
  nameFilterPlaceholder?: string
  showNameFilter?: boolean
  
  // Network filter
  networkFilter?: string
  onNetworkFilterChange?: (value: string) => void
  showNetworkFilter?: boolean
  
  // Select filter (for type, status, etc.)
  selectFilter?: string
  onSelectFilterChange?: (value: string) => void
  selectFilterLabel?: string
  selectFilterPlaceholder?: string
  selectFilterOptions?: SelectFilterOption[]
  showSelectFilter?: boolean
  
  // Styling
  className?: string
}

export function DataFilters({
  // Name filter
  nameFilter = "",
  onNameFilterChange,
  nameFilterLabel = "Name",
  nameFilterPlaceholder = "Search by name",
  showNameFilter = true,
  
  // Network filter
  networkFilter = "all",
  onNetworkFilterChange,
  showNetworkFilter = true,
  
  // Select filter
  selectFilter = "all",
  onSelectFilterChange,
  selectFilterLabel = "Type",
  selectFilterPlaceholder = "Select type",
  selectFilterOptions = [],
  showSelectFilter = false,
  
  // Styling
  className = "",
}: DataFiltersProps) {
  const { isTestnet } = useNetworkInfo();

  return (
    <div className={`flex gap-4 mb-6 ${className}`}>
      {showNameFilter && (
        <div className="w-64 space-y-2">
          <Label htmlFor="name-search">{nameFilterLabel}</Label>
          <div className="relative">
            <Input
              id="name-search"
              className="pl-9"
              placeholder={nameFilterPlaceholder}
              value={nameFilter}
              onChange={(e) => onNameFilterChange?.(e.target.value)}
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              <Search size={16} strokeWidth={2} />
            </div>
          </div>
        </div>
      )}
      
      {showSelectFilter && selectFilterOptions.length > 0 && (
        <div className="w-48 space-y-2">
          <Label htmlFor="select-filter">{selectFilterLabel}</Label>
          <Select
            value={selectFilter}
            onValueChange={(value) => onSelectFilterChange?.(value)}
          >
            <SelectTrigger id="select-filter">
              <SelectValue placeholder={selectFilterPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All {selectFilterLabel.toLowerCase()}s</SelectItem>
              {selectFilterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {showNetworkFilter && (
        <div className="w-48 space-y-2">
          <Label>Network</Label>
          <ToggleGroup 
            type="single" 
            value={networkFilter}
            onValueChange={(value) => {
              // Only update if there's a new value and either we're not in testnet or the value is "all"
              if (value && (!isTestnet || value === "all")) {
                onNetworkFilterChange?.(value);
              }
            }}
            className="bg-background border border-input p-1"
          >
            <ToggleGroupItem value="all" className="flex items-center gap-2 px-4">
              All
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="Arbitrum" 
              className={cn(
                "flex items-center gap-2 px-4",
                isTestnet && "opacity-50 cursor-not-allowed"
              )}
              disabled={isTestnet}
            >
              <div className="w-[18px] h-[20px] relative">
                <ArbitrumIcon size={19} className="text-current" fill="currentColor" />
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem 
              value="Base" 
              className={cn(
                "flex items-center gap-2 px-4",
                isTestnet && "opacity-50 cursor-not-allowed"
              )}
              disabled={isTestnet}
            >
              <div className="w-[18px] h-[20px] relative">
                <BaseIcon size={19} className="text-current" fill="currentColor" />
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}
    </div>
  )
} 