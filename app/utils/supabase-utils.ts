import { BuilderDB } from "@/app/lib/supabase";

/**
 * Converts a slug to a builder name by replacing hyphens with spaces and capitalizing words.
 * 
 * @param slug The URL slug (e.g., "acme-corp")
 * @returns The builder name (e.g., "Acme Corp")
 */
export function slugToBuilderName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Converts a builder name to a slug by replacing spaces with hyphens and lowercasing.
 * 
 * @param name The builder name (e.g., "Acme Corp")
 * @returns The URL slug (e.g., "acme-corp")
 */
export function builderNameToSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Type guard to check if a value is a valid BuilderDB object
 */
export function isBuilderDB(value: unknown): value is BuilderDB {
  return value !== null && 
         typeof value === 'object' && 
         value !== null &&
         'id' in value &&
         'name' in value &&
         typeof (value as BuilderDB).id === 'string' && 
         typeof (value as BuilderDB).name === 'string';
}

/**
 * Parse reward types from a builder, handling various data formats
 */
export function getRewardTypes(builder: BuilderDB): string[] {
  if (!builder.reward_types) {
    return [];
  }
  
  // Handle case where it might be stored as a string
  if (typeof builder.reward_types === 'string') {
    try {
      return JSON.parse(builder.reward_types);
    } catch {
      return [builder.reward_types];
    }
  }
  
  // Handle case where it's already an array
  if (Array.isArray(builder.reward_types)) {
    return builder.reward_types;
  }
  
  return [];
} 