import Image from "next/image";
import { NetworkIcon } from '@web3icons/react';
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { EditSubnetModal } from "./edit-subnet-modal";
import { Builder } from "@/app/builders/builders-data";

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
}: ProjectHeaderProps) {
  
  // Debug log to see the builder data being passed
  console.log('[ProjectHeader] Builder data:', builder);
  console.log('[ProjectHeader] Builder ID:', builder?.id);
  console.log('[ProjectHeader] Show edit button:', showEditButton);
  
  // Track image loading error
  const [imageError, setImageError] = useState(false);
  // Track edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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
          <div className="flex -space-x-1">
            {networks.map((network: string) => (
              <div key={network} className="relative">
                <NetworkIcon name={network.toLowerCase()} size={24} />
              </div>
            ))}
          </div>
          
          {rewardType && (
            <>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300 text-sm">{rewardType}</span>
            </>
          )}
          
          {website && (
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
          )}
        </div>
        
        {/* Row 3: Description */}
        {description && (
          <p className="text-gray-400 text-sm">
            {description}
          </p>
        )}
        
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
            
            {/* {showEditButton && builder && (
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="copy-button copy-button-secondary font-medium px-4 py-2 mt-2"
              >
                Edit subnet
              </button>
            )} */}
          </div>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="flex -space-x-1">
              {networks.map((network: string) => (
                <div key={network} className="relative">
                  <NetworkIcon name={network.toLowerCase()} size={24} />
                </div>
              ))}
            </div>
            
            {rewardType && (
              <>
                <span className="text-gray-400">|</span>
                <span className="text-gray-300">{rewardType}</span>
              </>
            )}
            
            {website && (
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
            )}
          </div>
          
          {description && (
            <p className="text-gray-400 max-w-2xl">
              {description}
            </p>
          )}
          
          {children}
        </div>
      </div>
      
      {/* Edit Subnet Modal */}
      <EditSubnetModal
        isOpen={isEditModalOpen}
        onCloseAction={() => setIsEditModalOpen(false)}
        builder={builder || null}
        onSave={() => {
          // The modal will handle refreshing the builders data
          console.log("Subnet metadata updated successfully");
        }}
      />
    </>
  );
} 