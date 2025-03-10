"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronUp, ChevronDown } from "lucide-react";
import Image from "next/image";
import { MetricCard } from "@/components/metric-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Link from "next/link";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { useBuilders } from "@/context/builders-context";

export default function BuildersPage() {
  // Use the builders context instead of local state
  const {
    // Filtering
    nameFilter,
    setNameFilter,
    rewardTypeFilter,
    setRewardTypeFilter,
    networkFilter,
    setNetworkFilter,
    
    // Sorting
    sortColumn,
    sortDirection,
    setSorting,
    
    // Data
    filteredBuilders,
    rewardTypes,
    isLoading,
    
    // Total metrics (independent of filters)
    totalMetrics
  } = useBuilders();

  // Convert context sorting to the format expected by the UI
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Handle sorting from UI
  const handleSort = (columnId: string) => {
    setSorting(columnId);
  };

  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Active Builders"
          metrics={[{ value: totalMetrics.totalBuilders.toString(), label: "Builders" }]}
        />

        <MetricCard
          title="Total Staked"
          metrics={[{ value: totalMetrics.totalStaked.toLocaleString(), label: "MOR" }]}
        />

        <MetricCard
          className="col-span-2"
          title="Community Stats"
          metrics={[
            { value: totalMetrics.totalStaking.toLocaleString(), label: "Staking" },
            { value: "12.5k", label: "Commits" }
          ]}
        />
      </div>

      <div className="page-section">
        <h2 className="section-title">Explore Builders</h2>
        <div className="section-content group">
          <div className="section-body p-2">
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="w-64 space-y-2">
                <Label htmlFor="name-search">Name</Label>
                <div className="relative">
                  <Input
                    id="name-search"
                    className="pl-9"
                    placeholder="Search builder name"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <Search size={16} strokeWidth={2} />
                  </div>
                </div>
              </div>
              <div className="w-48 space-y-2">
                <Label htmlFor="reward-type">Reward Type</Label>
                <Select
                  value={rewardTypeFilter}
                  onValueChange={setRewardTypeFilter}
                >
                  <SelectTrigger id="reward-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {rewardTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-48 space-y-2">
                <Label>Network</Label>
                <ToggleGroup 
                  type="single" 
                  value={networkFilter}
                  onValueChange={(value) => {
                    // Only update if there's a new value
                    if (value) {
                      setNetworkFilter(value);
                    }
                  }}
                  className="bg-background border border-input p-1"
                >
                  <ToggleGroupItem value="all" className="flex items-center gap-2 px-4">
                    All
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Arbitrum" className="flex items-center gap-2 px-4">
                    <div className="w-[18px] h-[20px] relative">
                      <ArbitrumIcon size={19} className="text-current" />
                    </div>
                    <span>Arbitrum</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Base" className="flex items-center gap-2 px-4">
                    <div className="w-[18px] h-[20px] relative">
                      <BaseIcon size={19} className="text-current" />
                    </div>
                    <span>Base Mainnet</span>
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
              <div className="table-container">
                <Table className="table-base">
                  <TableHeader className="table-header sticky top-0 z-10">
                    <TableRow className="table-header-row">
                      <TableHead className="table-header-cell">Name</TableHead>
                      <TableHead className="table-header-cell">Networks</TableHead>
                      <TableHead className="table-header-cell">Reward Type</TableHead>
                      <TableHead 
                        className="table-header-cell table-header-cell-sortable group"
                        onClick={() => handleSort('totalStaked')}
                      >
                        <div className="flex items-center justify-between">
                          MOR Staked
                          <div className="table-sort-icons">
                            <ChevronUp 
                              className={cn(
                                "table-sort-icon table-sort-icon-up",
                                sorting?.id === 'totalStaked' && !sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                            <ChevronDown 
                              className={cn(
                                "table-sort-icon table-sort-icon-down",
                                sorting?.id === 'totalStaked' && sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                          </div>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="table-header-cell table-header-cell-sortable group"
                        onClick={() => handleSort('stakingCount')}
                      >
                        <div className="flex items-center justify-between">
                          # Staking
                          <div className="table-sort-icons">
                            <ChevronUp 
                              className={cn(
                                "table-sort-icon table-sort-icon-up",
                                sorting?.id === 'stakingCount' && !sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                            <ChevronDown 
                              className={cn(
                                "table-sort-icon table-sort-icon-down",
                                sorting?.id === 'stakingCount' && sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                          </div>
                        </div>
                      </TableHead>
                      <TableHead 
                        className="table-header-cell"
                      >
                        Lock period
                      </TableHead>
                      <TableHead 
                        className="table-header-cell table-header-cell-sortable group"
                        onClick={() => handleSort('minDeposit')}
                      >
                        <div className="flex items-center justify-between">
                          Min MOR Deposit
                          <div className="table-sort-icons">
                            <ChevronUp 
                              className={cn(
                                "table-sort-icon table-sort-icon-up",
                                sorting?.id === 'minDeposit' && !sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                            <ChevronDown 
                              className={cn(
                                "table-sort-icon table-sort-icon-down",
                                sorting?.id === 'minDeposit' && sorting.desc 
                                  ? "table-sort-icon-active" 
                                  : "table-sort-icon-inactive"
                              )} 
                            />
                          </div>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBuilders.map((builder) => (
                      <TableRow 
                        key={builder.id} 
                        className="table-row"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
                              {builder.image && builder.image !== '' ? (
                                <Image
                                  src={builder.image}
                                  alt={builder.name}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                                  {builder.name.charAt(0)}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Link 
                                href={`/builders/${builder.name.toLowerCase().replace(/\s+/g, '-')}`}
                                className="font-medium text-gray-200 hover:text-emerald-400 transition-colors"
                              >
                                {builder.name}
                              </Link>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="table-cell">
                          <div className="flex items-center gap-1">
                            {(builder.networks || []).map((network) => (
                              <div key={network} className="relative" title={network === "Arbitrum" ? "Arbitrum" : "Base Mainnet"}>
                                {network === "Arbitrum" ? (
                                  <ArbitrumIcon size={19} className="text-current" />
                                ) : (
                                  <BaseIcon size={19} className="text-current" />
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-gray-300">
                            {builder.rewardType}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-200">{builder.totalStaked.toLocaleString()}</span>
                        </TableCell>
                        <TableCell className="text-gray-300">
                          {builder.stakingCount}
                        </TableCell>
                        <TableCell className="text-gray-300">{builder.lockPeriod}</TableCell>
                        <TableCell className="text-gray-300">{builder.minDeposit}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-center my-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      )}
    </div>
  );
}