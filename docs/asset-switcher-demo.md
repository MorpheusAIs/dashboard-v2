# Dynamic Asset Switcher - Chart Enhancement

## 🎯 Overview

The capital chart has been enhanced with a dynamic asset switcher that allows users to view different asset deposits with unique styling and colors. This feature is currently available when using mock data in development mode.

## ✨ Features

### Dynamic Asset Tabs
- **Smart Sorting**: Assets ordered by total deposits (highest to lowest)
- **Availability Filter**: Only shows assets that have deposits > 0
- **Responsive Design**: Adapts to different screen sizes

### Asset-Specific Styling
Each asset has its own unique color scheme:

- **stETH**: Emerald green (`#34d399`)
- **LINK**: Blue (`#2563eb`) 
- **wETH**: Purple (`#8b5cf6`)
- **USDC**: Cyan (`#06b6d4`)
- **USDT**: Green (`#10b981`)
- **wBTC**: Amber/Orange (`#f59e0b`)

### Interactive Chart
- **Dynamic Title**: Changes from "Total stETH Deposits" to "Total Deposits in" with asset tabs
- **Color-matched Chart**: Line and fill colors match the selected asset
- **Smooth Transitions**: Animated switching between assets
- **Realistic Data**: Each asset has unique deposit amounts and growth patterns

## 🚀 How to Use

### 1. Enable Mock Data
Mock data is automatically enabled in development mode. The asset switcher will appear in the chart header.

### 2. Switch Assets
Click any asset button to switch the chart data and styling:
```
[stETH] [LINK] [wETH] [USDC] [USDT] [wBTC]
```

### 3. View Asset-Specific Data
Each asset shows:
- **Chart Data**: 31 days of realistic deposit growth
- **Updated Metrics**: TVL, APR, daily rewards, and stakers specific to that asset
- **Custom Colors**: Chart line and fill colors match the asset theme

## 🔧 Technical Implementation

### Components
- `AssetSwitcher`: Renders dynamic asset buttons with proper styling
- `DepositStethChart`: Enhanced with asset-specific colors and titles
- `ChartSection`: Coordinates between data and visualization

### Data Flow
1. `useCapitalChartData` manages selected asset state
2. Mock data service provides asset-specific data and colors  
3. Chart updates automatically when asset selection changes
4. Metrics update to reflect the selected asset's values

### Mock Data Structure
```typescript
// Sample data structure for each asset
{
  date: "2024-12-01T23:59:59.000Z",
  deposits: 12450.75,
  timestamp: 1733097599
}
```

## 📊 Mock Data Overview

### Asset Ranges (Latest Values)
- **LINK**: ~23,587 tokens (highest deposits)
- **stETH**: ~20,423 tokens  
- **wETH**: ~4,957 tokens
- **USDT**: ~13,989 tokens
- **USDC**: ~10,846 tokens
- **wBTC**: ~1,325 tokens (lowest deposits)

### Realistic Metrics Per Asset
Each asset has unique:
- **Price multipliers** (wBTC: $95K, stETH: $3.5K, LINK: $25, etc.)
- **APR rates** (ranging from 7.8% to 12.2%)  
- **Daily MOR emissions** (1,567 to 4,123)
- **Active staker counts** (734 to 2,156)

## 🎨 UI/UX Features

### Button States
- **Selected**: Asset color with ring highlight
- **Unselected**: Gray with hover effects
- **Hover**: Subtle background color transition

### Chart Integration  
- **Header Layout**: Title and asset tabs side-by-side
- **Responsive**: Tabs stack properly on mobile devices
- **Accessibility**: Proper aria-labels and keyboard navigation

## 🔮 Future Enhancements

### Production Integration
- Connect to real GraphQL endpoints for each asset pool
- Dynamic asset detection based on actual pool data
- Real-time metrics from individual asset contracts

### Advanced Features
- Multi-asset comparison charts
- Asset performance indicators
- Historical comparison tools
- Filtering and sorting options

## 🧪 Testing

1. **Default View**: Starts with stETH (emerald green)
2. **Switch Assets**: Click any asset button to change data and colors
3. **Check Console**: See loading messages for each asset switch
4. **Verify Metrics**: Watch TVL and other metrics update per asset

The feature seamlessly demonstrates how the chart will work once connected to real multi-asset pool data!
