"use client";

import { gql } from '@apollo/client';

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
  }
`;

export const GET_BUILDERS_PROJECTS = gql`
  ${BUILDER_PROJECT_FRAGMENT}
  query getBuildersProjects(
    $first: Int = 10
    $skip: Int = 10
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
    $first: Int = 10
    $skip: Int = 10
    $buildersProjectId: Bytes = ""
  ) {
    buildersUsers(
      first: $first
      skip: $skip
      where: { buildersProject_: {id: $buildersProjectId} }
    ) {
      address
      id
      staked
      lastStake
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
    $first: Int = 100
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
    $orderBy: BuildersProject_orderBy
    $usersOrderBy: BuildersUser_orderBy
    $usersDirection: OrderDirection
    $orderDirection: OrderDirection
    $name_in: [String!]
    $address: Bytes = ""
  ) {
    buildersProjects(
      first: 100
      skip: 0
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: {name_in: $name_in}
    ) {
      ...BuilderProject
    }

    buildersUsers(
      orderBy: $usersOrderBy
      orderDirection: $usersDirection
      where: {
        address: $address
        buildersProject_: {name_in: $name_in}
      }
    ) {
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
      ...BuilderUserDefault
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
    builderSubnets(where: { owner: $owner }) {
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
      where: { address: $address, staked_gt: "0" }
    ) {
      ...BuilderUserDefault
      builderSubnet {
        ...BuilderSubnetDefault
      }
    }
  }
`; 