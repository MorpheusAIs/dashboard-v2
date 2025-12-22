import { z } from "zod";
import { Option } from "@/components/ui/multiple-selector";
import { base, baseSepolia } from 'wagmi/chains';

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

// Step 1: Pool Configuration Schema
export const subnetContractSchema = z.object({
  name: z.string().min(1, "Subnet name is required"),
  minStake: z.number().min(0, "Minimum stake must be a non-negative number"),
  withdrawLockPeriod: z.number().min(1, "Withdraw lock period must be at least 1"),
  withdrawLockUnit: z.enum(["hours", "days"]),
  networkChainId: z.number({ required_error: "Please select a network" }),
});

// Legacy schema - kept for backward compatibility but not used for v4 contracts
// V4 contracts (Base and Base Sepolia) use subnet.name and subnet.minStake directly
export const builderPoolSchema = z.object({
  name: z.string().min(1, "Pool name is required").optional(), // Not used for v4 contracts
  minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // Not used for v4 contracts
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
    .min(60, "Description must be at least 60 characters")
    .max(800, "Description must be 800 characters or less"),
  website: z.string()
    .min(1, "Project URL is required")
    .url("Please enter a valid URL"),
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
    withdrawLockPeriod: z.number().min(1, "Withdraw lock period is required."),
    withdrawLockUnit: z.enum(["days", "hours"]),
  }),
  builderPool: z.object({ // Legacy fields - not used for v4 contracts (Base and Base Sepolia)
    name: z.string().optional(), // V4 contracts use subnet.name instead
    minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // V4 contracts use subnet.minStake instead
  }).optional(), 
  metadata: metadataContractSchema,
  projectOffChain: projectOffChainSchema,
}).superRefine((data, ctx) => {
  // V4 contracts: Both Base and Base Sepolia use subnet.name and subnet.minStake
  // No longer support Arbitrum mainnet - only Base and Base Sepolia with v4 contracts
  
  // Cross-field validation for withdrawLockPeriod on v4 networks
  // Apply 1 hour minimum to both Base mainnet and Base Sepolia testnet
  if (data.subnet.networkChainId === base.id || data.subnet.networkChainId === baseSepolia.id) {
    const withdrawLockSeconds = calculateSecondsForLockPeriod(data.subnet.withdrawLockPeriod, data.subnet.withdrawLockUnit);
    // Assuming minimalWithdrawLockPeriod on chain is 3600 (1 hour)
    if (withdrawLockSeconds < 3600) {
      const networkName = data.subnet.networkChainId === base.id ? 'Base mainnet' : 'Base Sepolia';
      ctx.addIssue({
        path: ["subnet", "withdrawLockPeriod"],
        message: `Withdraw lock period must be at least 1 hour for ${networkName}.`,
        code: z.ZodIssueCode.custom,
      });
    }
  }

  // V4 networks (Base and Base Sepolia) use subnet.name and subnet.minStake
  // No need to validate builderPool fields for v4 contracts
  // subnet.name is already validated in the base schema, so no additional validation needed here
});

// Helper function (if not already available to your Zod schema)
const calculateSecondsForLockPeriod = (period: number, unit: "hours" | "days"): number => {
  const secondsInHour = 3600;
  const secondsInDay = 86400;
  return unit === "hours" ? period * secondsInHour : period * secondsInDay;
};

// Type for form data
export type FormData = z.infer<typeof formSchema>; 