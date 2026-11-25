import React from 'react';
import { TarsProvider, useTars } from './context/TarsContext';
import { AppLayout } from './components/layout/AppLayout';
import { TodayView } from './components/views/TodayView';
import { NudgesView } from './components/views/NudgesView';
import { EventsView } from './components/views/EventsView';
import { ScheduleView } from './components/views/ScheduleView';
import { AdminConsoleView } from './components/views/AdminConsoleView';

const ViewRouter: React.FC = () => {
  const { currentView } = useTars();

  switch (currentView) {
    case 'today':
      return <TodayView />;
    case 'nudges':
      return <NudgesView />;
    case 'events':
      return <EventsView />;
    case 'schedule':
      return <ScheduleView />;
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
