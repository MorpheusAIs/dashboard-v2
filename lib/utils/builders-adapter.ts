"use client";

import { BuilderProject, BuilderSubnet } from '@/lib/types/graphql';
import { Builder } from '@/app/builders/builders-data';
import { PredefinedBuilder, getBuilderImagePath } from './load-predefined-builders';

/**
 * Adapts the GraphQL BuilderProject data to the UI Builder format
 * @param project The GraphQL BuilderProject data
 * @param predefinedBuilders Optional predefined builders metadata
 * @returns The UI Builder format
 */
export async function adaptBuilderProjectToUI(
  project: BuilderProject, 
  predefinedBuilders?: PredefinedBuilder[]
): Promise<Builder> {
  // Try to find matching predefined builder by name if predefinedBuilders is provided
  const predefinedBuilder = predefinedBuilders?.find(
    builder => builder.name.toLowerCase() === project.name.toLowerCase()
  );
  
  // Debug logging for Arbitrum Sepolia data
  if (project.network === 'Arbitrum_Sepolia') {
    console.log('Processing Arbitrum Sepolia builder:', {
      name: project.name,
      totalStaked: project.totalStaked,
      minStake: project.minimalDeposit,
      lockPeriod: project.withdrawLockPeriodAfterDeposit,
      totalUsers: project.totalUsers
    });
  }
  
  // Convert totalStaked from string to number (it's in wei format)
  // The value is in gwei (10^18), so divide by 10^18 to get MOR tokens
  // Use Math.floor to remove decimals
  const totalStaked = project.totalStaked ? Math.floor(parseInt(project.totalStaked) / 1e18) : 0;
  console.log(`Builder ${project.name} totalStaked: ${totalStaked} (raw: ${project.totalStaked})`);
  
  // Convert minimalDeposit from string to number (it's in wei format)
  const minDeposit = project.minimalDeposit ? parseFloat(project.minimalDeposit) / 1e18 : undefined;
  console.log(`Builder ${project.name} minDeposit: ${minDeposit} (raw: ${project.minimalDeposit})`);
  
  // Calculate lock period in days from seconds
  let lockPeriod: string | undefined = undefined;
  if (project.withdrawLockPeriodAfterDeposit) {
    const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit);
    const lockPeriodDays = Math.ceil(lockPeriodSeconds / (60 * 60 * 24));
    lockPeriod = `${lockPeriodDays} days`;
  }
  console.log(`Builder ${project.name} lockPeriod: ${lockPeriod} (raw: ${project.withdrawLockPeriodAfterDeposit})`);
  
  // Get networks from API data if available, otherwise from predefined builder data
  let networks: string[] = [];
  
  // Use network info from API data when available - especially for Arbitrum_Sepolia
  if (project.network) {
    // Network info from the API data (added during fetch)
    if (project.network === 'Arbitrum_Sepolia') {
      networks = ['Arbitrum Sepolia'];
    } else {
      networks = [project.network];
    }
  } else if (predefinedBuilder?.networks && Array.isArray(predefinedBuilder.networks) && predefinedBuilder.networks.length > 0) {
    networks = predefinedBuilder.networks;
  }
  
  // Use data from predefined builder if available, otherwise use defaults
  const name = project.name;
  const description = project.description || predefinedBuilder?.description || '';
  const longDescription = predefinedBuilder?.longDescription || '';
  
  // Get image paths - prioritize project.image if available (from Arbitrum Sepolia)
  let image = '';
  let localImage = '';
  
  if (project.image) {
    // Direct image from API data (like Arbitrum Sepolia)
    image = project.image;
    localImage = image;
  } else if (predefinedBuilder) {
    // Use the localImage path from the predefined builder, properly prefixed
    localImage = predefinedBuilder.localImage && predefinedBuilder.localImage !== '' 
      ? (predefinedBuilder.localImage.startsWith('/') 
          ? predefinedBuilder.localImage 
          : `/${predefinedBuilder.localImage}`)
      : '';
    
    // Use the same image for both properties to ensure consistency
    image = localImage || getBuilderImagePath(name);
  } else {
    // Fallback to default image mapping if no predefined builder found
    image = getBuilderImagePath(name);
  }
  
  // For website, use project.website (from Arbitrum Sepolia) if available
  const website = project.website || predefinedBuilder?.website || '';
  
  const tags = predefinedBuilder?.tags || [];
  const githubUrl = predefinedBuilder?.githubUrl || '';
  const twitterUrl = predefinedBuilder?.twitterUrl || '';
  const discordUrl = predefinedBuilder?.discordUrl || '';
  const contributors = predefinedBuilder?.contributors || 0;
  const githubStars = predefinedBuilder?.githubStars || 0;
  
  // Only use rewardType from predefined builders if it's explicitly defined
  const rewardType = predefinedBuilder?.rewardType || 'To Be Announced';
  
  // Get staking count directly from API data
  // First try stakingCount which is set during API response mapping
  // Then fall back to totalUsers property from the API
  const stakingCount = project.stakingCount !== undefined ? project.stakingCount : 
                      (project.totalUsers ? parseInt(project.totalUsers) : 0);
  
  console.log(`Builder ${project.name} stakingCount: ${stakingCount} (raw stakingCount: ${project.stakingCount}, totalUsers: ${project.totalUsers})`);

  return {
    id: project.id,
    name,
    description,
    longDescription,
    image,
    localImage,
    tags,
    githubUrl,
    twitterUrl,
    discordUrl,
    contributors,
    githubStars,
    networks,
    rewardType,
    minDeposit,
    totalStaked,
    stakingCount,
    lockPeriod,
    website
  };
}

/**
 * Adapts an array of GraphQL BuilderProject data to the UI Builder format
 * @param projects Array of GraphQL BuilderProject data
 * @param predefinedBuilders Optional predefined builders metadata
 * @returns Array of UI Builder format
 */
export async function adaptBuilderProjectsToUI(
  projects: BuilderProject[], 
  predefinedBuilders?: PredefinedBuilder[]
): Promise<Builder[]> {
  const adaptedProjects = await Promise.all(
    projects.map(project => adaptBuilderProjectToUI(project, predefinedBuilders))
  );
  return adaptedProjects;
} 