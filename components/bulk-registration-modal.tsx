"use client";

import { useState, useRef, useCallback } from "react";
import { useNetwork } from "@/context/network-context";
import { toast } from "sonner";
import { useBuilderContract } from "@/hooks/use-builder-contract";
import { Upload } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ArbitrumIcon, BaseIcon } from "@/components/network-icons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { networkNameToChainId } from "@/lib/contracts";

interface SubnetData {
  controllingAddress: string;
  subnetName: string;
  minTime: string;
  minStake: string;
}

export function BulkRegistrationModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [csvData, setCsvData] = useState<SubnetData[]>([]);
  const [currentSubnetIndex, setCurrentSubnetIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState<"Arbitrum" | "Base">("Base");
  const [selectedFileName, setSelectedFileName] = useState<string>("Choose file...");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Network integration
  const { currentChainId, switchToChain } = useNetwork();
  const { createSubnet, isConnected } = useBuilderContract();
  
  // Check if user is on the correct network
  const isCorrectNetwork = useCallback(() => {
    const targetChainId = networkNameToChainId[selectedNetwork];
    return currentChainId === targetChainId;
  }, [currentChainId, selectedNetwork]);
  
  // Network switching function
  const switchNetwork = useCallback(async () => {
    const targetChainId = networkNameToChainId[selectedNetwork];
    try {
      await switchToChain(targetChainId);
      return true;
    } catch (error) {
      console.error("Failed to switch network:", error);
      toast.error(`Failed to switch to ${selectedNetwork}`);
      return false;
    }
  }, [selectedNetwork, switchToChain]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Update the selected file name state
    setSelectedFileName(file.name);

    // Check if file is CSV
    if (file.type !== "text/csv" && !file.name.endsWith('.csv')) {
      toast.error("Please upload a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const lines = csvText.split('\n');
        
        // Check if there's a header
        if (lines.length < 2) {
          toast.error("CSV file must contain a header and at least one data row");
          return;
        }
        
        // Parse the header to find column indices
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        const controllingAddressIndex = headers.findIndex(h => 
          h === 'controlling address' || h === 'controllingaddress' || h === 'address');
        const subnetNameIndex = headers.findIndex(h => 
          h === 'subnet name' || h === 'subnetname' || h === 'name');
        const minTimeIndex = headers.findIndex(h => 
          h === 'min time' || h === 'mintime' || h === 'time');
        const minStakeIndex = headers.findIndex(h => 
          h === 'min stake' || h === 'minstake' || h === 'stake');
          
        // Validate required columns exist
        if (controllingAddressIndex === -1 || subnetNameIndex === -1 || 
            minTimeIndex === -1 || minStakeIndex === -1) {
          toast.error("CSV must contain columns for: Controlling Address, Subnet Name, min time, min stake");
          return;
        }
        
        // Parse data rows
        const parsedData: SubnetData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines
          
          const values = line.split(',').map(v => v.trim());
          
          parsedData.push({
            controllingAddress: values[controllingAddressIndex],
            subnetName: values[subnetNameIndex],
            minTime: values[minTimeIndex],
            minStake: values[minStakeIndex]
          });
        }
        
        if (parsedData.length === 0) {
          toast.error("No valid data rows found in CSV");
          return;
        }
        
        setCsvData(parsedData);
        toast.success(`Successfully loaded ${parsedData.length} subnets`);
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast.error("Failed to parse CSV file");
      }
    };
    
    reader.readAsText(file);
  };

  const handleCreateSubnet = async () => {
    if (currentSubnetIndex >= csvData.length) return;
    
    // Check wallet connection
    if (!isConnected) {
      toast.error("Wallet not connected");
      return;
    }
    
    // Handle network switching if needed
    if (!isCorrectNetwork()) {
      toast.loading(`Switching to ${selectedNetwork}...`, {
        id: "network-switch",
      });
      
      setIsProcessing(true);
      const switched = await switchNetwork();
      
      if (switched) {
        toast.success(`Switched to ${selectedNetwork}`, {
          id: "network-switch",
        });
      } else {
        setIsProcessing(false);
      }
      
      return; // Will retry after network switch
    }
    
    // Create the subnet
    setIsProcessing(true);
    const subnet = csvData[currentSubnetIndex];
    
    try {
      const success = await createSubnet(subnet);
      
      if (success) {
        // Move to next subnet
        setCurrentSubnetIndex(prev => prev + 1);
        
        if (currentSubnetIndex + 1 >= csvData.length) {
          toast.success("All subnets created successfully!");
          setTimeout(() => {
            onOpenChange(false);
            resetFileInput();
          }, 1500);
        }
      }
    } catch (error: Error | unknown) {
      toast.error(`Error creating subnet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error("Error creating subnet:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const resetFileInput = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setCsvData([]);
    setCurrentSubnetIndex(0);
    setSelectedFileName("Choose file...");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-background text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-emerald-400">
            Register builders in bulk
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1 space-y-2">
                <Label htmlFor="csv-upload">Upload CSV file</Label>
                <div className="relative">
                  {/* Hidden actual file input */}
                  <input
                    ref={fileInputRef}
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                  {/* Custom file input UI */}
                  <div 
                    className="flex items-center gap-2 px-3 py-2 border border-input rounded-md bg-transparent cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm text-gray-400 truncate">
                      {selectedFileName}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  CSV must include headers and columns for: Controlling Address, Subnet Name, min time, min stake
                </p>
              </div>
              
              <div className="w-[200px] space-y-2">
                <Label htmlFor="network-select">Network</Label>
                <Select
                  value={selectedNetwork}
                  onValueChange={(value: "Arbitrum" | "Base") => setSelectedNetwork(value)}
                >
                  <SelectTrigger id="network-select">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
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
              </div>
            </div>
          </div>

          {csvData.length > 0 && (
            <div className="space-y-4">
              <div className="max-h-[300px] overflow-auto custom-scrollbar">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow>
                      <TableHead>Controlling Address</TableHead>
                      <TableHead>Subnet Name</TableHead>
                      <TableHead>Min Time</TableHead>
                      <TableHead>Min Stake</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.map((item, index) => (
                      <TableRow key={index} className={index < currentSubnetIndex ? "opacity-50" : ""}>
                        <TableCell className="font-mono text-xs">
                          {item.controllingAddress.slice(0, 6)}...{item.controllingAddress.slice(-4)}
                        </TableCell>
                        <TableCell>{item.subnetName}</TableCell>
                        <TableCell>{item.minTime}</TableCell>
                        <TableCell>{item.minStake}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              <div className="text-sm text-gray-300">
                {csvData.length} subnet{csvData.length !== 1 ? 's' : ''} ready to be created.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={resetFileInput}
          >
            Reset
          </Button>
          
          <button 
            type="button" 
            onClick={handleCreateSubnet}
            className={`copy-button ${(!csvData.length || currentSubnetIndex >= csvData.length || (!isConnected && !isCorrectNetwork())) ? "opacity-50 cursor-not-allowed" : ""}`}
            disabled={!csvData.length || currentSubnetIndex >= csvData.length || isProcessing || (!isConnected && !isCorrectNetwork())}
          >
            {!isConnected ? (
              "Connect wallet first"
            ) : !isCorrectNetwork() ? (
              <span className="flex items-center gap-2 align-center justify-center">
                Switch to {' '}
                {selectedNetwork === "Arbitrum" ? (
                  <ArbitrumIcon size={20} className="text-black" fill="#000" />
                ) : (
                  <BaseIcon size={20} className="text-black" fill="#000" />
                )}
              </span>
            ) : csvData.length ? (
              isProcessing ? (
                <span className="flex items-center gap-2">Processing...</span>
              ) : (
                <span>Create subnet {currentSubnetIndex + 1}/{csvData.length}</span>
              )
            ) : (
              "Upload CSV first"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 