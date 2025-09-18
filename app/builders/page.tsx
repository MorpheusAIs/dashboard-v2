"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
import { useChainId } from 'wagmi';
import { arbitrumSepolia } from 'wagmi/chains';
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
import { useUserStakedBuilders } from "@/app/hooks/useUserStakedBuilders";

import { StakeModal } from "@/components/staking/stake-modal";

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

// Add this helper function after the checkSimpleImageExtension function

/**
 * Formats the time until unlocking in a human-readable way
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
function formatUnlockTime(claimLockEnd?: string | number | bigint | null): string {
  if (!claimLockEnd) return "Unknown";
  
  try {
    // Convert input to number if it's a string or bigint
    const unlockTimestamp = typeof claimLockEnd === 'string' 
      ? parseInt(claimLockEnd) 
      : typeof claimLockEnd === 'bigint' 
      ? Number(claimLockEnd) 
      : claimLockEnd;
    
    // Check if it's a valid number
    if (isNaN(unlockTimestamp)) return "Unknown";
    
    const now = Math.floor(Date.now() / 1000);
    
    // If already unlocked
    if (unlockTimestamp <= now) {
      return "Unlocked";
    }
    
    // Calculate remaining time
    const remainingSeconds = unlockTimestamp - now;
    
    // Format the remaining time more precisely
    if (remainingSeconds < 60) {
      return `${remainingSeconds} seconds`;
    } else if (remainingSeconds < 3600) {
      return `${Math.floor(remainingSeconds / 60)} minutes`;
    } else if (remainingSeconds < 86400) {
      return `${Math.floor(remainingSeconds / 3600)} hours`;
    } else {
      const days = Math.floor(remainingSeconds / 86400);
      return days === 1 ? "1 day" : `${days} days`;
    }
  } catch (error) {
    console.error("Error calculating unlock time:", error);
    return "Unknown";
  }
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
const participatingBuildersSample: Builder[] = [
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
    admin: null, // Added admin field
    mainnetProjectId: null
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
    admin: null, // Added admin field
    mainnetProjectId: null
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
    admin: null, // Added admin field
    mainnetProjectId: null
  }
];

// Function to generate the correct slug for a builder, including network for duplicates
const getBuilderSlug = (builder: Builder, duplicateNames: string[]) => {
  const baseSlug = builderNameToSlug(builder.name);
  // For builders with duplicate names across networks, append the network to the slug
  if (duplicateNames.includes(builder.name)) {
    return `${baseSlug}-${builder.network.toLowerCase()}`;
  }
  return baseSlug;
};

export default function BuildersPage() {
  // Get chain ID to determine testnet vs mainnet
  const chainId = useChainId();
  const isTestnet = chainId === arbitrumSepolia.id;
  
  // Helper function to get the appropriate subnet ID for URLs
  const getSubnetId = useCallback((builder: Builder): string => {
    // Check the builder's actual network, not the user's wallet network
    const builderIsOnTestnet = builder.networks && 
      builder.networks.some(network => network === "Arbitrum Sepolia");
    
    if (builderIsOnTestnet) {
      // For testnet: use builder.id (the on-chain subnet contract address)
      return builder.id || '';
    } else {
      // For mainnet: use mainnetProjectId (the on-chain project contract address)
      return builder.mainnetProjectId || builder.id || '';
    }
  }, []);
  
  // Add state for stake modal
  const [stakeModalOpen, setStakeModalOpen] = useState(false);
  const [selectedBuilder, setSelectedBuilder] = useState<Builder | null>(null);
  
  // Handler for opening the stake modal
  const handleOpenStakeModal = useCallback((builder: Builder) => {
    setSelectedBuilder(builder);
    setStakeModalOpen(true);
  }, []);

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
    builders,
    rewardTypes,
    isLoading,
    refreshData,
    
    // Total metrics (independent of filters)
    totalMetrics,

  } = useBuilders();

  // Check for newly created subnet and trigger refresh
  useEffect(() => {
    const newSubnetData = localStorage.getItem('new_subnet_created');
    if (newSubnetData) {
      try {
        const { name, timestamp } = JSON.parse(newSubnetData);
        // Only process if created within last 5 minutes (to avoid stale data)
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          console.log('[BuildersPage] New subnet detected:', name, 'triggering refresh');
          // Clear the localStorage first
          localStorage.removeItem('new_subnet_created');
          // Trigger refresh to fetch the new subnet
          refreshData();
        } else {
          // Remove stale data
          localStorage.removeItem('new_subnet_created');
        }
      } catch (e) {
        console.error('[BuildersPage] Error parsing new subnet data:', e);
        localStorage.removeItem('new_subnet_created');
      }
    }
  }, [refreshData]); // Include refreshData in dependencies

  // Get auth state
  const { userAddress, isAuthenticated, isLoading: isLoadingAuth } = useAuth();

  // Hook for fetching user staked builders on mainnet (for "Staking in" tab)
  const { data: userStakedBuilders, isLoading: isLoadingUserStakedBuilders } = useUserStakedBuilders();

  // Temporary fallback values for testing
  const userAdminSubnets = useMemo<Builder[] | null>(() => {
    if (!isAuthenticated || !userAddress || !builders) return null;
    const adminSubnets = builders.filter((b: Builder) => b.admin?.toLowerCase() === userAddress.toLowerCase());
    console.log(`[BuildersPage] userAdminSubnets calculation:`, {
      totalBuilders: builders.length,
      userAddress,
      adminSubnets: adminSubnets.length,
      subnetNames: adminSubnets.map(s => s.name)
    });
    return adminSubnets;
  }, [isAuthenticated, userAddress, builders]);

  const isLoadingUserAdminSubnets = isLoading || isLoadingAuth;

  // Initialize tab state from URL or use default
  const [activeTab, setActiveTab] = useState(() => {
    const tabFromUrl = getParam('tab') || 'builders';
    console.log("[BuildersPage] Initial activeTab from URL:", tabFromUrl);
    return tabFromUrl;
  });
  


  // Convert context sorting to the format expected by the UI (for Builders tab)
  const sorting = useMemo(() => {
    if (!sortColumn) return null;
    return {
      id: sortColumn,
      desc: sortDirection === 'desc'
    };
  }, [sortColumn, sortDirection]);

  // Add a memo to track duplicate builder names
  const duplicateBuilderNames = useMemo(() => {
    if (!builders) return [];
    const counts: Record<string, number> = {};
    
    // Count occurrences of each builder name
    builders.forEach(builder => {
      counts[builder.name] = (counts[builder.name] || 0) + 1;
    });
    
    // Return names that appear more than once
    return Object.entries(counts)
      .filter(([_, count]) => count > 1)
      .map(([name]) => name);
  }, [builders]);

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
                        href={`/builders/${getBuilderSlug(builder, duplicateBuilderNames)}?subnet_id=${getSubnetId(builder)}&network=${encodeURIComponent(builder.networks?.[0] || builder.network || '')}`}
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
              className="stake-button py-1 px-3 text-sm border border-white text-white bg-transparent hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all duration-200 rounded"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering
                handleOpenStakeModal(builder);
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    [handleOpenStakeModal, duplicateBuilderNames, getSubnetId]
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
                  href={`/builders/${getBuilderSlug(subnet, duplicateBuilderNames)}?subnet_id=${getSubnetId(subnet)}&network=${encodeURIComponent(subnet.networks?.[0] || subnet.network || '')}`} // Or potentially /subnets/<id> if that page exists
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
        cell: (subnet) => { // Use description from Builder
          const description = subnet.description || '';
          const truncatedDescription = description.length > 80 
            ? description.substring(0, 80) + '...' 
            : description;
          
          return (
            <span className="text-gray-300" title={description}>
              {truncatedDescription}
            </span>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: (subnet) => {
          let status = "Pending";
          let statusClass = "bg-yellow-900/30 text-yellow-400"; // Default for Pending

          if (subnet.startsAt) {
              try {
                  // Ensure startsAt is treated as a Unix timestamp in seconds
                  const startsDate = new Date(Number(subnet.startsAt) * 1000);
                  const currentDate = new Date();

                  if (!isNaN(startsDate.getTime())) { // Check if date is valid
                      if (startsDate <= currentDate) { // startsAt is past or present
                          status = "Active";
                          statusClass = "bg-emerald-900/30 text-emerald-400";
                      } else { // startsAt is in the future
                          // Status remains "Pending", class remains yellow
                      }
                  } else {
                      // Invalid date, status remains "Pending", class remains yellow
                      console.warn("Invalid startsAt date encountered:", subnet.startsAt);
                  }
              } catch (e) {
                  console.error("Error parsing startsAt date:", e);
                  // Error during parsing, status remains "Pending", class remains yellow
              }
          } else {
              // No startsAt date, status remains "Pending", class remains yellow
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
        id: "startsAt",
        header: "Starts at",
        accessorKey: "startsAt",
        cell: (subnet) => (
           <span className="text-gray-300">
            {subnet.startsAt 
              ? new Date(Number(subnet.startsAt) * 1000).toLocaleDateString() 
              : '—'}
          </span>
        ),
      },
      // {
      //   id: "unlockIn_subnets",
      //   header: "Claim unlocks in",
      //   enableSorting: true,
      //   cell: (subnet) => {
      //     // Only log one time per subnet to avoid console clutter
      //     console.log("DEBUG - Processing subnet for claim unlock:", subnet.name);
          
      //     // Different data structures between testnet and mainnet
      //     let claimLockEnd = null;
          
      //     // For the "Your Subnets" tab
      //     // For testnet networks - use the builderUsers data for the admin's stake
      //     if (subnet.builderUsers && subnet.admin && userAddress && 
      //         subnet.admin.toLowerCase() === userAddress.toLowerCase()) {
      //       // Try to find the admin's own stake to get their claimLockEnd
      //       const adminStake = subnet.builderUsers.find(user => 
      //         user.address.toLowerCase() === userAddress.toLowerCase()
      //       );
            
      //       if (adminStake && adminStake.claimLockEnd) {
      //         claimLockEnd = adminStake.claimLockEnd;
      //         console.log(`Subnet ${subnet.name}: Found claim lock end in admin stake:`, claimLockEnd);
      //       }
      //     }
          
      //     console.log(`FINAL RESULT - Subnet ${subnet.name}:`, {
      //       claimLockEnd,
      //       formattedTime: formatUnlockTime(claimLockEnd)
      //     });
          
      //     const unlockStatus = formatUnlockTime(claimLockEnd);
          
      //     if (unlockStatus === "Unlocked") {
      //       return (
      //         <span className="bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full text-xs">
      //           Unlocked
      //         </span>
      //       );
      //     } else {
      //       return <span className="text-gray-300">{unlockStatus}</span>;
      //     }
      //   },
      // },
      {
        id: "actions",
        header: "Actions",
        cell: (subnet) => (
          <div className="w-24 flex justify-center">
            <button 
              className="stake-button py-1 px-3 text-sm border border-white text-white bg-transparent hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all duration-200 rounded"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering
                handleOpenStakeModal(subnet);
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleOpenStakeModal, duplicateBuilderNames, userAddress, getSubnetId]
  );
  // --- END MODIFY subnetsColumns ---


  // Define state for your subnets tab filters
  const [yourSubnetsNameFilter, setYourSubnetsNameFilter] = useState("");
  const [yourSubnetsNetworkFilter, setYourSubnetsNetworkFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // Note: This filters the calculated 'Active'/'Pending' status

  // --- MODIFY Filter logic ---
  // Filter the userAdminSubnets based on the filters
  const filteredUserAdminSubnets = useMemo(() => {
    return (userAdminSubnets || []).filter((subnet) => { 
      const matchesName = yourSubnetsNameFilter === '' || 
        subnet.name.toLowerCase().includes(yourSubnetsNameFilter.toLowerCase());
      
      const matchesNetwork =
        yourSubnetsNetworkFilter === "all" || yourSubnetsNetworkFilter === "" || 
        (subnet.networks && subnet.networks.some(network => 
           network.toLowerCase() === yourSubnetsNetworkFilter.toLowerCase()
        ));
      
       let currentStatus = "Pending";
       if (subnet.startsAt) {
          try {
              // Ensure startsAt is treated as a Unix timestamp in seconds for filtering
              const startsDate = new Date(Number(subnet.startsAt) * 1000);
              const currentDate = new Date();
              if (!isNaN(startsDate.getTime()) && startsDate <= currentDate) {
                  currentStatus = "Active";
              }
          } catch {} // Ignore errors for filtering, will default to Pending
       } else {
           currentStatus = "Pending"; // Default if no date, or if date was invalid
       }

      const matchesStatus =
        statusFilter === "all" || statusFilter === "" || 
        currentStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesName && matchesNetwork && matchesStatus;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAdminSubnets, yourSubnetsNameFilter, yourSubnetsNetworkFilter, statusFilter, userAddress]);
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
    // Use the dedicated hook data for mainnet user staked builders
    let sourceData: (Builder & { userStake?: number })[] = [];

    if (isAuthenticated && userAddress) {
      if (userStakedBuilders && userStakedBuilders.length > 0) {
        // Use real data from the dedicated hook
        sourceData = userStakedBuilders.map(builder => ({
          ...builder,
          userStake: builder.userStake || 0
        }));
        console.log(`[filteredParticipatingBuilders] Using ${sourceData.length} real staked builders from hook`);
      } else {
        // No real data available, use empty array for authenticated users
        sourceData = [];
        console.log('[filteredParticipatingBuilders] User is authenticated but has no staked builders');
      }
    } else {
      // User not authenticated, show sample data
      sourceData = participatingBuildersSample;
      console.log('[filteredParticipatingBuilders] User not authenticated, using sample data');
    }

    // Apply text filters to the source data
    return sourceData.filter((builder) => {
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
  }, [participatingNameFilter, participatingNetworkFilter, participatingTypeFilter, isAuthenticated, userAddress, userStakedBuilders]);

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
                        href={`/builders/${getBuilderSlug(builder, duplicateBuilderNames)}?subnet_id=${getSubnetId(builder)}&network=${encodeURIComponent(builder.networks?.[0] || builder.network || '')}`}
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
      // {
      //   id: "unlockIn_participating",
      //   header: "Claim unlocks in",
      //   enableSorting: true,
      //   cell: (builder) => {
      //     // Only log one time per builder to avoid console clutter
      //     console.log("DEBUG - Processing builder for claim unlock:", builder.name);
          
      //     // Different data structures between testnet and mainnet
      //     let claimLockEnd = null;
          
      //     // For the "Participating" tab
      //     // Check for builderUsers data for the current user's stake
      //     if (builder.builderUsers && userAddress) {
      //       const userStake = builder.builderUsers.find(user => 
      //         user.address.toLowerCase() === userAddress.toLowerCase()
      //       );
            
      //       if (userStake && userStake.claimLockEnd) {
      //         claimLockEnd = userStake.claimLockEnd;
      //         console.log(`Builder ${builder.name}: Found claim lock end in user stake:`, claimLockEnd);
      //       }
      //     }
          
      //     console.log(`FINAL RESULT - Builder ${builder.name}:`, {
      //       claimLockEnd,
      //       formattedTime: formatUnlockTime(claimLockEnd)
      //     });
          
      //     const unlockStatus = formatUnlockTime(claimLockEnd);
          
      //     if (unlockStatus === "Unlocked") {
      //       return (
      //         <span className="bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full text-xs">
      //           Unlocked
      //         </span>
      //       );
      //     } else {
      //       return <span className="text-gray-300">{unlockStatus}</span>;
      //     }
      //   },
      // },
      {
        id: "actions",
        header: "Actions",
        cell: (builder) => (
          <div className="w-24 flex justify-center">
            <button 
              className="stake-button py-1 px-3 text-sm border border-white text-white bg-transparent hover:border-emerald-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all duration-200 rounded"
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click from triggering
                handleOpenStakeModal(builder);
              }}
            >
              Stake
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleOpenStakeModal, duplicateBuilderNames, userAddress, getSubnetId]
  );

  // Calculate Avg MOR Staked for Community Stats
  const avgMorStakedPerUser = useMemo(() => {
    if (totalMetrics.totalStaking > 0) {
      const avg = totalMetrics.totalStaked / totalMetrics.totalStaking;
      // Format to 2 decimal places if it's a float, otherwise show as integer
      return parseFloat(avg.toFixed(2)).toLocaleString();
    }
    return "0"; // Or 'N/A' or some other placeholder
  }, [totalMetrics.totalStaked, totalMetrics.totalStaking]);





  return (
    <div className="page-container">
      <div className="page-grid">
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

        <div className="relative">
          <MetricCard
            title="Active Builders"
            metrics={[{ value: totalMetrics.totalBuilders.toString(), label: "Builders" }]}
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


        <div className="relative col-span-2">
          <MetricCard
            className="col-span-2"
            title="Community Stats"
            metrics={[
              { value: totalMetrics.totalStaking.toLocaleString(), label: "Staking" },
              { value: avgMorStakedPerUser, label: "Avg MOR / Staker" }
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
                  value="participating"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Staking in
                </TabsTrigger>
                <TabsTrigger
                  value="subnets"
                  className="data-[state=active]:after:bg-emerald-400 relative rounded-none py-2 px-4 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-l font-semibold"
                >
                  Your Subnets
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
                      window.location.href = `/builders/${getBuilderSlug(builder, duplicateBuilderNames)}?subnet_id=${getSubnetId(builder)}&network=${encodeURIComponent(builder.networks?.[0] || builder.network || '')}`;
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
                       // Link to builder/subnet detail page
                       window.location.href = `/builders/${getBuilderSlug(subnet, duplicateBuilderNames)}?subnet_id=${getSubnetId(subnet)}&network=${encodeURIComponent(subnet.networks?.[0] || subnet.network || '')}`; // Or /subnets/<id>
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
                  showSelectFilter={false}
                />

                <div className="[&>div]:max-h-[600px] overflow-auto custom-scrollbar">
                  <DataTable
                    columns={participatingColumns as unknown as Column<Builder>[]} 
                    data={filteredParticipatingBuilders} // Use the new dynamic list
                    isLoading={isLoadingAuth || isLoadingUserStakedBuilders} // Use loading state from new hook
                    loadingRows={6}
                    noResultsMessage={isAuthenticated && userAddress ? "You have not staked in any builders on mainnet networks." : "No participating builders found."}
                    onRowClick={(builder) => {
                      window.location.href = `/builders/${getBuilderSlug(builder, duplicateBuilderNames)}?subnet_id=${getSubnetId(builder)}&network=${encodeURIComponent(builder.networks?.[0] || builder.network || '')}`;
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
        onCloseAction={() => setStakeModalOpen(false)} 
        selectedBuilder={selectedBuilder}
      />
    </div>
  );
}