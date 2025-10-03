import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KmData } from "@/hooks/useRacePlanning";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

interface PaceDistributionTableProps {
  data: KmData[];
  formatTime: (seconds: number) => string;
  formatPace: (seconds: number) => string;
  avgPaceSeconds: number;
}

export function PaceDistributionTable({
  data,
  formatTime,
  formatPace,
  avgPaceSeconds,
}: PaceDistributionTableProps) {
  const getPaceIndicator = (pace: number) => {
    const diff = ((pace - avgPaceSeconds) / avgPaceSeconds) * 100;
    if (Math.abs(diff) < 2) {
      return <Minus className="h-4 w-4 text-muted-foreground" />;
    } else if (diff > 0) {
      return <ArrowDown className="h-4 w-4 text-orange-500" />;
    } else {
      return <ArrowUp className="h-4 w-4 text-green-500" />;
    }
  };

  const getPaceColor = (pace: number) => {
    const diff = ((pace - avgPaceSeconds) / avgPaceSeconds) * 100;
    if (Math.abs(diff) < 2) return "text-foreground";
    if (diff > 0) return "text-orange-500";
    return "text-green-500";
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 sm:w-16 text-xs sm:text-sm">Km</TableHead>
              <TableHead className="text-xs sm:text-sm">Pace</TableHead>
              <TableHead className="text-xs sm:text-sm">Tempo</TableHead>
              <TableHead className="text-xs sm:text-sm">Acumulado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.km}>
                <TableCell className="font-medium text-xs sm:text-sm py-2 sm:py-4">{row.km}</TableCell>
                <TableCell className="py-2 sm:py-4">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {getPaceIndicator(row.pace)}
                    <span className={`font-mono text-xs sm:text-sm ${getPaceColor(row.pace)}`}>
                      {formatPace(row.pace)}/km
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs sm:text-sm py-2 sm:py-4">{formatTime(row.time)}</TableCell>
                <TableCell className="font-mono font-medium text-xs sm:text-sm py-2 sm:py-4">{formatTime(row.accumulatedTime)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
