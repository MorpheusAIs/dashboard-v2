/**
 * Detailed test for buildersUsers schema in v4
 */

const V4_ENDPOINTS = {
  Base: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-base-compatible/v0.0.1/gn',
  Arbitrum: 'https://api.goldsky.com/api/public/project_cmgzm6igw009l5np264iw7obk/subgraphs/morpheus-mainnet-arbitrum-compatible/v0.0.1/gn'
};

async function testGraphQLQuery(
  endpoint: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return await response.json();
}

async function testUsersSchema(network: 'Base' | 'Arbitrum') {
  console.log(`\nTesting ${network} buildersUsers schema...`);
  const endpoint = V4_ENDPOINTS[network];

  // Test buildersUsers with various field combinations
  const queries = [
    {
      name: 'buildersUsers with basic fields',
      query: `
        query TestUsersBasic {
          buildersUsers(first: 2, orderBy: staked, orderDirection: desc) {
            id
            address
            staked
            lastStake
          }
        }
      `
    },
    {
      name: 'buildersUsers with claimLockEnd',
      query: `
        query TestUsersWithClaimLock {
          buildersUsers(first: 2, orderBy: staked, orderDirection: desc) {
            id
            address
            staked
            lastStake
            claimLockEnd
          }
        }
      `
    },
    {
      name: 'buildersUsers with buildersProject relation',
      query: `
        query TestUsersWithProject {
          buildersUsers(first: 2, orderBy: staked, orderDirection: desc, where: { staked_gt: "0" }) {
            id
            address
            staked
            lastStake
            buildersProject {
              id
              name
              admin
              totalStaked
              totalUsers
            }
          }
        }
      `
    },
    {
      name: 'buildersUsers filtered by address',
      query: `
        query TestUsersByAddress($address: Bytes!) {
          buildersUsers(where: { address: $address }) {
            id
            address
            staked
            lastStake
            claimLockEnd
            buildersProject {
              id
              name
              totalStaked
            }
          }
        }
      `,
      variables: {
        address: '0x67760bad63cc00294764ef7d1f6570e864c196c1' // Example address from Base
      }
    },
    {
      name: 'buildersUsers with pagination (first/skip)',
      query: `
        query TestUsersPagination {
          buildersUsers(first: 5, skip: 0, orderBy: staked, orderDirection: desc) {
            id
            address
            staked
            buildersProject {
              id
              name
            }
          }
        }
      `
    }
  ];

  for (const test of queries) {
    console.log(`\n  ${test.name}:`);
    try {
      const result = await testGraphQLQuery(endpoint, test.query, test.variables || {}) as { data?: unknown; errors?: Array<{ message: string }> };
      if (result.errors) {
        console.log('  ❌ Failed:', result.errors[0]?.message);
      } else if (result.data) {
        console.log('  ✅ Success!');
        console.log('  ' + JSON.stringify(result.data, null, 2).split('\n').join('\n  '));
      }
    } catch (error) {
      console.log('  ❌ Error:', (error as Error).message);
    }
  }
}

async function main() {
  console.log('V4 BuildersUsers Schema Test');
  console.log('============================');

  await testUsersSchema('Base');
  await testUsersSchema('Arbitrum');

  console.log('\n============================');
  console.log('Test Complete');
}

main().catch(console.error);

