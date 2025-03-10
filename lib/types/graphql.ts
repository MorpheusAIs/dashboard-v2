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
  name: string;
  startsAt: string;
  totalClaimed: string;
  totalStaked: string;
  totalUsers: string;
  withdrawLockPeriodAfterDeposit: string;
  // Additional fields for UI display
  networks?: string[];
  rewardType?: string;
  image?: string;
  stakingCount?: number;
  lockPeriod?: string;
  minDeposit?: number;
}

export interface BuilderUser {
  address: string;
  id: string;
  lastStake: string;
  staked: string;
  buildersProject?: BuilderProject;
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
  orderBy?: BuildersProject_OrderBy;
  usersOrderBy?: BuildersUser_OrderBy;
  usersDirection?: OrderDirection;
  orderDirection?: OrderDirection;
  name_in?: string[];
  address?: string;
} 