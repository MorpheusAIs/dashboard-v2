"use client";

import { BuilderProject } from '@/lib/types/graphql';
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
  
  // Convert totalStaked from string to number (it's in wei format)
  const totalStaked = parseInt(project.totalStaked) / 1e18;
  
  // Convert minimalDeposit from string to number (it's in wei format)
  const minDeposit = parseFloat(project.minimalDeposit) / 1e18;
  
  // Calculate lock period in days from seconds
  const lockPeriodSeconds = parseInt(project.withdrawLockPeriodAfterDeposit);
  const lockPeriodDays = Math.ceil(lockPeriodSeconds / (60 * 60 * 24));
  const lockPeriod = `${lockPeriodDays} days`;
  
  // Get networks from predefined builder data
  let networks: string[] = ['Base']; // Default to Base if not found
  
  if (predefinedBuilder?.networks && Array.isArray(predefinedBuilder.networks) && predefinedBuilder.networks.length > 0) {
    networks = predefinedBuilder.networks;
  }
  
  // Use data from predefined builder if available, otherwise use defaults
  const name = project.name;
  const description = predefinedBuilder?.description || '';
  const longDescription = predefinedBuilder?.longDescription || '';
  
  // Get the appropriate image path
  const image = getBuilderImagePath(name);
  
  const localImage = predefinedBuilder?.localImage || '';
  const tags = predefinedBuilder?.tags || [];
  const githubUrl = predefinedBuilder?.githubUrl || '';
  const twitterUrl = predefinedBuilder?.twitterUrl || '';
  const discordUrl = predefinedBuilder?.discordUrl || '';
  const contributors = predefinedBuilder?.contributors || 0;
  const githubStars = predefinedBuilder?.githubStars || 0;
  const rewardType = predefinedBuilder?.rewardType || 'To Be Announced';
  const website = predefinedBuilder?.website || '';
  
  // Default staking count if not provided
  const stakingCount = project.stakingCount || parseInt(project.totalUsers);
  
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