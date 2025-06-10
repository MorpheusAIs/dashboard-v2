# Architecture Overview

*Last Updated: January 2025*

## 🏗️ **System Architecture**

Morpheus Dashboard v2 is built as a modern Web3 application with a focus on performance, scalability, and user experience.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Blockchain    │
│   (Next.js)     │◄──►│   (API Routes)  │◄──►│   Networks      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   State Mgmt    │    │   Data Layer    │    │   Smart         │
│   (React Query) │    │   (GraphQL)     │    │   Contracts     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 **Technology Stack**

### **Frontend Framework**
- **Next.js 14** with App Router
- **React 18** with Server Components
- **TypeScript** for type safety
- **Tailwind CSS** + **shadcn/ui** for styling

### **Web3 Integration**
- **Wagmi v2** + **Viem** for blockchain interactions
- **Reown AppKit** for wallet connections
- **Ethers.js v5** for contract operations
- **Multiple RPC providers** for redundancy

### **State Management**
- **TanStack Query** for server state caching
- **React Context** for global app state
- **React Hook Form** + **Zod** for form state

### **Data Layer**
- **GraphQL** with Apollo Client
- **Multiple subgraphs** for different networks
- **Supabase** for builder metadata storage
- **Local storage** for user preferences (sidebar collapse status, search)

## 📁 **Project Structure**

```
dashboard-v2/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── builders/          # Builder subnet pages
│   ├── capital/           # Capital management
│   ├── compute/           # Compute node pages
│   ├── metrics/           # Protocol metrics
│   ├── graphql/           # GraphQL queries
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── ui/               # Base UI components
│   ├── subnet-form/      # Subnet creation form
│   └── ...               # Feature-specific components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions
├── types/                # TypeScript definitions
└── config/               # Configuration files
```

## 🌐 **Network Architecture**

### **Supported Networks**
```typescript
const networks = {
  mainnet: {
    arbitrum: { chainId: 42161, rpc: "..." },
    base: { chainId: 8453, rpc: "..." },
    ethereum: { chainId: 1, rpc: "..." }
  },
  testnet: {
    arbitrumSepolia: { chainId: 421614, rpc: "..." }
  }
}
```

### **Contract Integration**
- **Builder Contracts**: Subnet creation and management  
- **Capital Contracts**: Staking and yield distribution
- **Compute Contracts**: Node registration and rewards
- **Token Contracts**: MOR and MOR20 tokens

### **GraphQL Subgraphs**
```typescript
const subgraphs = {
  builders: "https://api.studio.thegraph.com/...",
  capital: "https://api.studio.thegraph.com/...",
  compute: "https://api.studio.thegraph.com/..."
}
```

## 🔄 **Data Flow**

### **1. User Interactions**
```
User Action → React Component → Hook → Wagmi → Blockchain
                                    → GraphQL → Subgraph
                                    → API Route → Supabase
```

### **2. Real-time Updates**
```
Blockchain Event → Subgraph → GraphQL Poll → TanStack Query → UI Update
```

### **3. State Management**
```
Server State (TanStack Query) ← GraphQL/Blockchain
Global State (React Context) ← User preferences/wallet
Local State (React Hooks) ← Component-specific data
```

## 🎨 **UI Architecture**

### **Design System**
- **shadcn/ui**: Base component library
- **Tailwind CSS**: Utility-first styling
- **CSS Variables**: Dynamic theming
- **Responsive Design**: Mobile-first approach

### **Component Hierarchy**
```
RootLayout
├── AppSidebar (Navigation)
├── TestnetIndicator (Network status)  
├── Page Components
│   ├── Feature-specific components
│   ├── UI Components (buttons, forms, etc.)
│   └── Chart Components (recharts)
└── Web3Providers (Wallet context)
```

## 🔐 **Security Architecture**

### **Wallet Security**
- **No private key handling** - wallets manage keys
- **Transaction signing** handled by user's wallet
- **Network validation** before transactions
- **Contract address verification**

### **Data Security**
- **No sensitive data storage** in localStorage
- **API routes** protected by network validation
- **GraphQL queries** read-only by design
- **Environment variables** for sensitive config

## ⚡ **Performance Architecture**

### **Optimization Strategies**
- **Code Splitting**: Route-based and component-based
- **Tree Shaking**: Automatic unused code removal
- **Image Optimization**: Next.js built-in optimization
- **Bundle Analysis**: Regular size monitoring

### **Caching Strategy**
```
Level 1: Browser Cache (static assets)
Level 2: TanStack Query (API responses)  
Level 3: GraphQL Cache (blockchain data)
Level 4: Vercel Edge Cache (pages)
```

### **Loading Performance**
- **Static Generation**: 13/13 pages pre-built
- **Incremental Static Regeneration**: Dynamic data updates
- **Server Components**: Reduced JavaScript bundle
- **Lazy Loading**: Component-level code splitting

## 🚀 **Deployment Architecture**

### **Hosting**
- **Platform**: Vercel (Edge Network)
- **Domain**: Custom domain with SSL
- **CDN**: Global edge locations
- **Environment**: Production + Preview branches

### **CI/CD Pipeline**
```
Git Push → GitHub → Vercel Build → TypeScript Check → Deploy → Health Check
```

### **Environment Configuration**
- **Production**: Live environment with mainnet contracts
- **Preview**: Branch-based previews for testing
- **Development**: Local environment with hot reload

## 🔍 **Monitoring Architecture**

### **Application Monitoring**
- **Vercel Analytics**: Performance and user metrics
- **Error Tracking**: Built-in error boundaries
- **Build Monitoring**: TypeScript and lint checks
- **Bundle Analysis**: Size and performance tracking

### **Blockchain Monitoring**
- **RPC Health**: Multiple provider fallbacks
- **Contract Calls**: Success/failure tracking
- **Transaction Monitoring**: Gas usage and confirmations
- **Network Status**: Real-time network health

## 🧪 **Testing Architecture**

### **Testing Strategy**
- **Type Safety**: TypeScript compilation
- **Linting**: ESLint configuration
- **Build Testing**: Production build verification
- **Integration Testing**: End-to-end user flows

### **Quality Gates**
1. **TypeScript**: Must compile without errors
2. **Linting**: Must pass ESLint rules
3. **Build**: Must generate successfully
4. **Bundle Size**: Must stay within limits

---

## 📚 **Development Guidelines**

### **Code Organization**
- **Feature-based structure** for related components
- **Shared utilities** in `/lib` directory
- **Type definitions** centralized in `/types`
- **Configuration** externalized to `/config`

### **Best Practices**
- **TypeScript strict mode** enabled
- **React hooks** for state management
- **Custom hooks** for reusable logic
- **Context providers** for global state

---

[← Back to Wiki Home](Home) | [View Performance Metrics →](Performance-Metrics) 