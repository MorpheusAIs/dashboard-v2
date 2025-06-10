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
  const { rewardTypes } = useBuilders();
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

      // Update the builder using the API route (bypasses RLS)
      const updateData = {
        id: builder.id,
        description: description.trim() || null,
        website: website.trim() || null,
        image_src: imageSrc.trim() || null,
        ...(rewardType && { reward_types: [rewardType] })
      };
      
      console.log(`[EditSubnetModal] === STARTING SAVE PROCESS === ${new Date().toISOString()}`);
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
      console.error('[EditSubnetModal] Error in save process:', error);
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