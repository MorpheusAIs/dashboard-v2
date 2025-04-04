"use client";

import { BuilderProject } from '@/lib/types/graphql';
import { Builder } from '@/app/builders/builders-data';

/**
 * Adapts the GraphQL BuilderProject data to the UI Builder format
 * @param project The GraphQL BuilderProject data
 * @returns The UI Builder format
 */
export async function adaptBuilderProjectToUI(
  project: BuilderProject
): Promise<Builder> {
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
  const totalStaked = project.totalStaked ? Math.floor(parseInt(project.totalStaked) / 1e18) : 0;
  console.log(`Builder ${project.name} totalStaked: ${totalStaked} (raw: ${project.totalStaked})`);
  
  // Convert minimalDeposit from string to number (it's in wei format)
  const minDeposit = project.minimalDeposit ? parseFloat(project.minimalDeposit) / 1e18 : 0;
  console.log(`Builder ${project.name} minDeposit: ${minDeposit} (raw: ${project.minimalDeposit})`);
  
  // Calculate lock period in days from seconds
  let lockPeriod: string | undefined = undefined;
  if (project.withdrawLockPeriodAfterDeposit) {
    const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit);
    const lockPeriodDays = Math.ceil(lockPeriodSeconds / (60 * 60 * 24));
    lockPeriod = `${lockPeriodDays} days`;
  }
  console.log(`Builder ${project.name} lockPeriod: ${lockPeriod} (raw: ${project.withdrawLockPeriodAfterDeposit})`);
  
  // Get networks from API data if available
  let networks: string[] = [];
  
  // Use network info from API data when available - especially for Arbitrum_Sepolia
  if (project.network) {
    // Network info from the API data (added during fetch)
    if (project.network === 'Arbitrum_Sepolia') {
      networks = ['Arbitrum Sepolia'];
    } else {
      networks = [project.network];
    }
  }
  
  // Use data from the project directly
  const name = project.name;
  const description = project.description || '';
  
  // Get image paths from project data
  const image = project.image || '';
  const image_src = image;
  
  // For website, use project.website (from Arbitrum Sepolia) if available
  const website = project.website || '';
  
  // Default reward types
  const reward_types = ['To Be Announced'];
  
  // Get staking count directly from API data
  const stakingCount = project.stakingCount !== undefined ? project.stakingCount : 
                      (project.totalUsers ? parseInt(project.totalUsers) : 0);
  
  console.log(`Builder ${project.name} stakingCount: ${stakingCount} (raw stakingCount: ${project.stakingCount}, totalUsers: ${project.totalUsers})`);

  return {
    id: project.id,
    name,
    description,
    long_description: '', // Changed from longDescription to match Builder type
    image_src, // Changed property name to match Builder type
    tags: [],
    github_url: '',
    twitter_url: '',
    discord_url: '',
    contributors: 0,
    github_stars: 0,
    networks,
    network: networks.length > 0 ? networks[0] : '', // Add network property
    reward_types, // Changed from rewardType to match Builder type
    minDeposit,
    totalStaked,
    stakingCount,
    lockPeriod,
    website,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reward_types_detail: []
  };
}

/**
 * Adapts an array of GraphQL BuilderProject data to the UI Builder format
 * @param projects Array of GraphQL BuilderProject data
 * @returns Array of UI Builder format
 */
export async function adaptBuilderProjectsToUI(
  projects: BuilderProject[]
): Promise<Builder[]> {
  const adaptedProjects = await Promise.all(
    projects.map(project => adaptBuilderProjectToUI(project))
  );
  return adaptedProjects;
} 