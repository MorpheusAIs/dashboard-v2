"use client";

import { useState, useMemo } from "react";
import { MetricCard } from "@/components/metric-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { ExternalLink } from "lucide-react";
import { BulkRegistrationModal } from "@/components/bulk-registration-modal";
import { useBuilders } from "@/context/builders-context";
import { useAuth } from "@/context/auth-context";
import { DataTable, Column } from "@/components/ui/data-table";
import { DataFilters } from "@/components/ui/data-filters";
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Builder } from "@/app/builders/builders-data";
import { useUrlParams, useInitStateFromUrl, ParamConverters } from '@/lib/utils/url-params';
import { StakeVsTotalChart } from "@/components/stake-vs-total-chart";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { formatNumber } from "@/lib/utils";
import { builderNameToSlug } from "@/app/utils/supabase-utils";

// Interfaces
interface UserSubnet {
  id: string;
  name: string;
  description: string;
  network: string;
  status: string;
  stakeAmount: number;
  createdAt: string;
  image?: string;
}

// Add this function near the top of the file, before the component definition
/**
 * Validates if a URL is properly formatted and has a valid image file extension
 */
function isValidImageUrl(url?: string): boolean {
  if (!url) return false;
  
  try {
    // First check if it's a properly formatted URL
    const isProperlyFormatted = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
    if (!isProperlyFormatted) return false;
    
    // For absolute URLs, parse and check if pathname contains an image extension
    if (url.startsWith('http')) {
      try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname.toLowerCase();
        // Check if the pathname contains a valid image extension
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
        return validExtensions.some(ext => pathname.includes(ext));
      } catch {
        // If URL parsing fails, fall back to simple check
        return checkSimpleImageExtension(url);
      }
    } 
    
    // For relative URLs or fallback, do a simple check
    return checkSimpleImageExtension(url);
  } catch {
    return false;
  }
}

/**
 * Simple check for image extension anywhere in the URL string
 */
function checkSimpleImageExtension(url: string): boolean {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const urlLower = url.toLowerCase();
  return validExtensions.some(ext => urlLower.includes(ext));
}

// Separate component for the modal to ensure it works independently
function BuilderModalWrapper() {
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const { isAdmin } = useAuth();
  
  return (
    <div className="flex gap-4 items-center">
      {isAdmin && (
        <button 
          onClick={() => setIsBulkModalOpen(true)}
          className="copy-button copy-button-secondary mb-4"
        >
          Bulk registration
        </button>
      )}
      
      <Link href="/builders/newsubnet">
        <button
          className="copy-button mb-4"
        >
          Become a Builder
        </button>
      </Link>
      
      {isAdmin && (
        <BulkRegistrationModal
          open={isBulkModalOpen}
          onOpenChange={setIsBulkModalOpen}
        />
      )}
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

// Sample data for Participating tab - Projects where the user has staked tokens
const participatingBuilders: Builder[] = [
  {
    id: "1",
    name: "Neptune AI",
    description: "AI acceleration subnet for deep learning models",
    image: "/images/builders/neptune.png",
    totalStaked: 7250,
    reward_types: ["Token"],
    website: "https://neptune.ai",
    networks: ["Arbitrum"],
    lockPeriod: "30 days",
    stakingCount: 48,
    userStake: 1200,
    minDeposit: 1000,
    network: "Arbitrum",
    long_description: "",
    image_src: "",
    tags: [],
    github_url: "",
    twitter_url: "",
    discord_url: "",
    contributors: 0,
    github_stars: 0,
    reward_types_detail: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "2",
    name: "Quantum Forge",
    description: "Distributed computing network for quantum simulations",
    image: "/images/builders/quantum.png",
    totalStaked: 12800,
    reward_types: ["Token"],
    website: "https://quantumforge.network",
    networks: ["Base"],
    lockPeriod: "60 days",
    stakingCount: 76,
    userStake: 2500,
    minDeposit: 1000,
    network: "Base",
    long_description: "",
    image_src: "",
    tags: [],
    github_url: "",
    twitter_url: "",
    discord_url: "",
    contributors: 0,
    github_stars: 0,
    reward_types_detail: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: "3",
    name: "Atlas Protocol",
    description: "Privacy-preserving computation network",
    image: "/images/builders/atlas.png",
    totalStaked: 5600,
    reward_types: ["Fee Share"],
    website: "https://atlasprotocol.io",
    networks: ["Arbitrum", "Base"],
    lockPeriod: "45 days",
    stakingCount: 32,
    userStake: 850,
    minDeposit: 1000,
    network: "Arbitrum",
    long_description: "",
    image_src: "",
    tags: [],
    github_url: "",
    twitter_url: "",
    discord_url: "",
    contributors: 0,
    github_stars: 0,
    reward_types_detail: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export default function BuildersPage() {
  // Use the URL params hook
  const { getParam, setParam } = useUrlParams();

  // Use the builders context
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

  // Initialize tab state from URL or use default
  const [activeTab, setActiveTab] = useState(() => {
    return getParam('tab') || 'builders';
  });

  // Convert context sorting to the format expected by the UI
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Define columns for the builders table
  const buildersColumns: Column<Builder>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (builder) => {
          // Try to safely determine if the image can be rendered
          const hasValidImage = (() => {
            try {
              if (!builder.image_src && !builder.image) return false;
              const url = builder.image_src || builder.image || '';
              return isValidImageUrl(url);
            } catch {
              return false;
            }
          })();
          
          return (
            <div className="flex items-center gap-3">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
                      {hasValidImage ? (
                        <Image
                          src={builder.image_src || builder.image || ''}
                          alt={builder.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                          onError={() => {
                            // Force a re-render with invalid image
                            const img = document.querySelector(`[alt="${builder.name}"]`) as HTMLImageElement;
                            if (img) img.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                          {builder.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/builders/${builderNameToSlug(builder.name)}`}
                        className="font-medium text-gray-200 hover:text-emerald-400 transition-colors"
                      >
                        {builder.name}
                      </Link>
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 bg-background/95 backdrop-blur-sm border-gray-800">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      {builder.description || "No description available."}
                    </p>
                    {builder.website && (
                      <div className="flex items-center pt-2">
                        <ExternalLink className="mr-2 h-4 w-4 text-emerald-400" />
                        <a 
                          href={builder.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Visit Project
                        </a>
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          );
        },
      },
      {
        id: "networks",
        header: "Networks",
        cell: (builder) => (
          <div className="flex items-center gap-1">
            {(builder.networks || []).map((network: string) => (
              <div key={network} className="relative">
                {network === "Arbitrum" || network === "Arbitrum Sepolia" ? (
                  <ArbitrumIcon size={19} className="text-current" />
                ) : (
                  <BaseIcon size={19} className="text-current" />
                )}
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "rewardType",
        header: "Reward Type",
        accessorKey: "reward_types",
        cell: (builder) => (
          <div className="flex items-center gap-2 text-gray-300">
            {builder.reward_types || "TBA"}
          </div>
        ),
      },
      {
        id: "totalStaked",
        header: "MOR Staked",
        accessorKey: "totalStaked",
        enableSorting: true,
        cell: (builder) => (
          <span className="text-gray-200">
            {builder.totalStaked !== undefined ? 
              formatNumber(builder.totalStaked)
              : "—"}
          </span>
        ),
      },
      {
        id: "stakingCount",
        header: "# Staking",
        accessorKey: "stakingCount",
        enableSorting: true,
        cell: (builder) => (
          <span className="text-gray-300">
            {builder.stakingCount !== undefined ? builder.stakingCount : "—"}
          </span>
        ),
      },
      {
        id: "lockPeriod",
        header: "Lock period",
        accessorKey: "lockPeriod",
        cell: (builder) => (
          <span className="text-gray-300">
            {builder.lockPeriod || "—"}
          </span>
        ),
      },
      {
        id: "minDeposit",
        header: "Min MOR Deposit",
        accessorKey: "minDeposit",
        enableSorting: true,
        cell: (builder) => (
          <span className="text-gray-300">
            {builder.minDeposit !== undefined ? builder.minDeposit.toLocaleString() : "—"}
          </span>
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
        cell: (subnet) => {
          // Try to safely determine if the image can be rendered
          const hasValidImage = (() => {
            try {
              if (!subnet.image) return false;
              return isValidImageUrl(subnet.image);
            } catch {
              return false;
            }
          })();
          
          return (
            <div className="flex items-center gap-3">
              <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
                {hasValidImage ? (
                  <div className="relative size-8">
                    <Image
                      src={subnet.image || ''}
                      alt={subnet.name}
                      fill
                      sizes="32px"
                      className="object-cover"
                      onError={() => {
                        // Force a re-render with invalid image
                        const img = document.querySelector(`[alt="${subnet.name}"]`) as HTMLImageElement;
                        if (img) img.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                    {subnet.name.charAt(0)}
                  </div>
                )}
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
          );
        },
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

  // Define state for participating tab filters
  const [participatingNameFilter, setParticipatingNameFilter] = useState("");
  const [participatingNetworkFilter, setParticipatingNetworkFilter] = useState("all");
  const [participatingTypeFilter, setParticipatingTypeFilter] = useState("all");

  // Filter the participatingBuilders based on the filters
  const filteredParticipatingBuilders = useMemo(() => {
    return participatingBuilders.filter((builder) => {
      const matchesName = participatingNameFilter === '' || 
        builder.name.toLowerCase().includes(participatingNameFilter.toLowerCase());
      
      const matchesNetwork =
        participatingNetworkFilter === "all" || participatingNetworkFilter === "" || 
        (builder.networks && builder.networks.some(network => 
          network.toLowerCase() === participatingNetworkFilter.toLowerCase()
        ));
      
      const matchesType =
        participatingTypeFilter === "all" || participatingTypeFilter === "" || 
        (builder.reward_types && builder.reward_types.toString().toLowerCase() === participatingTypeFilter.toLowerCase());

      return matchesName && matchesNetwork && matchesType;
    });
  }, [participatingNameFilter, participatingNetworkFilter, participatingTypeFilter]);

  // For participating filters, initialize from URL if values exist
  useInitStateFromUrl(
    'participating_name',
    (value) => {
      if (value !== '') setParticipatingNameFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'participating_network',
    (value) => {
      if (value !== '') setParticipatingNetworkFilter(value);
    },
    ParamConverters.string.deserialize
  );

  useInitStateFromUrl(
    'participating_type',
    (value) => {
      if (value !== '') setParticipatingTypeFilter(value);
    },
    ParamConverters.string.deserialize
  );

  // Handle tab change with manual URL update
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setParam('tab', value);
  };

  // Define columns for the participating builders table
  const participatingColumns: Column<Builder & { userStake: number }>[] = useMemo(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (builder: Builder & { userStake: number }) => {
          // Try to safely determine if the image can be rendered
          const hasValidImage = (() => {
            try {
              if (!builder.image_src && !builder.image) return false;
              const url = builder.image_src || builder.image || '';
              return isValidImageUrl(url);
            } catch {
              return false;
            }
          })();
          
          return (
            <div className="flex items-center gap-3">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <div className="flex items-center gap-3 cursor-pointer">
                    <div className="relative size-8 rounded-lg overflow-hidden bg-white/[0.05]">
                      {hasValidImage ? (
                        <Image
                          src={builder.image_src || builder.image || ''}
                          alt={builder.name}
                          fill
                          sizes="32px"
                          className="object-cover"
                          onError={() => {
                            // Force a re-render with invalid image
                            const img = document.querySelector(`[alt="${builder.name}"]`) as HTMLImageElement;
                            if (img) img.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center size-8 bg-emerald-700 text-white font-medium">
                          {builder.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/builders/${builderNameToSlug(builder.name)}`}
                        className="font-medium text-gray-200 hover:text-emerald-400 transition-colors"
                      >
                        {builder.name}
                      </Link>
                    </div>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-80 bg-background/95 backdrop-blur-sm border-gray-800">
                  <div className="space-y-2">
                    <p className="text-sm text-gray-300">
                      {builder.description || "No description available."}
                    </p>
                    {builder.website && (
                      <div className="flex items-center pt-2">
                        <ExternalLink className="mr-2 h-4 w-4 text-emerald-400" />
                        <a 
                          href={builder.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          Visit Project
                        </a>
                      </div>
                    )}
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          );
        },
      },
      {
        id: "networks",
        header: "Networks",
        cell: (builder) => (
          <div className="flex items-center gap-1">
            {(builder.networks || []).map((network: string) => (
              <div key={network} className="relative">
                {network === "Arbitrum" ? (
                  <ArbitrumIcon size={19} className="text-current" />
                ) : (
                  <BaseIcon size={19} className="text-current" />
                )}
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "rewardType",
        header: "Reward Type",
        accessorKey: "reward_types",
        cell: (builder) => (
          <div className="flex items-center gap-2 text-gray-300">
            {builder.reward_types}
          </div>
        ),
      },
      {
        id: "stakeVsTotal",
        header: "Your stake vs Total",
        cell: (builder) => (
          <StakeVsTotalChart 
            userStake={builder.userStake || 0} 
            totalStaked={builder.totalStaked} 
          />
        ),
      },
      {
        id: "stakingCount",
        header: "# Staking",
        accessorKey: "stakingCount",
        enableSorting: true,
        cell: (builder) => (
          <span className="text-gray-300">{builder.stakingCount}</span>
        ),
      },
      {
        id: "lockPeriod",
        header: "Lock period",
        accessorKey: "lockPeriod",
        cell: (builder) => (
          <span className="text-gray-300">{builder.lockPeriod}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="page-container">
      <div className="page-grid">
        <div className="relative">
          <MetricCard
            title="Active Builders"
            metrics={[{ value: totalMetrics.totalBuilders.toString(), label: "Subnets" }]}
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
            title="Community Stats"
            metrics={[
              { value: totalMetrics.totalStaking.toLocaleString(), label: "Staking" },
              { value: "12.5k", label: "Commits" }
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
                  value="builders"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Builders
                </TabsTrigger>
                <TabsTrigger
                  value="subnets"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Your Subnets
                </TabsTrigger>
                <TabsTrigger
                  value="participating"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Participating
                </TabsTrigger>
              </TabsList>
            </div>
            <BuilderModalWrapper />
          </div>
          
          <div className="section-content group">
            <TabsContent value="builders">
              <div className="section-body p-2">
                {/* Filters for builders */}
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
                  
                  selectFilter={rewardTypeFilter}
                  onSelectFilterChange={(value) => {
                    setRewardTypeFilter(value);
                    setParam('rewardType', value === 'all' ? null : value);
                  }}
                  selectFilterLabel="Reward Type"
                  selectFilterPlaceholder="Select type"
                  selectFilterOptions={rewardTypes.map(type => ({ value: type, label: type }))}
                  showSelectFilter={true}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={buildersColumns}
                    data={filteredBuilders}
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
                    noResultsMessage="No builders found."
                    onRowClick={(builder) => {
                      window.location.href = `/builders/${builderNameToSlug(builder.name)}`;
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Your Subnets Tab Content */}
            <TabsContent value="subnets">
              <div className="section-body p-2">
                {/* Filters for your subnets */}
                <DataFilters
                  nameFilter={yourSubnetsNameFilter}
                  onNameFilterChange={(value) => {
                    setYourSubnetsNameFilter(value);
                    setParam('subnet_name', value || null);
                  }}
                  nameFilterLabel="Name"
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

            {/* Participating Tab Content */}
            <TabsContent value="participating">
              <div className="section-body p-2">
                {/* Filters for participating */}
                <DataFilters
                  nameFilter={participatingNameFilter}
                  onNameFilterChange={(value) => {
                    setParticipatingNameFilter(value);
                    setParam('participating_name', value || null);
                  }}
                  nameFilterLabel="Name"
                  nameFilterPlaceholder="Search subnet name"
                  
                  networkFilter={participatingNetworkFilter}
                  onNetworkFilterChange={(value) => {
                    setParticipatingNetworkFilter(value);
                    setParam('participating_network', value === 'all' ? null : value);
                  }}
                  showNetworkFilter={true}
                  
                  selectFilter={participatingTypeFilter}
                  onSelectFilterChange={(value) => {
                    setParticipatingTypeFilter(value);
                    setParam('participating_type', value === 'all' ? null : value);
                  }}
                  selectFilterLabel="Reward Type"
                  selectFilterPlaceholder="Select type"
                  selectFilterOptions={rewardTypes.map(type => ({ value: type, label: type }))}
                  showSelectFilter={true}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={participatingColumns as unknown as Column<Builder>[]}
                    data={filteredParticipatingBuilders}
                    isLoading={isLoading}
                    loadingRows={6}
                    noResultsMessage="No participating builders found."
                    onRowClick={(builder) => {
                      window.location.href = `/builders/${builderNameToSlug(builder.name)}`;
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