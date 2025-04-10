import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface FeeDisplayCardProps {
  formattedFee: string;
  needsApproval: boolean;
  isLoading: boolean;
  tokenSymbol: string;
}

export const FeeDisplayCard: React.FC<FeeDisplayCardProps> = ({
  formattedFee,
  needsApproval,
  isLoading,
  tokenSymbol,
}) => {
  return (
    <Card className="mb-6 bg-slate-950/50 border-emerald-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-emerald-400 flex justify-between items-center">
          <span>Creation Fee</span>
          {!isLoading && formattedFee !== `0 ${tokenSymbol}` && (
            <Badge variant={needsApproval ? "destructive" : "secondary"} className="ml-2">
              {needsApproval ? "Approval Required" : "Ready"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>One-time fee in {tokenSymbol} to create the builder pool.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? "Loading..." : formattedFee}
        </div>
      </CardContent>
    </Card>
  );
};

export default FeeDisplayCard; 