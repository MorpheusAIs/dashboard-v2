// GraphQL queries for Builders module

export const GET_BUILDERS_PROJECT_BY_NAME = `
  query getBuildersProjectsByName($name: String!) {
    buildersProjects(where: { name: $name }) {
      id
      name
      totalStaked
      totalUsers
      withdrawLockPeriodAfterDeposit
      minimalDeposit
    }
  }
`;

// V1-compatible query for Goldsky endpoints (flat array structure)
export const GET_BUILDERS_PROJECT_BY_NAME_V1 = `
  query getBuildersProjectsByName($name: String!) {
    buildersProjects(where: { name: $name }) {
      id
      name
      totalStaked
      totalUsers
      withdrawLockPeriodAfterDeposit
      minimalDeposit
    }
  }
`;

// New query to get builder subnet by name for testnet
export const GET_BUILDER_SUBNET_BY_NAME = `
  query getBuilderSubnetByName($name: String!) {
    builderSubnets(where: { name: $name }, first: 1) {
      id
      name
      totalStaked
      totalUsers
      withdrawLockPeriodAfterStake
      minStake
      builderUsers {
        id
        address
        staked
        claimed
        lastStake
        claimLockEnd
      }
    }
  }
`;

// V4 query - uses first/skip pagination for Goldsky V4 compatibility
// Note: V4 schema does NOT have 'claimed' or 'claimLockEnd' on BuildersUser
export const GET_BUILDERS_PROJECT_USERS = `
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

// Testnet query - for builder subnet users (testnet only - keeps claimed/claimLockEnd)
export const GET_BUILDER_SUBNET_USERS = `
  query getBuilderSubnetUsers(
    $first: Int = 50
    $skip: Int = 0
    $builderSubnetId: Bytes = ""
    $orderBy: String = "staked"
    $orderDirection: String = "desc"
  ) {
    builderUsers(
      first: $first
      skip: $skip
      where: { builderSubnet_: {id: $builderSubnetId} }
      orderBy: $orderBy
      orderDirection: $orderDirection
    ) {
      address
      id
      staked
      lastStake
      claimed
      claimLockEnd
    }
  }
`;

// V4 query to get all builders projects - uses first/skip for Goldsky V4
export const GET_ALL_BUILDERS_PROJECTS = `
  query getAllBuildersProjects($first: Int = 1000, $skip: Int = 0) {
    buildersProjects(
      first: $first
      skip: $skip
      orderBy: totalStaked
      orderDirection: desc
    ) {
      id
      name
      admin
      minimalDeposit
      totalStaked
      totalUsers
      totalClaimed
      startsAt
      withdrawLockPeriodAfterDeposit
      claimLockEnd
      __typename
    }
  }
`; 