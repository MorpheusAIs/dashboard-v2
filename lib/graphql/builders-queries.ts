"use client";

import { gql } from '@apollo/client';

// Builder Project Fragment
export const BUILDER_PROJECT_FRAGMENT = gql`
  fragment BuilderProject on BuildersProject {
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
  query getAccountUserBuildersProjects($address: Bytes = "") {
    buildersUsers(where: { address: $address }) {
      address
      id
      lastStake
      staked
      buildersProject {
        ...BuilderProject
      }
    }
  }
`;

export const GET_BUILDERS_PROJECT_USERS = gql`
  query getBuildersProjectUsers(
    $first: Int = 5
    $skip: Int = 0
    $buildersProjectId: Bytes = ""
    $orderBy: String = "staked"
    $orderDirection: String = "desc"
  ) {
    buildersUsers(
      first: $first
      skip: $skip
      where: { buildersProject_: {id: $buildersProjectId} }
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      address
      id
      staked
      lastStake
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
    $first: Int = 1000
    $skip: Int = 0
    $orderBy: BuildersProject_orderBy
    $orderDirection: OrderDirection
    $usersOrderBy: BuildersUser_orderBy
    $usersDirection: OrderDirection
    $address: Bytes = ""
  ) {
    buildersProjects(
      first: $first
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      ...BuilderProject
    }

    buildersUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {address: $address}
    ) {
      address
      id
      lastStake
      staked
      buildersProject {
        ...BuilderProject
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
    $first: Int = 1000,
    $orderBy: String,
    $orderDirection: String,
    $usersOrderBy: String,
    $usersDirection: String,
    $name_in: [String!] = "",
    $address: String = ""
  ) {
    buildersProjects(
      first: $first
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: {name_in: $name_in}
    ) {
      ...BuilderProject
      __typename
    }

    buildersUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {
        address: $address,
        buildersProject_: {name_in: $name_in}
      }
    ) {
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

// Query to get combined builder subnets (for Arbitrum Sepolia)
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
    counters {
      id
      totalSubnets
      totalBuilderProjects
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