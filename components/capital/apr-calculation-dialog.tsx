"use client";

import { ExternalLink } from "lucide-react";
import { LiquidButton } from "@/components/ui/shadcn-io/liquid-button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const APR_FULL_BREAKDOWN_URL =
  "https://github.com/MorpheusAIs/dashboard-v2/blob/main/docs/APR_CALCULATION_EXPLANATION.md";

const APR_REFERENCES = [
  {
    label: "Protocol Yield Generation",
    href: "https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/protocol-yield-generation",
  },
  {
    label: "MOR Distribution Step #1",
    href: "https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/guides/mor-distribution.-step-1",
  },
  {
    label: "V7 Protocol Contracts",
    href: "https://gitbook.mor.org/smart-contracts/documentation/distribution-protocol/v7-protocol/contracts",
  },
] as const;

export function AprCalculationDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <LiquidButton size="sm" variant="ghost" className="rounded-lg shrink-0">
          How's APR calculated?
        </LiquidButton>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How is APR calculated?</DialogTitle>
          <DialogDescription>
            Daily MOR rewards are shared by the yield each asset actually generates — not just how much is deposited.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-3 text-sm text-muted-foreground list-disc pl-5">
          <li>
            Higher-yielding assets (for example USDT on Aave versus wETH) receive a larger share of daily MOR, so they show a higher APR even with the same USD deposited.
          </li>
          <li>
            For each asset, the protocol measures USD yield, splits daily MOR emissions by those shares, then annualizes: (daily MOR × 365) ÷ total deposited.
          </li>
          <li>
            Other assets&apos; yields — not their TVL — can change your asset&apos;s share. More deposits in the same asset spread the same rewards thinner.
          </li>
          <li>
            APR can move day to day as yields, deposits, and MOR emissions change. Emissions also decay over time.
          </li>
        </ul>

        <div className="space-y-2">
          <p className="text-sm font-medium text-white">References</p>
          <ul className="space-y-1.5">
            {APR_REFERENCES.map((reference) => (
              <li key={reference.href}>
                <a
                  href={reference.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-500 hover:text-emerald-400 hover:underline hover:underline-offset-3 inline-flex items-center gap-1 text-sm"
                >
                  {reference.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter className="sm:justify-between sm:items-center gap-3">
          <a
            href={APR_FULL_BREAKDOWN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:text-emerald-400 hover:underline hover:underline-offset-3 inline-flex items-center gap-1.5 text-sm font-medium"
          >
            Read full breakdown
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <DialogClose className="bg-white text-black px-4 py-2 rounded-md font-medium hover:bg-gray-100 transition-colors">
            I understand
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
