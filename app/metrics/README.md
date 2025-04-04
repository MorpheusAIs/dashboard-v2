# Metrics Section

This section of the application provides data visualization and metrics for the Morpheus protocol. It includes charts and metrics for token liquidity pools and other key performance indicators.

## Structure

- `page.tsx` - The main page component that renders all metrics components
- `LiquidityPoolsChart.tsx` - Client component to display liquidity pool data as a stacked bar chart with USD values
- `debug.tsx` - Debugging tools for troubleshooting GraphQL and API issues

## Data Sources

The metrics page fetches data from the following sources:

### GraphQL Subgraph
The liquidity pool data is fetched from the Morpheus subgraph using GraphQL. The queries are defined in:
- `app/graphql/queries/metrics.ts`

### CoinGecko API
Token prices are fetched from the CoinGecko API to convert token amounts to USD values.
- The integration uses the `/simple/token_price` endpoint
- It automatically extracts unique token addresses from pool data
- Handles potential API errors with a fallback to displaying just token amounts

## Troubleshooting Tools

The metrics page includes built-in debugging tools:

1. **GraphQL Debug Tool**: Tests GraphQL endpoint connectivity and shows raw response data
2. **Fallback Data**: If the GraphQL query fails, sample data is used to display the chart
3. **Fallback Token Prices**: If CoinGecko API fails, predefined token prices are used

### Debugging GraphQL Issues
- Use the GraphQL Debug Tool to test different network endpoints
- Check the browser console for detailed error messages and response data
- Verify the format of the returned data matches expected schema

### Debugging CoinGecko API Issues
- Check for CORS errors in the browser console
- Verify rate limits haven't been exceeded
- Confirm token contract addresses are correct for Arbitrum

## How to Add New Metrics

To add a new metric or chart to this section:

1. Create a new GraphQL query in `app/graphql/queries/metrics.ts` if needed
2. Create a new client component for your chart/metric
3. Add the component to the grid in `page.tsx`

## CoinGecko API Rate Limits

Note that the CoinGecko API has rate limits:
- Free tier: 10-30 calls/minute
- If you encounter rate limiting issues, consider implementing additional caching or using the Pro API with an API key

## Styling

The section uses the application's UI components and styling conventions. Charts should use the `ChartContainer` from `@/components/ui/chart.tsx` for consistent styling.

## Example

```tsx
// Example of how to add a new metric component that uses token prices
import { NewMetricChart } from "./NewMetricChart";

// In the MetricsPage component:
<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
  <div className="lg:col-span-2">
    <Suspense fallback={<div className="h-64 bg-card animate-pulse rounded-lg" />}>
      <LiquidityPoolsContent />
    </Suspense>
  </div>
  
  <div className="lg:col-span-1">
    <Suspense fallback={<div className="h-64 bg-card animate-pulse rounded-lg" />}>
      <NewMetricChart />
    </Suspense>
  </div>
</div>
``` 