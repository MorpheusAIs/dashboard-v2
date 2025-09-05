# Fast Refresh Optimization Rule
## CRITICAL: Prevent Mixed Exports That Break Fast Refresh

### Problem
Files that export both React components AND other items (constants, utilities, functions, interfaces, types) cause Next.js Fast Refresh to fall back to full page reloads (5-10+ seconds) instead of hot module replacement (1-2 seconds).

### Rule: One Export Type Per File
**React component files must export ONLY React components. All other exports must be in separate dedicated files.**

### ❌ NEVER DO (Breaks Fast Refresh):
```tsx
// ❌ BAD: components/my-component.tsx
export interface MyData {
  id: string;
  name: string;
}

export const CONSTANTS = {
  MAX_ITEMS: 10,
  DEFAULT_COLOR: 'blue'
};

export const parseData = (data: string) => { ... };

export default function MyComponent() {
  return <div>Hello</div>;
}
```

### ✅ ALWAYS DO (Enables Fast Refresh):
```tsx
// ✅ GOOD: components/my-component.tsx (React component ONLY)
import type { MyData } from "./types/my-data";
import { CONSTANTS } from "./utils/constants";
import { parseData } from "./utils/parse-data";

export default function MyComponent() {
  return <div>Hello</div>;
}

// ✅ GOOD: components/types/my-data.ts (Types ONLY)
export interface MyData {
  id: string;
  name: string;
}

// ✅ GOOD: components/utils/constants.ts (Constants ONLY)
export const CONSTANTS = {
  MAX_ITEMS: 10,
  DEFAULT_COLOR: 'blue'
};

// ✅ GOOD: components/utils/parse-data.ts (Utilities ONLY)
export const parseData = (data: string) => { ... };
```

### Directory Structure Pattern:
components/feature/
├── types/ # Interfaces, types
├── utils/ # Utility functions, constants
├── hooks/ # Custom hooks
├── icons/ # Icon components (if needed)
├── my-component.tsx # React component ONLY
└── other-component.tsx # React component ONLY


### Enforcement Checklist:
**Before committing any component file, verify:**
- [ ] Does this file export a React component? 
- [ ] Does this file export anything else (interface, const, function, type)?
- [ ] If YES to both → SPLIT THE FILE

**Warning Signs (causes slow Fast Refresh):**
- `export interface` in component files
- `export const` (non-component) in component files  
- `export function` (non-component) in component files
- `export type` in component files
- Multiple `export` statements with mixed types

**Exception:** 
- UI library components (like shadcn/ui) with variant configs are acceptable but not ideal
- If you must keep mixed exports, move them to `/lib` or `/utils` directories, not `/components`

### Testing Fast Refresh:
After making component changes, verify in terminal logs:
- ✅ Should see: `⚡ Compiled /page in 1.2s (45 modules)` 
- ❌ Avoid: `✓ Compiled /page in 22.3s (20372 modules)`

The module count should be small (< 100) for Fast Refresh, not thousands.

### Benefits of Following This Rule:
- ⚡ 1-2 second hot reloads instead of 5-10+ second full recompilations
- 🔥 Consistent Fast Refresh performance across all components
- 🚀 Better developer experience matching production deployment tools
- 📊 Reduced CPU usage during development
- 🎯 Clear separation of concerns and better code organization

**Remember: Fast Refresh performance is a critical developer experience metric. Mixed exports are the #1 cause of Fast Refresh degradation.**