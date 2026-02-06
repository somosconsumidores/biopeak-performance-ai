import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, Loader2 } from 'lucide-react';
import { usePersonalRecords, SportCategory } from '@/hooks/usePersonalRecords';
import { PersonalRecordCard } from './PersonalRecordCard';
import { usePlatform } from '@/hooks/usePlatform';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const CATEGORIES: SportCategory[] = ['RUNNING', 'CYCLING', 'SWIMMING'];

export function PersonalRecordsCarousel() {
  const { records, loading, error, hasAnyRecords } = usePersonalRecords();
  const { isNative } = usePlatform();

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Meus Recordes Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-[280px] flex-shrink-0 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Don't show the section if no records exist
  if (!hasAnyRecords) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Meus Recordes Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {/* Desktop: grid layout */}
          {!isNative && (
            <div className="hidden md:grid md:grid-cols-3 gap-4">
              {CATEGORIES.map((category) => (
                <PersonalRecordCard
                  key={category}
                  category={category}
                  records={records[category]}
                />
              ))}
            </div>
          )}

          {/* Mobile/Native: horizontal scroll carousel */}
          <div className={`${isNative ? 'flex' : 'flex md:hidden'} gap-4 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide`}>
            {CATEGORIES.map((category) => (
              <div key={category} className="snap-start">
                <PersonalRecordCard
                  category={category}
                  records={records[category]}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
