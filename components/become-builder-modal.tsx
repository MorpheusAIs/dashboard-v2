"use client";

import { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RiCheckboxCircleFill, RiProgress4Fill } from "@remixicon/react";
import { useNetwork } from "@/context/network-context";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Form schemas
const subnetDetailsSchema = z.object({
  builderName: z.string().min(1, "Builder name is required"),
  minDeposit: z.number().min(0, "Minimum deposit must be a positive number"),
  network: z.enum(["Arbitrum", "Base"], {
    required_error: "Please select a network",
  }),
  withdrawLockPeriod: z.number().min(1, "Withdraw lock period must be at least 1"),
  withdrawLockUnit: z.enum(["hours", "days"]),
  startTime: z.date({
    required_error: "Start time is required",
  }),
  claimLockEnds: z.date({
    required_error: "Claim lock end date is required",
  }),
});

const projectDetailsSchema = z.object({
  // We'll leave this empty for now as requested
});

// Combined schema for the entire form
const formSchema = z.object({
  subnetDetails: subnetDetailsSchema,
  projectDetails: projectDetailsSchema,
});

// Steps configuration
const steps = [
  {
    id: 1,
    title: "Subnet Details",
    description: "Configure your subnet parameters",
  },
  {
    id: 2,
    title: "Project Details",
    description: "Add information about your project",
  },
];

export function BecomeBuilderModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  
  // Get user's current network
  const { currentChainId, switchToChain } = useNetwork();
  
  // Initialize form with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subnetDetails: {
        builderName: "",
        minDeposit: 0,
        network: "Base", // Changed from Arbitrum to Base
        withdrawLockPeriod: 1,
        withdrawLockUnit: "days",
        startTime: new Date(), // Set current date as default
        claimLockEnds: undefined,
      },
      projectDetails: {},
    },
  });

  // Get the currently selected network from the form
  const selectedNetwork = form.watch("subnetDetails.network");

  // Check if user is on the correct network
  const isCorrectNetwork = useCallback(() => {
    // Map form network names to chain IDs
    const networkToChainId: Record<string, number> = {
      "Arbitrum": 42161, // Arbitrum One
      "Base": 8453,      // Base Mainnet
    };
    
    return currentChainId === networkToChainId[selectedNetwork];
  }, [currentChainId, selectedNetwork]);

  // Reset network switching state when the network changes
  useEffect(() => {
    if (isCorrectNetwork() && isNetworkSwitching) {
      setIsNetworkSwitching(false);
      
      // Show toast notification when network is successfully switched
      toast.success(`Successfully switched to ${selectedNetwork}`, {
        id: "network-switch",
      });
    }
  }, [currentChainId, isCorrectNetwork, isNetworkSwitching, selectedNetwork]);

  // Calculate seconds for withdraw lock period
  const calculateSecondsForLockPeriod = (period: number, unit: "hours" | "days") => {
    const secondsInHour = 3600;
    const secondsInDay = 86400;
    
    return unit === "hours" 
      ? period * secondsInHour 
      : period * secondsInDay;
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Convert withdraw lock period to seconds
    const withdrawLockSeconds = calculateSecondsForLockPeriod(
      data.subnetDetails.withdrawLockPeriod,
      data.subnetDetails.withdrawLockUnit
    );
    
    // Here you would submit the data to your API
    console.log("Form submitted:", {
      ...data,
      subnetDetails: {
        ...data.subnetDetails,
        withdrawLockSeconds,
      },
    });
    
    // Close the modal
    onOpenChange(false);
  };

  // Handle next step
  const handleNext = async () => {
    // Check if we need to switch networks first
    if (!isCorrectNetwork()) {
      setIsNetworkSwitching(true);
      
      // Map form network names to chain IDs for switching
      const networkToChainId: Record<string, number> = {
        "Arbitrum": 42161, // Arbitrum One
        "Base": 8453,      // Base Mainnet
      };
      
      // Initiate network switch
      try {
        toast.loading(`Switching to ${selectedNetwork}...`, {
          id: "network-switch",
        });
        await switchToChain(networkToChainId[selectedNetwork]);
      } catch (error) {
        console.error("Failed to switch network:", error);
        setIsNetworkSwitching(false);
        
        // Show error toast
        toast.error(`Failed to switch to ${selectedNetwork}`, {
          id: "network-switch",
        });
      }
      return;
    }
    
    // Validate current step
    if (currentStep === 1) {
      const result = await form.trigger("subnetDetails", { shouldFocus: true });
      if (result) {
        setCurrentStep(2);
      }
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  // Handle back step
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-400">
            Become a Builder
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="mt-4">
            {/* Progress bar */}
            <div className="h-2 w-full bg-emerald-500/20 rounded-full">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
          {/* Progress steps */}
          <div className="flex justify-between mb-4">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2">
                {currentStep > step.id ? (
                  <RiCheckboxCircleFill className="size-4 text-emerald-400" />
                ) : currentStep === step.id ? (
                  <RiProgress4Fill className="size-4 text-emerald-400 animate-spin" />
                ) : (
                  <div className="size-4 rounded-full border border-emerald-500/50" />
                )}
                <span className="text-sm text-gray-300">{step.title}</span>
              </div>
            ))}
          </div>


        <Form {...form}>
          <form className="space-y-6">
            {/* Step 1: Subnet Details */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="subnetDetails.builderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Builder name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter builder name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4 items-start">
                  <FormField
                    control={form.control}
                    name="subnetDetails.minDeposit"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Minimum deposit (MOR)</FormLabel>
                        <FormControl>
                          <NumberInput
                            min={0}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormDescription>
                          This is the minimum amount of MOR users can deposit when staking to your project.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subnetDetails.network"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Network</FormLabel>
                        <Select 
                          value={field.value} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select network" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Arbitrum" className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <ArbitrumIcon size={18} className="text-current" />
                                <span>Arbitrum</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Base" className="flex items-center gap-2">
                              <div className="flex items-center gap-2">
                                <BaseIcon size={18} className="text-current" />
                                <span>Base</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4 items-center">
                  <FormField
                    control={form.control}
                    name="subnetDetails.withdrawLockPeriod"
                    render={({ field }) => (
                      <FormItem className="w-1/3">
                        <FormLabel>Withdraw lock period</FormLabel>
                        <FormControl>
                          <NumberInput
                            min={1}
                            value={field.value}
                            onValueChange={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subnetDetails.withdrawLockUnit"
                    render={({ field }) => (
                      <FormItem className="flex-1 flex items-cente mt-8">
                        <RadioGroup
                          className="flex space-x-4"
                          value={field.value}
                          onValueChange={field.onChange}
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="subnetDetails.startTime"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Start time</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subnetDetails.claimLockEnds"
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>Claim lock ends</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>Pick a date</span>
                                )}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Project Details */}
            {currentStep === 2 && (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-gray-400">Project details will be added later.</p>
              </div>
            )}
          </form>
        </Form>

        <DialogFooter className="flex justify-between">
          {currentStep > 1 && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleBack}
            >
              Back
            </Button>
          )}
          <button 
            type="button" 
            onClick={handleNext}
            className="copy-button"
          >
            {!isCorrectNetwork() ? (
              <span className="flex items-center gap-2 align-center justify-center">
                Switch to {' '}
                {selectedNetwork === "Arbitrum" ? (
                  <ArbitrumIcon size={20} className="text-black" fill="#000" />
                ) : (
                  <BaseIcon size={20} className="text-black" fill="#000" />
                )}
              </span>
            ) : currentStep < steps.length ? "Next" : "Confirm"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 