"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBuilders } from "@/context/builders-context";
import { Builder } from "@/app/builders/builders-data";
import { toast } from "sonner";

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
  onSave?: () => void;
}

export function EditSubnetModal({ isOpen, onCloseAction, builder, onSave }: EditSubnetModalProps) {
  const { rewardTypes, refreshData } = useBuilders();
  const [isLoading, setIsLoading] = useState(false);
  
  console.log('[EditSubnetModal] Available reward types:', rewardTypes);
  
  // Form state
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [imageSrc, setImageSrc] = useState("");
  const [rewardType, setRewardType] = useState("");

  // Add validation states
  const [websiteError, setWebsiteError] = useState(false);
  const [imageSrcError, setImageSrcError] = useState(false);

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
    // Reset form state when closing
    setDescription("");
    setWebsite("");
    setImageSrc("");
    setRewardType("");
    setIsLoading(false);
    
    // Reset validation states
    setWebsiteError(false);
    setImageSrcError(false);
    
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
    
    // Pre-fill form fields
    setDescription(builder.description || "");
    setWebsite(builder.website || "");
    setImageSrc(builder.image_src || "");
    setRewardType(builder.reward_types?.[0] || "");
  }, [builder, isOpen]);

  const handleSave = async () => {
    console.log('[EditSubnetModal] Save handler called');
    
    if (!builder || !builder.id) {
      console.error('[EditSubnetModal] Cannot save: Missing builder or builder ID');
      toast.error("Cannot save: Builder information is missing");
      return;
    }

    // Validate URLs before saving
    if (websiteError || imageSrcError) {
      toast.error("Please fix the invalid URLs before saving");
      return;
    }
    
    setIsLoading(true);
    let saveSuccessful = false;

    try {
      console.log('[EditSubnetModal] === SAVE PROCESS STARTED ===');
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
        reward_types: rewardType ? [rewardType] : null
      });

      // Check if there are any actual changes
      const hasChanges = 
        (description.trim() || '') !== (builder.description || '') ||
        (website.trim() || '') !== (builder.website || '') ||
        (imageSrc.trim() || '') !== (builder.image_src || '') ||
        (rewardType || '') !== (builder.reward_types?.[0] || '');

      console.log('[EditSubnetModal] Has changes:', hasChanges);

      // Detect if this is a temporary morlord ID (subnet not yet in Supabase)
      const isTempMorlordId = builder.id.startsWith('morlord-');
      const httpMethod = isTempMorlordId ? 'POST' : 'PATCH';
      
      console.log(`[EditSubnetModal] Using ${httpMethod} method for ${isTempMorlordId ? 'new subnet creation' : 'existing subnet update'}`);

      // Prepare data based on method
      interface CreateBuilderData {
        name: string;
        networks: string[];
        description: string | null;
        long_description: string | null;
        website: string | null;
        image_src: string | null;
        reward_types: string[];
        tags: string[];
        github_url: string | null;
        twitter_url: string | null;
        discord_url: string | null;
        contributors: number;
        github_stars: number;
        reward_types_detail: string[];
      }
      
      interface UpdateBuilderData {
        id: string;
        description?: string | null;
        website?: string | null;
        image_src?: string | null;
        reward_types?: string[];
      }
      
      let requestData: CreateBuilderData | UpdateBuilderData;
      
      if (isTempMorlordId) {
        // For POST (creating new subnet): include name and required fields
        const extractedName = builder.id.replace(/^morlord-/, '').replace(/-/g, ' ');
        requestData = {
          name: extractedName,
          networks: builder.networks || ['Base'], // Use builder's networks or default to Base
          description: description.trim() || null,
          long_description: description.trim() || null,
          website: website.trim() || null,
          image_src: imageSrc.trim() || null,
          reward_types: rewardType ? [rewardType] : [],
          // Set other required fields with defaults
          tags: [],
          github_url: null,
          twitter_url: null,
          discord_url: null,
          contributors: 0,
          github_stars: 0,
          reward_types_detail: [],
        };
      } else {
        // For PATCH (updating existing subnet): only include the fields to update
        requestData = {
          id: builder.id,
          description: description.trim() || null,
          website: website.trim() || null,
          image_src: imageSrc.trim() || null,
          ...(rewardType && { reward_types: [rewardType] })
        };
      }
      
      console.log(`[EditSubnetModal] === STARTING ${httpMethod} PROCESS === ${new Date().toISOString()}`);
      console.log('[EditSubnetModal] Request data being sent:', requestData);
      console.log('[EditSubnetModal] API endpoint: /api/builders');
      console.log(`[EditSubnetModal] HTTP method: ${httpMethod}`);

      const response = await fetch('/api/builders', {
        method: httpMethod,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log(`[EditSubnetModal] API response received: ${response.status} at ${new Date().toISOString()}`);
      console.log('[EditSubnetModal] API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[EditSubnetModal] API error response:', errorData);
        
        // Provide more specific error messages for common issues
        let errorMessage = errorData.error || response.statusText;
        
        if (errorData.error && errorData.error.includes('invalid input syntax for type uuid')) {
          errorMessage = "This subnet has an invalid ID format. This has been fixed - please try again.";
        } else if (response.status === 404) {
          errorMessage = "Subnet not found. It may have been deleted or you may not have permission to edit it.";
        } else if (response.status === 403) {
          errorMessage = "You don't have permission to edit this subnet.";
        } else if (response.status === 500) {
          errorMessage = `Server error: ${errorData.error || 'Unknown error occurred'}`;
        } else if (response.status === 400 && isTempMorlordId) {
          errorMessage = `Error creating subnet: ${errorData.error || 'Invalid data provided'}`;
        }
        
        const actionText = isTempMorlordId ? 'create subnet metadata' : 'update subnet metadata';
        toast.error(`Failed to ${actionText}: ${errorMessage}`);
        return;
      }

      const data = await response.json();
      console.log(`[EditSubnetModal] API ${httpMethod} successful at ${new Date().toISOString()}, data:`, data);
      saveSuccessful = true;

      const successMessage = isTempMorlordId ? 
        "Subnet metadata created successfully" : 
        "Subnet metadata updated successfully";
      toast.success(successMessage);
      
      console.log('[EditSubnetModal] Calling onSave callback and refreshing cache...');
      // Call the onSave callback if provided
      try {
        if (onSave) {
          onSave();
        }
      } catch (callbackError) {
        console.error('[EditSubnetModal] Error in onSave callback:', callbackError);
      }
      
      // Refresh builders cache to ensure the new/updated subnet is properly merged
      // This is especially important for temporary morlord IDs that need to be replaced
      try {
        console.log('[EditSubnetModal] Refreshing builders cache...');
        await refreshData();
        console.log('[EditSubnetModal] Cache refresh completed successfully');
      } catch (refreshError) {
        console.error('[EditSubnetModal] Error refreshing cache:', refreshError);
        // Don't fail the save operation if cache refresh fails
      }
      
    } catch (error) {
      console.error('[EditSubnetModal] Error in save process:', error);
      const actionText = builder.id.startsWith('morlord-') ? 'create subnet metadata' : 'update subnet metadata';
      toast.error(`Failed to ${actionText}`);
    } finally {
      console.log('[EditSubnetModal] Setting isLoading to false');
      setIsLoading(false);
      
      // Handle modal close after API completes
      if (saveSuccessful) {
        console.log('[EditSubnetModal] Save successful, closing modal after cache refresh');
        
        // Close the modal after cache refresh
        setTimeout(() => {
          console.log(`[EditSubnetModal] Closing modal at ${new Date().toISOString()}`);
          handleClose();
          console.log(`[EditSubnetModal] === SAVE PROCESS COMPLETED === ${new Date().toISOString()}`);
        }, 200); // Small delay to ensure cache refresh and UI updates complete
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
          {/* Description field */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <Textarea
                id="description"
                placeholder="Enter subnet description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                rows={3}
              />
              <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-background/80 px-1 rounded">
                {description.length}/200
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

          {/* Reward type dropdown */}
          <div className="grid gap-2">
            <Label htmlFor="rewardType">Reward type</Label>
            <Select value={rewardType} onValueChange={setRewardType}>
              <SelectTrigger>
                <SelectValue placeholder="Select reward type" />
              </SelectTrigger>
              <SelectContent>
                {rewardTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
} 