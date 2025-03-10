"use client";

import { Builder } from '@/app/builders/builders-data';

// Define the structure of the predefined builders metadata
export interface PredefinedBuilder {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  image: string;
  localImage: string;
  tags: string[];
  githubUrl: string;
  twitterUrl: string;
  discordUrl: string;
  contributors: number;
  githubStars: number;
  totalStaked: number;
  rewardType: string;
  website: string;
  stakingCount?: number;
  networks?: string[];
}

// Map of builder names to available image files in public/builders
const BUILDER_IMAGE_MAP: Record<string, string> = {
  'Venice': '/builders/venice.svg',
  'Morlord MOR Staking': '/builders/morlord.svg',
  'coincap': '/builders/coincap.svg',
  'MySuperAgent': '/builders/superagent.svg',
  'MOR Builders': '/builders/builders.svg',
  'Morpheus Asia': '/builders/asia.svg',
  'Nounspace': '/builders/nounspace.svg',
  'Wire Network': '/builders/wire.svg',
  // Default fallback for any other builder
  'default': '/builders/builders.svg'
};

// Get the appropriate image path for a builder
export function getBuilderImagePath(builderName: string): string {
  return BUILDER_IMAGE_MAP[builderName] || BUILDER_IMAGE_MAP['default'];
}

// Load the predefined builders metadata from the JSON file
export async function loadPredefinedBuilders(): Promise<PredefinedBuilder[]> {
  try {
    // In Next.js, we can use dynamic import to load JSON files
    const predefinedBuildersData = await import('@/app/builders/predefined-builders-meta.json');
    console.log('Loaded predefined builders data:', predefinedBuildersData);
    return predefinedBuildersData.default || [];
  } catch (error) {
    console.error('Error loading predefined builders metadata:', error);
    return [];
  }
}

// Convert a predefined builder to the Builder interface
export function adaptPredefinedBuilderToBuilder(predefinedBuilder: PredefinedBuilder): Builder {
  // Use the localImage path from the predefined builder, properly prefixed
  // The localImage in the JSON is like "images/filename.png", but we need "/images/filename.png"
  const localImagePath = predefinedBuilder.localImage.startsWith('/') 
    ? predefinedBuilder.localImage 
    : `/${predefinedBuilder.localImage}`;
  
  // Use networks from predefined builder if available, otherwise use default
  let networks: string[];
  if (predefinedBuilder.networks && Array.isArray(predefinedBuilder.networks) && predefinedBuilder.networks.length > 0) {
    networks = predefinedBuilder.networks;
  } else {
    // Fallback to default networks
    networks = ['Arbitrum', 'Base'];
  }
  
  return {
    id: predefinedBuilder.id,
    name: predefinedBuilder.name,
    description: predefinedBuilder.description,
    longDescription: predefinedBuilder.longDescription,
    image: localImagePath, // Use the local image path
    localImage: localImagePath,
    tags: predefinedBuilder.tags,
    githubUrl: predefinedBuilder.githubUrl,
    twitterUrl: predefinedBuilder.twitterUrl,
    discordUrl: predefinedBuilder.discordUrl,
    contributors: predefinedBuilder.contributors,
    githubStars: predefinedBuilder.githubStars,
    totalStaked: predefinedBuilder.totalStaked || 0,
    rewardType: predefinedBuilder.rewardType,
    website: predefinedBuilder.website,
    // Use networks from predefined builder or default
    networks,
    minDeposit: 0.001, // Default minimum deposit
    stakingCount: predefinedBuilder.stakingCount || Math.floor(Math.random() * 100), // Random staking count
    lockPeriod: '30 days', // Default lock period
  };
}

// Convert an array of predefined builders to the Builder interface
export function adaptPredefinedBuildersToBuilders(predefinedBuilders: PredefinedBuilder[]): Builder[] {
  return predefinedBuilders.map(adaptPredefinedBuilderToBuilder);
} 