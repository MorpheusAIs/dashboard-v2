import Image from "next/image";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { ExternalLink, Code } from "lucide-react";
import { useState, useEffect } from "react";
import { EditSubnetModal } from "./edit-subnet-modal";
import { Builder } from "@/app/builders/builders-data";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

// Helper function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    // Remove protocol and www if present
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return domain;
  } catch {
    // Return original URL if parsing fails
    return url;
  }
};

// Helper function to validate image URL
const isValidImageUrl = (url?: string): boolean => {
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
};

// Simple check for image extension anywhere in the URL string
const checkSimpleImageExtension = (url: string): boolean => {
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
  const urlLower = url.toLowerCase();
  return validExtensions.some(ext => urlLower.includes(ext));
};

export interface ProjectHeaderProps {
  name: string;
  description?: string;
  imagePath?: string;
  networks?: string[];
  website?: string;
  rewardType?: string;
  backButton?: boolean;
  onBack?: () => void;
  backPath?: string;
  children?: React.ReactNode;
  builder?: Builder | null;
  showEditButton?: boolean;
  subnetId?: string | null;
  isTestnet?: boolean;
  getDataUrl?: string;
}

export function ProjectHeader({
  name,
  description,
  imagePath,
  networks = ['Base'],
  website,
  rewardType,
  children,
  builder,
  showEditButton = false,
  subnetId,
  isTestnet = false,
  getDataUrl,
}: ProjectHeaderProps) {
  
  // Track image loading error
  const [imageError, setImageError] = useState(false);
  // Track edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Track if metadata is refreshing after update
  const [isMetadataRefreshing, setIsMetadataRefreshing] = useState(false);
  
  // Debug log to see the builder data being passed (after state declarations)
  useEffect(() => {
    console.log('[ProjectHeader] Builder data:', builder);
    console.log('[ProjectHeader] Builder ID:', builder?.id);
    console.log('[ProjectHeader] Show edit button:', showEditButton);
    console.log('[ProjectHeader] Is metadata refreshing:', isMetadataRefreshing);
  }, [builder, showEditButton, isMetadataRefreshing]);
  
  // Check if image is valid
  const hasValidImage = (() => {
    try {
      if (!imagePath || imageError) return false;
      return isValidImageUrl(imagePath);
    } catch {
      return false;
    }
  })();

  // Generate project default icon from name
  const firstLetter = name.charAt(0);

  return (
    <>
      {/* Mobile Layout (sm and smaller) */}
      <div className="sm:hidden space-y-4">
        {/* Row 1: Image + Title */}
        <div className="flex items-center gap-4">
          <div className="relative size-16 sm:size-24 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0">
            {hasValidImage ? (
              <div className="relative size-16 sm:size-24">
                <Image
                  src={imagePath!.startsWith('http') ? imagePath! : imagePath!.startsWith('/') ? imagePath! : `/${imagePath!}`}
                  alt={name}
                  fill
                  sizes="(max-width: 640px) 64px, 96px"
                  className="object-cover"
                  onError={() => {
                    setImageError(true);
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center size-16 sm:size-24 bg-emerald-700 text-white text-2xl sm:text-4xl font-medium">
                {firstLetter}
              </div>
            )}
          </div>
          
          <h1 className="text-xl sm:text-2xl font-bold text-gray-100 flex-1">{name}</h1>
        </div>
        
        {/* Row 2: Network + Reward Type + Website */}
        <div className="flex items-center gap-3 flex-wrap">
          <TooltipProvider>
            <div className="flex -space-x-1">
              {networks.map((network: string) => {
                const isArbitrum = network === "Arbitrum" || network === "Arbitrum Sepolia";
                const networkIcon = isArbitrum ? (
                  <ArbitrumIcon size={24} className="text-current" />
                ) : (
                  <BaseIcon size={24} className="text-current" />
                );
                
                // Show tooltip for testnet networks
                if (isTestnet) {
                  const tooltipText = `${network} testnet`;
                  return (
                    <Tooltip key={network}>
                      <TooltipTrigger asChild>
                        <div className="relative cursor-help">
                          {networkIcon}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl"
                      >
                        <p className="text-sm font-medium">{tooltipText}</p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                
                return (
                  <div key={network} className="relative">
                    {networkIcon}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
          
          {rewardType && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300 text-sm">{rewardType}</span>
            </>
          )}
          
          {isMetadataRefreshing ? (
            <>
              <span className="text-gray-400">|</span>
              <Skeleton className="h-4 w-24" />
            </>
          ) : website ? (
            <>
              <span className="text-gray-400">|</span>
              <a 
                href={website} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-emerald-500 hover:text-emerald-400 hover:underline hover:underline-offset-3 flex items-center gap-1 text-sm"
              >
                {extractDomain(website)}
                <ExternalLink className="h-3 w-3" />
              </a>
            </>
          ) : null}
        </div>
        
        {/* Row 3: Description */}
        {isMetadataRefreshing ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : description ? (
          <p className="text-gray-400 text-sm">
            {description}
          </p>
        ) : null}
        
        {children}
      </div>

      {/* Desktop Layout (sm and larger) */}
      <div className="hidden sm:flex items-start gap-6">
        <div className="relative size-24 rounded-xl overflow-hidden bg-white/[0.05] flex-shrink-0">
          {hasValidImage ? (
            <div className="relative size-24">
              <Image
                src={imagePath!.startsWith('http') ? imagePath! : imagePath!.startsWith('/') ? imagePath! : `/${imagePath!}`}
                alt={name}
                fill
                sizes="96px"
                className="object-cover"
                onError={() => {
                  setImageError(true);
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center size-24 bg-emerald-700 text-white text-4xl font-medium">
              {firstLetter}
            </div>
          )}
        </div>
        
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-bold text-gray-100 mb-2">{name}</h1>

            <div className="flex flex-col gap-2 items-end">
              {showEditButton && builder && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="copy-button copy-button-secondary font-medium px-4 py-2 mt-2"
                >
                  Edit subnet
                </button>
              )}

              {getDataUrl && (
                <a
                  href={getDataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="copy-button copy-button-secondary font-medium px-4 py-2 mt-2 border-white text-white hover:bg-white hover:text-black transition-colors flex items-center"
                >
                  <Code className="size-4" />
                  <span className="ml-2">GetData</span>
                </a>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <TooltipProvider>
              <div className="flex -space-x-1">
                {networks.map((network: string) => {
                  const isArbitrum = network === "Arbitrum" || network === "Arbitrum Sepolia";
                  const networkIcon = isArbitrum ? (
                    <ArbitrumIcon size={24} className="text-current" />
                  ) : (
                    <BaseIcon size={24} className="text-current" />
                  );
                  
                  // Show tooltip for testnet networks
                  if (isTestnet) {
                    const tooltipText = `${network} testnet`;
                    return (
                      <Tooltip key={network}>
                        <TooltipTrigger asChild>
                          <div className="relative cursor-help">
                            {networkIcon}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="bg-black/90 text-white border-emerald-500/20 z-50 rounded-xl"
                        >
                          <p className="text-sm font-medium">{tooltipText}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  }
                  
                  return (
                    <div key={network} className="relative">
                      {networkIcon}
                    </div>
                  );
                })}
              </div>
            </TooltipProvider>
            
            {rewardType && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-300">{rewardType}</span>
              </>
            )}
            
            {isMetadataRefreshing ? (
              <>
                <span className="text-gray-400">|</span>
                <Skeleton className="h-5 w-32" />
              </>
            ) : website ? (
              <>
                <span className="text-gray-400">|</span>
                <a 
                  href={website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-emerald-500 hover:text-emerald-400 hover:underline hover:underline-offset-3 flex items-center gap-1"
                >
                  {extractDomain(website)}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            ) : null}
          </div>
          
          {isMetadataRefreshing ? (
            <div className="space-y-2 max-w-2xl">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : description ? (
            <p className="text-gray-400 max-w-2xl">
              {description}
            </p>
          ) : null}
          
          {children}
        </div>
      </div>
      
      {/* Edit Subnet Modal */}
      <EditSubnetModal
        isOpen={isEditModalOpen}
        onCloseAction={() => {
          setIsEditModalOpen(false);
          // Don't reset refreshing state here - let it persist if transaction was confirmed
          // The modal will handle resetting it when data refresh completes
        }}
        builder={builder || null}
        subnetId={subnetId || null}
        isTestnet={isTestnet}
        onRefreshingChange={(refreshing) => {
          console.log('[ProjectHeader] Refreshing state changed:', refreshing);
          setIsMetadataRefreshing(refreshing);
        }}
        onSave={() => {
          // The modal will handle refreshing the builders data
          console.log("Subnet metadata updated successfully");
        }}
      />
    </>
  );
} 