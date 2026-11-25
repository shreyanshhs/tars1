import React from 'react';
import { TarsProvider, useTars } from './context/TarsContext';
import { AppLayout } from './components/layout/AppLayout';
import { TodayView } from './components/views/TodayView';
import { NudgesView } from './components/views/NudgesView';
import { EventsView } from './components/views/EventsView';
import { ScheduleView } from './components/views/ScheduleView';
import { AdminConsoleView } from './components/views/AdminConsoleView';
import { ActivityView } from './components/views/ActivityView';
import { NptelPicksMobileView } from './components/views/student';

const ViewRouter: React.FC = () => {
  const { currentView } = useTars();

  switch (currentView) {
    case 'today':
    case 'home':
      return <TodayView />;
    case 'nudges':
      return <NudgesView />;
    case 'events':
      return <EventsView />;
    case 'schedule':
      return <ScheduleView />;
    case 'activity':
      return <ActivityView />;
    case 'nptel':
      return <NptelPicksMobileView />;
    case 'admin':
      return <AdminConsoleView />;
    default:
      return <TodayView />;
  }
};

export function App() {
  return (
    <TarsProvider>
      <AppLayout>
        <ViewRouter />
      </AppLayout>
    </TarsProvider>
  );
}

export default App;
