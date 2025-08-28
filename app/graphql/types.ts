// Common GraphQL response types

// ====== Builders Types ======
export interface BuildersUser {
  address: string;
  id: string;
  staked: string;
  lastStake: string;
}

export interface BuildersProject {
  id: string;
  name: string;
  totalStaked: string;
  totalUsers: string;
  withdrawLockPeriodAfterDeposit: string;
  minimalDeposit?: string;
}

// This interface defines the structure inside the data field of the GraphQL response
export interface BuildersResponseData {
  buildersProjects: BuildersProject[];
  buildersUsers: BuildersUser[];
}

// Full GraphQL response structure for builders queries
export interface BuildersGraphQLResponse {
  data: BuildersResponseData;
  errors?: Array<{ message: string }>;
}

// ====== Compute Types ======
export interface SubnetUser {
  id: string;
  staked: string;
  claimed: string;
  address: string;
  __typename: string;
}

export interface Subnet {
  fee: string;
  totalUsers: string;
  deregistrationOpensAt: string;
  __typename: string;
}

// This interface defines the structure inside the data field of the GraphQL response
export interface ComputeResponseData {
  subnetUsers: SubnetUser[];
  subnets: Subnet[];
}

// Full GraphQL response structure for compute queries
export interface ComputeGraphQLResponse {
  data: ComputeResponseData;
  errors?: Array<{ message: string }>;
}

// ====== Capital Types ======
export interface Referral {
  referralAddress: string;
  amount: string;
}

export interface Referrer {
  referrerAddress: string;
  referrals: Referral[];
}

// This interface defines the structure inside the data field of the GraphQL response
export interface CapitalReferralResponseData {
  referrers: Referrer[];
}

// Full GraphQL response structure for capital referral queries
export interface CapitalReferralGraphQLResponse {
  data: CapitalReferralResponseData;
  errors?: Array<{ message: string }>;
}

// ====== Common UI Types ======
export interface StakingEntry {
  address: string;
  displayAddress: string;
  amount: number;
  timestamp?: number;
  unlockDate?: number;
  claimed?: number;
  fee?: number;
} 