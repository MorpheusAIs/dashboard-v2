import buildersData from './predefined-builders-meta.json';

export interface Builder {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image: string;
  localImage?: string;
  tags?: string[];
  githubUrl?: string;
  twitterUrl?: string;
  discordUrl?: string;
  contributors?: number;
  githubStars?: number;
  totalStaked: number;
  rewardType: string;
  website?: string;
  networks?: string[];
  lockPeriod?: string;
  minDeposit?: number;
  stakingCount?: number;
  userStake?: number;
}

// Add mock data for fields not in the JSON
const enrichedBuilders: Builder[] = buildersData.map(builder => ({
  ...builder,
  // Use the networks from the JSON file or default to ['Base'] if not specified
  networks: builder.networks || ['Base'],
  lockPeriod: '30 days', // Mock lock period
  minDeposit: 1000, // Mock minimum deposit
  stakingCount: Math.floor(Math.random() * 100), // Mock staking count
  totalStaked: builder.totalStaked || 0 // Ensure totalStaked has a default value
}));

export const builders = enrichedBuilders; 