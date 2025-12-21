import { BuilderProject } from '@/lib/types/graphql';

/**
 * V1 response structure from Goldsky subgraph
 * Goldsky uses "builderSubnets" and returns flat array (not items wrapper)
 * Matches main branch query pattern but Goldsky schema returns direct array
 */
export interface V1BuildersResponse {
  builderSubnets: Array<{
    id: string;
    name: string;
    admin: string;
    minimalDeposit: string;
    totalStaked: string;
    totalUsers: string;
    totalClaimed: string;
    withdrawLockPeriodAfterDeposit: string;
    slug: string;
    description: string;
    website: string;
    image: string;
  }>;
}

/**
 * V4 response structure expected by frontend
 */
export interface V4BuildersResponse {
  buildersProjects: {
    items: BuilderProject[];
  };
}

/**
 * Transforms a single V1 builderSubnet to V4 BuilderProject format
 * Goldsky schema is actually very similar to V4, just needs field mapping and missing fields added
 */
export function transformV1ProjectToV4(
  project: V1BuildersResponse['builderSubnets'][0],
  chainId: number
): BuilderProject {
  return {
    // Direct field mapping (Goldsky uses same names as V4)
    id: project.id,
    name: project.name,
    admin: project.admin,
    minimalDeposit: project.minimalDeposit,
    totalStaked: project.totalStaked,
    totalClaimed: project.totalClaimed,
    totalUsers: project.totalUsers,
    withdrawLockPeriodAfterDeposit: project.withdrawLockPeriodAfterDeposit,
    // Metadata fields (available in Goldsky)
    slug: project.slug || undefined,
    description: project.description || undefined,
    website: project.website || undefined,
    image: project.image || undefined,
    // V4 fields that don't exist in Goldsky - set to empty strings
    startsAt: '', // Not available in Goldsky schema
    claimLockEnd: '', // Not available in Goldsky schema
    chainId: chainId, // Derived from network
  };
}

/**
 * Transforms V1 response structure to V4 format
 * Converts Goldsky's flat array to V4's nested items structure
 * Renames builderSubnets -> buildersProjects
 */
export function transformV1ToV4Response(
  v1Response: V1BuildersResponse,
  chainId: number
): V4BuildersResponse {
  const transformedProjects = v1Response.builderSubnets.map((project) =>
    transformV1ProjectToV4(project, chainId)
  );

  return {
    buildersProjects: {
      items: transformedProjects,
    },
  };
}

/**
 * Chain ID constants for mainnet networks
 */
export const CHAIN_IDS = {
  Base: 8453,
  Arbitrum: 42161,
} as const;

/**
 * Type guard to check if response is V1 format
 */
export function isV1Response(
  response: V1BuildersResponse | V4BuildersResponse
): response is V1BuildersResponse {
  return Array.isArray((response as V1BuildersResponse).builderSubnets);
}

/**
 * Type guard to check if response is V4 format
 */
export function isV4Response(
  response: V1BuildersResponse | V4BuildersResponse
): response is V4BuildersResponse {
  return (
    typeof (response as V4BuildersResponse).buildersProjects === 'object' &&
    'items' in (response as V4BuildersResponse).buildersProjects
  );
}
