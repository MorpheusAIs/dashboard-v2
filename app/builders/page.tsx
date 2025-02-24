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
import { useState, useMemo } from "react";
import { NetworkIcon } from '@web3icons/react'
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import Link from "next/link";
import { builders } from "./builders-data";

export default function BuildersPage() {
  const [nameFilter, setNameFilter] = useState("");
  const [rewardTypeFilter, setRewardTypeFilter] = useState<string>("all");
  const [networkFilter, setNetworkFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<{ id: string; desc: boolean } | null>(null);

  // Get unique reward types for the dropdown
  const rewardTypes = useMemo(() => {
    const types = builders.map(builder => builder.rewardType);
    return Array.from(new Set(types));
  }, []);

  // Filter and sort builders
  const filteredBuilders = useMemo(() => {
    let result = builders.filter(builder => {
      const matchesName = builder.name.toLowerCase().includes(nameFilter.toLowerCase());
      const matchesRewardType = rewardTypeFilter === "all" || builder.rewardType === rewardTypeFilter;
      const matchesNetwork = networkFilter === "all" || builder.networks.includes(networkFilter);
      return matchesName && matchesRewardType && matchesNetwork;
    });

    if (sorting) {
      result = [...result].sort((a, b) => {
        const aValue = a[sorting.id as keyof typeof a];
        const bValue = b[sorting.id as keyof typeof b];
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sorting.desc ? bValue - aValue : aValue - bValue;
        }
        return 0;
      });
    }

    return result;
  }, [builders, nameFilter, rewardTypeFilter, networkFilter, sorting]);

  const handleSort = (columnId: string) => {
    setSorting(current => {
      // If clicking the same column
      if (current?.id === columnId) {
        // If it was ascending, make it descending
        if (!current.desc) {
          return { id: columnId, desc: true };
        }
        // If it was descending, remove sorting
        return null;
      }
      // If clicking a new column, start with ascending
      return { id: columnId, desc: false };
    });
  };

  return (
    <div className="page-container">
      <div className="page-grid">
        <MetricCard
          title="Active Builders"
          metrics={[{ value: "75", label: "Builders" }]}
        />

        <MetricCard
          title="Total Staked"
          metrics={[{ value: "100,000", label: "MOR" }]}
        />

        <MetricCard
          className="col-span-2"
          title="Community Stats"
          metrics={[
            { value: "578", label: "Staking" },
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
                    <NetworkIcon name="arbitrum" size={18} />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="Base" className="flex items-center gap-2 px-4">
                    <NetworkIcon name="base" size={18} />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
              <Table className="border-separate border-spacing-0 [&_td]:border-border [&_th]:border-b [&_th]:border-border [&_tr:not(:last-child)_td]:border-b [&_tr]:border-none">
                <TableHeader className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm">
                  <TableRow className="hover:bg-transparent border-b border-white/[0.08]">
                    <TableHead className="text-sm font-medium text-gray-400">Name</TableHead>
                    <TableHead className="text-sm font-medium text-gray-400">Networks</TableHead>
                    <TableHead className="text-sm font-medium text-gray-400">Reward Type</TableHead>
                    <TableHead 
                      className="text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 transition-colors group"
                      onClick={() => handleSort('totalStaked')}
                    >
                      <div className="flex items-center justify-between">
                        MOR Staked
                        <div className="flex flex-col ml-2">
                          <ChevronUp 
                            className={cn(
                              "h-3 w-3 -mb-0.5",
                              sorting?.id === 'totalStaked' && !sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
                            )} 
                          />
                          <ChevronDown 
                            className={cn(
                              "h-3 w-3 -mt-0.5",
                              sorting?.id === 'totalStaked' && sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
                            )} 
                          />
                        </div>
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 transition-colors group"
                      onClick={() => handleSort('stakingCount')}
                    >
                      <div className="flex items-center justify-between">
                        # Staking
                        <div className="flex flex-col ml-2">
                          <ChevronUp 
                            className={cn(
                              "h-3 w-3 -mb-0.5",
                              sorting?.id === 'stakingCount' && !sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
                            )} 
                          />
                          <ChevronDown 
                            className={cn(
                              "h-3 w-3 -mt-0.5",
                              sorting?.id === 'stakingCount' && sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
                            )} 
                          />
                        </div>
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-sm font-medium text-gray-400"
                    >
                      Lock period
                    </TableHead>
                    <TableHead 
                      className="text-sm font-medium text-gray-400 cursor-pointer hover:text-gray-200 transition-colors group"
                      onClick={() => handleSort('minDeposit')}
                    >
                      <div className="flex items-center justify-between">
                        Min MOR Deposit
                        <div className="flex flex-col ml-2">
                          <ChevronUp 
                            className={cn(
                              "h-3 w-3 -mb-0.5",
                              sorting?.id === 'minDeposit' && !sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
                            )} 
                          />
                          <ChevronDown 
                            className={cn(
                              "h-3 w-3 -mt-0.5",
                              sorting?.id === 'minDeposit' && sorting.desc 
                                ? "text-emerald-400" 
                                : "text-gray-500/50 group-hover:text-gray-500"
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
                      className="border-b border-white/[0.08] hover:bg-emerald-400/10 transition-colors"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
                            <Image
                              src={builder.image}
                              alt={builder.name}
                              fill
                              className="object-cover"
                            />
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
                      <TableCell>
                        <div className="flex -space-x-1">
                          {builder.networks.map((network) => (
                            <div
                              key={network}
                              className="relative"
                            >
                              <NetworkIcon 
                                name={network.toLowerCase()} 
                                size={22} 
                              />
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
  );
}