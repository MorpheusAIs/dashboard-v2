import React, { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { baseSepolia, base } from 'wagmi/chains';
import { Option } from "@/components/ui/multiple-selector";
import MultipleSelector from "@/components/ui/multiple-selector";


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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Skills options for the multiple selector
const SKILLS_OPTIONS: Option[] = [
  { label: 'image2text', value: 'image2text' },
  { label: 'tts', value: 'tts' },
  { label: 'research', value: 'research' },
  { label: 'imagegen', value: 'imagegen' },
  { label: 'multimodal', value: 'multimodal' },
  { label: 'pdf extraction', value: 'pdf_extraction' },
  { label: 'ocr', value: 'ocr' },
  { label: 'text generation', value: 'text_generation' },
  { label: 'code generation', value: 'code_generation' },
  { label: 'data analysis', value: 'data_analysis' },
  { label: 'web scraping', value: 'web_scraping' },
  { label: 'api integration', value: 'api_integration' },
  { label: 'automation', value: 'automation' },
  { label: 'chat', value: 'chat' },
  { label: 'translation', value: 'translation' },
  { label: 'summarization', value: 'summarization' },
  { label: 'sentiment analysis', value: 'sentiment_analysis' },
  { label: 'classification', value: 'classification' },
];

export const Step2ProjectMetadata: React.FC<Step2ProjectMetadataProps> = ({ isSubmitting }) => {
  const form = useFormContext();
  // Use ref to track the last subnet name we processed
  const lastProcessedNameRef = useRef<string>('');
  // State to track the image URL validation status
  const [imageUrlError, setImageUrlError] = useState<string | null>(null);
  
  // Get selected network ID
  const selectedChainId = useWatch({ control: form.control, name: "subnet.networkChainId" });
  const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id; // Both Base and Base Sepolia use V4 contracts

  // Get selected subnet type
  const selectedType = useWatch({ control: form.control, name: "subnet.type" });
  const showMetadataSection = selectedType && selectedType !== "App";
  
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

  // Initialize extended metadata when type changes to non-App
  useEffect(() => {
    if (showMetadataSection && selectedType) {
      // Initialize the extended object if it doesn't exist
      const currentExtended = form.getValues("metadata.extended");
      if (!currentExtended) {
        form.setValue("metadata.extended", {
          type: selectedType,
          description: "",
          endpointUrl: "",
          author: "",
          xUrl: "",
          githubUrl: "",
          inputType: "",
          outputType: "",
          docsUrl: "",
          skills: [],
          category: "",
        }, {
          shouldValidate: false,
          shouldDirty: false,
        });
      } else if (currentExtended.type !== selectedType) {
        // Update type if it changed
        form.setValue("metadata.extended.type", selectedType, {
          shouldValidate: false,
          shouldDirty: false,
        });
      }
    }
  }, [showMetadataSection, selectedType, form]);

  // Combine extended metadata into description JSON only when needed
  // Use a ref to prevent infinite loops
  const combineMetadataTimeoutRef = useRef<NodeJS.Timeout>();
  const lastCombinedDataRef = useRef<string>("");

  useEffect(() => {
    if (showMetadataSection) {
      // Clear any existing timeout
      if (combineMetadataTimeoutRef.current) {
        clearTimeout(combineMetadataTimeoutRef.current);
      }

      // Debounce the combination to prevent excessive updates
      combineMetadataTimeoutRef.current = setTimeout(() => {
        const extendedData = form.getValues("metadata.extended");
        if (extendedData) {
          // Create metadata_ structure
          const metadataObject = {
            description: extendedData.description || "",
            endpointUrl: extendedData.endpointUrl || "",
            author: extendedData.author || "",
            inputType: extendedData.inputType || "",
            outputType: extendedData.outputType || "",
            skills: extendedData.skills || [],
            type: extendedData.type || selectedType || "",
            category: extendedData.category || "",
          };

          // Create combined data with metadata_ wrapper
          const combinedData = {
            metadata_: metadataObject,
            timestamp: Date.now(), // Add timestamp to ensure uniqueness
          };

          // Only update if data actually changed
          const jsonString = JSON.stringify(combinedData);
          if (jsonString !== lastCombinedDataRef.current) {
            lastCombinedDataRef.current = jsonString;
            form.setValue("metadata.description", jsonString, {
              shouldValidate: false, // Don't validate during the combination process
              shouldDirty: true,
            });
          }
        }
      }, 300); // 300ms debounce
    }

    // Cleanup timeout on unmount
    return () => {
      if (combineMetadataTimeoutRef.current) {
        clearTimeout(combineMetadataTimeoutRef.current);
      }
    };
  }, [showMetadataSection, form]);

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

        {/* Conditional Metadata Section for non-App types */}
        {showMetadataSection && (
          <>
            <div className="border-t border-gray-100/30 my-6"></div>
            <h3 className="text-lg font-medium text-gray-100 mb-4">Metadata</h3>
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="metadata.extended.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="metadata.extended.description">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        id="metadata.extended.description"
                        placeholder="Describe what this agent, API, or MCP server does..."
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      A detailed description of what this agent, API, or MCP server does.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="metadata.extended.endpointUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="metadata.extended.endpointUrl">Endpoint URL</FormLabel>
                    <FormControl>
                      <Input
                        id="metadata.extended.endpointUrl"
                        type="url"
                        placeholder="https://api.example.com/v1/chat"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The API endpoint URL where this service can be accessed.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Author and Type in the same row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.author"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.author">Author</FormLabel>
                        <FormControl>
                          <Input id="metadata.extended.author" placeholder="Author name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.type">Type</FormLabel>
                        <FormControl>
                          <Input
                            id="metadata.extended.type"
                            placeholder="Agent, API, or MCP server type"
                            {...field}
                            value={selectedType || field.value || ''}
                            readOnly
                          />
                        </FormControl>
                        <FormDescription>
                          Pre-filled with the selected type.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* GitHub URL and X URL in the same row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.githubUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.githubUrl">GitHub URL</FormLabel>
                        <FormControl>
                          <Input
                            id="metadata.extended.githubUrl"
                            type="url"
                            placeholder="https://github.com/username/repo"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          URL to the repository if open sourced.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.xUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.xUrl">X URL</FormLabel>
                        <FormControl>
                          <Input
                            id="metadata.extended.xUrl"
                            type="url"
                            placeholder="https://x.com/username"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Input Type and Output Type in the same row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.inputType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.inputType">Input Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger id="metadata.extended.inputType">
                              <SelectValue placeholder="Select input type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.outputType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.outputType">Output Type</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger id="metadata.extended.outputType">
                              <SelectValue placeholder="Select output type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="audio">Audio</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Category and Docs URL in the same row */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.category">Category</FormLabel>
                        <FormControl>
                          <Input
                            id="metadata.extended.category"
                            placeholder="AI Assistant, Data Processing, etc."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex-1">
                  <FormField
                    control={form.control}
                    name="metadata.extended.docsUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="metadata.extended.docsUrl">Docs URL</FormLabel>
                        <FormControl>
                          <Input
                            id="metadata.extended.docsUrl"
                            type="url"
                            placeholder="https://docs.example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          URL to LLM-consumable documentation.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="metadata.extended.skills"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor="metadata.extended.skills">Skills</FormLabel>
                    <FormControl>
                      <MultipleSelector
                        value={(field.value || []).map((skill: string) => ({
                          label: skill,
                          value: skill
                        }))}
                        onChange={(options: Option[]) => {
                          const skillStrings = options.map(option => option.value);
                          field.onChange(skillStrings);
                        }}
                        defaultOptions={SKILLS_OPTIONS}
                        placeholder="Select skills..."
                        emptyIndicator="No skills found"
                      />
                    </FormControl>
                    <FormDescription>
                      Select the skills this agent, API, or MCP server provides.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </>
        )}
      </div>
    </fieldset>
  );
};

export default Step2ProjectMetadata; 