# Mock Data for Capital Chart Development

This folder contains mock data files that can be used for development and testing of the capital chart visualization without requiring live GraphQL data.

## Files

- `steth-deposits.json` - Mock stETH deposit data for a 31-day period
- `usdt-deposits.json` - Mock USDT deposit data for a 31-day period  
- `usdc-deposits.json` - Mock USDC deposit data for a 31-day period
- `index.ts` - Service functions to load and format mock data

## Usage

### Enable Mock Data

Mock data is automatically enabled in development mode (`NODE_ENV === 'development'`). You can also manually enable it by setting:

```bash
NEXT_PUBLIC_USE_MOCK_DATA=true
```

### Data Structure

Each JSON file contains an array of data points with this structure:

```json
{
  "date": "2024-12-01T23:59:59.000Z",
  "deposits": 12450.75,
  "timestamp": 1733097599
}
```

- `date`: ISO timestamp string for the data point
- `deposits`: Total amount deposited (as a number, not Wei)
- `timestamp`: Unix timestamp for sorting and compatibility

### Integration

The mock data service is integrated into `useCapitalChartData` hook and will:

1. Replace GraphQL queries with mock data when enabled
2. Provide realistic metrics (TVL, APR, active stakers)
3. Simulate loading delays for realistic UX testing
4. Work seamlessly with existing chart components

### Chart Visualization

When mock data is enabled, you'll see:
- 31 days of realistic deposit growth data
- Proper chart rendering with interactive features
- Mock metrics displayed in the metric cards
- Console messages indicating mock data is being used

## Development Notes

- Mock data includes realistic growth patterns with some volatility
- Different tokens have different scales (stETH being the primary focus)
- The service automatically formats data for compatibility with existing chart components
- Historical data loading is skipped when using mock data to improve performance
