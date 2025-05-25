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

export const GET_BUILDERS_PROJECT_USERS = `
  query getBuildersProjectUsers(
    $first: Int = 10
    $skip: Int = 10
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
    }
  }
`;

// New query to get builder subnet users for testnet
export const GET_BUILDER_SUBNET_USERS = `
  query getBuilderSubnetUsers(
    $first: Int = 10
    $skip: Int = 10
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

// Use this query to get all builders projects (like in query.json)
export const GET_ALL_BUILDERS_PROJECTS = `
  query getAllBuildersProjects($first: Int = 5) {
    buildersProjects(first: $first) {
      id
      name
      minimalDeposit
      totalStaked
      totalUsers
      withdrawLockPeriodAfterDeposit
    }
  }
`; 