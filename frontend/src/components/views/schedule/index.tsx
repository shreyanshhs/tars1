import React, { useState } from 'react';
import { ScheduleWeekView } from './ScheduleWeekView';
import { ScheduleDayView } from './ScheduleDayView';

export const ScheduleView: React.FC = () => {
  const [activeView, setActiveView] = useState<'week' | 'day'>('week');

  if (activeView === 'day') {
    return <ScheduleDayView activeView={activeView} onSwitchView={setActiveView} />;
  }

  return <ScheduleWeekView activeView={activeView} onSwitchView={setActiveView} />;
};

export default ScheduleView;
