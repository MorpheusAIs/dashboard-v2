"use client";

import { gql } from '@apollo/client';

// Builder Project Fragment
export const BUILDER_PROJECT_FRAGMENT = gql`
  fragment BuilderProject on buildersProject {
    admin
    claimLockEnd
    id
    minimalDeposit
    name
    startsAt
    totalClaimed
    totalStaked
    totalUsers
    withdrawLockPeriodAfterDeposit
    __typename
  }
`;

// Builder User Default Fragment
export const BUILDER_USER_DEFAULT_FRAGMENT = gql`
  fragment BuilderUserDefault on BuilderUser {
    id
    address
    staked
    claimed
    claimLockEnd
    lastStake
  }
`;

// Builder Subnet Default Fragment
export const BUILDER_SUBNET_DEFAULT_FRAGMENT = gql`
  fragment BuilderSubnetDefault on BuilderSubnet {
    id
    name
    owner
    minStake
    fee
    feeTreasury
    startsAt
    withdrawLockPeriodAfterStake
    maxClaimLockEnd
    slug
    description
    website
    image
    totalStaked
    totalClaimed
    totalUsers
    builderUsers {
      id
      address
      staked
      claimed
      claimLockEnd
      lastStake
    }
  }
`;

export const GET_BUILDERS_PROJECTS = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getBuildersProjects(
    $first: Int = 1000
    $skip: Int = 0
    $orderBy: BuildersProject_orderBy
    $orderDirection: OrderDirection
  ) {
    buildersProjects(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ...BuilderProject
    }
  }
`;

export const GET_BUILDERS_PROJECT = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getBuildersProject($id: ID = "") {
    buildersProject(id: $id) {
      ...BuilderProject
    }
  }
`;

export const GET_ACCOUNT_USER_BUILDERS_PROJECTS = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getAccountUserBuildersProjects($address: String = "") {
    buildersUsers(where: { address: $address }) {
      items {
        address
        id
        lastStake
        staked
        buildersProject {
          ...BuilderProject
        }
      }
    }
  }
`;

// V4-compatible query using first/skip pagination
// Note: BuildersUser in v4 does NOT have 'claimed' or 'claimLockEnd' fields
export const GET_BUILDERS_PROJECT_USERS = gql`
  query getBuildersProjectUsers(
    $first: Int = 50
    $skip: Int = 0
    $buildersProjectId: Bytes!
    $orderBy: BuildersUser_orderBy = staked
    $orderDirection: OrderDirection = desc
  ) {
    buildersUsers(
      first: $first
      skip: $skip
      where: { buildersProject_: { id: $buildersProjectId } }
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      address
      id
      staked
      lastStake
      buildersProject {
        id
        name
      }
      __typename
    }
  }
`;

export const GET_BUILDERS_COUNTERS = gql`
  query GetBuildersCounters {
    counters {
      id
      totalBuildersProjects
      totalSubnets
    }
  }
`;

export const COMBINED_BUILDERS_LIST = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query combinedBuildersList(
    $limit: Int = 1000
    $orderBy: BuildersProject_orderBy
    $orderDirection: OrderDirection
    $usersOrderBy: BuildersUser_orderBy
    $usersDirection: OrderDirection
    $address: String = ""
  ) {
    buildersProjects(
      limit: $limit
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...BuilderProject
      }
    }

    buildersUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {address: $address}
    ) {
      items {
        address
        id
        lastStake
        staked
        buildersProject {
          ...BuilderProject
        }
      }
    }

    counters {
      id
      totalBuildersProjects
      totalSubnets
    }
  }
`;

export const COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query combinedBuildersListFilteredByPredefinedBuilders(
    $limit: Int = 1000,
    $orderBy: String,
    $orderDirection: String,
    $usersOrderBy: String,
    $usersDirection: String,
    $address: String = ""
  ) {
    buildersProjects(
      limit: $limit
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      items {
        ...BuilderProject
        __typename
      }
    }

    buildersUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {
        address: $address
      }
    ) {
      items {
        address
        id
        lastStake
        staked
        buildersProject {
          ...BuilderProject
          __typename
        }
        __typename
      }
    }
  }
`;

export const COMBINED_BUILDERS_LIST_FILTERED_BY_PREDEFINED_BUILDERS_TESTNET = gql`
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query combinedBuildersListFilteredByPredefinedBuildersTestnet(
    $orderBy: BuilderSubnet_orderBy
    $orderDirection: OrderDirection
    $usersOrderBy: BuilderUser_orderBy
    $usersDirection: OrderDirection
    $name_in: [String!] = ""
    $address: Bytes = ""
  ) {
    builderSubnets(
      first: 1000
      skip: 0
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: {name_in: $name_in}
    ) {
      ...BuilderSubnetDefault
      totalStaked
      totalClaimed
      totalUsers
    }

    builderUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {
        address: $address
        builderSubnet_: {name_in: $name_in}
      }
    ) {
      ...BuilderUserDefault
      builderSubnet {
        ...BuilderSubnetDefault
      }
    }
  }
`;

// Query to get user's builder subnets
export const GET_USER_BUILDER_SUBNETS = gql`
  ${BUILDER_USER_DEFAULT_FRAGMENT}
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query getUserAccountBuilderSubnets(
    $address: Bytes = ""
    $builder_subnet_id: Bytes = ""
  ) {
    builderUsers(
      where: { address: $address, builderSubnet_: { id: $builder_subnet_id } }
    ) {
      ...BuilderUserDefault
      builderSubnet {
        ...BuilderSubnetDefault
      }
    }
  }
`;

// Query to get all builder subnets (for Builders tab)
export const GET_ALL_BUILDER_SUBNETS = gql`
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query getAllBuilderSubnets {
    builderSubnets {
      ...BuilderSubnetDefault
    }
  }
`;

// Query to get admin builder subnets (for Your Subnets tab)
export const GET_ADMIN_BUILDER_SUBNETS = gql`
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query getAdminBuilderSubnets($owner: Bytes = "") {
    builderSubnets(first: 1000, where: { owner: $owner }) {
      ...BuilderSubnetDefault
    }
  }
`;

// Query to get participating builder subnets (for Participating tab)
export const GET_PARTICIPATING_BUILDER_SUBNETS = gql`
  ${BUILDER_USER_DEFAULT_FRAGMENT}
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query getParticipatingBuilderSubnets($address: Bytes = "") {
    builderUsers(
      first: 1000,
      where: { address: $address, staked_gt: "0" }
    ) {
      ...BuilderUserDefault
      builderSubnet {
        ...BuilderSubnetDefault
      }
    }
  }
`;

// Query to get combined builder subnets (for Arbitrum Sepolia - deprecated)
export const COMBINED_BUILDER_SUBNETS = gql`
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  ${BUILDER_USER_DEFAULT_FRAGMENT}
  query combinedBuilderSubnets(
    $first: Int = 1000, 
    $skip: Int = 0, 
    $orderBy: BuilderSubnet_orderBy, 
    $orderDirection: OrderDirection, 
    $usersOrderBy: BuilderUser_orderBy, 
    $usersDirection: OrderDirection, 
    $builderSubnetName: String! = "", 
    $address: Bytes = ""
  ) {
    builderSubnets(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: {name_contains_nocase: $builderSubnetName}
    ) {
      ...BuilderSubnetDefault
    }
    builderUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {address: $address}
    ) {
      ...BuilderUserDefault
      builderSubnet {
        ...BuilderSubnetDefault
      }
    }
    counters(id: "1") {
      id
      totalSubnets
      totalBuilderProjects
    }
  }
`;

// Query to get combined builders projects (for Base Sepolia - uses BuildersV4 schema)
export const COMBINED_BUILDERS_PROJECTS_BASE_SEPOLIA = gql`
  query combinedBuildersProjectsBaseSepolia {
    buildersProjects {
      items {
        id
        name
        totalStaked
        totalClaimed
        totalUsers
        description
        website
        image
        slug
        minimalDeposit
        chainId
        withdrawLockPeriodAfterDeposit
      }
    }
  }
`;

// Query to get combined builders projects (for Base Mainnet - uses Goldsky V4 schema)
// Goldsky V4 returns array directly (no items wrapper)
export const COMBINED_BUILDERS_PROJECTS_BASE_MAINNET = gql`
  query combinedBuildersProjectsBaseMainnet {
    buildersProjects(
      first: 1000
      orderBy: totalStaked
      orderDirection: desc
    ) {
      id
      name
      admin
      totalStaked
      totalClaimed
      totalUsers
      minimalDeposit
      withdrawLockPeriodAfterDeposit
      startsAt
      claimLockEnd
      __typename
    }
  }
`;

// Query to get combined builders projects (for Arbitrum Mainnet - uses Goldsky V4 schema)
// Goldsky V4 returns array directly (no items wrapper)
export const COMBINED_BUILDERS_PROJECTS_ARBITRUM_MAINNET = gql`
  query combinedBuildersProjectsArbitrumMainnet {
    buildersProjects(
      first: 1000
      orderBy: totalStaked
      orderDirection: desc
    ) {
      id
      name
      admin
      totalStaked
      totalClaimed
      totalUsers
      minimalDeposit
      withdrawLockPeriodAfterDeposit
      startsAt
      claimLockEnd
      __typename
    }
  }
`;

// Query to get projects where user has staked (for Base Sepolia - "Staking in" tab)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECTS_FOR_USER_BASE_SEPOLIA = gql`
  query GetProjectsForUser($userAddress: String!) {
    buildersUsers(
      where: { address: $userAddress }
      orderBy: "staked"
      orderDirection: "desc"
      limit: 100
    ) {
      items {
        project {
          id
          name
          slug
          description
          website
          image
          admin
          totalStaked
          totalUsers
          minimalDeposit
          withdrawLockPeriodAfterDeposit
          startsAt
          chainId
          contractAddress
        }
        staked
        lastStake
        claimLockEnd
      }
      totalCount
    }
  }
`;

// Query to get projects where user has staked (for Base Mainnet - "Staking in" tab)
// V4-compatible - no claimLockEnd on BuildersUser
export const GET_PROJECTS_FOR_USER_BASE_MAINNET = gql`
  query GetProjectsForUser($userAddress: Bytes!) {
    buildersUsers(
      where: { address: $userAddress, staked_gt: "0" }
      orderBy: staked
      orderDirection: desc
      first: 100
    ) {
      address
      staked
      lastStake
      buildersProject {
        id
        name
        admin
        totalStaked
        totalUsers
        minimalDeposit
        withdrawLockPeriodAfterDeposit
        startsAt
        claimLockEnd
      }
      __typename
    }
  }
`;

// Query to get projects where user has staked (for Arbitrum Mainnet - "Staking in" tab)
// V4-compatible - no claimLockEnd on BuildersUser
export const GET_PROJECTS_FOR_USER_ARBITRUM_MAINNET = gql`
  query GetProjectsForUser($userAddress: Bytes!) {
    buildersUsers(
      where: { address: $userAddress, staked_gt: "0" }
      orderBy: staked
      orderDirection: desc
      first: 100
    ) {
      address
      staked
      lastStake
      buildersProject {
        id
        name
        admin
        totalStaked
        totalUsers
        minimalDeposit
        withdrawLockPeriodAfterDeposit
        startsAt
        claimLockEnd
      }
      __typename
    }
  }
`;

// Query to get projects by admin (for Base Sepolia - "Your Subnets" tab)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECTS_BY_ADMIN_BASE_SEPOLIA = gql`
  query GetProjectsByAdmin($adminAddress: String!) {
    buildersProjects(
      where: { admin: $adminAddress }
      orderBy: "createdAt"
      orderDirection: "desc"
    ) {
      items {
        id
        name
        admin
        slug
        description
        website
        image
        totalStaked
        totalUsers
        minimalDeposit
        withdrawLockPeriodAfterDeposit
        startsAt
        chainId
      }
      totalCount
    }
  }
`;

// Query to get projects by admin (for Base Mainnet - "Your Subnets" tab)
// V4-compatible with standard mainnet schema
export const GET_PROJECTS_BY_ADMIN_BASE_MAINNET = gql`
  query GetProjectsByAdmin($adminAddress: Bytes!) {
    buildersProjects(
      where: { admin: $adminAddress }
      orderBy: startsAt
      orderDirection: desc
      first: 1000
    ) {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      minimalDeposit
      withdrawLockPeriodAfterDeposit
      startsAt
      claimLockEnd
      __typename
    }
  }
`;

// Query to get projects by admin (for Arbitrum Mainnet - "Your Subnets" tab)
// V4-compatible with standard mainnet schema
export const GET_PROJECTS_BY_ADMIN_ARBITRUM_MAINNET = gql`
  query GetProjectsByAdmin($adminAddress: Bytes!) {
    buildersProjects(
      where: { admin: $adminAddress }
      orderBy: startsAt
      orderDirection: desc
      first: 1000
    ) {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      minimalDeposit
      withdrawLockPeriodAfterDeposit
      startsAt
      claimLockEnd
      __typename
    }
  }
`;

// Query to get builders where user has staked (for mainnet networks)
export const GET_USER_STAKED_BUILDERS = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getUserStakedBuilders($address: String = "") {
    buildersUsers(
      first: 1000,
      where: { address: $address, staked_gt: "0" }
    ) {
      id
      address
      staked
      claimed
      lastStake
      buildersProject {
        ...BuilderProject
      }
    }
  }
 `;

// Query to get individual builder project data with user's staking info
export const GET_USER_ACCOUNT_BUILDERS_PROJECT = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getUserAccountBuildersProject($address: Bytes = "", $project_id: Bytes = "") {
    buildersUsers(where: {address: $address, buildersProject_: {id: $project_id}}) {
      address
      id
      lastStake
      staked
      buildersProject {
        ...BuilderProject
      }
      __typename
    }
  }
`;

// Query to get individual builder project data (without user info)
export const GET_BUILDERS_PROJECT_BY_ID = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getBuildersProjectById($id: ID = "") {
    buildersProject(id: $id) {
      ...BuilderProject
      __typename
    }
  }
`;

// Query to get individual builder subnet data (testnet)
export const GET_BUILDER_SUBNET_BY_ID = gql`
  ${BUILDER_SUBNET_DEFAULT_FRAGMENT}
  query getBuilderSubnetById($id: ID = "") {
    builderSubnet(id: $id) {
      ...BuilderSubnetDefault
      __typename
    }
  }
`;

// Query to get project details with first 10 users (for Base Sepolia - builder detail page)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_WITH_DETAILS_BASE_SEPOLIA = gql`
  query GetProjectWithDetails($projectId: String!) {
    buildersProject(id: $projectId) {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      slug
      description
      users(limit: 10, orderBy: "staked", orderDirection: "desc") {
        items {
          id
          address
          staked
          lastStake
        }
        totalCount
      }
    }
  }
`;

// Query to get project details with first 10 users (for Base Mainnet - builder detail page)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_WITH_DETAILS_BASE_MAINNET = gql`
  query GetProjectWithDetails($projectId: String!) {
    buildersProject(id: $projectId) {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      slug
      description
      users(limit: 10, orderBy: "staked", orderDirection: "desc") {
        items {
          id
          address
          staked
          lastStake
        }
        totalCount
      }
    }
  }
`;

// Query to get project details with first 10 users (for Arbitrum Mainnet - builder detail page)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_WITH_DETAILS_ARBITRUM_MAINNET = gql`
  query GetProjectWithDetails($projectId: String!) {
    buildersProject(id: $projectId) {
      id
      name
      admin
      totalStaked
      totalUsers
      totalClaimed
      slug
      description
      users(limit: 10, orderBy: "staked", orderDirection: "desc") {
        items {
          id
          address
          staked
          lastStake
        }
        totalCount
      }
    }
  }
`;

// Query to get paginated users for a project (for Base Sepolia - builder detail page pagination)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_USERS_PAGINATED_BASE_SEPOLIA = gql`
  query GetProjectUsers($projectId: String!, $limit: Int!, $offset: Int!) {
    buildersUsers(
      where: { buildersProjectId: $projectId }
      orderBy: "staked"
      orderDirection: "desc"
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        address
        staked
        lastStake
      }
      totalCount
    }
  }
`;

// Query to get paginated users for a project (for Base Mainnet - builder detail page pagination)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_USERS_PAGINATED_BASE_MAINNET = gql`
  query GetProjectUsers($projectId: String!, $limit: Int!, $offset: Int!) {
    buildersUsers(
      where: { buildersProjectId: $projectId }
      orderBy: "staked"
      orderDirection: "desc"
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        address
        staked
        lastStake
      }
      totalCount
    }
  }
`;

// Query to get paginated users for a project (for Arbitrum Mainnet - builder detail page pagination)
// Based on BuildersV4 GraphQL schema
export const GET_PROJECT_USERS_PAGINATED_ARBITRUM_MAINNET = gql`
  query GetProjectUsers($projectId: String!, $limit: Int!, $offset: Int!) {
    buildersUsers(
      where: { buildersProjectId: $projectId }
      orderBy: "staked"
      orderDirection: "desc"
      limit: $limit
      offset: $offset
    ) {
      items {
        id
        address
        staked
        lastStake
      }
      totalCount
    }
  }
`; 