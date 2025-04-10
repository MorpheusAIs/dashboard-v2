import { z } from "zod";
import { zeroAddress, isAddress } from "viem";
import { Option } from "@/components/ui/multiple-selector";

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
  fee: z.number().min(0, "Fee must be non-negative").max(10000, "Fee cannot exceed 100% (10000 basis points)"),
  // Refined address validation: Must be a valid address AND not the zero address
  feeTreasury: z.string()
    .min(1, "Fee Treasury address is required") // Basic required check
    .regex(ETH_ADDRESS_REGEX, "Invalid Ethereum address format")
    .refine((val) => val !== zeroAddress, "Fee Treasury cannot be the zero address")
    .refine((val) => isAddress(val), "Invalid Ethereum address checksum"), // isAddress checks checksum
  startsAt: z.date({ required_error: "Stake start date is required" }),
  withdrawLockPeriod: z.number().min(1, "Withdraw lock period must be at least 1"),
  withdrawLockUnit: z.enum(["hours", "days"]),
  maxClaimLockEnd: z.date({ required_error: "Max claim lock end date is required" }),
  networkChainId: z.number({ required_error: "Please select a network" }),
});

// Step 2: Project Metadata Schema
export const metadataContractSchema = z.object({
  slug: z.string()
    .min(3, "Slug must be at least 3 characters")
    .max(120, "Slug must be 120 characters or less")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens"),
  description: z.string()
    .min(10, "Description must be at least 10 characters")
    .max(800, "Description must be 800 characters or less"),
  website: z.string().url("Please enter a valid URL").min(1, "Project URL is required"),
  image: z.union([z.literal(''), z.string().url("Please enter a valid URL for the logo")]).optional(),
});

// Step 2: Project Off-Chain Schema
export const projectOffChainSchema = z.object({
   email: z.string().email("Please enter a valid email").optional().or(z.literal('')),
   discordLink: z.string().url("Please enter a valid Discord invite URL")
    .refine(url => url.startsWith('https://discord.gg/') || url.startsWith('https://discord.com/invite/'), {
       message: "URL must start with https://discord.gg/ or https://discord.com/invite/",
     })
     .optional().or(z.literal('')),
   twitterLink: z.string().url("Please enter a valid X/Twitter profile URL")
     .refine(url => url.startsWith('https://x.com/') || url.startsWith('https://twitter.com/'), {
       message: "URL must start with https://x.com/ or https://twitter.com/",
     })
     .optional().or(z.literal('')),
   rewards: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
 }).superRefine((data, ctx) => {
   if (!data.email && !data.discordLink && !data.twitterLink) {
     ctx.addIssue({
       code: z.ZodIssueCode.custom,
       message: "Please provide at least one contact method (Email, Discord, or X/Twitter)",
       path: ["email"],
     });
   }
 });

// Combined Form Schema
export const formSchema = z.object({
  subnet: subnetContractSchema,
  metadata: metadataContractSchema,
  projectOffChain: projectOffChainSchema,
});

// Type for form data
export type FormData = z.infer<typeof formSchema>; 