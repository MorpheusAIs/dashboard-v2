# Next.js 14 → 16 & React 18 → 19 Migration Plan

## Critical Security Context

**CVE-2025-55182 (React2Shell)** - CVSS 10.0 - ACTIVELY EXPLOITED
- Affects React 19.0, 19.1.0, 19.1.1, 19.2.0
- Fixed in: React 19.0.3, 19.1.4, or 19.2.3
- Next.js patched: 16.0.7, 15.5.7, 15.4.8, 15.3.6, 15.2.6, 15.1.9, 15.0.5

**Additional CVEs (December 2025):**
- CVE-2025-55184 and CVE-2025-67779 - DoS attacks
- CVE-2025-55183 - Source code exposure
- Fixed in: React 19.0.3, 19.1.4, 19.2.3

**Current Project Status:**
- Next.js: 14.2.16 (vulnerable if upgraded without patch)
- React: 18 (not directly affected by RSC vulnerability)
- Target: Next.js 16.0.7+ with React 19.2.3

---

## Breaking Changes Summary

### 1. Async Request APIs (REQUIRED)
Next.js 16 removes synchronous access to request APIs. Must use `await`.

**Affected Files:**
| File | Current Pattern | Migration Required |
|------|-----------------|-------------------|
| `app/api/builders/goldsky/[projectId]/route.ts` | `{ params }: { params: { projectId: string } }` | Make params Promise |
| `app/api/builders/goldsky/[projectId]/users/route.ts` | `{ params }: { params: { projectId: string } }` | Make params Promise |
| `app/api/builders/goldsky/user-admin/[network]/route.ts` | `{ params }: { params: { network: string } }` | Make params Promise |
| `app/api/builders/goldsky/user-staked/[network]/route.ts` | `{ params }: { params: { network: string } }` | Make params Promise |

**Already Migrated:**
- `app/layout.tsx` - Already uses `await headers()`

**No Migration Needed:**
- Client-side `useSearchParams()` - Stays synchronous
- `request.nextUrl.searchParams` - Already synchronous property access

### 2. Turbopack as Default
- Already using `--turbo` flag in package.json
- Custom webpack config needs Turbopack compatibility review
- Options: Keep webpack with `--webpack` flag, or migrate to Turbopack

### 3. Middleware → Proxy Rename
- **No middleware.ts in project** - No migration needed

### 4. Package Migrations

| Package | Current Version | Target Version | Notes |
|---------|----------------|----------------|-------|
| `next` | 14.2.16 | 16.0.7+ | Security patch required |
| `react` | ^18 | 19.2.3 | Security patch required |
| `react-dom` | ^18 | 19.2.3 | Security patch required |
| `framer-motion` | ^12.23.22 | motion@12+ | Package renamed |
| `wagmi` | ^2.14.9 | ^3.1.3 | React 19 compatibility |
| `@wagmi/core` | ^2.16.3 | ^3.x | Match wagmi |
| `@reown/appkit` | ^1.6.1 | ^1.8.15 | Latest version |
| `@reown/appkit-adapter-wagmi` | ^1.6.1 | ^1.8.15 | Match appkit |
| `@tanstack/react-query` | ^5.76.0 | ^5.90.16 | React 19 compatible |
| `eslint-config-next` | 14.2.16 | 16.0.7 | Match Next.js |
| `@types/react` | 18.3.23 | ^19.0.0 | React 19 types |
| `@types/react-dom` | ^18 | ^19.0.0 | React 19 types |

### 5. Import Changes

**framer-motion → motion:**
```tsx
// Before
import { motion, AnimatePresence } from 'framer-motion'

// After
import { motion, AnimatePresence } from 'motion/react'
```

### 6. next.config.mjs Updates

**Current webpack config:**
- Custom watchOptions (can keep)
- React Native async storage fallback (may need adjustment)
- Source map config (can keep)

**Turbopack consideration:**
- Move any Turbopack config from `experimental.turbopack` to `turbopack`
- Decide: Keep webpack with `--webpack` flag or migrate to Turbopack

---

## Migration Steps

### Phase 1: Preparation
1. [x] Create feature branch `feature/nextjs-16-react-19-migration`
2. [x] Analyze codebase for breaking changes
3. [x] Document migration plan

### Phase 2: Core Updates
4. [x] Run `npx @next/codemod upgrade 16` for automated migrations
5. [x] Update package.json dependencies manually if codemod misses any
6. [x] Run `npm install` to update lock file

### Phase 3: Code Migrations
7. [x] Migrate API route params to async pattern (4 files)
8. [x] Update framer-motion imports to motion/react
9. [x] Update next.config.mjs if needed for Turbopack

### Phase 4: Dependency Updates
10. [x] Keep wagmi 2.x (compatible with current codebase, awaiting full v3 migration)
11. [x] Radix UI packages compatible with React 19
12. [x] Update all other packages to React 19 compatible versions

### Phase 5: Verification
13. [x] Run `npm run build` - fix any TypeScript errors
14. [x] Run `npm run lint` - ESLint config needs migration to flat config format
15. [ ] Test all major features:
    - Wallet connection
    - Capital page deposits/withdrawals
    - Builders page staking
    - Subnet creation flow

---

## API Route Migration Pattern

### Before (Next.js 14):
```typescript
export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  const { projectId } = params;
  // ...
}
```

### After (Next.js 16):
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  // ...
}
```

---

## Rollback Plan

If migration fails:
1. `git checkout main`
2. Delete feature branch: `git branch -D feature/nextjs-16-react-19-migration`
3. Document issues encountered for future attempt

---

## Resources

- [Next.js 16 Blog Post](https://nextjs.org/blog/next-16)
- [Version 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Version 15 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-15)
- [Next.js Codemods](https://nextjs.org/docs/app/guides/upgrading/codemods)
- [React 19 Security Advisory](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [CVE-2025-55182 Summary](https://vercel.com/changelog/cve-2025-55182)
- [Wagmi v2 to v3 Migration](https://wagmi.sh/react/guides/migrate-from-v1-to-v2)
- [Motion Upgrade Guide](https://motion.dev/docs/react-upgrade-guide)
