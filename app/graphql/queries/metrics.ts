// GraphQL queries for Metrics module

export const GET_LIQUIDITY_POOLS = `
  query GetLiquidityPools {
    poolsToken0: pools(where: { token0: "0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86" }) {
      id
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      liquidity
      totalValueLockedToken0
      totalValueLockedToken1
    }
    poolsToken1: pools(where: { token1: "0x092baadb7def4c3981454dd9c0a0d7ff07bcfc86" }) {
      id
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      liquidity
      totalValueLockedToken0
      totalValueLockedToken1
    }
  }
`;

// Add other metrics-related queries here as needed 