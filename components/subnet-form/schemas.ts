import { z } from "zod";
import { zeroAddress, isAddress } from "viem";
import { Option } from "@/components/ui/multiple-selector";
import { arbitrum, base } from 'wagmi/chains';

// Constants for form options
export const REWARD_OPTIONS: Option[] = [
  { label: 'Token Airdrop', value: 'token_airdrop' },
  { label: 'NFT Whitelist', value: 'nft_whitelist' },
  { label: 'Yield Boost', value: 'yield_boost' },
  { label: 'Governance Rights', value: 'governance_rights' },
  { label: 'Early Access', value: 'early_access' },
  { label: 'Exclusive Content', value: 'exclusive_content' },
];

export const FORM_STEPS = [
  { id: 1, title: "Pool Configuration", description: "Define core pool parameters", fields: ["subnet"] as const },
  { id: 2, title: "Project & Metadata", description: "Add descriptive info", fields: ["metadata", "projectOffChain"] as const },
];

// Regular expression for Ethereum addresses
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

// Step 1: Pool Configuration Schema
export const subnetContractSchema = z.object({
  name: z.string().min(1, "Subnet name is required"),
  minStake: z.number().min(0, "Minimum stake must be a non-negative number"),
  // Fee and Treasury are optional, only relevant/validated when present (i.e., on testnet)
  fee: z.number().min(0, "Fee must be non-negative").max(10000, "Fee cannot exceed 100% (10000 basis points)").optional(),
  feeTreasury: z.string()
    // .min(1, "Fee Treasury address is required") // Optional, so min(1) doesn't make sense here
    .regex(ETH_ADDRESS_REGEX, "Invalid Ethereum address format")
    .refine((val) => val !== zeroAddress, "Fee Treasury cannot be the zero address")
    .refine((val) => isAddress(val), "Invalid Ethereum address checksum")
    .optional(), 
  startsAt: z.date({ required_error: "Stake start date is required" }),
  withdrawLockPeriod: z.number().min(1, "Withdraw lock period must be at least 1"),
  withdrawLockUnit: z.enum(["hours", "days"]),
  maxClaimLockEnd: z.date({ required_error: "Max claim lock end date is required" }),
  networkChainId: z.number({ required_error: "Please select a network" }),
});

// Optional Step 1 extension for Mainnet: Builder Pool Configuration
export const builderPoolSchema = z.object({
  name: z.string().min(1, "Pool name is required").optional(), // Optional if subnet.name is used as fallback
  minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // Optional if subnet.minStake is used
});

// Step 2: Project Metadata Schema
export const metadataContractSchema = z.object({
  slug: z.union([
    z.literal(''),
    z.string()
      .min(3, "Slug must be at least 3 characters")
      .max(120, "Slug must be 120 characters or less")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
  ]).optional(), 
  description: z.string()
    // .min(10, "Description must be at least 10 characters") // Temp remove min
    .max(800, "Description must be 800 characters or less")
    .optional(), // Temp make optional
  website: z.string().url("Please enter a valid URL")
    // .min(1, "Project URL is required") // Temp remove min
    .optional(), // Temp make optional
  image: z.union([z.literal(''), z.string().url("Please enter a valid URL for the logo")]).optional(),
});

// Step 2: Project Off-Chain Schema
export const projectOffChainSchema = z.object({
   // email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
   email: z.string().optional(), // Temp simplify
   discordLink: z.string().optional(), // Temp simplify
   twitterLink: z.string().optional(), // Temp simplify
   /* // Original complex validation using union
   discordLink: z.union([
     z.literal(''), 
     z.string().url("Please enter a valid Discord invite URL")
       .startsWith('https://discord.gg/', { message: "URL must start with https://discord.gg/" })
       .or(z.string().url().startsWith('https://discord.com/invite/', { message: "URL must start with https://discord.com/invite/"}))
   ]).optional(),
   twitterLink: z.union([
     z.literal(''), 
     z.string().url("Please enter a valid X/Twitter profile URL")
       .startsWith('https://x.com/', { message: "URL must start with https://x.com/" })
       .or(z.string().url().startsWith('https://twitter.com/', { message: "URL must start with https://twitter.com/"}))
   ]).optional(),
   */
   rewards: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
 })
 /* // Temp remove superRefine
 .superRefine((data, ctx) => {
   if (!data.email && !data.discordLink && !data.twitterLink) {
     ctx.addIssue({
       code: z.ZodIssueCode.custom,
       message: "Please provide at least one contact method (Email, Discord, or X/Twitter)",
       path: ["email"],
     });
   }
 });
*/

// Combined Form Schema
export const formSchema = z.object({
  subnet: z.object({
    name: z.string().min(1, "Subnet name is required."),
    networkChainId: z.number(),
    minStake: z.number().min(0, "Minimum stake must be non-negative."),
    fee: z.number().optional(),
    feeTreasury: z.string().optional(),
    withdrawLockPeriod: z.number().min(1, "Withdraw lock period is required."),
    withdrawLockUnit: z.enum(["days", "hours"]),
    startsAt: z.date().refine(date => date.getTime() > new Date().getTime() - 24*60*60*1000, { // Allow selection of 'today', hook ensures future
        message: "Start date should be today or in the future."
    }),
    maxClaimLockEnd: z.date(),
  }),
  builderPool: z.object({ // For mainnet-specific fields that differ from 'subnet'
    name: z.string().optional(), // Made optional - validation handled in superRefine
    minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // Made optional - validation handled in superRefine
  }).optional(), 
  metadata: metadataContractSchema,
  projectOffChain: projectOffChainSchema,
}).superRefine((data, ctx) => {
  // Cross-field validation for withdrawLockPeriod on mainnet
  if (data.subnet.networkChainId === arbitrum.id || data.subnet.networkChainId === base.id) {
    const withdrawLockSeconds = calculateSecondsForLockPeriod(data.subnet.withdrawLockPeriod, data.subnet.withdrawLockUnit);
    // Assuming minimalWithdrawLockPeriod on chain is 604800 (7 days)
    if (withdrawLockSeconds < 604800) {
      ctx.addIssue({
        path: ["subnet", "withdrawLockPeriod"],
        message: "Withdraw lock period must be at least 7 days for mainnet.",
        code: z.ZodIssueCode.custom,
      });
    }
  }

  // Validate maxClaimLockEnd is after startsAt
  if (data.subnet.maxClaimLockEnd.getTime() <= data.subnet.startsAt.getTime()) {
    ctx.addIssue({
      path: ["subnet", "maxClaimLockEnd"],
      message: "Claim lock end date must be after the start date.",
      code: z.ZodIssueCode.custom,
    });
  }

  // Conditional validation for mainnet vs testnet names if they use different fields
  // This example assumes 'subnet.name' is used for testnet and 'builderPool.name' for mainnet.
  // If you use a single 'name' field in the form that maps to different contract fields, adjust accordingly.
  if (data.subnet.networkChainId === arbitrum.id || data.subnet.networkChainId === base.id) {
      // Mainnet validation: require builderPool fields
      if (!data.builderPool?.name || data.builderPool.name.trim() === "") {
          ctx.addIssue({
            path: ["builderPool", "name"], // Path to the mainnet name field
            message: "Pool name is required for mainnet.",
            code: z.ZodIssueCode.custom,
          });
      }
      if (data.builderPool?.minimalDeposit === undefined || data.builderPool.minimalDeposit < 0) {
          ctx.addIssue({
            path: ["builderPool", "minimalDeposit"], // Path to the mainnet deposit field
            message: "Minimal deposit is required for mainnet.",
            code: z.ZodIssueCode.custom,
          });
      }
  } else { // Testnet
      // Testnet validation: require subnet fields  
      if (!data.subnet.name || data.subnet.name.trim() === "") {
           ctx.addIssue({
            path: ["subnet", "name"], // Path to the testnet name field
            message: "Subnet name is required for testnet.",
            code: z.ZodIssueCode.custom,
          });
      }
  }
});

// Helper function (if not already available to your Zod schema)
const calculateSecondsForLockPeriod = (period: number, unit: "hours" | "days"): number => {
  const secondsInHour = 3600;
  const secondsInDay = 86400;
  return unit === "hours" ? period * secondsInHour : period * secondsInDay;
};

// Type for form data
export type FormData = z.infer<typeof formSchema>; 