import React, { useState } from 'react';
import { format } from "date-fns";
import { CalendarIcon, Wallet } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { cn } from "@/lib/utils";
import { SUPPORTED_CHAINS, ArbitrumSepoliaIcon } from './constants';
import { zeroAddress } from 'viem';
import { useAccount } from 'wagmi';

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

interface Step1PoolConfigProps {
  isSubmitting: boolean;
  tokenSymbol: string;
}

export const Step1PoolConfig: React.FC<Step1PoolConfigProps> = ({ isSubmitting, tokenSymbol }) => {
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [claimLockEndsPopoverOpen, setClaimLockEndsPopoverOpen] = useState(false);
  const form = useFormContext();
  const { address } = useAccount();

  return (
    <fieldset disabled={isSubmitting} className="space-y-4 p-6 border border-gray-100/30 rounded-lg">
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">Subnet Configuration</legend>

      {/* Name */}
      <FormField
        control={form.control}
        name="subnet.name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Builder Subnet Name</FormLabel>
            <FormControl>
              <Input placeholder="Unique subnet name (cannot be changed)" {...field} />
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
            <FormLabel>Network</FormLabel>
            <Select
              value={field.value?.toString()}
              onValueChange={(value) => field.onChange(Number(value))}
              disabled={isSubmitting}
            >
              <FormControl><SelectTrigger><SelectValue placeholder="Select network" /></SelectTrigger></FormControl>
              <SelectContent>
                {Object.values(SUPPORTED_CHAINS).map((chain) => {
                  let IconComponent = null;
                  if (chain.id === 421614) IconComponent = ArbitrumSepoliaIcon;
                  // Add other icons as needed
                  return (
                    <SelectItem key={chain.id} value={chain.id.toString()}>
                      <div className="flex items-center gap-2">
                        {IconComponent && <IconComponent className="text-current" />}
                        <span>{chain.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
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
          name="subnet.minStake"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Minimum Deposit ({tokenSymbol})</FormLabel>
              <FormControl><NumberInput min={0} value={field.value} onValueChange={field.onChange} /></FormControl>
              <FormDescription>Min {tokenSymbol} required to deposit in this subnet.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="subnet.fee"
          render={({ field }) => (
            <FormItem>
              <FormLabel>% Emission Rate</FormLabel>
              <FormControl>
                <NumberInput
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
      </div>

      {/* Fee Treasury */}
      <FormField
        control={form.control}
        name="subnet.feeTreasury"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Treasury Address</FormLabel>
            <FormControl>
              <div className="relative">
                <Input
                  placeholder="0x..."
                  {...field}
                  value={field.value === zeroAddress ? '' : field.value}
                  className="pr-32" // Add padding for the button
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

      {/* Withdraw Lock */}
      <div className="flex gap-4 items-end">
        <FormField
          control={form.control}
          name="subnet.withdrawLockPeriod"
          render={({ field }) => (
            <FormItem className="flex-grow">
              <FormLabel>Withdraw Lock Period</FormLabel>
              <FormControl><NumberInput min={1} value={field.value} onValueChange={field.onChange} /></FormControl>
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