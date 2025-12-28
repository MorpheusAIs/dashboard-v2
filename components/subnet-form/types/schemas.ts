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
  { id: 1, title: "Configuration", description: "Define core parameters", fields: ["subnet"] as const },
  { id: 2, title: "Project Metadata", description: "Add project information", fields: ["metadata"] as const },
];

// Step 1: Pool Configuration Schema
export const subnetContractSchema = z.object({
  name: z.string().min(1, "Subnet name is required"),
  minStake: z.number().min(0, "Minimum stake must be a non-negative number"),
  withdrawLockPeriod: z.number().min(7, "Withdraw lock period must be at least 7 days"),
  networkChainId: z.number({ required_error: "Please select a network" }),
  claimAdmin: z.string().refine((val) => {
    if (!val || val.trim() === '') return false;
    // Basic Ethereum address validation (0x followed by 40 hex characters)
    return /^0x[a-fA-F0-9]{40}$/.test(val);
  }, "Please enter a valid Ethereum address"),
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
    .min(1, "Description is required")
    .max(3000, "Description must be 3000 characters or less"),
  website: z.string()
    .min(1, "Project URL is required")
    .url("Please enter a valid URL"),
  image: z.union([z.literal(''), z.string().url("Please enter a valid URL for the logo")]).optional(),
  extended: z.object({
    description: z.string().optional(),
    author: z.string().optional(),
    xUrl: z.string().url().optional().or(z.literal('')),
    githubUrl: z.string().url().optional().or(z.literal('')),
    type: z.string().optional(),
    inputType: z.string().optional(),
    outputType: z.string().optional(),
    docsUrl: z.string().url().optional().or(z.literal('')),
    skills: z.array(z.string()).optional(),
    category: z.string().optional(),
  }).optional(),
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
    type: z.enum(["App", "Agent", "MCP server", "API"]).default("App"),
    networkChainId: z.number(),
    minStake: z.number().min(0, "Minimum stake must be non-negative."),
    withdrawLockPeriod: z.number().min(7, "Withdraw lock period must be at least 7 days."),
    claimAdmin: z.string().refine((val) => {
      if (!val || val.trim() === '') return false;
      // Basic Ethereum address validation (0x followed by 40 hex characters)
      return /^0x[a-fA-F0-9]{40}$/.test(val);
    }, "Please enter a valid Ethereum address"),
  }),
  builderPool: z.object({ // Legacy fields - not used for v4 contracts (Base and Base Sepolia)
    name: z.string().optional(), // V4 contracts use subnet.name instead
    minimalDeposit: z.number().min(0, "Minimal deposit must be non-negative").optional(), // V4 contracts use subnet.minStake instead
  }).optional(),
  metadata: metadataContractSchema,
  // projectOffChain is no longer required for v4 contracts since metadata is stored on-chain
  projectOffChain: projectOffChainSchema.optional(),
}).superRefine((data, ctx) => {
  // V4 contracts: Both Base and Base Sepolia use subnet.name and subnet.minStake
  // No longer support Arbitrum mainnet - only Base and Base Sepolia with v4 contracts

  // Cross-field validation for withdrawLockPeriod on v4 networks
  // Apply 7 day minimum for both Base mainnet and Base Sepolia testnet
  if (data.subnet.networkChainId === base.id || data.subnet.networkChainId === baseSepolia.id) {
    const withdrawLockSeconds = data.subnet.withdrawLockPeriod * 86400; // Convert days to seconds
    // Minimum is 7 days = 604800 seconds
    if (withdrawLockSeconds < 604800) {
      const networkName = data.subnet.networkChainId === base.id ? 'Base mainnet' : 'Base Sepolia';
      ctx.addIssue({
        path: ["subnet", "withdrawLockPeriod"],
        message: `Withdraw lock period must be at least 7 days for ${networkName}.`,
        code: z.ZodIssueCode.custom,
      });
    }
  }

  // Conditional validation for description based on subnet type
  if (data.subnet.type === "App") {
    // For App type, description should be a regular text description
    if (!data.metadata.description || data.metadata.description.length < 60) {
      ctx.addIssue({
        path: ["metadata", "description"],
        message: "Description must be at least 60 characters for App type.",
        code: z.ZodIssueCode.custom,
      });
    }
  } else {
    // For non-App types, description can be JSON or regular text
    // The length check is already handled by the base schema (min 1, max 2000)
    // We can add additional validation here if needed
  }

  // V4 networks (Base and Base Sepolia) use subnet.name and subnet.minStake
  // No need to validate builderPool fields for v4 contracts
  // subnet.name is already validated in the base schema, so no additional validation needed here
});


// Type for form data
export type FormData = z.infer<typeof formSchema>; 