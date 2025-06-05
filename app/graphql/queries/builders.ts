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

// Query to get individual builder project data with user's staking info
export const GET_USER_ACCOUNT_BUILDERS_PROJECT = `
  query getUserAccountBuildersProject($address: Bytes = "", $project_id: Bytes = "") {
    buildersUsers(where: {address: $address, buildersProject_: {id: $project_id}}) {
      address
      id
      lastStake
      staked
      buildersProject {
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
      __typename
    }
  }
`;

// Query to get individual builder project data (without user info)
export const GET_BUILDERS_PROJECT_BY_ID = `
  query getBuildersProjectById($id: ID = "") {
    buildersProject(id: $id) {
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
  }
`;

// Query to get individual builder subnet data (testnet)
export const GET_BUILDER_SUBNET_BY_ID = `
  query getBuilderSubnetById($id: ID = "") {
    builderSubnet(id: $id) {
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
      __typename
    }
  }
`; 