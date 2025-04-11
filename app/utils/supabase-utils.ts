import { BuilderDB } from "@/app/lib/supabase";

/**
 * Converts a slug to a builder name by replacing hyphens with spaces and handling special character replacements.
 * This function needs to handle special cases like 'of-2' becoming 'OF#2'.
 * For already URL-friendly names like "word1-word2", we'll preserve them as words with proper capitalization.
 * 
 * @param slug The URL slug (e.g., "acme-corp" or "of-2" or "already-slugged-name")
 * @returns The builder name (e.g., "Acme Corp" or "OF#2" or "Already Slugged Name")
 */
export function slugToBuilderName(slug: string): string {
  // Special case handling for common patterns
  if (slug.match(/of-(\d+)$/i)) {
    return slug.replace(/of-(\d+)$/i, "OF#$1").toUpperCase();
  }
  
  if (slug.match(/of-builder-(\d+)$/i)) {
    return slug.replace(/of-builder-(\d+)$/i, "OF Builder #$1");
  }
  
  // For slugs like "word1-word2", we want to transform them into "Word1 Word2"
  // We'll capitalize the first letter of each word and replace hyphens with spaces
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Converts a builder name to a slug by replacing spaces with hyphens, removing special characters, and lowercasing.
 * Handles special characters like #, &, etc.
 * If the name is already URL-friendly (e.g., "word1-word2"), it preserves that format.
 * 
 * @param name The builder name (e.g., "Acme Corp" or "OF#2" or "already-slugged-name")
 * @returns The URL slug (e.g., "acme-corp" or "of-2" or "already-slugged-name")
 */
export function builderNameToSlug(name: string): string {
  // Special case handling
  if (name.match(/OF#\d+/i)) {
    return name.replace(/OF#(\d+)/i, "of-$1").toLowerCase();
  }
  
  if (name.match(/OF Builder #\d+/i)) {
    return name.replace(/OF Builder #(\d+)/i, "of-builder-$1").toLowerCase();
  }
  
  // Check if name is already URL-friendly
  // URL-friendly means: all lowercase, no spaces, only alphanumeric and hyphens
  const isAlreadyUrlFriendly = /^[a-z0-9-]+$/.test(name);
  
  if (isAlreadyUrlFriendly) {
    // If already URL-friendly, just return as is
    return name;
  }
  
  // Standard case - convert from name to slug
  return name
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-'); // Replace spaces with hyphens
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

/**
 * Test function to validate slug transformation logic
 * This is for development purposes only and should be removed in production
 */
export function testSlugTransformations(): void {
  const testCases = [
    { name: "Acme Corp", expectedSlug: "acme-corp" },
    { name: "OF#2", expectedSlug: "of-2" },
    { name: "OF Builder #1", expectedSlug: "of-builder-1" },
    { name: "already-slugged-name", expectedSlug: "already-slugged-name" },
    { name: "project-with-hyphens", expectedSlug: "project-with-hyphens" },
    { name: "Project With Spaces", expectedSlug: "project-with-spaces" },
    { name: "Project_with_underscores", expectedSlug: "projectwithunderscores" },
    { name: "Project.with.periods", expectedSlug: "projectwithperiods" },
    { name: "123 Numbers", expectedSlug: "123-numbers" }
  ];

  console.log("=== Testing builderNameToSlug ===");
  testCases.forEach(test => {
    const slug = builderNameToSlug(test.name);
    console.log(`${test.name} → ${slug} ${slug === test.expectedSlug ? '✓' : '✗'}`);
  });

  console.log("\n=== Testing slugToBuilderName ===");
  testCases.forEach(test => {
    const slug = test.expectedSlug;
    const backToName = slugToBuilderName(slug);
    console.log(`${slug} → ${backToName}`);
  });
} 