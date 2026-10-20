"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatUnits, zeroAddress } from "viem";
import { AssetIcon } from "@/components/icons";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCapitalContext, type AssetSymbol } from "@/context/CapitalPageContext";
import { useCapitalPoolData, estimateDailyMor } from "@/hooks/use-capital-pool-data";
import { useCapitalMetrics } from "@/app/hooks/useCapitalMetrics";
import { getContractAddress, type ContractAddresses, type NetworkEnvironment } from "@/config/networks";
import { getAssetsForNetwork } from "./constants/asset-config";
import { useLockMultiplierPreview } from "./hooks/use-lock-multiplier-preview";
import { formatLockDurationFromDays, getMaxLockSliderDays } from "@/lib/utils/power-factor-utils";
import {
  LOCK_PREVIEW_PRESETS,
  SECONDS_PER_DAY,
  formatMultiplier,
  formatPreviewDate,
  getClaimableFrom,
  getTotalMultiplier,
  getWithdrawableFrom,
  multiplierToNumber,
} from "@/lib/utils/lock-preview-utils";

const depositPoolMapping: Partial<Record<AssetSymbol, keyof ContractAddresses>> = {
  stETH: "stETHDepositPool",
  LINK: "linkDepositPool",
  USDC: "usdcDepositPool",
  USDT: "usdtDepositPool",
  wBTC: "wbtcDepositPool",
  wETH: "wethDepositPool",
};

function parseAprValue(apr: string | undefined): number | null {
  if (!apr || apr === "N/A" || apr === "Coming Soon") return null;
  const value = Number.parseFloat(apr.replace("%", ""));
  return Number.isFinite(value) ? value : null;
}

function toDateInputValue(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
}

function ResultRow({ label, value, hint, emphasis }: { label: ReactNode; value: ReactNode; hint?: ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span className="text-gray-300">{label}</span>
      <div className="text-right shrink-0">
        <div className={cn("font-medium", emphasis ? "text-emerald-400 text-base" : "text-white")}>{value}</div>
        {hint && <div className="text-xs text-gray-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

export function LockMultiplierPreview() {
  const { userAddress, l1ChainId, selectedAsset: contextSelectedAsset } = useCapitalContext();

  const networkEnv = useMemo((): NetworkEnvironment => {
    return [1, 42161, 8453].includes(l1ChainId || 0) ? "mainnet" : "testnet";
  }, [l1ChainId]);

  const assetOptions = useMemo(() => {
    const chainId = networkEnv === "mainnet" ? 1 : 11155111;
    return getAssetsForNetwork(networkEnv)
      .filter((asset) => {
        const contractKey = depositPoolMapping[asset.metadata.symbol];
        const hasDepositPool = contractKey && getContractAddress(chainId, contractKey, networkEnv);
        return hasDepositPool && !asset.metadata.disabled && asset.metadata.symbol !== "wBTC";
      })
      .map((asset) => asset.metadata);
  }, [networkEnv]);

  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>(contextSelectedAsset);
  const [lockDays, setLockDays] = useState(365);
  const [debouncedLockDays, setDebouncedLockDays] = useState(365);
  const [hasReferral, setHasReferral] = useState(false);
  const [amount, setAmount] = useState("");
  // Held fixed so on-chain reads use one lock start; the curve moves by days, not seconds
  const [now] = useState(() => Math.floor(Date.now() / 1000));
  const maxDays = useMemo(() => getMaxLockSliderDays(), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedLockDays(lockDays), 150);
    return () => window.clearTimeout(timer);
  }, [lockDays]);

  const selectedMetadata = assetOptions.find((asset) => asset.symbol === selectedAsset) ?? assetOptions[0];
  const asset = selectedMetadata?.symbol ?? selectedAsset;
  const decimals = selectedMetadata?.decimals ?? 18;

  const preview = useLockMultiplierPreview({
    asset,
    lockDays: debouncedLockDays,
    maxDays,
    now,
    l1ChainId,
    networkEnv,
    userAddress,
  });

  const { morPrice } = useCapitalMetrics();
  const poolData = useCapitalPoolData({ morPrice: morPrice || undefined });
  const pool = poolData.assets[asset];
  const unlockedApr = parseAprValue(pool?.apr);

  const nowBigInt = BigInt(now);
  const lockEnd = nowBigInt + BigInt(lockDays * SECONDS_PER_DAY);
  const isLockMultiplierPending = preview.isLoadingLockMultiplier || debouncedLockDays !== lockDays;

  // --- New deposit ---
  const totalMultiplierRaw = preview.lockMultiplier !== undefined ? getTotalMultiplier(preview.lockMultiplier, hasReferral) : undefined;
  const totalMultiplier = totalMultiplierRaw !== undefined ? multiplierToNumber(totalMultiplierRaw) : undefined;
  const depositAmount = Number.parseFloat(amount) || 0;
  const yourApr = unlockedApr !== null && totalMultiplier !== undefined ? unlockedApr * totalMultiplier : null;
  const dailyMor = totalMultiplier !== undefined ? estimateDailyMor(pool, depositAmount * totalMultiplier, true) : 0;

  const position = preview.position;
  const lastClaim = position?.lastClaim ?? BigInt(0);
  const newDepositClaimableFrom = preview.lockPeriods
    ? getClaimableFrom(lockEnd, { lastStake: nowBigInt, lastClaim }, preview.lockPeriods)
    : undefined;
  const newDepositWithdrawableFrom = preview.lockPeriods ? getWithdrawableFrom(nowBigInt, preview.lockPeriods) : undefined;

  // --- Extending an existing position with lockClaim ---
  const hasPosition = !!position && position.deposited > BigInt(0);
  const positionHasReferrer = !!position && position.referrer !== zeroAddress;
  const canExtend = hasPosition && lockEnd > position.claimLockEnd;
  const extendedMultiplierRaw = preview.lockMultiplier !== undefined ? getTotalMultiplier(preview.lockMultiplier, positionHasReferrer) : undefined;
  const extendedMultiplier = extendedMultiplierRaw !== undefined ? multiplierToNumber(extendedMultiplierRaw) : undefined;
  const currentMultiplier = preview.currentUserMultiplier !== undefined ? multiplierToNumber(preview.currentUserMultiplier) : undefined;

  const positionDeposited = hasPosition ? Number(formatUnits(position.deposited, decimals)) : 0;
  const positionVirtual = hasPosition ? Number(formatUnits(position.virtualDeposited, decimals)) : 0;
  const currentDailyMor = hasPosition ? estimateDailyMor(pool, positionVirtual, false) : 0;
  // lockClaim re-weights the whole position, so swap its old virtual weight for the new one
  const poolWithoutPosition = pool
    ? { ...pool, totalVirtualDeposited: Math.max(0, (pool.totalVirtualDeposited ?? 0) - positionVirtual) }
    : undefined;
  const extendedDailyMor = hasPosition && extendedMultiplier !== undefined
    ? estimateDailyMor(poolWithoutPosition, positionDeposited * extendedMultiplier, true)
    : 0;
  const extendedClaimableFrom = hasPosition && preview.lockPeriods
    ? getClaimableFrom(lockEnd, position, preview.lockPeriods)
    : undefined;
  const positionWithdrawableFrom = hasPosition && preview.lockPeriods
    ? getWithdrawableFrom(position.lastStake, preview.lockPeriods)
    : undefined;

  const threshold = preview.noBoostThresholdDays;
  const isBelowThreshold = threshold !== undefined && lockDays < threshold;

  const formatApr = (value: number | null) => (value === null ? (pool?.apr ?? "—") : `${value.toFixed(2)}%`);
  const formatMorPerDay = (value: number) => `${value.toFixed(4)} MOR`;

  return (
    <div className="page-section mt-8">
      <div className="relative">
        <GlowingEffect
          spread={40}
          glow={true}
          disabled={false}
          proximity={64}
          inactiveZone={0.01}
          borderWidth={2}
          borderRadius="rounded-xl"
        />
        <div className="section-content group relative px-1 py-4 sm:p-6">
          <div className="section-content-gradient group-hover:bg-gradient-to-bl group-hover:from-emerald-400/10 group-hover:to-transparent" />
          <div className="p-4 md:p-6">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white">Lock Multiplier Preview</h2>
              <p className="text-sm text-gray-400 mt-1">
                See your multiplier and APR for any lock length before you deposit or extend a lock. Read from the contracts, no transaction needed.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Inputs */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white">Pool</Label>
                  <div className="flex flex-wrap gap-2">
                    {assetOptions.map((option) => (
                      <button
                        key={option.symbol}
                        type="button"
                        onClick={() => setSelectedAsset(option.symbol)}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
                          option.symbol === asset
                            ? "border-emerald-400 bg-emerald-500/10 text-white"
                            : "border-gray-700 text-gray-300 hover:bg-gray-800/25"
                        )}
                      >
                        <AssetIcon symbol={option.symbol} className="rounded-lg" size={18} />
                        {option.symbol}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-white">Lock length</Label>
                    <span className="text-sm text-emerald-400 font-medium">
                      {lockDays === 0 ? "No lock" : formatLockDurationFromDays(lockDays)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {LOCK_PREVIEW_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setLockDays(preset.days)}
                        className={cn(
                          "rounded-md border px-2 py-1.5 text-center transition-colors",
                          lockDays === preset.days
                            ? "border-emerald-400 bg-emerald-500/10"
                            : "border-gray-700 hover:bg-gray-800/25"
                        )}
                      >
                        <div className="text-sm text-white">{preset.label}</div>
                        <div className="text-[11px] text-gray-400">{formatMultiplier(preview.presetMultipliers[preset.days])}</div>
                      </button>
                    ))}
                  </div>
                  <Slider
                    min={0}
                    max={maxDays}
                    step={1}
                    value={[lockDays]}
                    onValueChange={(values) => setLockDays(values[0] ?? 0)}
                    showTooltip
                    tooltipContent={(value) => (value === 0 ? "No lock" : formatLockDurationFromDays(value))}
                    className="py-2"
                  />
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>0 days</span>
                    <span>~{formatLockDurationFromDays(maxDays)} ({formatMultiplier(preview.maxMultiplier)})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="lock-preview-end-date" className="text-xs text-gray-400 shrink-0">
                      Or lock until
                    </Label>
                    <Input
                      id="lock-preview-end-date"
                      type="date"
                      min={toDateInputValue(nowBigInt)}
                      max={toDateInputValue(nowBigInt + BigInt(maxDays * SECONDS_PER_DAY))}
                      value={toDateInputValue(lockEnd)}
                      onChange={(e) => {
                        const picked = Date.parse(`${e.target.value}T00:00:00Z`);
                        if (Number.isNaN(picked)) return;
                        // Round up so the resulting lock end lands on the picked date, not the day before
                        const days = Math.ceil((picked / 1000 - now) / SECONDS_PER_DAY);
                        setLockDays(Math.min(maxDays, Math.max(0, days)));
                      }}
                      className="h-9 bg-background border-gray-700 text-white [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label htmlFor="lock-preview-referral" className="text-sm font-medium text-white">
                      Deposit with a referral
                    </Label>
                    <p className="text-xs text-gray-400">A referrer adds +0.01× to your multiplier.</p>
                  </div>
                  <Switch id="lock-preview-referral" checked={hasReferral} onCheckedChange={setHasReferral} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lock-preview-amount" className="text-sm font-medium text-white">
                    Deposit amount <span className="text-xs text-gray-400 font-normal">(optional, for MOR/day)</span>
                  </Label>
                  <Input
                    id="lock-preview-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => {
                      if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value);
                    }}
                    className="bg-background border-gray-700 text-white"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4">
                  <h3 className="text-sm font-semibold text-emerald-400 mb-4">New deposit</h3>
                  <div className="space-y-3 text-sm">
                    <ResultRow
                      label="Lock multiplier"
                      value={isLockMultiplierPending && preview.lockMultiplier === undefined ? "Loading..." : formatMultiplier(preview.lockMultiplier)}
                    />
                    {hasReferral && <ResultRow label="Referral bonus" value="+0.01×" />}
                    <ResultRow label="Total multiplier" value={formatMultiplier(totalMultiplierRaw)} emphasis />
                    <ResultRow
                      label="Your APR"
                      value={formatApr(yourApr)}
                      hint={unlockedApr !== null ? `${unlockedApr.toFixed(2)}% at 1.00×` : undefined}
                    />
                    <ResultRow
                      label="MOR per day"
                      value={depositAmount > 0 ? formatMorPerDay(dailyMor) : "Enter an amount"}
                    />
                    <ResultRow label="Can claim from" value={formatPreviewDate(newDepositClaimableFrom)} />
                    <ResultRow label="Can withdraw from" value={formatPreviewDate(newDepositWithdrawableFrom)} />
                  </div>
                  {preview.lockMultiplierError && (
                    <p className="text-xs text-red-400 mt-3">Could not read the multiplier from the contract.</p>
                  )}
                </div>

                {hasPosition && (
                  <div className="rounded-lg border border-gray-700 p-4">
                    <h3 className="text-sm font-semibold text-white mb-4">Your {asset} position</h3>
                    <div className="space-y-3 text-sm">
                      <ResultRow
                        label="Current multiplier"
                        value={formatMultiplier(preview.currentUserMultiplier)}
                        hint={`Lock ends ${formatPreviewDate(position.claimLockEnd)}`}
                      />
                      {canExtend ? (
                        <>
                          <ResultRow
                            label={`Extend to ${formatPreviewDate(lockEnd)}`}
                            value={formatMultiplier(extendedMultiplierRaw)}
                            hint={positionHasReferrer ? "Includes your +0.01× referral bonus" : undefined}
                            emphasis
                          />
                          <ResultRow
                            label="APR after extending"
                            value={formatApr(unlockedApr !== null && extendedMultiplier !== undefined ? unlockedApr * extendedMultiplier : null)}
                            hint={
                              unlockedApr !== null && currentMultiplier !== undefined
                                ? `Now ${(unlockedApr * currentMultiplier).toFixed(2)}%`
                                : undefined
                            }
                          />
                          <ResultRow
                            label="MOR per day after extending"
                            value={formatMorPerDay(extendedDailyMor)}
                            hint={`Now ${formatMorPerDay(currentDailyMor)}`}
                          />
                          <ResultRow label="Can claim from" value={formatPreviewDate(extendedClaimableFrom)} />
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">
                          To preview extending with Lock Rewards, pick an end date after {formatPreviewDate(position.claimLockEnd)}.
                        </p>
                      )}
                      <ResultRow label="Can withdraw from" value={formatPreviewDate(positionWithdrawableFrom)} hint="Extending does not change this" />
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs leading-relaxed">
                  {threshold !== undefined && (
                    <p className={cn("rounded p-2 border", isBelowThreshold ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" : "text-gray-400 border-gray-800")}>
                      Locks shorter than about {threshold} days (~{formatLockDurationFromDays(threshold)}) currently get no boost: they stay at 1.00×.
                    </p>
                  )}
                  <p className="text-gray-500">
                    The multiplier depends on when you lock, not only how long. The curve is front-loaded toward the end of the emission period, so the same lock length earns less over time. It is capped at about 10.7×.
                  </p>
                  <p className="text-gray-500">
                    APR and MOR/day are estimates from current emissions, pool size and prices, and will change.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
