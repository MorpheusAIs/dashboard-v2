# Builders Route - Mobile Responsiveness Issues

This document analyzes the UI components in the `/builders` route that are likely not responsive or mobile optimized, ranked from easiest to fix to most complex.

## Easy Fixes (Simple CSS/Tailwind changes)

### 1. Network Switch Notification
**File:** `app/builders/[slug]/page.tsx` (lines 820-825)
**Issue:** Fixed positioning notification could overflow on small screens
```typescript
<div className="fixed top-4 right-4 bg-emerald-900/90 text-white px-4 py-3 rounded-lg shadow-lg z-50 max-w-md transition-all duration-300 ease-in-out opacity-100 transform translate-y-0">
```
**Problems:**
- `fixed top-4 right-4` doesn't account for very small screens
- `max-w-md` might still be too wide on mobile
- Missing responsive spacing adjustments

**Fix Complexity:** ⭐ (Very Easy)
**Estimated Time:** 15 minutes

### 2. Footer Button Layout in New Subnet Page
**File:** `app/builders/newsubnet/page.tsx` (lines 327-366)
**Issue:** Button layout could break on very small screens
```typescript
<div className="mt-8 flex justify-between items-center">
  <div className="flex items-center space-x-2">
    <Button>{isNetworkSwitching ? 'Switching...' : `Switch to ${getNetworkName(selectedChainId)}`}</Button>
  </div>
</div>
```
**Problems:**
- `flex justify-between` on small screens with long button text
- Network switch button text can be quite long
- No responsive stacking

**Fix Complexity:** ⭐ (Very Easy) 
**Estimated Time:** 20 minutes

### 3. Builder Modal Wrapper Button Layout
**File:** `app/builders/page.tsx` (lines 137-165)
**Issue:** Horizontal button layout could overflow
```typescript
<div className="flex gap-4 items-center">
  <button className="copy-button copy-button-secondary mb-4">Bulk registration</button>
  <button className="copy-button mb-4">Become a Builder</button>
</div>
```
**Problems:**
- No responsive stacking for buttons
- Could cause horizontal overflow on small screens

**Fix Complexity:** ⭐ (Very Easy)
**Estimated Time:** 10 minutes

## Medium Complexity

### 4. Data Filters Layout
**File:** `components/ui/data-filters.tsx` (lines 44-88)
**Issue:** Filter controls don't stack responsively
```typescript
<div className={`flex gap-4 mb-6 ${className}`}>
  <div className="w-64 space-y-2">...</div>
  <div className="w-48 space-y-2">...</div>
  <div className="w-48 space-y-2">...</div>
</div>
```
**Problems:**
- Fixed widths (`w-64`, `w-48`) don't work well on mobile
- `flex gap-4` causes horizontal overflow
- No responsive stacking or width adjustments

**Fix Complexity:** ⭐⭐ (Easy-Medium)
**Estimated Time:** 45 minutes

### 5. Project Header Layout
**File:** `components/staking/project-header.tsx` (lines 160-251)
**Issue:** Fixed image size and horizontal layout
```typescript
<div className="flex items-start gap-6">
  <div className="relative size-24 rounded-xl overflow-hidden bg-white/[0.05]">
    {/* Image content */}
  </div>
  <div className="flex-1">...</div>
</div>
```
**Problems:**
- `size-24` (96px) image might be too large on small screens
- `gap-6` could be too much spacing on mobile
- No responsive image sizing or layout stacking

**Fix Complexity:** ⭐⭐ (Easy-Medium)
**Estimated Time:** 30 minutes

### 6. Staking Form Cards Input Layout
**File:** `components/staking/staking-form-card.tsx`, `components/staking/withdrawal-position-card.tsx`
**Issue:** Input fields with absolute positioned elements
```typescript
<div className="relative">
  <Input className="pr-32" />
  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
    <span className="text-xs text-gray-400 mr-2">{maxAmount} {tokenSymbol}</span>
    <button className="h-8 px-2 text-xs copy-button-secondary">Max</button>
  </div>
</div>
```
**Problems:**
- Fixed padding `pr-32` might not work on all screen sizes
- Absolute positioned content could overlap on small screens
- Text size might be too small on mobile

**Fix Complexity:** ⭐⭐ (Easy-Medium)
**Estimated Time:** 1 hour

### 7. Staking Actions Grid Layout
**File:** `app/builders/[slug]/page.tsx` (lines 1047-1077)
**Issue:** Complex conditional grid layouts
```typescript
// Admin layout - 3/5 and 2/5 split
<div className="grid grid-cols-1 md:grid-cols-5 gap-8">
  <div className="md:col-span-3 space-y-4">...</div>
  <div className="md:col-span-2">...</div>
</div>

// Non-admin layout - 1/2 and 1/2 split  
<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
  {StakeFormWithGlow}
  {WithdrawalCardWithGlow}
</div>
```
**Problems:**
- Complex conditional layouts might not work well on all screen sizes
- Grid spans could be better optimized for tablet sizes
- Gap spacing might need adjustment

**Fix Complexity:** ⭐⭐ (Medium)
**Estimated Time:** 1.5 hours

## High Complexity

### 8. Builder Page Metric Cards Grid
**File:** `app/builders/page.tsx` (lines 1159-1215)
**Issue:** Complex responsive grid with custom classes
```typescript
<div className="page-grid">
  <div className="relative">...</div>
  <div className="relative">...</div>
  <div className="relative col-span-2">...</div>
</div>
```
**Problems:**
- Uses custom `page-grid` class (definition not visible)
- `col-span-2` layout might not be ideal for all screen sizes
- Multiple GlowingEffect components add complexity
- Need to understand the custom CSS classes

**Fix Complexity:** ⭐⭐⭐ (Medium-Hard)
**Estimated Time:** 2 hours

### 9. Data Tables
**File:** `app/builders/page.tsx` (lines 410-712, 952-1156)
**Issue:** Multiple complex tables with many columns
```typescript
const buildersColumns: Column<Builder>[] = [
  { id: "name", header: "Name" },
  { id: "networks", header: "Networks" },
  { id: "totalStaked", header: "MOR Staked" },
  { id: "stakingCount", header: "# Staking" },
  { id: "lockPeriod", header: "Lock period" },
  { id: "minDeposit", header: "Min MOR Deposit" },
  { id: "actions", header: "Actions" }
];
```
**Problems:**
- 7+ columns in builders table won't fit on mobile screens
- No responsive strategy (horizontal scroll, column hiding, card view)
- Table headers and cells need mobile-specific styling
- Action buttons (`w-24 flex justify-center`) might be too small for touch
- HoverCard components might not work well on mobile

**Fix Complexity:** ⭐⭐⭐⭐ (Hard)
**Estimated Time:** 4-6 hours

### 10. Tabbed Interface with Complex State Management
**File:** `app/builders/page.tsx` (lines 1221-1419)
**Issue:** Complex tabbed interface with multiple layouts
```typescript
<div className="flex justify-between items-center align-middle mb-4">
  <div className="flex flex-row items-center gap-4 align-middle">
    <h2 className="flex section-title">Explore</h2>
    <TabsList className="flex h-auto rounded-none border-b border-gray-800 bg-transparent p-0 -mt-3">
      <TabsTrigger>Builders</TabsTrigger>
      <TabsTrigger>Staking in</TabsTrigger>  
      <TabsTrigger>Your Subnets</TabsTrigger>
    </TabsList>
  </div>
  <BuilderModalWrapper />
</div>
```
**Problems:**
- Header uses `flex justify-between` which could break with long tab names
- Each tab has different filter layouts and data tables
- Tab content includes complex DataFilters + DataTable combinations
- Multiple state management for filters across tabs
- Modal components (StakeModal) need mobile optimization
- URL parameter management for filters and tabs

**Fix Complexity:** ⭐⭐⭐⭐⭐ (Very Hard)
**Estimated Time:** 8-12 hours

## Summary

**Total Issues Found:** 10
- **Easy Fixes:** 3 issues (~45 minutes total)
- **Medium Complexity:** 4 issues (~4 hours total) 
- **High Complexity:** 3 issues (~14-20 hours total)

**Recommended Approach:**
1. Start with easy fixes to get quick wins
2. Tackle medium complexity issues to improve core usability
3. Plan dedicated sprints for high complexity items (especially data tables and tabbed interface)

**Key Mobile Optimization Strategies Needed:**
- Responsive grid layouts with proper breakpoints
- Input field optimization for touch interfaces
- Table responsive strategies (horizontal scroll, column hiding, or card views)
- Modal and overlay positioning for mobile
- Touch-friendly button sizes and spacing
- Typography scaling for mobile readability 