import { useState, useEffect, useRef } from "react";
import type { RewardSnapshot } from "../types/user-asset";

// Hook for calculating daily emissions based on reward accumulation rate
export function useDailyEmissions(
  currentReward: bigint | undefined, 
  userDeposited: bigint | undefined,
  assetSymbol: string,
  networkEnv: string
): number {
  const rewardSnapshotsRef = useRef<RewardSnapshot[]>([]);
  const [dailyEmissions, setDailyEmissions] = useState<number>(0);

  useEffect(() => {
    // Only calculate for testnet (Sepolia) where we have real contract data
    if (networkEnv !== 'testnet' || !currentReward || !userDeposited || userDeposited === BigInt(0)) {
      setDailyEmissions(0);
      rewardSnapshotsRef.current = [];
      return;
    }

    const now = Date.now();
    const snapshots = rewardSnapshotsRef.current;
    
    // Add current snapshot
    snapshots.push({
      timestamp: now,
      reward: currentReward
    });
    
    // Keep only last 10 minutes of snapshots (should have ~40 data points with 15s intervals)
    const tenMinutesAgo = now - (10 * 60 * 1000);
    rewardSnapshotsRef.current = snapshots.filter(s => s.timestamp > tenMinutesAgo);
    
    // Need at least 2 snapshots that are at least 2 minutes apart to calculate rate
    const validSnapshots = rewardSnapshotsRef.current;
    if (validSnapshots.length < 2) {
      console.log(`📊 [${assetSymbol}] Insufficient data for daily emissions calculation:`, validSnapshots.length);
      return;
    }
    
    // Find oldest snapshot that's at least 2 minutes old
    const twoMinutesAgo = now - (2 * 60 * 1000);
    const oldSnapshot = validSnapshots.find(s => s.timestamp <= twoMinutesAgo);
    const latestSnapshot = validSnapshots[validSnapshots.length - 1];
    
    if (!oldSnapshot) {
      console.log(`📊 [${assetSymbol}] No snapshot old enough for reliable calculation`);
      return;
    }
    
    // Calculate reward accumulation rate
    const rewardDiff = latestSnapshot.reward - oldSnapshot.reward;
    const timeDiffMs = latestSnapshot.timestamp - oldSnapshot.timestamp;
    const timeDiffSeconds = timeDiffMs / 1000;
    
    if (timeDiffSeconds <= 0) return;
    
    // Calculate daily rate: (MOR per second) * (seconds per day)
    const rewardPerSecond = Number(rewardDiff) / (10**18) / timeDiffSeconds; // Convert from wei to ether
    const dailyRate = rewardPerSecond * (24 * 60 * 60); // Seconds in a day
    
    // Only update if the calculated rate is reasonable (> 0 and < 1000 MOR/day per user)
    if (dailyRate > 0 && dailyRate < 1000) {
      setDailyEmissions(dailyRate);
      console.log(`📊 [${assetSymbol}] Daily emissions calculated:`, {
        rewardDiff: Number(rewardDiff) / (10**18),
        timeDiffMinutes: timeDiffSeconds / 60,
        rewardPerSecond,
        dailyRate,
        snapshotCount: validSnapshots.length
      });
    } else if (dailyRate > 0) {
      // For very high rates, might indicate testnet accelerated rewards
      const adjustedRate = Math.min(dailyRate / 1440, 100); // Assume 1440x acceleration (1 minute = 1 day)
      setDailyEmissions(adjustedRate);
      console.log(`📊 [${assetSymbol}] Adjusted daily emissions for testnet acceleration:`, {
        originalRate: dailyRate,
        adjustedRate,
        accelerationFactor: 1440
      });
    }
  }, [currentReward, userDeposited, assetSymbol, networkEnv]);

  return dailyEmissions;
}
