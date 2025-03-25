// GraphQL queries for Compute module

export const GET_SUBNET_USERS = `
  query GetProviders($subnetId: String!, $skip: Int!, $first: Int!) {
    subnetUsers(
      where: {subnet_: {id: $subnetId}}
      skip: $skip
      first: $first
    ) {
      id
      staked
      claimed
      address
      __typename
    }
    subnets(where: {id: $subnetId}) {
      fee
      totalUsers
      deregistrationOpensAt
      __typename
    }
  }
`;

// Add other compute-related queries here as needed 