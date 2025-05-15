"use client";

import { useState, useMemo, useEffect } from "react";
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
import { useRouter } from 'next/navigation';

import { StakeModal } from "@/components/staking/stake-modal";

// Interfaces
// interface UserSubnet {
//   id: string;
//   name: string;
//   description: string;
//   network: string;
//   status: string;
//   stakeAmount: number;
//   createdAt: string;
//   image?: string;
// }

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

// Sample subnets data for the "Your Subnets" tab - REMOVED
// const sampleSubnets: UserSubnet[] = [ ... ];


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
    updated_at: new Date().toISOString(),
    startsAt: new Date().toISOString(),
    admin: null // Added admin field
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
    updated_at: new Date().toISOString(),
    startsAt: new Date().toISOString(),
    admin: null // Added admin field
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
    updated_at: new Date().toISOString(),
    startsAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    admin: null // Added admin field
  }
];

export default function BuildersPage() {
  const router = useRouter();
  // Add state for stake modal
  const [stakeModalOpen, setStakeModalOpen] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState<Builder | null>(null);
  
  // Handler for opening the stake modal
  const handleOpenStakeModal = (builder: Builder) => {
    setSelectedBuilder(builder);
    setStakeModalOpen(true);
  };

  // Use the URL params hook
  const { getParam, setParam } = useUrlParams();

  // Use the builders context
  const {
    // Filtering for 'Builders' tab
    nameFilter,
    setNameFilter,
    rewardTypeFilter,
    setRewardTypeFilter,
    networkFilter,
    setNetworkFilter,
    
    // Sorting for 'Builders' tab
    sortColumn,
    sortDirection,
    setSorting,
    
    // Data for 'Builders' tab
    filteredBuilders,
    rewardTypes,
    isLoading,
    
    // Total metrics (independent of filters)
    totalMetrics,

    // --- NEW: Data for 'Your Subnets' tab ---
    userAdminSubnets, // Assuming this will be provided by the context
    isLoadingUserAdminSubnets, // Assuming this loading state will be provided
    // --- END NEW ---

  } = useBuilders();

  // Initialize tab state from URL or use default
  const [activeTab, setActiveTab] = useState(() => {
    return getParam('tab') || 'builders';
  });

  // Convert context sorting to the format expected by the UI (for Builders tab)
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
      // {
      //   id: "rewardType",
      //   header: "Reward Type",
      //   accessorKey: "reward_types",
      //   cell: (builder) => (
      //     <div className="flex items-center gap-2 text-gray-300">
      //       {builder.reward_types || "TBA"}
      //     </div>
      //   ),
      // },
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
      {
        id: "actions",
        header: "Actions",
        cell: (builder) => (
          <div className="w-24 flex justify-center">
            <button 
              className="copy-button-secondary py-1 px-3 text-sm opacity-0 transition-opacity duration-200 action-button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering navigation
                handleOpenStakeModal(builder); // Open the stake modal
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    [handleOpenStakeModal]
  );

  // Define columns for the subnets table
  // --- MODIFY subnetsColumns ---
  const subnetsColumns: Column<Builder>[] = useMemo( // Changed type to Builder
    () => [
      {
        id: "name",
        header: "Name",
        cell: (subnet) => { // subnet is now of type Builder
          const hasValidImage = (() => {
            try {
              // Use image_src or image from Builder type
              const url = subnet.image_src || subnet.image || '';
              return isValidImageUrl(url);
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
                      src={subnet.image_src || subnet.image || ''} // Use Builder fields
                      alt={subnet.name}
                      fill
                      sizes="32px"
                      className="object-cover"
                      onError={() => {
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
                  // Assuming subnets might have a different detail page or use slug like builders
                  href={`/builders/${builderNameToSlug(subnet.name)}`} // Or potentially /subnets/<id> if that page exists
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
        cell: (subnet) => ( // Use networks array from Builder
          <div className="flex items-center gap-1">
             {(subnet.networks || []).map((network: string) => (
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
        id: "description",
        header: "Description",
        accessorKey: "description",
        cell: (subnet) => ( // Use description from Builder
          <span className="text-gray-300">{subnet.description}</span>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: (subnet) => { // Use startsAt from Builder (needs to be added to type/data)
          // Assuming subnet.startsAt exists and is a valid date string or Date object
          let status = "Pending";
          let statusClass = "bg-yellow-900/30 text-yellow-400";

          if (subnet.startsAt) {
              try {
                  const startsDate = new Date(subnet.startsAt);
                  if (!isNaN(startsDate.getTime()) && startsDate <= new Date()) {
                      status = "Active";
                      statusClass = "bg-emerald-900/30 text-emerald-400";
                  }
              } catch (e) {
                  console.error("Error parsing startsAt date:", e);
                  // Keep default pending status if date is invalid
              }
          } else {
             // If no startsAt date, maybe default to Active or handle as needed
             // For now, let's assume Active if startsAt is missing or invalid after fetch
             status = "Active"; 
             statusClass = "bg-emerald-900/30 text-emerald-400"; 
          }
           
          // We might need a separate 'Inactive' status based on other criteria later
          // For now, just Active/Pending based on startsAt

          return (
            <span className={cn("px-2 py-1 rounded-full text-xs", statusClass)}>
              {status}
            </span>
          );
        },
      },
      {
        id: "totalStaked", // Changed id and accessorKey
        header: "MOR Staked", // Renamed header
        accessorKey: "totalStaked", // Use totalStaked from Builder
        cell: (subnet) => ( // Use totalStaked from Builder
          <span className="text-gray-200">
            {subnet.totalStaked !== undefined ? 
              formatNumber(subnet.totalStaked) // Use formatNumber
              : "—"}
          </span>
        ),
      },
      {
        id: "createdAt", // Assuming Builder type has created_at
        header: "Created At",
        accessorKey: "created_at", // Use created_at from Builder
        cell: (subnet) => ( // Format the date
           <span className="text-gray-300">
            {subnet.created_at ? new Date(subnet.created_at).toLocaleDateString() : '—'}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: (subnet) => (
          <div className="w-24 flex justify-center">
            <button 
              className="copy-button-secondary py-1 px-3 text-sm opacity-0 transition-opacity duration-200 action-button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering navigation
                handleOpenStakeModal(subnet); // Open the stake modal
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    [handleOpenStakeModal]
  );
  // --- END MODIFY subnetsColumns ---


  // Define state for your subnets tab filters
  const [yourSubnetsNameFilter, setYourSubnetsNameFilter] = useState("");
  const [yourSubnetsNetworkFilter, setYourSubnetsNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // Note: This filters the calculated 'Active'/'Pending' status

  // --- MODIFY Filter logic ---
  // Filter the userAdminSubnets based on the filters
  const filteredUserAdminSubnets = useMemo(() => {
    // Use userAdminSubnets from context
    return (userAdminSubnets || []).filter((subnet) => { 
      const matchesName = yourSubnetsNameFilter === '' || 
        subnet.name.toLowerCase().includes(yourSubnetsNameFilter.toLowerCase());
      
      // Check against the 'networks' array in Builder type
      const matchesNetwork =
        yourSubnetsNetworkFilter === "all" || yourSubnetsNetworkFilter === "" || 
        (subnet.networks && subnet.networks.some(network => 
           network.toLowerCase() === yourSubnetsNetworkFilter.toLowerCase()
        ));
      
      // Calculate status on the fly for filtering
       let currentStatus = "Pending";
       if (subnet.startsAt) {
          try {
              const startsDate = new Date(subnet.startsAt);
              if (!isNaN(startsDate.getTime()) && startsDate <= new Date()) {
                  currentStatus = "Active";
              }
          } catch {} // Ignore errors for filtering
       } else {
           currentStatus = "Active"; // Default if no date
       }

      const matchesStatus =
        statusFilter === "all" || statusFilter === "" || 
        currentStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesName && matchesNetwork && matchesStatus;
    });
  }, [userAdminSubnets, yourSubnetsNameFilter, yourSubnetsNetworkFilter, statusFilter]); // Added userAdminSubnets dependency
  // --- END MODIFY Filter logic ---

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
    // Keep using sample data for now
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
      {
        id: "actions",
        header: "Actions",
        cell: (builder) => (
          <div className="w-24 flex justify-center">
            <button 
              className="copy-button-secondary py-1 px-3 text-sm opacity-0 transition-opacity duration-200 action-button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering navigation
                handleOpenStakeModal(builder); // Open the stake modal
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    [handleOpenStakeModal]
  );

  // Fetch user admin subnets when address is available or data reloads
  const { userAddress } = useAuth();
  const { fetchUserAdminSubnets } = useBuilders(); // Get the fetch function
  useEffect(() => {
     // Ensure we have an address and the fetch function exists
     if (userAddress && fetchUserAdminSubnets) { 
       console.log("useEffect in BuildersPage triggering fetchUserAdminSubnets for:", userAddress);
       fetchUserAdminSubnets(userAddress);
     }
     // Note: The context itself handles re-fetching when its internal data reloads,
     // so we only need to depend on the userAddress and the function reference here.
  }, [userAddress, fetchUserAdminSubnets]);


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
                    onRowClick={(subnet) => {
                      router.push(`/builders/${builderNameToSlug(subnet.name)}`); // Or /subnets/<id>
                   }}
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* --- MODIFY Your Subnets Tab Content --- */}
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
                  selectFilterOptions={[ // Filters based on calculated Active/Pending
                    { value: "active", label: "Active" },
                    { value: "pending", label: "Pending" },
                    // { value: "inactive", label: "Inactive" }, // Add if needed later
                  ]}
                  showSelectFilter={true}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={subnetsColumns} // Use updated columns
                    data={filteredUserAdminSubnets} // Use filtered real data
                    isLoading={isLoadingUserAdminSubnets} // Use loading state from context
                    loadingRows={6}
                    noResultsMessage="No subnets administered by you were found." // Updated message
                    onRowClick={(subnet) => {
                       router.push(`/builders/${builderNameToSlug(subnet.name)}`); // Or /subnets/<id>
                    }}
                  />
                </div>
              </div>
            </TabsContent>
            {/* --- END MODIFY Your Subnets Tab Content --- */}


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
                  selectFilterOptions={rewardTypes.map(type => ({ value: type, label: type }))} // Use rewardTypes from context if needed here too
                  showSelectFilter={true}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={participatingColumns as unknown as Column<Builder>[]} // Keep using sample data columns for now
                    data={filteredParticipatingBuilders} // Keep using sample data for now
                    isLoading={false} // Assuming sample data isn't loading
                    loadingRows={6}
                    noResultsMessage="No participating builders found."
                    onRowClick={(builder) => {
                      router.push(`/builders/${builderNameToSlug(builder.name)}`);
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      
      {/* Stake Modal */}
      <StakeModal 
        isOpen={stakeModalOpen} 
        onClose={() => setStakeModalOpen(false)} 
        selectedBuilder={selectedBuilder}
      />
    </div>
  );
}