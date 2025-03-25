import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface StatItem {
  label: string;
  value: string | number;
  description?: string;
}

export interface StakingStatsCardProps {
  items: StatItem[];
  columns?: 1 | 2 | 3;
}

export function StakingStatsCard({
  items,
  columns = 3,
}: StakingStatsCardProps) {
  const gridClass = columns === 1 
    ? "grid-cols-1" 
    : columns === 2 
      ? "grid-cols-1 md:grid-cols-2" 
      : "grid-cols-1 md:grid-cols-3";

  return (
    <div className={`grid ${gridClass} gap-4`}>
      {items.map((item, index) => (
        <Card key={index}>
          <CardHeader>
            <CardTitle>{item.label}</CardTitle>
            {item.description && <CardDescription>{item.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-100">
              {typeof item.value === 'number' 
                ? item.value.toLocaleString() 
                : item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Simple single stat card for flexible layouts
export function StatCard({ item }: { item: StatItem }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{item.label}</CardTitle>
        {item.description && <CardDescription>{item.description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-gray-100">
          {typeof item.value === 'number' 
            ? item.value.toLocaleString() 
            : item.value}
        </p>
      </CardContent>
    </Card>
  );
} 