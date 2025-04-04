"use client"

import { useState, useMemo } from "react"
import { MetricCard } from "@/components/metric-card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons"
import { BecomeSubnetModal } from "@/components/become-subnet-modal"
import { useCompute } from "@/context/compute-context"
import { DataTable, Column } from "@/components/ui/data-table"
import { DataFilters } from "@/components/ui/data-filters"
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params'
import { GlowingEffect } from "@/components/ui/glowing-effect"

// Interfaces
interface Subnet {
  id: string;
  name: string;
  description?: string;
  network?: string;
  status?: string;
  stakeAmount?: number;
  fee: number;
  totalStaked: number;
  totalClaimed: number;
  stakingCount: number;
  owner?: string;
  deregistrationOpensAt?: string;
  createdAt?: string;
}

interface UserSubnet {
  id: string;
  name: string;
  description: string;
  network: string;
  status: string;
  stakeAmount: number;
  createdAt: string;
}

// Separate component for the modal to ensure it works independently
function SubnetModalWrapper() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  return (
    <div className="flex gap-4 items-center">
      <button 
        onClick={() => setIsModalOpen(true)}
        className="copy-button mb-4"
      >
        Become a Subnet
      </button>
      
      <BecomeSubnetModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    </div>
  );
}

// Sample subnets data for the "Your Subnets" tab
const sampleSubnets: UserSubnet[] = [
  {
    id: "6bd0895b-0baf-47d8-b39a-768d3550f826",
    name: "GenAscend",
    description: "GenAscend on Arbitrum",
    network: "Arbitrum",
    status: "Active",
    stakeAmount: 5000,
    createdAt: "2023-10-15",
  },
  {
    id: "6e330560-23d3-4939-b3a1-f1af3a5c1649",
    name: "Titan.io",
    description: "Titan.io on Arbitrum",
    network: "Arbitrum",
    status: "Active",
    stakeAmount: 7500,
    createdAt: "2023-11-22",
  },
  {
    id: "a1b2c3d4-e5f6-4a5b-9c8d-7e6f5a4b3c2d",
    name: "4kGpL8",
    description: "4kGpL8 subnet for ML computation",
    network: "Base",
    status: "Pending",
    stakeAmount: 3000,
    createdAt: "2024-01-05",
  },
  {
    id: "b2c3d4e5-f6a7-5b6c-0d1e-8f7g6h5j4k3",
    name: "aB3dH7",
    description: "High-performance AI subnet",
    network: "Arbitrum",
    status: "Active",
    stakeAmount: 10000,
    createdAt: "2023-09-10",
  },
  {
    id: "c3d4e5f6-a7b8-6c7d-1e2f-9g8h7j6k5l4",
    name: "9nRt5e",
    description: "Storage subnet on Base",
    network: "Base",
    status: "Inactive",
    stakeAmount: 2500,
    createdAt: "2024-02-20",
  },
];

export default function ComputePage() {
  // Use the URL params hook
  const { getParam, setParam } = useUrlParams();

  // Use the compute context
  const {
    // Filtering
    nameFilter,
    setNameFilter,
    networkFilter,
    setNetworkFilter,
    
    // Sorting
    sortColumn,
    sortDirection,
    setSorting,
    
    // Data
    filteredSubnets,
    isLoading,
    
    // Total metrics (independent of filters)
    totalMetrics
  } = useCompute();

  // Initialize tab state from URL or use default 
  const [activeTab, setActiveTab] = useState(() => {
    return getParam('tab') || 'compute';
  });

  // Convert context sorting to the format expected by the UI
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Define columns for the compute table
  const computeColumns: Column<Subnet>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (subnet) => (
          <div className="flex items-center gap-3">
            <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
              <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                {subnet.name.charAt(0)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                href={`/subnets/${subnet.id}`}
                className="font-medium text-gray-200 hover:text-emerald-400 transition-colors"
              >
                {subnet.name}
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "fee",
        header: "Subnet Fee",
        accessorKey: "fee",
        enableSorting: true,
        cell: (subnet) => (
          <span className="text-gray-200">{subnet.fee.toLocaleString()}%</span>
        ),
      },
      {
        id: "totalStaked",
        header: "MOR Staked",
        accessorKey: "totalStaked",
        enableSorting: true,
        cell: (subnet) => (
          <span className="text-gray-200">{subnet.totalStaked.toLocaleString()} MOR</span>
        ),
      },
      {
        id: "totalClaimed",
        header: "MOR Claimed",
        accessorKey: "totalClaimed",
        enableSorting: true,
        cell: (subnet) => (
          <span className="text-gray-300">{subnet.totalClaimed.toLocaleString()} MOR</span>
        ),
      },
      {
        id: "stakingCount",
        header: "# Staking",
        accessorKey: "stakingCount",
        enableSorting: true,
        cell: (subnet) => (
          <span className="text-gray-300">{subnet.stakingCount}</span>
        ),
      },
    ],
    []
  );

  // Define columns for the subnets table
  const subnetsColumns: Column<UserSubnet>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (subnet) => (
          <div className="flex items-center gap-3">
            <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
              <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                {subnet.name.charAt(0)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link 
                href={`/subnets/${subnet.id}`}
                className="font-medium text-gray-200 hover:text-emerald-400 transition-colors"
              >
                {subnet.name}
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "network",
        header: "Network",
        cell: (subnet) => (
          <div className="flex items-center gap-1">
            <div className="relative">
              {subnet.network === "Arbitrum" ? (
                <ArbitrumIcon size={19} className="text-current" />
              ) : (
                <BaseIcon size={19} className="text-current" />
              )}
            </div>
          </div>
        ),
      },
      {
        id: "description",
        header: "Description",
        accessorKey: "description",
        cell: (subnet) => (
          <span className="text-gray-300">{subnet.description}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        accessorKey: "status",
        cell: (subnet) => (
          <span className={cn(
            "px-2 py-1 rounded-full text-xs",
            subnet.status === "Active" ? "bg-emerald-900/30 text-emerald-400" :
            subnet.status === "Pending" ? "bg-yellow-900/30 text-yellow-400" :
            "bg-red-900/30 text-red-400"
          )}>
            {subnet.status}
          </span>
        ),
      },
      {
        id: "stakeAmount",
        header: "Stake Amount",
        accessorKey: "stakeAmount",
        cell: (subnet) => (
          <span className="text-gray-200">{subnet.stakeAmount.toLocaleString()} MOR</span>
        ),
      },
      {
        id: "createdAt",
        header: "Created At",
        accessorKey: "createdAt",
        cell: (subnet) => (
          <span className="text-gray-300">{subnet.createdAt}</span>
        ),
      },
    ],
    []
  );

  // Define state for your subnets tab filters
  const [yourSubnetsNameFilter, setYourSubnetsNameFilter] = useState("");
  const [yourSubnetsNetworkFilter, setYourSubnetsNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Filter the sampleSubnets based on the filters
  const filteredSampleSubnets = useMemo(() => {
    return sampleSubnets.filter((subnet) => {
      const matchesName = yourSubnetsNameFilter === '' || 
        subnet.name.toLowerCase().includes(yourSubnetsNameFilter.toLowerCase());
      
      const matchesNetwork =
        yourSubnetsNetworkFilter === "all" || yourSubnetsNetworkFilter === "" || 
        subnet.network === yourSubnetsNetworkFilter;
      
      const matchesStatus =
        statusFilter === "all" || statusFilter === "" || 
        subnet.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesName && matchesNetwork && matchesStatus;
    });
  }, [yourSubnetsNameFilter, yourSubnetsNetworkFilter, statusFilter]);

  // Handle tab change with manual URL update
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setParam('tab', value);
  };

  // For your subnets filters, initialize from URL only if values exist
  useInitStateFromUrl(
    'subnet_name',
    (value) => {
      if (value !== '') setYourSubnetsNameFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'subnet_network',
    (value) => {
      if (value !== '') setYourSubnetsNetworkFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'subnet_status',
    (value) => {
      if (value !== '') setStatusFilter(value);
    },
    ParamConverters.string.deserialize
  );

  return (
    <div className="page-container">
      <div className="page-grid">
        <div className="relative">
          <MetricCard
            title="Compute Participants"
            metrics={[{ value: totalMetrics.totalSubnets.toString(), label: "Subnets" }]}
            disableGlow={true}
          />
          <GlowingEffect 
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            borderRadius="rounded-xl"
          />
        </div>

        <div className="relative">
          <MetricCard
            title="Total Staked"
            metrics={[{ value: totalMetrics.totalStaked, label: "MOR" }]}
            disableGlow={true}
            autoFormatNumbers={true}
          />
          <GlowingEffect 
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            borderRadius="rounded-xl"
          />
        </div>

        <div className="relative col-span-2">
          <MetricCard
            className="col-span-2"
            title="Network Stats"
            metrics={[
              { value: totalMetrics.totalStaking.toLocaleString(), label: "Staking" },
              { value: "99.99%", label: "Uptime" }
            ]}
            disableGlow={true}
          />
          <GlowingEffect 
            spread={40}
            glow={true}
            disabled={false}
            proximity={64}
            inactiveZone={0.01}
            borderWidth={2}
            borderRadius="rounded-xl"
          />
        </div>
      </div>

      <div className="page-section">
        <Tabs 
          value={activeTab} 
          onValueChange={handleTabChange}
          className="w-full"
        >
          <div className="flex justify-between items-center align-middle mb-4">
            <div className="flex flex-row items-center gap-4 align-middle">
              <h2 className="flex section-title">Explore</h2>
              <TabsList className="flex h-auto rounded-none border-b border-gray-800 bg-transparent p-0 -mt-3">
                <TabsTrigger
                  value="compute"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Compute
                </TabsTrigger>
                <TabsTrigger
                  value="subnets"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Your Subnets
                </TabsTrigger>
              </TabsList>
            </div>
            <SubnetModalWrapper />
          </div>
          
          <div className="section-content group">
            <TabsContent value="compute">
              <div className="section-body p-2">
                {/* Filters for compute */}
                <DataFilters
                  nameFilter={nameFilter}
                  onNameFilterChange={(value) => {
                    setNameFilter(value);
                    setParam('name', value || null);
                  }}
                  nameFilterLabel="Name"
                  nameFilterPlaceholder="Search subnet name"
                  
                  networkFilter={networkFilter}
                  onNetworkFilterChange={(value) => {
                    setNetworkFilter(value);
                    setParam('network', value === 'all' ? null : value);
                  }}
                  showNetworkFilter={true}
                  
                  showSelectFilter={false}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={computeColumns}
                    data={filteredSubnets}
                    isLoading={isLoading}
                    sorting={sorting}
                    onSortingChange={(columnId: string) => {
                      setSorting(columnId);
                      // Determine the direction based on current state
                      const newDirection = columnId === sortColumn && sortDirection === 'asc' ? 'desc' : 'asc';
                      // Update URL parameter
                      setParam('sort', `${columnId}-${newDirection}`);
                    }}
                    loadingRows={6}
                    noResultsMessage="No subnets found."
                    onRowClick={(subnet) => {
                      window.location.href = `/compute/${subnet.name.toLowerCase().replace(/\s+/g, '-')}`;
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Your Subnets Tab Content */}
            <TabsContent value="subnets">
              <div className="section-body p-2">
                {/* Filters for your subnets */}
                <div className="flex gap-4 mb-6">
                  <DataFilters
                    nameFilter={yourSubnetsNameFilter}
                    onNameFilterChange={(value) => {
                      setYourSubnetsNameFilter(value);
                      setParam('subnet_name', value || null);
                    }}
                    nameFilterLabel="Subnet Name"
                    nameFilterPlaceholder="Search subnet name"
                    
                    networkFilter={yourSubnetsNetworkFilter}
                    onNetworkFilterChange={(value) => {
                      setYourSubnetsNetworkFilter(value);
                      setParam('subnet_network', value === 'all' ? null : value);
                    }}
                    showNetworkFilter={true}
                    
                    selectFilter={statusFilter}
                    onSelectFilterChange={(value) => {
                      setStatusFilter(value);
                      setParam('subnet_status', value === 'all' ? null : value);
                    }}
                    selectFilterLabel="Status"
                    selectFilterPlaceholder="Select status"
                    selectFilterOptions={[
                      { value: "active", label: "Active" },
                      { value: "pending", label: "Pending" },
                      { value: "inactive", label: "Inactive" },
                    ]}
                    showSelectFilter={true}
                  />
                </div>

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={subnetsColumns}
                    data={filteredSampleSubnets}
                    isLoading={false}
                    loadingRows={6}
                    noResultsMessage="No subnets found."
                    onRowClick={(subnet) => {
                      window.location.href = `/subnets/${subnet.id}`;
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
} 