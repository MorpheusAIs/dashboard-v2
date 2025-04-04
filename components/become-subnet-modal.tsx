"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

interface BecomeSubnetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BecomeSubnetModal({ open, onOpenChange }: BecomeSubnetModalProps) {
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState("10");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update fee when slider changes
  const handleSliderChange = (values: number[]) => {
    if (values[0]) {
      setFee(values[0].toString());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Ensure the input value is between 1 and 100
    if (value === "" || (parseInt(value) >= 1 && parseInt(value) <= 100)) {
      setFee(value);
    }
  };
  
  // Format slider tooltip value
  const formatSliderValue = (value: number) => {
    return `${value}%`;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!name || !fee) {
      toast.error("Please fill out all required fields");
      return;
    }

    const feeNum = parseInt(fee, 10);
    if (isNaN(feeNum) || feeNum < 1 || feeNum > 100) {
      toast.error("Fee must be between 1% and 100%");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In a real implementation, this would connect to a wallet and submit a transaction
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API request
      
      toast.success("Subnet registration submitted successfully!");
      onOpenChange(false);
      
      // Reset form
      setName("");
      setWebsite("");
      setDescription("");
      setFee("10");
    } catch (error) {
      console.error("Error submitting subnet registration:", error);
      toast.error("Failed to submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-background border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-400">Become a Subnet Provider</DialogTitle>
          <DialogDescription className="text-gray-400">
            Register as a compute subnet provider on the network
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="subnet-name" className="text-sm font-medium">
              Subnet Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="subnet-name"
              placeholder="Enter subnet name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background border-gray-700"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subnet-website" className="text-sm font-medium">
              Website (Optional)
            </Label>
            <Input
              id="subnet-website"
              placeholder="https://yourwebsite.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="bg-background border-gray-700"
              type="url"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subnet-description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <div className="relative">
              <textarea
                id="subnet-description"
                placeholder="Describe your subnet and its purpose"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[80px] resize-none bg-background border border-gray-700 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subnet-fee" className="text-sm font-medium">
              Subnet Fee (%) <span className="text-red-500">*</span>
            </Label>
            
            <div className="mb-6">
              <span
                className="text-muted-foreground mb-3 flex w-full items-center justify-between gap-2 text-xs font-medium"
                aria-hidden="true"
              >
                <span>1%</span>
                <span>100%</span>
              </span>
              <Slider
                value={[parseInt(fee) || 1]}
                onValueChange={handleSliderChange}
                min={1}
                max={100}
                step={10}
                showTooltip={true}
                tooltipContent={formatSliderValue}
                aria-label="Subnet fee percentage"
              />
            </div>
            
            <Input
              id="subnet-fee"
              placeholder="Enter subnet fee percentage"
              value={fee}
              onChange={handleInputChange}
              className="bg-background border-gray-700 pt-2"
              type="number"
              min="1"
              max="100"
              step="1"
              required
            />
            <p className="text-xs text-gray-400">
              This is the percentage fee users will pay to access your subnet (1-100%)
            </p>
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Submitting..." : "Submit Registration"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 