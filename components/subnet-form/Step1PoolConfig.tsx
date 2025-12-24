import React, { useState, useEffect, useCallback } from 'react';
import { useFormContext, useWatch } from "react-hook-form";
import { baseSepolia, base } from 'wagmi/chains';
import { useNetwork } from "@/context/network-context";
import { useBuilders } from "@/context/builders-context";
import { useAccount } from 'wagmi';
import { isAddress } from 'viem';

import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BaseIcon } from "@/components/network-icons";
import { BaseSepoliaIcon } from './icons/base-sepolia-icon';
import { Input } from "@/components/ui/input";

interface Step1PoolConfigProps {
  isSubmitting: boolean;
  tokenSymbol: string;
  onValidationChange?: (hasError: boolean) => void;
}

export const Step1PoolConfig: React.FC<Step1PoolConfigProps> = ({ isSubmitting, tokenSymbol, onValidationChange }) => {
  const [subnetNameError, setSubnetNameError] = useState<string | null>(null);
  const [claimAdminError, setClaimAdminError] = useState<string | null>(null);
  const form = useFormContext();
  const { currentChainId } = useNetwork();
  const { builders } = useBuilders();
  const { address: connectedAddress } = useAccount();

  const selectedChainId = form.watch("subnet.networkChainId");
  // Both Base mainnet and Base Sepolia use V4 contracts with the same structure
  const isV4Network = selectedChainId === base.id || selectedChainId === baseSepolia.id;

  // Get the current subnet name being entered
  const currentSubnetName = useWatch({ 
    control: form.control, 
    name: isV4Network ? "subnet.name" : "builderPool.name" 
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

  // Note: Both Base and Base Sepolia use V4 contracts with the same structure
  // No field mirroring needed since both use subnet.name and subnet.minStake

  // Sync form network when user changes wallet network (but not when they change form dropdown)
  const [lastWalletChainId, setLastWalletChainId] = useState<number | undefined>(currentChainId);
  
  useEffect(() => {
    if (currentChainId && currentChainId !== lastWalletChainId) {
      const supportedChainIds = [baseSepolia.id, base.id] as const;
      
      // Only sync if wallet changed to a supported network
      if (supportedChainIds.includes(currentChainId as typeof supportedChainIds[number])) {
        console.log(`Wallet network changed to ${currentChainId}, updating form`);
        form.setValue("subnet.networkChainId", currentChainId as typeof supportedChainIds[number], { shouldValidate: true });
      }
      
      // Update last known wallet chain ID
      setLastWalletChainId(currentChainId);
    }
  }, [currentChainId, lastWalletChainId, form]);

  // Effect to adjust withdrawLockPeriod when network changes
  useEffect(() => {
    const currentWithdrawLockPeriod = form.getValues("subnet.withdrawLockPeriod");
    // Ensure period is at least 1 (unit can be days or hours for both networks)
    if (currentWithdrawLockPeriod < 1) {
      form.setValue("subnet.withdrawLockPeriod", 1, { shouldValidate: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, [selectedChainId, form]);

  return (
    <fieldset disabled={isSubmitting} className="space-y-6 p-6 border border-gray-100/30 rounded-lg">
      <legend className="text-xl font-semibold text-gray-100 mb-4 px-1">
        Pool Configuration
      </legend>

      {/* Name */}
      <FormField
        control={form.control}
        name="subnet.name"
        render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor="subnet.name">Subnet Name</FormLabel>
            <FormControl>
              <Input 
                id="subnet.name" 
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
                // Both Base and Base Sepolia use V4 contracts with the same fields
              }}
              disabled={isSubmitting}
            >
              <FormControl>
                <SelectTrigger id="subnet.networkChainId">
                  <SelectValue placeholder="Select network" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={baseSepolia.id.toString()}>
                  <div className="flex items-center gap-2">
                    <BaseSepoliaIcon className="text-current" />
                    <span>Base Sepolia</span>
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

      {/* Min Stake - Both Base and Base Sepolia use V4 contracts */}
      {isV4Network && (
        <FormField
          control={form.control}
          name="subnet.minStake"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="subnet.minStake">Minimum Stake ({tokenSymbol})</FormLabel>
              <FormControl><NumberInput id="subnet.minStake" min={0} value={field.value} onValueChange={field.onChange} /></FormControl>
              <FormDescription>Min {tokenSymbol} required for this subnet.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Withdraw Lock Section for V4 networks (Base and Base Sepolia) */}
      {isV4Network && (
        <FormField
          control={form.control}
          name="subnet.withdrawLockPeriod"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="subnet.withdrawLockPeriod">Withdraw Lock Period (Days)</FormLabel>
              <FormControl>
                <NumberInput
                  id="subnet.withdrawLockPeriod"
                  min={7}
                  value={field.value}
                  onValueChange={field.onChange}
                />
              </FormControl>
              <FormDescription>
                Minimum 7 days. All deposits are locked after each deposit action.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Claim Admin Address Section for V4 networks (Base and Base Sepolia) */}
      {isV4Network && (
        <FormField
          control={form.control}
          name="subnet.claimAdmin"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="subnet.claimAdmin">Claim Admin Address</FormLabel>
              <FormControl>
                <Input
                  id="subnet.claimAdmin"
                  placeholder="0x..."
                  {...field}
                  className={claimAdminError ? "border-red-500" : undefined}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    field.onChange(value);
                    // Validate address format
                    if (value && !isAddress(value)) {
                      setClaimAdminError("Please enter a valid Ethereum address");
                    } else {
                      setClaimAdminError(null);
                    }
                  }}
                  onBlur={(e) => {
                    field.onBlur();
                    const value = e.target.value.trim();
                    if (value && !isAddress(value)) {
                      setClaimAdminError("Please enter a valid Ethereum address");
                    } else {
                      setClaimAdminError(null);
                    }
                  }}
                />
              </FormControl>
              <FormDescription>
                This address can claim the Subnet rewards on behalf of the admin. Defaults to your connected wallet address.
              </FormDescription>
              {claimAdminError && (
                <FormDescription className="text-red-500">
                  {claimAdminError}
                </FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </fieldset>
  );
};

export default Step1PoolConfig; 