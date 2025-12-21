"use client";

import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBuilders } from "@/context/builders-context";
import { Builder, isV4Builder } from "@/app/builders/builders-data";
import { toast } from "sonner";
import { useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { Address } from "viem";
import BuildersV4Abi from '@/app/abi/BuildersV4.json';
import { testnetChains, mainnetChains } from '@/config/networks';
import { useNetwork } from "@/context/network-context";

// Add URL validation function
const isValidUrl = (url: string): boolean => {
  if (!url.trim()) return true; // Empty is valid (optional field)
  
  // Check if it's a valid URL structure first
  try {
    const urlObj = new URL(url);
    
    // Additional validation for web URLs
    // Must have http/https protocol
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Must have a hostname that looks like a domain (contains at least one dot)
    if (!urlObj.hostname || !urlObj.hostname.includes('.')) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
};

export interface EditSubnetModalProps {
  isOpen: boolean;
  onCloseAction: () => void;
  builder: Builder | null;
  subnetId?: string | null;
  isTestnet?: boolean;
  onSave?: () => void;
  onRefreshingChange?: (isRefreshing: boolean) => void; // Callback to notify parent of refreshing state
}

export function EditSubnetModal({ isOpen, onCloseAction, builder, subnetId, isTestnet = false, onSave, onRefreshingChange }: EditSubnetModalProps) {
  const { rewardTypes, refreshData } = useBuilders();
  const [isLoading, setIsLoading] = useState(false);
  const chainId = useChainId();
  const { switchToChain } = useNetwork();
  
  // V4 contract write hooks
  const { writeContract, data: hash, isPending: isContractPending, error: contractError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });
  
  console.log('[EditSubnetModal] Available reward types:', rewardTypes);
  
  // Detect if this is a V4 subnet
  const isV4 = builder ? isV4Builder(builder) : false;
  
  // Log V4 detection details
  console.log('[EditSubnetModal] === V4 DETECTION ===');
  console.log('[EditSubnetModal] Is V4 subnet:', isV4);
  console.log('[EditSubnetModal] Builder data for detection:', {
    hasSlug: !!builder?.slug,
    slug: builder?.slug,
    id: builder?.id,
    idIsHex: builder?.id?.startsWith('0x'),
    idLength: builder?.id?.length,
    mainnetProjectId: builder?.mainnetProjectId,
    mainnetProjectIdIsHex: builder?.mainnetProjectId?.startsWith('0x'),
    name: builder?.name
  });
  
  // Get contract address based on network (matching logic from builder page)
  const contractAddress = (() => {
    if (isTestnet) {
      return testnetChains.baseSepolia.contracts?.builders?.address as Address | undefined;
    } else {
      // For mainnet, determine chain based on current chainId or builder network
      // V4 subnets are on Base mainnet, V1 subnets can be on Arbitrum or Base
      if (chainId === 42161) {
        // Arbitrum mainnet
        return mainnetChains.arbitrum.contracts?.builders?.address as Address | undefined;
      }
      // Base mainnet (default for V4)
      return mainnetChains.base.contracts?.builders?.address as Address | undefined;
    }
  })();
  
  // Form state
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [slug, setSlug] = useState("");
  // Note: rewardType removed - V4 subnets don't support it, only V1 (Supabase) does

  // Add validation states
  const [websiteError, setWebsiteError] = useState(false);
  const [imageSrcError, setImageSrcError] = useState(false);
  
  // Ref to track which transaction hash we've already processed (prevent duplicate toasts)
  const processedTxHashRef = useRef<string | null>(null);
  // Ref to track if we have a confirmed transaction that's waiting for data refresh
  const hasConfirmedTransactionRef = useRef<boolean>(false);

  // URL validation handlers
  const handleWebsiteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setWebsite(value);
    setWebsiteError(value.trim() !== '' && !isValidUrl(value));
  };

  const handleImageSrcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setImageSrc(value);
    setImageSrcError(value.trim() !== '' && !isValidUrl(value));
  };

  // Handle modal close with cleanup
  const handleClose = () => {
    console.log('[EditSubnetModal] handleClose called');
    console.log('[EditSubnetModal] Has confirmed transaction:', hasConfirmedTransactionRef.current);
    console.log('[EditSubnetModal] Is contract pending:', isContractPending);
    console.log('[EditSubnetModal] Is confirming:', isConfirming);
    console.log('[EditSubnetModal] Has hash:', !!hash);
    
    // Reset form state when closing
    setDescription("");
    setWebsite("");
    setImageSrc("");
    setSlug("");
    setIsLoading(false);
    
    // Reset validation states
    setWebsiteError(false);
    setImageSrcError(false);
    
    // Only reset refreshing state if we don't have a confirmed transaction waiting for refresh
    // If transaction was confirmed, keep refreshing state active so skeleton shows after modal closes
    if (!hasConfirmedTransactionRef.current) {
      // User cancelled before transaction was confirmed or no transaction was submitted
      console.log('[EditSubnetModal] No confirmed transaction - resetting refreshing state');
      // Reset processed transaction hash when closing modal
      processedTxHashRef.current = null;
      
      // Notify parent that we're no longer refreshing
      if (onRefreshingChange) {
        onRefreshingChange(false);
      }
    } else {
      console.log('[EditSubnetModal] ✅ Confirmed transaction exists - keeping refreshing state active after modal close');
      console.log('[EditSubnetModal] Skeleton should now be visible in ProjectHeader');
    }
    
    // Use setTimeout to ensure focus is properly managed before closing
    setTimeout(() => {
      onCloseAction();
    }, 0);
  };

  // Initialize form with builder data when modal opens
  useEffect(() => {
    if (!isOpen || !builder) return;

    console.log('[EditSubnetModal] useEffect: Modal opened for builder:', builder.name);
    console.log('[EditSubnetModal] Builder ID:', builder.id);
    console.log('[EditSubnetModal] Builder data:', builder);
    console.log('[EditSubnetModal] Is V4:', isV4);
    console.log('[EditSubnetModal] Subnet ID:', subnetId);
    
    // Reset processed transaction hash and confirmed transaction ref when modal opens
    processedTxHashRef.current = null;
    hasConfirmedTransactionRef.current = false;
    
    // Pre-fill form fields
    // For V4, prefer image field; for V1, use image_src
    const imageValue = isV4 ? (builder.image || builder.image_src || "") : (builder.image_src || builder.image || "");
    setDescription(builder.description || "");
    setWebsite(builder.website || "");
    setImageSrc(imageValue);
    setSlug(builder.slug || "");
    // Note: rewardType removed - V4 subnets don't support it
  }, [builder, isOpen, isV4, subnetId]);
  
  // Handle V4 transaction confirmation
  useEffect(() => {
    // Only process if: V4 subnet, transaction confirmed, we have a hash, and we haven't processed this hash yet
    if (isV4 && isConfirmed && hash && processedTxHashRef.current !== hash) {
      console.log('[EditSubnetModal] V4 transaction confirmed successfully');
      console.log('[EditSubnetModal] Transaction hash:', hash);
      
      // Mark this transaction hash as processed
      processedTxHashRef.current = hash;
      // Mark that we have a confirmed transaction waiting for data refresh
      hasConfirmedTransactionRef.current = true;
      
      // Dismiss any loading toast first
      toast.dismiss("v4-update");
      
      // Show success toast (only once per transaction hash) with unique ID
      toast.success("Subnet metadata updated successfully on-chain", {
        id: `v4-success-${hash}`, // Unique ID based on transaction hash
      });
      setIsLoading(false);
      
      // Notify parent that we're refreshing data (this will show skeleton)
      if (onRefreshingChange) {
        console.log('[EditSubnetModal] Setting refreshing state to true - skeleton should appear');
        onRefreshingChange(true);
      }
      
      // Refresh builder data
      if (refreshData) {
        refreshData().then(() => {
          console.log('[EditSubnetModal] Data refresh complete - stopping skeleton');
          // Data refresh complete, stop showing skeleton
          hasConfirmedTransactionRef.current = false;
          if (onRefreshingChange) {
            onRefreshingChange(false);
          }
        }).catch((error) => {
          console.error('[EditSubnetModal] Error refreshing data:', error);
          // Stop showing skeleton even on error
          hasConfirmedTransactionRef.current = false;
          if (onRefreshingChange) {
            onRefreshingChange(false);
          }
        });
      } else {
        // If no refreshData, stop refreshing after a delay
        setTimeout(() => {
          hasConfirmedTransactionRef.current = false;
          if (onRefreshingChange) {
            onRefreshingChange(false);
          }
        }, 2000);
      }
      
      // Call onSave callback
      if (onSave) {
        onSave();
      }
      
      // Close modal after a short delay (skeleton will remain visible)
      setTimeout(() => {
        handleClose();
      }, 1000);
    }
  }, [isV4, isConfirmed, hash, refreshData, onSave, onRefreshingChange]);
  
  // Handle V4 transaction errors
  useEffect(() => {
    if (isV4 && contractError) {
      console.error('[EditSubnetModal] V4 contract error:', contractError);
      toast.error(`Transaction failed: ${contractError.message || 'Unknown error'}`);
      setIsLoading(false);
      // Reset confirmed transaction ref on error
      hasConfirmedTransactionRef.current = false;
      // Stop showing skeleton on error
      if (onRefreshingChange) {
        onRefreshingChange(false);
      }
    }
  }, [isV4, contractError, onRefreshingChange]);

  const handleSave = async () => {
    console.log('[EditSubnetModal] ========== SAVE HANDLER CALLED ==========');
    console.log('[EditSubnetModal] Is V4 subnet:', isV4);
    console.log('[EditSubnetModal] Builder ID:', builder?.id);
    console.log('[EditSubnetModal] Builder mainnetProjectId:', builder?.mainnetProjectId);
    console.log('[EditSubnetModal] Subnet ID:', subnetId);
    
    if (!builder) {
      console.error('[EditSubnetModal] Cannot save: Missing builder');
      toast.error("Cannot save: Builder information is missing");
      return;
    }

    // Validate URLs before saving
    if (websiteError || imageSrcError) {
      toast.error("Please fix the invalid URLs before saving");
      return;
    }
    
    setIsLoading(true);

    // V4 Path: Update on-chain metadata via contract
    // IMPORTANT: V4 subnets MUST use contract, never API
    if (isV4) {
      console.log('[EditSubnetModal] ✅ DETECTED AS V4 - Using contract path');
      if (!subnetId || !contractAddress) {
        console.error('[EditSubnetModal] Cannot save V4: Missing subnetId or contractAddress');
        toast.error("Cannot save: Missing subnet information");
        setIsLoading(false);
        return;
      }
      
      try {
        console.log('[EditSubnetModal] === V4 SAVE PROCESS STARTED ===');
        console.log('[EditSubnetModal] Subnet ID:', subnetId);
        console.log('[EditSubnetModal] Contract address:', contractAddress);
        
        // subnetId should already be in bytes32 format (Address type)
        // Convert string to Address if needed
        const subnetIdBytes32 = subnetId as Address;
        
        // Construct SubnetMetadata struct
        // Use current slug if not changed, otherwise use new slug or generate from name
        const finalSlug = slug.trim() || builder.slug || builder.name.toLowerCase().replace(/\s+/g, '-');
        const metadataStruct = {
          slug: finalSlug,
          description: description.trim() || "",
          website: website.trim() || "",
          image: imageSrc.trim() || "",
        };
        
        console.log('[EditSubnetModal] V4 Update - Subnet ID:', subnetIdBytes32);
        console.log('[EditSubnetModal] V4 Update - Contract address:', contractAddress);
        console.log('[EditSubnetModal] V4 Update - Metadata struct:', metadataStruct);
        
        // Write to contract
        writeContract({
          address: contractAddress,
          abi: BuildersV4Abi,
          functionName: 'editSubnetMetadata',
          args: [subnetIdBytes32, metadataStruct],
        });
        
        // Show loading toast
        toast.loading("Updating subnet metadata on-chain...", { id: "v4-update" });
        
        // Transaction state will be handled by useEffect hooks above
        return;
        
      } catch (error) {
        console.error('[EditSubnetModal] Error in V4 save process:', error);
        toast.error(`Failed to update subnet metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoading(false);
        return;
      }
    }
    
    // V1 Path: Update Supabase metadata via API
    // Safety check: If somehow we got here but builder.id looks like a hex address, it's actually V4
    if (builder.id && builder.id.startsWith('0x') && builder.id.length === 66) {
      console.error('[EditSubnetModal] ⚠️ ERROR: Builder ID is hex address but isV4=false. This should not happen!');
      console.error('[EditSubnetModal] Forcing V4 path for hex ID:', builder.id);
      toast.error("Error: Subnet appears to be V4 but was not detected. Please refresh and try again.");
      setIsLoading(false);
      return;
    }
    
    if (!builder.id) {
      console.error('[EditSubnetModal] Cannot save V1: Missing builder ID');
      toast.error("Cannot save: Builder ID is missing");
      setIsLoading(false);
      return;
    }
    
    console.log('[EditSubnetModal] ✅ DETECTED AS V1 - Using Supabase API path');
    
    let saveSuccessful = false;

    try {
      console.log('[EditSubnetModal] === V1 SAVE PROCESS STARTED ===');
      console.log('[EditSubnetModal] Builder ID:', builder.id);
      console.log('[EditSubnetModal] Current builder data:', {
        id: builder.id,
        name: builder.name,
        description: builder.description,
        website: builder.website,
        image_src: builder.image_src,
        reward_types: builder.reward_types
      });

      console.log('[EditSubnetModal] Form values being saved:', {
        description: description.trim() || null,
        website: website.trim() || null,
        image_src: imageSrc.trim() || null,
        reward_types: builder.reward_types || null // Keep existing reward types, don't allow editing
      });

      // Update the builder using the API route (bypasses RLS)
      // Note: Only update V1 subnets via API - V4 should use contract
      const updateData = {
        id: builder.id,
        description: description.trim() || null,
        website: website.trim() || null,
        image_src: imageSrc.trim() || null,
        // Don't update reward_types via API - keep existing
      };
      
      console.log(`[EditSubnetModal] === STARTING V1 SAVE PROCESS === ${new Date().toISOString()}`);
      console.log('[EditSubnetModal] Form data being sent:', updateData);
      console.log('[EditSubnetModal] API endpoint: /api/builders');
      console.log('[EditSubnetModal] HTTP method: PATCH');

      const response = await fetch('/api/builders', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      console.log(`[EditSubnetModal] API response received: ${response.status} at ${new Date().toISOString()}`);
      console.log('[EditSubnetModal] API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[EditSubnetModal] API error response:', errorData);
        toast.error(`Failed to update subnet metadata: ${errorData.error || response.statusText}`);
        return;
      }

      const data = await response.json();
      console.log(`[EditSubnetModal] API update successful at ${new Date().toISOString()}, updated data:`, data);
      saveSuccessful = true;

      toast.success("Subnet metadata updated successfully");
      
      console.log('[EditSubnetModal] Calling onSave callback...');
      // Call the onSave callback if provided
      try {
        if (onSave) {
          onSave();
        }
      } catch (callbackError) {
        console.error('[EditSubnetModal] Error in onSave callback:', callbackError);
      }
      
    } catch (error) {
      console.error('[EditSubnetModal] Error in V1 save process:', error);
      toast.error("Failed to update subnet metadata");
    } finally {
      console.log('[EditSubnetModal] Setting isLoading to false');
      setIsLoading(false);
      
      // Handle cache update and modal close after API completes
      if (saveSuccessful) {
        console.log('[EditSubnetModal] Save successful, closing modal (real-time updates will handle cache)');
        
        // Close the modal immediately - Supabase real-time subscription will update the cache
        setTimeout(() => {
          console.log(`[EditSubnetModal] Closing modal at ${new Date().toISOString()}`);
          handleClose();
          console.log(`[EditSubnetModal] === SAVE PROCESS COMPLETED === ${new Date().toISOString()}`);
        }, 100); // Small delay to ensure UI updates
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-emerald-400">
            Edit {builder?.name} metadata
          </DialogTitle>
          <DialogDescription>
            Update the subnet information and settings below.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          {/* Slug field (V4 only) */}
          {isV4 && (
            <div className="grid gap-2">
              <Label htmlFor="slug">Slug (URL-friendly identifier)</Label>
              <Input
                id="slug"
                type="text"
                placeholder="e.g., my-subnet"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="max-w-[373px]"
              />
            </div>
          )}
          
          {/* Description field */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <Textarea
                id="description"
                placeholder="Enter subnet description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={isV4 ? 800 : 200}
                rows={3}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-background/80 px-1 rounded">
                {description.length}/{isV4 ? 800 : 200}
              </div>
            </div>
          </div>

          {/* Website URL field */}
          <div className="grid gap-2">
            <Label htmlFor="website">Subnet URL</Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={website}
              onChange={handleWebsiteChange}
              className={`max-w-[373px] overflow-hidden text-ellipsis ${websiteError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {websiteError && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
            )}
          </div>

          {/* Image URL field */}
          <div className="grid gap-2">
            <Label htmlFor="imageSrc">Subnet logo URL</Label>
            <Input
              id="imageSrc"
              type="url"
              placeholder="https://example.com/logo.png"
              value={imageSrc}
              onChange={handleImageSrcChange}
              className={`max-w-[373px] overflow-hidden text-ellipsis ${imageSrcError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {imageSrcError && (
              <p className="text-xs text-red-500">Please enter a valid URL</p>
            )}
            {imageSrc && !imageSrcError && (
              <p className="text-xs text-gray-500 truncate max-w-[373px]">
                Current: {imageSrc}
              </p>
            )}
          </div>

          {/* Reward type field removed - V4 subnets don't support it on-chain */}
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading || isContractPending || isConfirming}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || isContractPending || isConfirming}>
            {isContractPending || isConfirming 
              ? "Confirming transaction..." 
              : isLoading 
              ? "Saving..." 
              : isV4 
              ? "Update on-chain" 
              : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 