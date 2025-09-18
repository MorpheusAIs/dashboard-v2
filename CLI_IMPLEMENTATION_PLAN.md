# Web3 Frontend Template CLI - Implementation Plan

## Overview
Create an npm package CLI tool (`create-morpheus-template`) that scaffolds Next.js web3 frontend applications with the complete setup from this repository.

## Core Features

### 1. Project Scaffolding
- **Next.js 14** with App Router
- **TypeScript** configuration
- **Tailwind CSS** with custom dark theme
- **shadcn/ui** component library (all 40+ components)
- **Custom fonts** (Geist Sans & Geist Mono)

### 2. Web3 Integration
- **@reown/appkit** (WalletConnect v2) for wallet connection
- **wagmi** v2 and **viem** v2 for Ethereum interactions
- **TanStack Query** for data fetching and caching
- **MOR token** integration with balance display
- **Multi-network support** (Ethereum, Arbitrum, Base, Arbitrum Sepolia)

### 3. UI Components & Layout
- **Responsive sidebar** with collapsible navigation
- **Header with breadcrumbs** and wallet connection
- **MOR balance component** with network icons
- **Dark theme** with emerald accent colors
- **Custom CSS utilities** and component styles

### 4. Network Configuration
- **Mainnet networks**: Ethereum, Arbitrum, Base
- **Testnet networks**: Arbitrum Sepolia
- **Contract addresses** for MOR tokens and builders contracts
- **RPC configurations** with fallback URLs
- **LayerZero endpoint** configurations

## Package Structure

```
create-web3-template/
├── package.json
├── README.md
├── CHANGELOG.md
├── bin/
│   └── cli.js                  # Main CLI entry point
├── src/
│   ├── index.ts               # CLI command handler
│   ├── utils/
│   │   ├── file-utils.ts      # File operations
│   │   ├── package-utils.ts   # Package.json manipulation
│   │   └── git-utils.ts       # Git initialization
│   ├── templates/
│   │   ├── base/              # Base Next.js template
│   │   ├── components/        # All UI components
│   │   ├── config/            # Configuration files
│   │   ├── hooks/             # Custom hooks
│   │   ├── lib/               # Utility libraries
│   │   └── styles/            # CSS and styling
│   └── prompts/
│       └── project-setup.ts   # Interactive prompts
└── dist/                      # Compiled output
```

## CLI Commands & Options

### Basic Usage
```bash
# Using npx (recommended)
npx create-morpheus-template my-morpheus-app

# Using npm create
npm create morpheus-template my-morpheus-app

# Using yarn create
yarn create morpheus-template my-morpheus-app

# Using pnpm create
pnpm create morpheus-template my-morpheus-app
```

### Command Options
```bash
create-morpheus-template [project-name] [options]

Options:
  -t, --template <template>     Template variant (default: 'minimal')
  -n, --network <network>       Default network (mainnet|testnet) 
  -p, --project-id <id>         WalletConnect Project ID
  --skip-git                    Skip git initialization
  --skip-install                Skip dependency installation
  --package-manager <pm>        Package manager (npm|yarn|pnpm)
  -h, --help                    Display help
  -v, --version                 Display version
```

### Interactive Prompts
1. **Project name** (if not provided)
2. **Template variant** (minimal, full, custom)
3. **Network environment** (mainnet/testnet)
4. **WalletConnect Project ID** (optional)
5. **Package manager** preference
6. **Additional features** (GraphQL, Supabase, etc.)

## Template Variants

### 1. Minimal Template
- Basic Next.js setup with Web3 integration
- Essential components (sidebar, header, wallet connection)
- MOR balance component
- Single page layout

### 2. Full Template  
- Complete dashboard setup
- All shadcn/ui components
- Multiple page examples
- Advanced Web3 features
- GraphQL integration setup

### 3. Custom Template
- Interactive selection of features
- Modular component inclusion
- Custom network configurations

## Core Dependencies

### Production Dependencies
```json
{
  "@reown/appkit": "^1.6.1",
  "@reown/appkit-adapter-wagmi": "^1.6.1",
  "@tanstack/react-query": "^5.76.0",
  "@tanstack/react-query-devtools": "^5.76.0",
  "wagmi": "^2.14.9",
  "viem": "^2.22.14",
  "next": "14.2.16",
  "react": "^18",
  "react-dom": "^18",
  "tailwindcss": "^3.4.1",
  "@number-flow/react": "^0.5.7",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.6.0",
  "lucide-react": "^0.474.0",
  "class-variance-authority": "^0.7.1",
  "next-themes": "^0.4.6"
}
```

### shadcn/ui Dependencies
All 40+ Radix UI components used in the project:
- `@radix-ui/react-*` components
- Custom styled components
- Form handling components

## File Templates

### 1. Core Configuration Files
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind with custom theme
- `components.json` - shadcn/ui configuration
- `tsconfig.json` - TypeScript configuration
- `package.json` - Project dependencies

### 2. Web3 Configuration
- `config/index.tsx` - AppKit/wagmi configuration
- `config/networks.ts` - Network definitions and contracts
- `lib/contracts.ts` - Contract ABIs and addresses
- `components/web3-providers.tsx` - Provider setup

### 3. Layout Components
- `app/layout.tsx` - Root layout
- `app/providers.tsx` - Context providers
- `components/root-layout.tsx` - Main layout structure
- `components/app-sidebar.tsx` - Sidebar navigation

### 4. Web3 Components
- `components/mor-balance.tsx` - MOR token balance display
- `components/network-icons.tsx` - Network icons
- `hooks/use-mor-balance-refresh.ts` - Balance refresh hook

### 5. Styling
- `app/globals.css` - Global styles with CSS variables
- Custom component styles and utilities

## Development Workflow

### Phase 1: Core CLI Setup (Week 1)
1. Initialize npm package structure
2. Set up TypeScript and build configuration
3. Create basic CLI interface with commander.js
4. Implement file copying and template rendering
5. Add interactive prompts with inquirer.js

### Phase 2: Template Creation (Week 2)
1. Create base Next.js template structure
2. Add all shadcn/ui components
3. Implement Web3 provider setup
4. Create MOR balance component
5. Set up network configurations

### Phase 3: Advanced Features (Week 3)
1. Add template variants (minimal/full/custom)
2. Implement package manager detection
3. Add git initialization
4. Create post-installation scripts
5. Add environment file generation

### Phase 4: Testing & Polish (Week 4)
1. Test across different environments
2. Add comprehensive error handling
3. Create documentation and examples
4. Set up CI/CD for publishing
5. Beta testing with real projects

## Error Handling & Validation

### Pre-flight Checks
- Node.js version compatibility (>=18)
- Directory existence and permissions
- Network connectivity for package downloads
- Git availability (if not skipped)

### Runtime Validation
- Project name validation (valid directory name)
- WalletConnect Project ID format validation
- Network configuration validation
- Template file integrity checks

### Error Recovery
- Cleanup on failed installation
- Rollback mechanisms for partial installations
- Detailed error messages with solutions
- Fallback template options

## Publishing Strategy

### Package Registry
- **Primary**: npm registry as `create-web3-template`
- **Alternative**: Scoped package `@morpheus/create-web3-app`

### Versioning Strategy
- **Semantic versioning** (semver)
- **Beta releases** for testing
- **LTS versions** for stability

### Release Schedule
- **Major releases**: New Next.js versions, breaking changes
- **Minor releases**: New features, template updates
- **Patch releases**: Bug fixes, dependency updates

## Documentation Requirements

### README.md
- Quick start guide
- Installation instructions
- Usage examples
- Configuration options
- Troubleshooting guide

### CLI Help System
- Command documentation
- Option descriptions
- Usage examples
- Common patterns

### Template Documentation
- Component usage guides
- Web3 integration examples
- Customization instructions
- Best practices

## Future Enhancements

### Additional Templates
- **DeFi Dashboard** template
- **NFT Marketplace** template
- **DAO Governance** template
- **Multi-chain DEX** template

### Advanced Features
- **Custom component generator**
- **Automatic dependency updates**
- **Template marketplace**
- **Plugin system**

### Integrations
- **Supabase** database setup
- **IPFS** storage integration
- **The Graph** protocol setup
- **Hardhat** development environment

## Success Metrics

### Adoption Metrics
- **Downloads per month**: Target 1000+ after 6 months
- **GitHub stars**: Target 500+ after 1 year
- **Community contributions**: PRs, issues, discussions

### Quality Metrics
- **Template success rate**: >95% successful installations
- **Build success rate**: >98% template builds work
- **User satisfaction**: >4.5/5 in feedback surveys

## Risk Mitigation

### Technical Risks
- **Dependency conflicts**: Pin specific versions, test matrix
- **Template drift**: Automated synchronization with source
- **Breaking changes**: Version compatibility matrix

### Maintenance Risks
- **Dependency updates**: Automated PRs with testing
- **Security vulnerabilities**: Dependabot integration
- **Template obsolescence**: Regular review cycles

This implementation plan provides a comprehensive roadmap for creating a production-ready CLI tool that can generate high-quality Web3 frontend applications with all the sophisticated features present in the current repository. 