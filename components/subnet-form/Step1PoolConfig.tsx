import React, { useState, useEffect, useCallback } from 'react';
import { format } from "date-fns";
import { CalendarIcon, Wallet } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { ArbitrumSepoliaIcon } from './constants';
import { zeroAddress } from 'viem';
import { useAccount } from 'wagmi';
import { arbitrumSepolia, arbitrum, base } from 'wagmi/chains';
import { useNetwork } from "@/context/network-context";
import { useBuilders } from "@/context/builders-context";

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
  onValidationChange?: (hasError: boolean) => void;
}

export const Step1PoolConfig: React.FC<Step1PoolConfigProps> = ({ isSubmitting, tokenSymbol, onValidationChange }) => {
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [claimLockEndsPopoverOpen, setClaimLockEndsPopoverOpen] = useState(false);
  const [subnetNameError, setSubnetNameError] = useState<string | null>(null);
  const form = useFormContext();
  const { address } = useAccount();
  const { currentChainId } = useNetwork();
  const { builders } = useBuilders();

  const selectedChainId = form.watch("subnet.networkChainId");
  const isMainnet = selectedChainId === arbitrum.id || selectedChainId === base.id;
  const isTestnet = selectedChainId === arbitrumSepolia.id;

  // Get the current subnet name being entered
  const currentSubnetName = useWatch({ 
    control: form.control, 
    name: isTestnet ? "subnet.name" : "builderPool.name" 
  });

  // Function to validate subnet name against existing names
  const validateSubnetName = useCallback((name: string) => {
    if (!name || !name.trim()) {
      setSubnetNameError(null);
      onValidationChange?.(false);
      return true;
    }

    // Extract existing subnet names from builders data
    const existingNames = builders.map(builder => builder.name.toLowerCase().trim());
    const nameToCheck = name.toLowerCase().trim();

    if (existingNames.includes(nameToCheck)) {
      setSubnetNameError("This subnet name already exists. Please choose a different name.");
      onValidationChange?.(true);
      return false;
    }

    setSubnetNameError(null);
    onValidationChange?.(false);
    return true;
  }, [builders, onValidationChange]);

  // Validate subnet name whenever it changes
  useEffect(() => {
    if (currentSubnetName) {
      validateSubnetName(currentSubnetName);
    } else {
      setSubnetNameError(null);
      onValidationChange?.(false);
    }
  }, [currentSubnetName, validateSubnetName, onValidationChange]);

  // --- Field Mirrors for Mainnet Validation ---
  const builderPoolName = useWatch({ control: form.control, name: "builderPool.name" });
  const builderPoolDeposit = useWatch({ control: form.control, name: "builderPool.minimalDeposit" });

  useEffect(() => {
    if (isMainnet) { // Simplified: if mainnet, mirror. Otherwise, don't.
      if (builderPoolName !== undefined) {
        form.setValue("subnet.name", builderPoolName, { shouldValidate: false, shouldDirty: false });
      }
      if (builderPoolDeposit !== undefined) {
        form.setValue("subnet.minStake", builderPoolDeposit, { shouldValidate: false, shouldDirty: false });
      }
    }
  }, [builderPoolName, builderPoolDeposit, isMainnet, form]);

  // Add network sync effect
  useEffect(() => {
    if (currentChainId) {
      const supportedChainIds = [arbitrumSepolia.id, arbitrum.id, base.id] as const;
      if (currentChainId !== selectedChainId && supportedChainIds.includes(currentChainId as typeof supportedChainIds[number])) {
        form.setValue("subnet.networkChainId", currentChainId as typeof supportedChainIds[number], { shouldValidate: true });
      }
    }
  }, [currentChainId, selectedChainId, form]);

  // Determine the minimum value for the withdrawLockPeriod input
  let minWithdrawLockPeriodValue = 1; // Default for testnet (can be 1 day or 1 hour)
  if (isMainnet) {
    minWithdrawLockPeriodValue = 7; // On mainnet, unit is always days, min is 7 days
  }

  // Effect to adjust withdrawLockPeriod and unit when network changes
  useEffect(() => {
    const currentWithdrawLockPeriod = form.getValues("subnet.withdrawLockPeriod");
    const currentWithdrawLockUnit = form.getValues("subnet.withdrawLockUnit");

    if (isMainnet) {
      if (currentWithdrawLockUnit !== "days") {
        form.setValue("subnet.withdrawLockUnit", "days", { shouldValidate: true });
      }
      // Always ensure period is at least 7 for mainnet, converting if necessary from old unit
      let periodToSet = currentWithdrawLockPeriod;
      if (currentWithdrawLockUnit === "hours") {
         // If it was hours, convert to days for comparison / setting, min 7 days
         periodToSet = Math.max(7, Math.ceil(currentWithdrawLockPeriod / 24));
      } else {
         periodToSet = Math.max(7, currentWithdrawLockPeriod);
      }
      if (periodToSet !== currentWithdrawLockPeriod || currentWithdrawLockUnit !== "days") {
        form.setValue("subnet.withdrawLockPeriod", periodToSet, { shouldValidate: true });
      }

    } else { // Testnet: ensure period is at least 1 (unit can be days or hours)
      if (currentWithdrawLockPeriod < 1) {
        form.setValue("subnet.withdrawLockPeriod", 1, { shouldValidate: true });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [selectedChainId, form]); // Removed withdrawLockUnit, isMainnet from deps as they are derived from selectedChainId

  return (
    <fieldset disabled={isSubmitting} className="space-y-6 p-6 border border-gray-100/30 rounded-lg">
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">
        Pool Configuration
      </legend>

      {/* Name */}
      <FormField
        control={form.control}
        name={isTestnet ? "subnet.name" : "builderPool.name"}
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={isTestnet ? "subnet.name" : "builderPool.name"}>Subnet Name</FormLabel>
            <FormControl>
              <Input 
                id={isTestnet ? "subnet.name" : "builderPool.name"} 
                placeholder="Unique name (cannot be changed)" 
                {...field} 
                className={subnetNameError ? "border-red-500" : undefined}
                onChange={(e) => {
                  field.onChange(e);
                  validateSubnetName(e.target.value);
                }}
                onBlur={(e) => {
                  field.onBlur();
                  validateSubnetName(e.target.value);
                }}
              />
            </FormControl>
            {subnetNameError && (
              <FormDescription className="text-red-500">
                {subnetNameError}
              </FormDescription>
            )}
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
                if (chainId === arbitrum.id || chainId === base.id) { 
                  form.unregister("subnet.fee");
                  form.unregister("subnet.feeTreasury");
                  form.setValue("subnet.withdrawLockUnit", "days");
                } else {
                  // If switching to testnet, re-register or set defaults if needed
                  // form.register("subnet.fee"); 
                  // form.setValue("subnet.fee", 0);
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

      {/* Conditional Layout for Mainnet vs Testnet regarding Min Deposit/Stake, Fee, Withdraw Lock */}
      {isMainnet && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="builderPool.minimalDeposit" // Mainnet specific field
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="builderPool.minimalDeposit">Minimum Deposit ({tokenSymbol})</FormLabel>
                <FormControl><NumberInput id="builderPool.minimalDeposit" min={0} value={field.value} onValueChange={field.onChange} /></FormControl>
                <FormDescription>Min {tokenSymbol} required for this pool.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="subnet.withdrawLockPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="subnet.withdrawLockPeriod">Withdraw Lock Period (Days)</FormLabel>
                <FormControl>
                  <NumberInput 
                    id="subnet.withdrawLockPeriod-mainnet"
                    min={minWithdrawLockPeriodValue} // This will be 7
                    value={field.value} 
                    onValueChange={field.onChange} 
                  />
                </FormControl>
                {/* Description is now common below */}
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}

      {isTestnet && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> {/* Min Stake & Emission Rate side-by-side for testnet */}
            <FormField
              control={form.control}
              name="subnet.minStake" // Testnet specific field
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="subnet.minStake">Minimum Stake ({tokenSymbol})</FormLabel>
                  <FormControl><NumberInput id="subnet.minStake" min={0} value={field.value} onValueChange={field.onChange} /></FormControl>
                  <FormDescription>Min {tokenSymbol} required for this subnet.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                  <FormDescription>Note: Stored but may not be used by contract.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField // Fee Treasury - Testnet only, full width
            control={form.control}
            name="subnet.feeTreasury"
            render={({ field }) => (
              <FormItem className="mt-4"> {/* Added margin for spacing */}
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
                      onClick={() => { if (address) field.onChange(address); }}
                      disabled={!address || isSubmitting}
                    >
                      <Wallet className="mr-1 h-3 w-3" />
                      Use your address
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>Note: Stored but may not be used by contract.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Withdraw Lock Section for Testnet - Period and Unit Selection */}
          <div className="flex gap-4 items-end mt-4"> {/* Added margin for spacing */}
            <FormField
              control={form.control}
              name="subnet.withdrawLockPeriod"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormLabel htmlFor="subnet.withdrawLockPeriod-testnet">Withdraw Lock Period</FormLabel>
                  <FormControl>
                    <NumberInput 
                      id="subnet.withdrawLockPeriod-testnet" 
                      min={minWithdrawLockPeriodValue} // This will be 1
                      value={field.value} 
                      onValueChange={field.onChange} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField // Radio Group for unit selection - ONLY FOR TESTNET
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
                        <RadioGroupItem value="days" id="days-radio-testnet" />
                        <Label htmlFor="days-radio-testnet">Days</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="hours" id="hours-radio-testnet" />
                        <Label htmlFor="hours-radio-testnet">Hours</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription className="mt-2">
                    All deposits are locked after each deposit action.
                  </FormDescription>
                </FormItem>
              )}
            />
          </div>
        </>
      )}

      {/* Common Form Description for Withdraw Lock Period */}
      {/* <FormDescription className="mt-2">
        All deposits are locked after each deposit action.
      </FormDescription> */}

      {/* Dates (remains the same) */}
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