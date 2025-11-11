import React, { useEffect, useState } from 'react';
import { getTimeSlotMappings, mapTimeSlotIds } from '@/utils/timeSlotUtils';

interface Props {
  timeSlots: Record<string, any>;
}

export function TimeSlotsList({ timeSlots }: Props) {
  const [timeSlotMappings, setTimeSlotMappings] = useState<Record<string, string>>({});

  useEffect(() => {
    getTimeSlotMappings().then(setTimeSlotMappings);
  }, []);

  const mappedTimeSlots = mapTimeSlotIds(timeSlots, timeSlotMappings);

  return (
    <>
      {Object.entries(mappedTimeSlots).map(([slotLabel, days]) => (
        <div key={slotLabel} className="flex items-center justify-between">
          <span className="font-medium">{slotLabel}:</span>
          <div className="flex gap-2">
            {Array.isArray(days) ? days.join(', ') : String(days)}
          </div>
        </div>
      ))}
    </>
  );
}