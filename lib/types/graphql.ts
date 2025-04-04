// GraphQL types for the builder queries

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc',
}

export enum BuildersProject_OrderBy {
  Admin = 'admin',
  ClaimLockEnd = 'claimLockEnd',
  Id = 'id',
  MinimalDeposit = 'minimalDeposit',
  Name = 'name',
  StartsAt = 'startsAt',
  TotalClaimed = 'totalClaimed',
  TotalStaked = 'totalStaked',
  TotalUsers = 'totalUsers',
  WithdrawLockPeriodAfterDeposit = 'withdrawLockPeriodAfterDeposit',
}

export enum BuildersUser_OrderBy {
  Address = 'address',
  Id = 'id',
  LastStake = 'lastStake',
  Staked = 'staked',
}

export enum AdditionalBuildersOrderBy {
  RewardType = 'rewardType',
}

export type Bytes = string;

export interface BuilderProject {
  admin: string;
  claimLockEnd: string;
  id: string;
  minimalDeposit: string;
  minStake?: string; // Testnet field
  name: string;
  startsAt: string;
  totalClaimed: string;
  totalStaked: string;
  totalUsers: string;
  withdrawLockPeriodAfterDeposit: string;
  withdrawLockPeriodAfterStake?: string; // Testnet field
  // Additional fields for UI display
  networks?: string[];
  network?: string;
  rewardType?: string;
  image?: string;
  stakingCount?: number;
  lockPeriod?: string;
  minDeposit?: number;
  description?: string;
  website?: string;
  totalStakedFormatted?: number;
}

export interface BuilderUser {
  id: string;
  address: string;
  staked: string;
  claimed: string;
  claimLockEnd: string;
  lastStake: string;
  builderSubnet?: BuilderSubnet;
}

export interface BuildersCounter {
  id: string;
  totalBuildersProjects: string;
  totalSubnets: string;
}

// Query response types
export interface GetBuildersProjectsResponse {
  buildersProjects: BuilderProject[];
}

export interface GetBuildersProjectResponse {
  buildersProject: BuilderProject;
}

export interface GetAccountUserBuildersProjectsResponse {
  buildersUsers: BuilderUser[];
}

export interface GetBuildersProjectUsersResponse {
  buildersUsers: BuilderUser[];
}

export interface GetBuildersCountersResponse {
  counters: BuildersCounter[];
}

export interface CombinedBuildersListResponse {
  buildersProjects: BuilderProject[];
  buildersUsers: BuilderUser[];
  counters: BuildersCounter[];
}

export interface CombinedBuildersListFilteredByPredefinedBuildersResponse {
  buildersProjects: BuilderProject[];
  buildersUsers: BuilderUser[];
}

// Query variables types
export interface GetBuildersProjectsVariables {
  first?: number;
  skip?: number;
  orderBy?: BuildersProject_OrderBy;
  orderDirection?: OrderDirection;
}

export interface GetBuildersProjectVariables {
  id: string;
}

export interface GetAccountUserBuildersProjectsVariables {
  address: string;
}

export interface GetBuildersProjectUsersVariables {
  first?: number;
  skip?: number;
  buildersProjectId: string;
}

export interface CombinedBuildersListVariables {
  first?: number;
  skip?: number;
  orderBy?: BuildersProject_OrderBy;
  orderDirection?: OrderDirection;
  usersOrderBy?: BuildersUser_OrderBy;
  usersDirection?: OrderDirection;
  address?: string;
}

export interface CombinedBuildersListFilteredByPredefinedBuildersVariables {
  orderBy?: string;
  usersOrderBy?: string;
  usersDirection?: string;
  orderDirection?: string;
  name_in?: string[];
  address?: string;
}

// For Arbitrum Sepolia Builder Subnets
export interface BuilderSubnet {
  id: string;
  name: string;
  owner: string;
  minStake: string;
  fee: string;
  feeTreasury: string;
  startsAt: string;
  withdrawLockPeriodAfterStake: string;
  maxClaimLockEnd: string;
  slug: string;
  description: string;
  website: string;
  image: string;
  totalStaked: string;
  totalClaimed: string;
  totalUsers: string;
  // Additional fields for UI display
  networks?: string[];
  network?: string;
  rewardType?: string;
  stakingCount?: number;
  lockPeriod?: string;
  minDeposit?: number;
}

export interface CombinedBuildersListFilteredByPredefinedBuildersTestnetResponse {
  builderSubnets: BuilderSubnet[];
  builderUsers: BuilderUser[];
}

export interface ArbitrumSepoliaCounter {
  id: string;
  totalSubnets: string;
  totalBuilderProjects: string;
}

export interface CombinedBuilderSubnetsResponse {
  builderSubnets: BuilderSubnet[];
  builderUsers: BuilderUser[];
  counters: ArbitrumSepoliaCounter[];
}

// For Arbitrum Sepolia
export enum BuilderSubnet_orderBy {
  Id = 'id',
  Name = 'name',
  Owner = 'owner',
  MinStake = 'minStake',
  Fee = 'fee',
  FeeTreasury = 'feeTreasury',
  StartsAt = 'startsAt',
  WithdrawLockPeriodAfterStake = 'withdrawLockPeriodAfterStake',
  MaxClaimLockEnd = 'maxClaimLockEnd',
  Slug = 'slug',
  Description = 'description',
  Website = 'website',
  Image = 'image',
  TotalStaked = 'totalStaked',
  TotalClaimed = 'totalClaimed',
  TotalUsers = 'totalUsers',
  BuilderUsers = 'builderUsers'
}

export enum BuilderUser_orderBy {
  Id = 'id',
  Address = 'address',
  Staked = 'staked',
  Claimed = 'claimed',
  ClaimLockEnd = 'claimLockEnd',
  LastStake = 'lastStake',
  BuilderSubnet = 'builderSubnet',
  BuilderSubnet__TotalStaked = 'builderSubnet__totalStaked'
} 