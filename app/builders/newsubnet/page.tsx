"use client";

import { useState, useEffect, useCallback } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { RiCheckboxCircleFill, RiProgress4Fill } from "@remixicon/react";
import { useNetwork } from "@/context/network-context";
import { useBuilders } from "@/context/builders-context";
import { toast } from "sonner";
import Link from "next/link"; // Import Link

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Textarea } from "@/components/ui/textarea"; // Import Textarea
import MultipleSelector, { Option } from "@/components/ui/multiple-selector"; // Import MultipleSelector

// Define Reward Options
const REWARD_OPTIONS: Option[] = [
  { label: 'Token Airdrop', value: 'token_airdrop' },
  { label: 'NFT Whitelist', value: 'nft_whitelist' },
  { label: 'Yield Boost', value: 'yield_boost' },
  { label: 'Governance Rights', value: 'governance_rights' },
  { label: 'Early Access', value: 'early_access' },
  { label: 'Exclusive Content', value: 'exclusive_content' },
];

// Form schemas (Keep as is)
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
  projectUrl: z.string().url("Please enter a valid URL").min(1, "Project URL is required"),
  description: z.string().min(10, "Description must be at least 10 characters").max(500, "Description must be 500 characters or less"),
  projectLogoUrl: z.string().url("Please enter a valid URL for the logo").optional().or(z.literal('')),
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
      path: ["email"], // You can choose which field to attach the error message to
    });
  }
});

// Combined schema for the entire form
const formSchema = z.object({
  subnetDetails: subnetDetailsSchema,
  projectDetails: projectDetailsSchema,
});

// Steps configuration (Keep as is)
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

// Main page component
export default function NewSubnetPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isNetworkSwitching, setIsNetworkSwitching] = useState(false);
  const [nameExists, setNameExists] = useState(false);
  const [startTimePopoverOpen, setStartTimePopoverOpen] = useState(false);
  const [claimLockEndsPopoverOpen, setClaimLockEndsPopoverOpen] = useState(false);

  const { currentChainId, switchToChain } = useNetwork();
  const { builders } = useBuilders();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subnetDetails: {
        builderName: "",
        minDeposit: 0,
        network: "Base",
        withdrawLockPeriod: 1,
        withdrawLockUnit: "days",
        startTime: new Date(),
        claimLockEnds: undefined,
      },
      projectDetails: {
        projectUrl: "",
        description: "",
        projectLogoUrl: "",
        email: "",
        discordLink: "",
        twitterLink: "",
        rewards: [],
      },
    },
  });

  const selectedNetwork = form.watch("subnetDetails.network");
  const builderName = form.watch("subnetDetails.builderName");

  useEffect(() => {
    if (!builderName || !builders.length) {
      setNameExists(false);
      return;
    }
    const nameAlreadyExists = builders.some(
      builder => builder.name.toLowerCase() === builderName.toLowerCase()
    );
    setNameExists(nameAlreadyExists);
    if (nameAlreadyExists) {
      form.setError("subnetDetails.builderName", {
        type: "manual",
        message: "This builder name already exists"
      });
    } else {
      form.clearErrors("subnetDetails.builderName");
    }
  }, [builderName, builders, form]);

  const isCorrectNetwork = useCallback(() => {
    const networkToChainId: Record<string, number> = { "Arbitrum": 42161, "Base": 8453 };
    return currentChainId === networkToChainId[selectedNetwork];
  }, [currentChainId, selectedNetwork]);

  useEffect(() => {
    if (isCorrectNetwork() && isNetworkSwitching) {
      setIsNetworkSwitching(false);
      toast.success(`Successfully switched to ${selectedNetwork}`, { id: "network-switch" });
    }
  }, [currentChainId, isCorrectNetwork, isNetworkSwitching, selectedNetwork]);

  const calculateSecondsForLockPeriod = (period: number, unit: "hours" | "days") => {
    const secondsInHour = 3600;
    const secondsInDay = 86400;
    return unit === "hours" ? period * secondsInHour : period * secondsInDay;
  };

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    const withdrawLockSeconds = calculateSecondsForLockPeriod(
      data.subnetDetails.withdrawLockPeriod,
      data.subnetDetails.withdrawLockUnit
    );
    console.log("Form submitted:", {
      ...data,
      subnetDetails: { ...data.subnetDetails, withdrawLockSeconds },
    });
    toast.success("Subnet creation initiated (logged to console)");
    // TODO: Add actual API submission and redirect logic here
    // e.g., router.push('/builders');
  };

  const handleNext = async () => {
    if (!isCorrectNetwork()) {
      setIsNetworkSwitching(true);
      const networkToChainId: Record<string, number> = { "Arbitrum": 42161, "Base": 8453 };
      try {
        toast.loading(`Switching to ${selectedNetwork}...`, { id: "network-switch" });
        await switchToChain(networkToChainId[selectedNetwork]);
      } catch (error) {
        console.error("Failed to switch network:", error);
        setIsNetworkSwitching(false);
        toast.error(`Failed to switch to ${selectedNetwork}`, { id: "network-switch" });
      }
      return;
    }

    if (nameExists) {
      toast.warning("A builder with this name already exists");
      return;
    }

    if (currentStep === 1) {
      const result = await form.trigger("subnetDetails", { shouldFocus: true });
      if (result) {
        setCurrentStep(2);
      }
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Page structure starts here
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl"> {/* Added container */}
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">Become a Builder</h1>
        <p className="text-gray-400">Configure your builder subnet and project details.</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-6">
         {/* Progress bar */}
         <div className="h-2 w-full bg-emerald-500/20 rounded-full mb-2">
           <div
             className="h-full bg-emerald-400 rounded-full transition-all duration-300 ease-in-out"
             style={{ width: `${(currentStep / steps.length) * 100}%` }}
           />
         </div>
        {/* Progress step indicators */}
         <div className="flex justify-between">
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
       </div>


      {/* Form */}
      <Form {...form}>
        <form className="space-y-6">
          {/* Step 1: Subnet Details */}
          {currentStep === 1 && (
            <div className="space-y-4 p-6 border border-gray-100/30 rounded-lg">
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Subnet Details</h2>
              <FormField
                  control={form.control}
                  name="subnetDetails.builderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Builder name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Your project name. Can't be changed later."
                          {...field}
                          className={nameExists ? "border-red-500" : ""}
                        />
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
                          Minimum MOR users can deposit when staking.
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
                      <FormItem className="flex-1 flex items-center mt-8"> {/* Adjusted alignment */}
                         <FormLabel className="sr-only">Withdraw lock unit</FormLabel> {/* Added sr-only label */}
                        <FormControl>
                          <RadioGroup
                            className="flex space-x-4"
                            value={field.value}
                            onValueChange={field.onChange}
                            aria-labelledby="withdraw-lock-unit-label"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="days" id="days-radio" />
                              <Label htmlFor="days-radio" id="withdraw-lock-unit-label">Days</Label> {/* Added ID for aria */}
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="hours" id="hours-radio" />
                              <Label htmlFor="hours-radio">Hours</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                 {/* Date Pickers - Still using Popover structure */}
                <div className="flex gap-4">
                  <FormField
                    control={form.control}
                    name="subnetDetails.startTime"
                    render={({ field }) => (
                      <FormItem className="flex flex-col flex-1">
                        <FormLabel>Start time</FormLabel>
                        <Popover open={startTimePopoverOpen} onOpenChange={setStartTimePopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setStartTimePopoverOpen(false);
                              }}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
                       <FormItem className="flex flex-col flex-1">
                        <FormLabel>Claim lock ends</FormLabel>
                        <Popover open={claimLockEndsPopoverOpen} onOpenChange={setClaimLockEndsPopoverOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant={"outline"}
                              className={cn(
                                "w-full pl-3 text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                field.onChange(date);
                                setClaimLockEndsPopoverOpen(false);
                              }}
                              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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
            <div className="space-y-6 p-6 border border-gray-100/30 rounded-lg"> {/* Changed structure & styling */}
              <h2 className="text-xl font-semibold text-gray-100 mb-4">Project Details</h2>
               {/* Project URL */}
              <FormField
                control={form.control}
                name="projectDetails.projectUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://yourproject.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Description */}
              <FormField
                control={form.control}
                name="projectDetails.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Briefly describe what your project is about (max 500 characters)"
                        {...field}
                        rows={4}
                        className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               {/* Project Logo URL */}
              <FormField
                control={form.control}
                name="projectDetails.projectLogoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Logo URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://yourproject.com/logo.png" {...field} />
                    </FormControl>
                     <FormDescription>
                        Direct URL to your project&apos;s logo image.
                      </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Information Subsection */}
              <div className="space-y-2 pt-4 border-t border-gray-100/20">
                 <h3 className="text-lg font-medium text-gray-100">Contact Information</h3>
                 <p className="text-sm text-gray-400 pb-2">Please provide at least one contact method.</p>
                 <FormField
                  control={form.control}
                  name="projectDetails.email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="contact@yourproject.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="projectDetails.discordLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discord Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://discord.gg/yourserver" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="projectDetails.twitterLink"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>X (Twitter) Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://x.com/yourproject" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Rewards */}
               <FormField
                 control={form.control}
                 name="projectDetails.rewards"
                 render={({ field }) => (
                   <FormItem>
                     <FormLabel>Rewards for Stakers</FormLabel>
                     <FormControl>
                      {/* Ensure MultipleSelector uses the correct options and handles value changes */}
                       <MultipleSelector
                         value={field.value} // Pass the current value
                         defaultOptions={REWARD_OPTIONS} // Pass the defined options
                         placeholder="Select potential rewards for stakers..."
                         emptyIndicator={
                           <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                             No reward types found.
                           </p>
                         }
                         onChange={field.onChange} // Directly use field.onChange for simplicity if MultipleSelector handles Option[]
                       />
                     </FormControl>
                      <FormDescription>
                        Select the types of rewards stakers might receive.
                      </FormDescription>
                     <FormMessage />
                   </FormItem>
                 )}
               />
            </div>
          )}
        </form>
      </Form>

      {/* Page Footer Buttons */}
      <div className="mt-8 flex justify-between">
        {currentStep > 1 ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
          >
            Back
          </Button>
        ) : (
          // Optional: Add a cancel button or link back
          <Link href="/builders">
             <Button type="button" variant="outline">Cancel</Button>
          </Link>
        )}
        <button
            type="button"
            onClick={handleNext}
            className="copy-button" // Assuming this class provides styling
            disabled={isNetworkSwitching} // Disable button while switching
          >
            {isNetworkSwitching ? 'Switching...' : !isCorrectNetwork() ? (
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
      </div>
    </div>
  );
} 