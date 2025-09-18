# Create Web3 Template

A powerful CLI tool for scaffolding modern Web3 frontend applications with Next.js, wagmi, and comprehensive UI components.

## Features

🚀 **Next.js 14** with App Router and TypeScript  
🎨 **Tailwind CSS** with custom dark theme  
🔗 **@reown/appkit** (WalletConnect v2) integration  
⚡ **wagmi** v2 and **viem** v2 for Web3 interactions  
🎯 **40+ shadcn/ui components** pre-configured  
🌐 **Multi-network support** (Ethereum, Arbitrum, Base)  
💰 **MOR token balance** display with network icons  
📱 **Responsive design** with collapsible sidebar  
🎭 **Dark theme** with emerald accent colors  

## Quick Start

```bash
# Using npx (recommended)
npx create-web3-template my-web3-app

# Using npm
npm create web3-template my-web3-app

# Using yarn
yarn create web3-template my-web3-app

# Using pnpm
pnpm create web3-template my-web3-app
```

## Usage

### Basic Usage
```bash
create-web3-template [project-name] [options]
```

### Options
| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <template>` | Template variant (minimal, full, custom) | `minimal` |
| `-n, --network <network>` | Default network environment (mainnet, testnet) | `mainnet` |
| `-p, --project-id <id>` | WalletConnect Project ID | `prompt` |
| `--skip-git` | Skip git initialization | `false` |
| `--skip-install` | Skip dependency installation | `false` |
| `--package-manager <pm>` | Package manager (npm, yarn, pnpm) | `auto-detect` |
| `-h, --help` | Display help information | |
| `-v, --version` | Display version number | |

### Examples

**Create with specific template:**
```bash
npx create-web3-template my-defi-app --template full
```

**Skip git and use yarn:**
```bash
npx create-web3-template my-app --skip-git --package-manager yarn
```

**Testnet environment with custom Project ID:**
```bash
npx create-web3-template my-testnet-app --network testnet --project-id abc123
```

## Template Variants

### 🎯 Minimal Template
Perfect for getting started quickly with essential Web3 functionality.

**Includes:**
- Basic Next.js setup with TypeScript
- Essential UI components (Button, Card, Input, etc.)
- Wallet connection with AppKit
- MOR balance display
- Single page layout
- Responsive sidebar navigation

**File Structure:**
```
my-web3-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── providers.tsx
│   └── globals.css
├── components/
│   ├── ui/           # Essential shadcn/ui components
│   ├── web3-providers.tsx
│   ├── app-sidebar.tsx
│   ├── root-layout.tsx
│   ├── mor-balance.tsx
│   └── network-icons.tsx
├── config/
│   ├── index.tsx     # AppKit configuration
│   └── networks.ts   # Network definitions
├── lib/
│   ├── contracts.ts  # Contract addresses
│   └── utils.ts      # Utility functions
└── hooks/
    └── use-mor-balance-refresh.ts
```

### 🚀 Full Template
Complete dashboard setup with all features and components.

**Includes:**
- Everything from Minimal template
- All 40+ shadcn/ui components
- Multiple page examples
- Advanced Web3 hooks
- TanStack Query integration
- Form handling with react-hook-form
- Data tables and charts
- Modal and dialog examples

**Additional Features:**
- Multi-page navigation
- Advanced form components
- Data visualization
- Complex state management
- GraphQL setup (optional)

### ⚙️ Custom Template
Interactive template builder for selecting specific features.

**Interactive Options:**
- Component selection (pick specific shadcn/ui components)
- Network configuration (select supported networks)
- Additional integrations (GraphQL, Supabase, etc.)
- Layout preferences (sidebar style, theme options)

## What's Included

### Core Technologies
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **@reown/appkit** - Modern wallet connection
- **wagmi** - React hooks for Web3
- **viem** - TypeScript interface for Ethereum
- **TanStack Query** - Data fetching and caching

### UI Components (shadcn/ui)
The generated project includes all shadcn/ui components:

**Layout & Navigation:**
- Sidebar, Breadcrumb, Sheet, Tabs

**Forms & Inputs:**
- Button, Input, Textarea, Select, Checkbox, Radio Group, Switch, Slider, Calendar, Date Picker

**Data Display:**
- Table, Card, Badge, Avatar, Skeleton, Chart, Data Table

**Feedback & Overlays:**
- Dialog, Alert, Tooltip, Hover Card, Popover, Sonner (Toast)

**Utility:**
- Command, Collapsible, Separator, Label, Form

### Web3 Integration

**Wallet Support:**
- MetaMask, WalletConnect, Coinbase Wallet, and 100+ others
- Automatic wallet detection
- Mobile wallet support

**Network Support:**
- **Mainnet**: Ethereum, Arbitrum, Base
- **Testnet**: Arbitrum Sepolia
- Easy network switching
- Custom RPC configurations

**MOR Token Integration:**
- Real-time balance display
- Multi-network support
- Network-specific icons
- Automatic refresh on transactions

## 🎨 Visual Theme Editor Integration

Your generated projects include a powerful visual theme editor integration using tweakcn, enhanced with auth-free local development:

### Key Features
- **🚫 No Authentication Required**: Custom "Apply to Project" button bypasses social login
- **⚡ Real-time Sync**: Changes appear in your main app within 2 seconds
- **🎯 Visual Editor**: Professional theme customization interface
- **📱 Component Preview**: Test themes across all shadcn/ui components
- **🔄 Automatic Watching**: File system monitoring for instant updates
- **💾 Local Storage**: Themes saved locally without external dependencies

### Quick Setup

1. **Setup the theme editor (one-time):**
   ```bash
   npm run tweakcn:setup
   ```

2. **Start both servers:**
   ```bash
   npm run dev:with-tweakcn
   ```

3. **Access the editors:**
   - **Theme Editor**: http://localhost:3001 (auto-redirects to visual editor)
   - **Your Main App**: http://localhost:3000

### How to Use

1. **Make Changes**: Adjust colors, typography, spacing in the visual editor
2. **Apply Changes**: Click the **"⚡ Apply to Project"** button (top-right corner)
3. **See Results**: Changes appear in your main app automatically (no refresh needed)

### Available Commands

```bash
# Start with theme editor (recommended)
npm run dev:with-tweakcn

# Start main app only  
npm run dev

# Setup theme editor (one-time)
npm run tweakcn:setup

# Manual theme sync (if needed)
npm run tweakcn:sync

# Stop theme watcher
npm run tweakcn:stop
```

### Advanced Features

**Multiple Sync Methods:**
1. **Primary**: Custom "Apply to Project" button → API → File watcher
2. **Fallback**: Direct CSS variable extraction from tweakcn
3. **Manual**: `npm run tweakcn:sync` command

**Theme Structure:**
Your themes use CSS custom properties that work across all components:
```css
:root {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 160 84% 39%;
  --primary-foreground: 355 7% 97%;
  /* ... and more */
}
```

**Workflow Tips:**
- Start with pre-built themes as base templates
- Test changes across different components
- Use color picker harmony modes for cohesive palettes
- Adjust typography systematically
- Test both dark and light theme modes

**Troubleshooting:**
- Ensure both servers are running with `npm run dev:with-tweakcn`
- Look for the "⚡ Apply to Project" button in the top-right corner
- Try manual sync with `npm run tweakcn:sync` if needed
- Refresh the theme editor page if the apply button is missing

**Scalability Note:**
This integration is designed for local development. When you create new projects with the CLI, you'll always get the latest tweakcn version with these auth-free enhancements automatically applied, ensuring compatibility with updates while maintaining the seamless development experience.

## Configuration

### Environment Variables
Create a `.env.local` file in your project root:

```env
# Required: Get from https://cloud.reown.com
NEXT_PUBLIC_PROJECT_ID=your_walletconnect_project_id

# Optional: Network environment
NEXT_PUBLIC_NETWORK_ENV=mainnet

# Optional: Custom RPC URLs
NEXT_PUBLIC_ETHEREUM_RPC=https://your-ethereum-rpc
NEXT_PUBLIC_ARBITRUM_RPC=https://your-arbitrum-rpc
NEXT_PUBLIC_BASE_RPC=https://your-base-rpc
```

### WalletConnect Project ID
1. Visit [Reown Cloud](https://cloud.reown.com)
2. Create a new project
3. Copy your Project ID
4. Add it to your `.env.local` file

### Network Configuration
The template includes pre-configured networks with contract addresses:

**Mainnet Networks:**
- Ethereum (Chain ID: 1)
- Arbitrum (Chain ID: 42161)
- Base (Chain ID: 8453)

**Testnet Networks:**
- Arbitrum Sepolia (Chain ID: 421614)

### Customization

**Theme Colors:**
Edit `tailwind.config.ts` to customize the color scheme:
```typescript
theme: {
  extend: {
    colors: {
      primary: {
        DEFAULT: 'hsl(142, 76%, 36%)', // Emerald-600
        foreground: 'hsl(0, 0%, 98%)',
      },
      // ... other colors
    }
  }
}
```

**Sidebar Navigation:**
Modify `components/app-sidebar.tsx` to add/remove navigation items:
```typescript
const navigation = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Your Feature",
    url: "/your-feature",
    icon: YourIcon,
  },
];
```

## Development

### Getting Started
After creating your project:

```bash
cd my-web3-app
npm run dev
```

Your app will be available at `http://localhost:3000`

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler

### Adding New Components
Use the shadcn/ui CLI to add additional components:

```bash
npx shadcn@latest add component-name
```

### Project Structure
```
my-web3-app/
├── app/                 # Next.js App Router
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   ├── providers.tsx   # Context providers
│   └── globals.css     # Global styles
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── web3-providers.tsx
│   ├── app-sidebar.tsx
│   ├── root-layout.tsx
│   ├── mor-balance.tsx
│   └── network-icons.tsx
├── config/             # Configuration files
│   ├── index.tsx       # AppKit setup
│   └── networks.ts     # Network definitions
├── hooks/              # Custom React hooks
├── lib/                # Utility functions
│   ├── contracts.ts    # Contract addresses
│   └── utils.ts        # Helper functions
├── public/             # Static assets
└── types/              # TypeScript definitions
```

## Troubleshooting

### Common Issues

**"Project ID not found" error:**
- Make sure you've added `NEXT_PUBLIC_PROJECT_ID` to your `.env.local` file
- Verify the Project ID is correct from Reown Cloud

**Wallet connection not working:**
- Check that your app is running on the correct port
- Ensure your Project ID is configured for the correct domain
- Try refreshing the page and clearing browser cache

**Build errors:**
- Run `npm run type-check` to identify TypeScript errors
- Make sure all dependencies are installed with `npm install`
- Check that your Node.js version is 18 or higher

**Styling issues:**
- Ensure Tailwind CSS is properly configured
- Check that `globals.css` imports are correct
- Verify CSS variable definitions

### Getting Help

- **Documentation**: Check the [Next.js docs](https://nextjs.org/docs) and [wagmi docs](https://wagmi.sh)
- **Issues**: Report bugs on [GitHub Issues](https://github.com/your-repo/create-web3-template/issues)
- **Community**: Join our [Discord community](https://discord.gg/your-discord)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org) - The React framework
- [wagmi](https://wagmi.sh) - React hooks for Web3
- [shadcn/ui](https://ui.shadcn.com) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) - CSS framework
- [Reown](https://reown.com) - WalletConnect infrastructure

---

<p align="center">
  <strong>Created with ❤️ for the Web3 community</strong>
</p> 