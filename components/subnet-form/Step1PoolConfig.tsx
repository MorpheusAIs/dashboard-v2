import React, { useState, useEffect } from 'react';
import { format } from "date-fns";
import { CalendarIcon, Wallet } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { ArbitrumSepoliaIcon } from './constants';
import { zeroAddress } from 'viem';
import { useAccount } from 'wagmi';
import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";

interface Step1PoolConfigProps {
  isSubmitting: boolean;
  tokenSymbol: string;
}

export const Step1PoolConfig: React.FC<Step1PoolConfigProps> = ({ isSubmitting, tokenSymbol }) => {
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [claimLockEndsPopoverOpen, setClaimLockEndsPopoverOpen] = useState(false);
  const form = useFormContext();
  const { address } = useAccount();

  // --- Field Mirrors for Mainnet Validation ---
  const builderPoolName = useWatch({ control: form.control, name: "builderPool.name" });
  const builderPoolDeposit = useWatch({ control: form.control, name: "builderPool.minimalDeposit" });

  const selectedChainId = form.watch("subnet.networkChainId");
  const isTestnet = selectedChainId === arbitrumSepolia.id;

  // Mirror mainnet builderPool values into required subnet.* fields for validation purposes
  useEffect(() => {
    if (!isTestnet) {
      if (builderPoolName !== undefined) {
        form.setValue("subnet.name", builderPoolName, { shouldValidate: true, shouldDirty: false });
      }
      if (builderPoolDeposit !== undefined) {
        form.setValue("subnet.minStake", builderPoolDeposit, { shouldValidate: true, shouldDirty: false });
      }
    }
    // We intentionally omit form from dependency array to avoid endless loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderPoolName, builderPoolDeposit, isTestnet]);

  return (
    <fieldset disabled={isSubmitting} className="space-y-4 p-6 border border-gray-100/30 rounded-lg">
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">
        Subnet Configuration
      </legend>

      {/* Name */}
      <FormField
        control={form.control}
        name={isTestnet ? "subnet.name" : "builderPool.name"}
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={isTestnet ? "subnet.name" : "builderPool.name"}>Subnet Name</FormLabel>
            <FormControl>
              <Input id={isTestnet ? "subnet.name" : "builderPool.name"} placeholder="Unique name (cannot be changed)" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Network */}
      <FormField
        control={form.control}
        name="subnet.networkChainId"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="subnet.networkChainId">Network</FormLabel>
            <Select
              value={field.value?.toString()}
              onValueChange={(value) => {
                const chainId = Number(value);
                field.onChange(chainId);
                
                if (chainId === arbitrumSepolia.id) {
                  form.setValue("subnet.fee", 0);
                  form.setValue("subnet.feeTreasury", "");
                } else {
                  form.unregister("subnet.fee");
                  form.unregister("subnet.feeTreasury");
                }
              }}
              disabled={isSubmitting}
            >
              <FormControl>
                <SelectTrigger id="subnet.networkChainId">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={arbitrumSepolia.id.toString()}>
                  <div className="flex items-center gap-2">
                    <ArbitrumSepoliaIcon className="text-current" />
                    <span>Arbitrum Sepolia</span>
                  </div>
                </SelectItem>
                <SelectItem value={arbitrum.id.toString()}>
                  <div className="flex items-center gap-2">
                    <ArbitrumIcon size={19} className="text-current" />
                    <span>Arbitrum</span>
                  </div>
                </SelectItem>
                <SelectItem value={base.id.toString()}>
                  <div className="flex items-center gap-2">
                    <BaseIcon size={19} className="text-current" />
                    <span>Base</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Min Stake & Fee % */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name={isTestnet ? "subnet.minStake" : "builderPool.minimalDeposit"}
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={isTestnet ? "subnet.minStake" : "builderPool.minimalDeposit"}>Minimum {isTestnet ? "Stake" : "Deposit"} ({tokenSymbol})</FormLabel>
              <FormControl><NumberInput id={isTestnet ? "subnet.minStake" : "builderPool.minimalDeposit"} min={0} value={field.value} onValueChange={field.onChange} /></FormControl>
              <FormDescription>Min {tokenSymbol} required for this {isTestnet ? "subnet" : "pool"}.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {isTestnet && (
          <FormField
            control={form.control}
            name="subnet.fee"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="subnet.fee">% Emission Rate</FormLabel>
                <FormControl>
                  <NumberInput
                    id="subnet.fee"
                    min={0} max={100} step={0.01}
                    value={field.value / 100}
                    onValueChange={(value) => field.onChange(Math.round(value * 100))}
                  />
                </FormControl>
                <FormDescription>Note: This value is stored but not used by this contract directly.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      {/* Fee Treasury */}
      {isTestnet && (
        <FormField
          control={form.control}
          name="subnet.feeTreasury"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="subnet.feeTreasury">Treasury Address</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    id="subnet.feeTreasury"
                    placeholder="0x..."
                    {...field}
                    value={field.value === zeroAddress || field.value === undefined ? '' : field.value}
                    className="pr-32"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center text-xs h-8 px-2"
                    onClick={() => {
                      if (address) {
                        field.onChange(address);
                      }
                    }}
                    disabled={!address || isSubmitting}
                  >
                    <Wallet className="mr-1 h-3 w-3" />
                    Use your address
                  </Button>
                </div>
              </FormControl>
              <FormDescription>Note: This address is stored but not used by this contract directly.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Withdraw Lock */}
      <div className="flex gap-4 items-end">
        <FormField
          control={form.control}
          name="subnet.withdrawLockPeriod"
          render={({ field }) => (
            <FormItem className="flex-grow">
              <FormLabel htmlFor="subnet.withdrawLockPeriod">Withdraw Lock Period</FormLabel>
              <FormControl><NumberInput id="subnet.withdrawLockPeriod" min={1} value={field.value} onValueChange={field.onChange} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subnet.withdrawLockUnit"
          render={({ field }) => (
            <FormItem className="pb-2.5">
              <FormLabel className="sr-only">Withdraw lock unit</FormLabel>
              <FormControl>
                <RadioGroup 
                  className="flex space-x-4" 
                  value={field.value} 
                  onValueChange={field.onChange}
                  aria-label="Withdraw lock unit"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="days" id="days-radio" />
                    <Label htmlFor="days-radio">Days</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hours" id="hours-radio" />
                    <Label htmlFor="hours-radio">Hours</Label>
                  </div>
                </RadioGroup>
              </FormControl>
            </FormItem>
          )}
        />
      </div>
      <FormDescription>Duration deposits are locked after each deposit action.</FormDescription>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="subnet.startsAt"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Stake Start Time</FormLabel>
              <Popover open={startTimePopoverOpen} onOpenChange={setStartTimePopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button type="button" variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP") : <span>Pick start date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single" selected={field.value}
                    onSelect={(date) => { if (date) field.onChange(date); setStartTimePopoverOpen(false); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>When deposits become active.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subnet.maxClaimLockEnd"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Claim Lock End</FormLabel>
              <Popover open={claimLockEndsPopoverOpen} onOpenChange={setClaimLockEndsPopoverOpen}>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button type="button" variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                      {field.value ? format(field.value, "PPP") : <span>Pick lock end date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single" selected={field.value}
                    onSelect={(date) => { if (date) field.onChange(date); setClaimLockEndsPopoverOpen(false); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || (form.getValues("subnet.startsAt") && date < form.getValues("subnet.startsAt"))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormDescription>End date for potential claim locking.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </fieldset>
  );
};

export default Step1PoolConfig; 