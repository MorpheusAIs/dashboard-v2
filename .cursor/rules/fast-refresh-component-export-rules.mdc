---
description: Enforce Fast Refresh optimization by preventing mixed exports in React component files
globs: ["components/**/*.tsx", "app/**/*.tsx", "**/*component*.tsx"]
alwaysApply: false
---

# Fast Refresh Optimization Rule
## CRITICAL: Prevent Mixed Exports That Break Fast Refresh

### Rule: One Export Type Per File
**React component files must export ONLY React components. All other exports must be in separate dedicated files.**

This prevents Next.js Fast Refresh from falling back to full page reloads (5-10+ seconds) instead of hot module replacement (1-2 seconds).

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

### Required Directory Structure:
```
components/feature/
├── types/           # Interfaces, types
├── utils/           # Utility functions, constants
├── hooks/           # Custom hooks
├── my-component.tsx # React component ONLY
└── other-component.tsx # React component ONLY
```

### Enforcement Checklist:
**Before committing any component file, verify:**
- [ ] Does this file export a React component? 
- [ ] Does this file export anything else (interface, const, function, type)?
- [ ] If YES to both → SPLIT THE FILE

### Warning Signs (causes slow Fast Refresh):
- `export interface` in component files
- `export const` (non-component) in component files  
- `export function` (non-component) in component files
- `export type` in component files
- Multiple `export` statements with mixed types

