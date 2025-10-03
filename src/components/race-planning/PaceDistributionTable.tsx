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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Km</TableHead>
            <TableHead>Pace</TableHead>
            <TableHead>Tempo</TableHead>
            <TableHead>Acumulado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.km}>
              <TableCell className="font-medium">{row.km}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {getPaceIndicator(row.pace)}
                  <span className={`font-mono ${getPaceColor(row.pace)}`}>
                    {formatPace(row.pace)}/km
                  </span>
                </div>
              </TableCell>
              <TableCell className="font-mono">{formatTime(row.time)}</TableCell>
              <TableCell className="font-mono font-medium">{formatTime(row.accumulatedTime)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
