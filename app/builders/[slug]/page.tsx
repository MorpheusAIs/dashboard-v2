"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { NetworkIcon } from '@web3icons/react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { builders, Builder } from "../builders-data";

// Function to extract domain from URL
const extractDomain = (url: string): string => {
  try {
    // Remove protocol and www if present
    const domain = new URL(url).hostname.replace(/^www\./, '');
    return domain;
  } catch {
    // Return original URL if parsing fails
    return url;
  }
};

interface StakingEntry {
  address: string;
  amount: number;
  timestamp: number;
  unlockDate: number;
}

// Mock data for staking entries
const mockStakingEntries: StakingEntry[] = [
  {
    address: "0x1234...5678",
    amount: 1000,
    timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, // 15 days ago
    unlockDate: Date.now() + 15 * 24 * 60 * 60 * 1000, // 15 days from now
  },
  {
    address: "0x8765...4321",
    amount: 2500,
    timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
    unlockDate: Date.now() + 10 * 24 * 60 * 60 * 1000,
  },
  // Add more mock entries as needed
];

export default function BuilderPage() {
  const { slug } = useParams();
  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [userStakedAmount] = useState(1000); // Mock user's staked amount
  const [timeLeft] = useState("15 days"); // Mock time left until unlock
  
  // Find the builder based on the slug
  const builder = builders.find((b: Builder) => b.name.toLowerCase().replace(/\s+/g, '-') === slug);

  if (!builder) {
    return <div className="p-8">Builder not found</div>;
  }

  // Use the networks from the builder data
  const networksToDisplay = builder.networks || ['Base']; // Default to Base if not specified

  const handleStake = () => {
    // Implement staking logic here
    console.log("Staking:", stakeAmount);
  };

  const handleWithdraw = () => {
    // Implement withdrawal logic here
    console.log("Withdrawing:", withdrawAmount);
  };

  return (
    <div className="page-container">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Builder Header */}
        <div className="flex items-start gap-6">
          <div className="relative size-24 rounded-xl overflow-hidden bg-white/[0.05]">
            {builder.localImage && builder.localImage !== '' ? (
              <Image
                src={`/${builder.localImage}`}
                alt={builder.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex items-center justify-center size-24 bg-emerald-700 text-white text-4xl font-medium">
                {builder.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-100 mb-2">{builder.name}</h1>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex -space-x-1">
                {networksToDisplay.map((network: string) => (
                  <div key={network} className="relative">
                    <NetworkIcon name={network.toLowerCase()} size={24} />
                  </div>
                ))}
              </div>
              <span className="text-gray-400">|</span>
              <span className="text-gray-300">{builder.rewardType}</span>
              {builder.website && (
                <>
                  <span className="text-gray-400">|</span>
                  <a 
                    href={builder.website} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-emerald-500 hover:text-emerald-400 hover:underline hover:underline-offset-3"
                  >
                    {extractDomain(builder.website)}
                  </a>
                </>
              )}
            </div>
            <p className="text-gray-400 max-w-2xl">
              {builder.description || `This is a mock description for ${builder.name}. In a real implementation, 
              this would contain detailed information about the builder's project, 
              their goals, and what users get in return for staking.`}
            </p>
          </div>
        </div>

        {/* Staking Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Total Staked</CardTitle>
              <CardDescription>Current total MOR staked</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">
                {builder.totalStaked.toLocaleString()} MOR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Lock Period</CardTitle>
              <CardDescription>Required locking duration</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">{builder.lockPeriod}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Minimum Deposit</CardTitle>
              <CardDescription>Minimum required MOR</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-gray-100">{builder.minDeposit} MOR</p>
            </CardContent>
          </Card>
        </div>

        {/* Staking Actions */}
        <div className="grid grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Stake MOR</CardTitle>
              <CardDescription>Lock your MOR tokens to support this builder</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="stake-amount">Amount to stake</Label>
                  <Input
                    id="stake-amount"
                    placeholder="Enter MOR amount"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleStake}
                  className="w-full"
                >
                  Stake MOR
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Position</CardTitle>
              <CardDescription>Manage your staked MOR</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">Your staked amount:</span>
                  <span className="text-gray-200">{userStakedAmount} MOR</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-gray-400">Time until unlock:</span>
                  <span className="text-gray-200">{timeLeft}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount">Amount to withdraw</Label>
                  <Input
                    id="withdraw-amount"
                    placeholder="Enter MOR amount"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                  />
                </div>
                <Button 
                  onClick={handleWithdraw}
                  className="w-full"
                  variant="outline"
                >
                  Withdraw MOR
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staking Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Stakers</CardTitle>
            <CardDescription>List of addresses staking MOR</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-white/[0.08]">
                  <TableHead className="text-sm font-medium text-gray-400">Address</TableHead>
                  <TableHead className="text-sm font-medium text-gray-400">Amount Staked</TableHead>
                  <TableHead className="text-sm font-medium text-gray-400">Stake Date</TableHead>
                  <TableHead className="text-sm font-medium text-gray-400">Unlock Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStakingEntries.map((entry, index) => (
                  <TableRow 
                    key={index}
                    className="border-b border-white/[0.08] hover:bg-emerald-400/10 transition-colors"
                  >
                    <TableCell className="font-mono">{entry.address}</TableCell>
                    <TableCell>{entry.amount.toLocaleString()} MOR</TableCell>
                    <TableCell>{new Date(entry.timestamp).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(entry.unlockDate).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 