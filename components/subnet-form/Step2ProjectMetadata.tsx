import React, { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import MultipleSelector from "@/components/ui/multiple-selector";
import { REWARD_OPTIONS } from './schemas';
import { cn } from "@/lib/utils";
import { arbitrumSepolia } from 'wagmi/chains'; // Import arbitrumSepolia

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Step2ProjectMetadataProps {
  isSubmitting: boolean;
}

/**
 * Converts a name to a slug by replacing spaces with hyphens and lowercasing.
 * Also removes special characters.
 */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-'); // Replace multiple hyphens with a single one
}

export const Step2ProjectMetadata: React.FC<Step2ProjectMetadataProps> = ({ isSubmitting }) => {
  const form = useFormContext();
  // Use ref to track the last subnet name we processed
  const lastProcessedNameRef = useRef<string>('');
  // State to track the image URL validation status
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  
  // Get selected network ID and determine if it's testnet
  const selectedChainId = useWatch({ control: form.control, name: "subnet.networkChainId" });
  const isTestnet = selectedChainId === arbitrumSepolia.id;
  
  // Watch for changes to the subnet name field
  const subnetName = useWatch({
    control: form.control,
    name: "subnet.name",
    defaultValue: "",
  });
  
  // Auto-generate slug when subnet name changes - ONLY ON TESTNET
  useEffect(() => {
    // Only run this effect if on testnet
    if (!isTestnet) return;
    
    // Only proceed if there's a subnet name and it's different from the last one we processed
    if (subnetName && subnetName !== lastProcessedNameRef.current) {
      const currentSlug = form.getValues("metadata.slug");
      const generatedSlug = nameToSlug(subnetName);
      
      // Only update if the slug is empty or if it matches a previously generated slug pattern
      if (!currentSlug || currentSlug === nameToSlug(lastProcessedNameRef.current)) {
        // Update the ref to track this name as processed
        lastProcessedNameRef.current = subnetName;
        
        // Set the new slug value
        form.setValue("metadata.slug", generatedSlug, { 
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
  }, [subnetName, form, isTestnet]); // Add isTestnet to dependency array

  // Function to validate image URL
  const validateImageUrl = (url: string) => {
    if (!url) {
      setImageUrlError(null);
      return true; // Empty URL is valid (field is optional)
    }
    
    // Check if it's a valid URL format
    let isValidUrl = false;
    try {
      new URL(url);
      isValidUrl = true;
    } catch {
      setImageUrlError("Please enter a valid URL");
      return false;
    }
    
    if (isValidUrl) {
      try {
        // Check if URL contains a valid image extension in the pathname
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname.toLowerCase();
        
        // Check if any valid extension exists in the pathname
        const hasValidExtension = validExtensions.some(ext => pathname.includes(ext));
        
        if (!hasValidExtension) {
          setImageUrlError("URL should include a valid image extension (.jpg, .png, .svg, etc.)");
          return false;
        }
      } catch {
        setImageUrlError("Invalid URL format");
        return false;
      }
    }
    
    // Clear any existing errors
    setImageUrlError(null);
    return true;
  };

  return (
    <fieldset disabled={isSubmitting} className="space-y-6 p-6 border border-gray-100/30 rounded-lg">
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">Project & Metadata</legend>
      
      {/* Contract Metadata */}
      <div className="space-y-4 pb-4 border-b border-gray-100/20">
        <h3 className="text-lg font-medium text-gray-100">Project Information</h3>
        {/* Conditionally render Slug field only on testnet */}
        {isTestnet && (
          <FormField
            control={form.control} name="metadata.slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="metadata.slug">Slug</FormLabel>
                <FormControl>
                  <Input id="metadata.slug" placeholder="your-subnet-slug" {...field} />
                </FormControl>
                <FormDescription>
                  Short, URL-friendly identifier (auto-generated from name, but you can customize it).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control} name="metadata.website"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="metadata.website">Website</FormLabel>
              <FormControl>
                <Input id="metadata.website" type="url" placeholder="https://yourproject.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="metadata.image"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="metadata.image">Logo URL (Optional)</FormLabel>
              <FormControl>
                <Input 
                  id="metadata.image"
                  type="url" 
                  placeholder="https://yourproject.com/logo.png" 
                  {...field} 
                  value={field.value ?? ''} 
                  onChange={(e) => {
                    field.onChange(e);
                    validateImageUrl(e.target.value);
                  }}
                  onBlur={(e) => {
                    // Also validate on blur to catch issues when pasting
                    field.onBlur();
                    validateImageUrl(e.target.value);
                  }}
                  className={imageUrlError ? "border-red-500" : undefined}
                />
              </FormControl>
              <FormDescription className={cn(imageUrlError ? "text-red-500" : "")}>
                Direct URL to your project&apos;s logo (must end with a valid image extension like .jpg, .png, or .svg).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="metadata.description"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="metadata.description">Subnet Description</FormLabel>
              <FormControl>
                <Textarea id="metadata.description" placeholder="Describe this subnet (max 800 characters)." {...field} rows={4} maxLength={800} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Additional Project Info */}
      <div className="space-y-4 pt-4">
        <h3 className="text-lg font-medium text-gray-100">Additional Project Info</h3>
        <p className="text-sm text-gray-400 pb-2">Optional contact info & potential rewards (stored off-chain).</p>
        <FormField
          control={form.control} name="projectOffChain.email"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="projectOffChain.email">Contact Email (Optional)</FormLabel>
              <FormControl>
                <Input id="projectOffChain.email" type="email" placeholder="contact@yourproject.com" {...field} value={field.value ?? ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="projectOffChain.discordLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="projectOffChain.discordLink">Discord Link (Optional)</FormLabel>
              <FormControl>
                <Input id="projectOffChain.discordLink" placeholder="https://discord.gg/yourserver" {...field} value={field.value ?? ''}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="projectOffChain.twitterLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="projectOffChain.twitterLink">X (Twitter) Link (Optional)</FormLabel>
              <FormControl>
                <Input id="projectOffChain.twitterLink" placeholder="https://x.com/yourproject" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="projectOffChain.rewards"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Potential Rewards for Stakers (Optional)</FormLabel>
              <FormControl>
                <MultipleSelector
                  value={field.value}
                  defaultOptions={REWARD_OPTIONS}
                  placeholder="Select potential rewards (optional)..."
                  emptyIndicator={<p className="text-center text-sm text-gray-500">No reward types available.</p>}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormDescription>For informational purposes.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  );
};

export default Step2ProjectMetadata; 