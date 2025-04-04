import Image from "next/image";
import { NetworkIcon } from '@web3icons/react';
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
}

export function ProjectHeader({
  name,
  description,
  imagePath,
  networks = ['Base'],
  website,
  rewardType,
  backButton = false,
  onBack,
  backPath,
  children,
}: ProjectHeaderProps) {
  // Generate project default icon from name
  const firstLetter = name.charAt(0);
  
  // Render back button if needed
  const renderBackButton = () => {
    if (!backButton) return null;
    
    if (backPath) {
      return (
        <Link href={backPath}>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-full mr-3"
          >
            <span className="sr-only">Go back</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Button>
        </Link>
      );
    }
    
    return (
      <Button
        variant="outline"
        size="icon"
        className="size-9 rounded-full mr-3"
        onClick={onBack}
      >
        <span className="sr-only">Go back</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Button>
    );
  };

  return (
    <div className="flex items-start gap-6">
      {renderBackButton()}
      
      <div className="relative size-24 rounded-xl overflow-hidden bg-white/[0.05]">
        {imagePath ? (
          <Image
            src={imagePath.startsWith('http') ? imagePath : imagePath.startsWith('/') ? imagePath : `/${imagePath}`}
            alt={name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="flex items-center justify-center size-24 bg-emerald-700 text-white text-4xl font-medium">
            {firstLetter}
          </div>
        )}
      </div>
      
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">{name}</h1>
        
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
  );
} 