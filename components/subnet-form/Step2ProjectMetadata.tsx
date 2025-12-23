import React, { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { baseSepolia, base } from 'wagmi/chains';


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
  
  // Get selected network ID
  const selectedChainId = useWatch({ control: form.control, name: "subnet.networkChainId" });
  const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id; // Both Base and Base Sepolia use V4 contracts
  
  // Watch for changes to the subnet name field
  const subnetName = useWatch({
    control: form.control,
    name: "subnet.name",
    defaultValue: "",
  });
  
  // Auto-generate slug when subnet name changes - Required for V4 networks (Base and Base Sepolia)
  useEffect(() => {
    // Only run this effect if on V4 network (Base or Base Sepolia)
    if (!isV4Network) return;
    
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
  }, [subnetName, form, isV4Network]); // Auto-generate slug for V4 networks

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
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">Project Metadata</legend>

      {/* Contract Metadata */}
      <div className="space-y-4 pb-4">
        <h3 className="text-lg font-medium text-gray-100">Project Information</h3>
        <p className="text-sm text-gray-400 pb-2">This information will be stored on-chain with your subnet.</p>
        {/* Conditionally render Slug field for V4 networks (Base and Base Sepolia) */}
        {isV4Network && (
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
              <FormLabel htmlFor="metadata.website">Website *</FormLabel>
              <FormControl>
                <Input id="metadata.website" type="url" placeholder="https://yourproject.com" {...field} />
              </FormControl>
              <FormDescription>
                Your project&apos;s website URL (required).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control} name="metadata.image"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="metadata.image">Logo URL</FormLabel>
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
              <FormLabel htmlFor="metadata.description">
                Description *
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <Textarea id="metadata.description" placeholder="Describe this subnet (min 60, max 200 characters)." {...field} rows={4} maxLength={200} />
                  <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-background/80 px-1 rounded">
                    {(field.value || '').length}/200
                  </div>
                </div>
              </FormControl>
              <FormDescription>
                A brief description of your subnet (required, minimum 60 characters).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  );
};

export default Step2ProjectMetadata; 