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

export const GET_BUILDERS_PROJECT_USERS = `
  query getBuildersProjectUsers(
    $first: Int = 10
    $skip: Int = 10
    $buildersProjectId: Bytes = ""
    $orderBy: BuildersUser_orderBy
    $orderDirection: OrderDirection
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