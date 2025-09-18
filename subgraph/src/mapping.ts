import { BigInt, Bytes, log, store, Address, ethereum } from '@graphprotocol/graph-ts'
import { UserClaimed } from '../generated/StETHDepositPool/DepositPool'
import {
  UserClaimEvent,
  UserStakeEvent,
  UserWithdrawEvent,
  UserPoolStats,
  UserGlobalStats,
  PoolGlobalStats,
  DailyClaimStats,
  ActiveStakersCount
} from '../generated/schema'

// Constants
const ZERO_BI = BigInt.fromI32(0)
const ONE_BI = BigInt.fromI32(1)

// Pool type constants
const STETH_POOL_ADDRESS = "0xfea33a23f97d785236f22693edca564782ae98d0"
const LINK_POOL_ADDRESS = "0x7f4f17be21219d7da4c8e0d0b9be6a778354e5a5"

/**
 * Main event handler for UserClaimed events
 * Called whenever a user claims MOR rewards from either stETH or LINK pool
 */
export function handleUserClaimed(event: UserClaimed): void {
  log.info('Processing UserClaimed event: user={}, amount={}, poolId={}, contract={}', [
    event.params.user.toHexString(),
    event.params.amount.toString(),
    event.params.poolId.toString(),
    event.address.toHexString()
  ])

  // Determine pool type based on contract address
  const poolAddress = event.address
  const poolType = getPoolType(poolAddress)
  
  if (poolType === null) {
    log.warning('Unknown pool address: {}', [poolAddress.toHexString()])
    return
  }

  // Create unique event ID: txHash-logIndex
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()

  // Create UserClaimEvent entity
  createUserClaimEvent(event, eventId, poolType)

  // Update user pool statistics
  updateUserPoolStats(event, poolAddress, poolType)

  // Update user global statistics
  updateUserGlobalStats(event)

  // Update pool global statistics
  updatePoolGlobalStats(event, poolAddress, poolType)

  // Update daily statistics
  updateDailyClaimStats(event, poolAddress, poolType)

  log.info('Successfully processed UserClaimed event: {}', [eventId])
}

/**
 * Create individual UserClaimEvent entity
 */
function createUserClaimEvent(event: UserClaimed, eventId: string, poolType: string): void {
  let claimEvent = new UserClaimEvent(eventId)
  
  claimEvent.user = event.params.user
  claimEvent.receiver = event.params.receiver
  claimEvent.amount = event.params.amount
  claimEvent.poolId = event.params.poolId
  claimEvent.poolAddress = event.address
  claimEvent.poolType = poolType
  claimEvent.transactionHash = event.transaction.hash
  claimEvent.blockNumber = event.block.number
  claimEvent.blockTimestamp = event.block.timestamp
  claimEvent.logIndex = event.logIndex

  claimEvent.save()
}

/**
 * Update or create UserPoolStats for the specific user and pool
 */
function updateUserPoolStats(event: UserClaimed, poolAddress: Bytes, poolType: string): void {
  // ID format: userAddress-poolAddress
  const statsId = event.params.user.toHexString() + '-' + poolAddress.toHexString()
  let stats = UserPoolStats.load(statsId)

  if (stats === null) {
    // First claim from this pool for this user
    stats = new UserPoolStats(statsId)
    stats.user = event.params.user
    stats.poolAddress = poolAddress
    stats.poolType = poolType
    stats.totalClaimedAmount = ZERO_BI
    stats.claimCount = ZERO_BI
    stats.firstClaimTimestamp = event.block.timestamp
  }

  // Update aggregated data
  stats.totalClaimedAmount = stats.totalClaimedAmount.plus(event.params.amount)
  stats.claimCount = stats.claimCount.plus(ONE_BI)
  stats.lastClaimTimestamp = event.block.timestamp

  stats.save()
}

/**
 * Update or create UserGlobalStats (across all pools)
 */
function updateUserGlobalStats(event: UserClaimed): void {
  const userId = event.params.user.toHexString()
  let stats = UserGlobalStats.load(userId)

  if (stats === null) {
    // First claim ever for this user
    stats = new UserGlobalStats(userId)
    stats.totalClaimedAmount = ZERO_BI
    stats.totalClaimCount = ZERO_BI
    stats.firstClaimTimestamp = event.block.timestamp
    stats.activePools = []
  }

  // Update global aggregates
  stats.totalClaimedAmount = stats.totalClaimedAmount.plus(event.params.amount)
  stats.totalClaimCount = stats.totalClaimCount.plus(ONE_BI)
  stats.lastClaimTimestamp = event.block.timestamp

  // Update active pools list
  const poolType = getPoolType(event.address)
  if (poolType !== null) {
    let activePools = stats.activePools
    if (activePools.indexOf(poolType) === -1) {
      activePools.push(poolType)
      stats.activePools = activePools
    }
  }

  // Link to pool-specific stats
  const poolAddress = event.address
  const poolStatsId = event.params.user.toHexString() + '-' + poolAddress.toHexString()
  
  if (poolType === 'STETH') {
    stats.stETHPoolStats = poolStatsId
  } else if (poolType === 'LINK') {
    stats.linkPoolStats = poolStatsId
  }

  stats.save()
}

/**
 * Update or create PoolGlobalStats
 */
function updatePoolGlobalStats(event: UserClaimed, poolAddress: Bytes, poolType: string): void {
  const poolId = poolAddress.toHexString()
  let stats = PoolGlobalStats.load(poolId)

  if (stats === null) {
    // First claim ever from this pool
    stats = new PoolGlobalStats(poolId)
    stats.poolAddress = poolAddress
    stats.poolType = poolType
    stats.totalClaimedAmount = ZERO_BI
    stats.totalClaimCount = ZERO_BI
    stats.uniqueClaimers = ZERO_BI
    stats.firstClaimTimestamp = event.block.timestamp
  }

  // Update aggregates
  stats.totalClaimedAmount = stats.totalClaimedAmount.plus(event.params.amount)
  stats.totalClaimCount = stats.totalClaimCount.plus(ONE_BI)
  stats.lastClaimTimestamp = event.block.timestamp

  // Check if this is a new unique claimer
  const userPoolStatsId = event.params.user.toHexString() + '-' + poolAddress.toHexString()
  let userPoolStats = UserPoolStats.load(userPoolStatsId)
  
  if (userPoolStats !== null && userPoolStats.claimCount.equals(ONE_BI)) {
    // This is the user's first claim from this pool
    stats.uniqueClaimers = stats.uniqueClaimers.plus(ONE_BI)
  }

  stats.save()
}

/**
 * Update daily claim statistics
 */
function updateDailyClaimStats(event: UserClaimed, poolAddress: Bytes, poolType: string): void {
  // Get date in YYYY-MM-DD format
  const timestamp = event.block.timestamp.toI32()
  const day = timestamp / 86400 // seconds per day
  const dayStart = day * 86400
  const date = new Date(dayStart * 1000).toISOString().split('T')[0]

  // ID format: date-poolAddress
  const dailyId = date + '-' + poolAddress.toHexString()
  let dailyStats = DailyClaimStats.load(dailyId)

  if (dailyStats === null) {
    dailyStats = new DailyClaimStats(dailyId)
    dailyStats.date = date
    dailyStats.poolAddress = poolAddress
    dailyStats.poolType = poolType
    dailyStats.dailyClaimedAmount = ZERO_BI
    dailyStats.dailyClaimCount = ZERO_BI
    dailyStats.uniqueDailyClaimers = ZERO_BI
    
    // Initialize cumulative values from pool global stats
    const poolStats = PoolGlobalStats.load(poolAddress.toHexString())
    if (poolStats !== null) {
      dailyStats.cumulativeClaimedAmount = poolStats.totalClaimedAmount
      dailyStats.cumulativeClaimCount = poolStats.totalClaimCount
      dailyStats.cumulativeUniqueClaimers = poolStats.uniqueClaimers
    } else {
      dailyStats.cumulativeClaimedAmount = ZERO_BI
      dailyStats.cumulativeClaimCount = ZERO_BI
      dailyStats.cumulativeUniqueClaimers = ZERO_BI
    }
  }

  // Update daily aggregates
  dailyStats.dailyClaimedAmount = dailyStats.dailyClaimedAmount.plus(event.params.amount)
  dailyStats.dailyClaimCount = dailyStats.dailyClaimCount.plus(ONE_BI)

  // Update cumulative values (simplified - in production you'd want more precise calculation)
  dailyStats.cumulativeClaimedAmount = dailyStats.cumulativeClaimedAmount.plus(event.params.amount)
  dailyStats.cumulativeClaimCount = dailyStats.cumulativeClaimCount.plus(ONE_BI)

  dailyStats.save()
}

/**
 * Event handler for UserStaked events
 * Handles the first event type (0x04575...) with 61 events
 */
export function handleUserStaked(event: ethereum.Log): void {
  log.info('Processing UserStaked event: user={}, poolId={}, contract={}', [
    event.topics[2].toHexString(), // topic2 = user address
    event.topics[1].toHexString(), // topic1 = poolId  
    event.address.toHexString()
  ])

  const poolAddress = event.address
  const poolType = getPoolType(poolAddress)
  
  if (poolType === null) {
    log.warning('Unknown pool address in UserStaked: {}', [poolAddress.toHexString()])
    return
  }

  const user = Address.fromBytes(event.topics[2])
  const poolId = BigInt.fromUnsignedBytes(event.topics[1])
  
  // Decode amount from data field (first 32 bytes)
  const amount = BigInt.fromUnsignedBytes(event.data.subarray(0, 32))

  // Create unique event ID
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()

  // Create UserStakeEvent entity
  const stakeEvent = new UserStakeEvent(eventId)
  stakeEvent.user = user
  stakeEvent.amount = amount
  stakeEvent.poolId = poolId
  stakeEvent.poolAddress = poolAddress
  stakeEvent.poolType = poolType
  stakeEvent.transactionHash = event.transaction.hash
  stakeEvent.blockNumber = event.block.number
  stakeEvent.blockTimestamp = event.block.timestamp
  stakeEvent.logIndex = event.logIndex

  // Link to user pool stats
  const userPoolStatsId = user.toHexString() + '-' + poolAddress.toHexString()
  stakeEvent.userPoolStats = userPoolStatsId
  stakeEvent.save()

  // Update user pool stats with staking data
  updateUserPoolStatsStaking(user, poolAddress, poolType, amount, event.block.timestamp, true)
  
  // Update active stakers count
  updateActiveStakersCount()
}

/**
 * Event handler for UserWithdrawn events  
 * Handles the second event type (0xe2f0...) with 58 events
 */
export function handleUserWithdrawn(event: ethereum.Log): void {
  log.info('Processing UserWithdrawn event: user={}, poolId={}, contract={}', [
    event.topics[2].toHexString(), // topic2 = user address
    event.topics[1].toHexString(), // topic1 = poolId
    event.address.toHexString()
  ])

  const poolAddress = event.address
  const poolType = getPoolType(poolAddress)
  
  if (poolType === null) {
    log.warning('Unknown pool address in UserWithdrawn: {}', [poolAddress.toHexString()])
    return
  }

  const user = Address.fromBytes(event.topics[2])
  const poolId = BigInt.fromUnsignedBytes(event.topics[1])
  
  // Decode amount from data field (first 32 bytes)
  const amount = BigInt.fromUnsignedBytes(event.data.subarray(0, 32))

  // Create unique event ID
  const eventId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()

  // Create UserWithdrawEvent entity
  const withdrawEvent = new UserWithdrawEvent(eventId)
  withdrawEvent.user = user
  withdrawEvent.amount = amount
  withdrawEvent.poolId = poolId
  withdrawEvent.poolAddress = poolAddress
  withdrawEvent.poolType = poolType
  withdrawEvent.transactionHash = event.transaction.hash
  withdrawEvent.blockNumber = event.block.number
  withdrawEvent.blockTimestamp = event.block.timestamp
  withdrawEvent.logIndex = event.logIndex

  // Link to user pool stats
  const userPoolStatsId = user.toHexString() + '-' + poolAddress.toHexString()
  withdrawEvent.userPoolStats = userPoolStatsId
  withdrawEvent.save()

  // Update user pool stats with withdrawal data
  updateUserPoolStatsStaking(user, poolAddress, poolType, amount, event.block.timestamp, false)
  
  // Update active stakers count
  updateActiveStakersCount()
}

/**
 * Update user pool stats with staking/withdrawal data
 */
function updateUserPoolStatsStaking(
  user: Address,
  poolAddress: Bytes,
  poolType: string,
  amount: BigInt,
  timestamp: BigInt,
  isStake: boolean
): void {
  const userPoolStatsId = user.toHexString() + '-' + poolAddress.toHexString()
  let userPoolStats = UserPoolStats.load(userPoolStatsId)
  
  if (userPoolStats === null) {
    userPoolStats = new UserPoolStats(userPoolStatsId)
    userPoolStats.user = user
    userPoolStats.poolAddress = poolAddress
    userPoolStats.poolType = poolType
    
    // Initialize all fields
    userPoolStats.totalClaimedAmount = ZERO_BI
    userPoolStats.claimCount = ZERO_BI
    userPoolStats.firstClaimTimestamp = ZERO_BI
    userPoolStats.lastClaimTimestamp = ZERO_BI
    
    // Initialize staking fields
    userPoolStats.totalStakedAmount = ZERO_BI
    userPoolStats.totalWithdrawnAmount = ZERO_BI
    userPoolStats.currentStakedAmount = ZERO_BI
    userPoolStats.stakeCount = ZERO_BI
    userPoolStats.withdrawalCount = ZERO_BI
    userPoolStats.firstStakeTimestamp = ZERO_BI
    userPoolStats.lastStakeTimestamp = ZERO_BI
    userPoolStats.lastWithdrawalTimestamp = ZERO_BI
    userPoolStats.isActiveStaker = false
  }
  
  if (isStake) {
    // Handle staking
    userPoolStats.totalStakedAmount = userPoolStats.totalStakedAmount.plus(amount)
    userPoolStats.stakeCount = userPoolStats.stakeCount.plus(ONE_BI)
    userPoolStats.lastStakeTimestamp = timestamp
    
    if (userPoolStats.firstStakeTimestamp.equals(ZERO_BI)) {
      userPoolStats.firstStakeTimestamp = timestamp
    }
  } else {
    // Handle withdrawal
    userPoolStats.totalWithdrawnAmount = userPoolStats.totalWithdrawnAmount.plus(amount)
    userPoolStats.withdrawalCount = userPoolStats.withdrawalCount.plus(ONE_BI)
    userPoolStats.lastWithdrawalTimestamp = timestamp
  }
  
  // Update current staked amount and active status
  userPoolStats.currentStakedAmount = userPoolStats.totalStakedAmount.minus(userPoolStats.totalWithdrawnAmount)
  userPoolStats.isActiveStaker = userPoolStats.currentStakedAmount.gt(ZERO_BI)
  
  userPoolStats.save()
}

/**
 * Update global active stakers count
 */
function updateActiveStakersCount(): void {
  // Count global active stakers
  const globalStats = getOrCreateActiveStakersCount("global", null)
  
  // This is a simplified approach - in reality you'd query all UserPoolStats
  // with isActiveStaker = true, but for performance we'll update incrementally
  
  // For now, we'll recalculate periodically rather than on every event
  // This could be optimized further based on your needs
}

/**
 * Get or create ActiveStakersCount entity
 */
function getOrCreateActiveStakersCount(id: string, poolType: string | null): ActiveStakersCount {
  let entity = ActiveStakersCount.load(id)
  
  if (entity === null) {
    entity = new ActiveStakersCount(id)
    entity.activeStakers = ZERO_BI
    entity.poolType = poolType
    entity.lastUpdatedTimestamp = ZERO_BI
    entity.lastUpdatedBlock = ZERO_BI
  }
  
  return entity
}

/**
 * Helper function to determine pool type from contract address
 */
function getPoolType(address: Bytes): string | null {
  const addressString = address.toHexString().toLowerCase()
  
  if (addressString === STETH_POOL_ADDRESS.toLowerCase()) {
    return 'STETH'
  } else if (addressString === LINK_POOL_ADDRESS.toLowerCase()) {
    return 'LINK'
  }
  
  return null
}
