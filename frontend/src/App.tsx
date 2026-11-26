import React, { useState } from 'react';
import { TarsProvider, useTars } from './context/TarsContext';
import { AppLayout } from './components/layout/AppLayout';
import { TodayView } from './components/views/TodayView';
import { NudgesView } from './components/views/NudgesView';
import { EventsView } from './components/views/EventsView';
import { ScheduleView } from './components/views/ScheduleView';
import { AdminConsoleView } from './components/views/AdminConsoleView';

// Teacher Views (Slice 1)
import { TeacherHomeView } from './components/views/teacher/TeacherHomeView';
import { ApplyForLeaveModal } from './components/views/teacher/ApplyForLeaveModal';
import { LeaveInProgressView } from './components/views/teacher/LeaveInProgressView';
import { CoverRequestCard } from './components/views/teacher/CoverRequestCard';
import { ComingSoonView } from './components/views/teacher/ComingSoonView';
import { MyClassesView } from './components/views/teacher/MyClassesView';
import { HodClassesView } from './components/views/hod/HodClassesView';
import { ApprovalsView } from './components/views/hod/ApprovalsView';
import { NptelView } from './components/views/nptel/NptelView';
import { ActivityView } from './components/views/activity/ActivityView';
import { HelpView } from './components/views/help/HelpView';
import { SettingsView } from './components/views/settings/SettingsView';
import { GoogleMeetView } from './components/views/meet/GoogleMeetView';

const MainContent: React.FC = () => {
  const { role, setRole, currentView, setCurrentView, hasActiveLeave, cancelLeave } = useTars();
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const handleApplySuccess = (_leaveId: string) => {
    setCurrentView('leave');
  };

  const handleCancelLeave = () => {
    cancelLeave();
    setCurrentView('home');
  };

  // 1. Faculty View Flow
  if (role === 'faculty') {
    let content: React.ReactNode;

    switch (currentView) {
      case 'home':
      case 'today':
        content = (
          <TeacherHomeView
            onApplyLeave={() => setApplyModalOpen(true)}
            onViewLeaveProgress={() => setCurrentView('leave')}
            onOpenCoverRequest={() => setCoverModalOpen(true)}
            hasActiveLeave={hasActiveLeave}
          />
        );
        break;
      case 'leave':
        content = (
          <LeaveInProgressView
            onBackToHome={() => setCurrentView('home')}
            onCancelLeave={handleCancelLeave}
            onSwitchToHod={() => {
              setRole('hod');
              setCurrentView('approvals');
            }}
          />
        );
        break;
      case 'cover':
        content = (
          <div className="flex-1 min-h-[80vh] flex items-center justify-center p-6">
            <CoverRequestCard
              onAccept={() => setCurrentView('home')}
              onDecline={() => setCurrentView('home')}
            />
          </div>
        );
        break;
      case 'classes':
        content = <MyClassesView />;
        break;
      case 'meet':
        content = <GoogleMeetView />;
        break;
      case 'attendance':
        content = <ComingSoonView feature="attendance" />;
        break;
      case 'events':
        content = <EventsView />;
        break;
      case 'schedule':
        content = <ScheduleView />;
        break;
      case 'inbox':
      case 'nudges':
        content = <NudgesView />;
        break;
      case 'nptel':
        content = <NptelView />;
        break;
      case 'help':
        content = <HelpView />;
        break;
      case 'settings':
        content = <SettingsView />;
        break;
      default:
        content = (
          <TeacherHomeView
            onApplyLeave={() => setApplyModalOpen(true)}
            onViewLeaveProgress={() => setCurrentView('leave')}
            onOpenCoverRequest={() => setCoverModalOpen(true)}
          />
        );
    }

    return (
      <>
        {content}
        <ApplyForLeaveModal
          isOpen={applyModalOpen}
          onClose={() => setApplyModalOpen(false)}
          onSubmitSuccess={handleApplySuccess}
        />
        {coverModalOpen && (
          <CoverRequestCard
            isModal={true}
            onClose={() => setCoverModalOpen(false)}
            onAccept={() => setCoverModalOpen(false)}
            onDecline={() => setCoverModalOpen(false)}
          />
        )}
      </>
    );
  }

  // 2. HOD View Flow
  if (role === 'hod') {
    switch (currentView) {
      case 'home':
      case 'approvals':
      case 'leave':
        return <ApprovalsView />;
      case 'activity':
        return <ActivityView />;
      case 'admin':
        return <AdminConsoleView />;
      case 'schedule':
        return <ScheduleView />;
      case 'inbox':
      case 'nudges':
        return <NudgesView />;
      case 'nptel':
        return <NptelView />;
      case 'events':
        return <EventsView />;
      case 'classes':
        return <HodClassesView />;
      case 'meet':
        return <GoogleMeetView />;
      case 'attendance':
        return <ComingSoonView feature="attendance" />;
      case 'help':
        return <HelpView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <AdminConsoleView />;
    }
  }

  // 3. Student View Flow
  switch (currentView) {
    case 'home':
    case 'today':
      return <TodayView />;
    case 'inbox':
    case 'nudges':
      return <NudgesView />;
    case 'nptel':
      return <NptelView />;
    case 'events':
      return <EventsView />;
    case 'schedule':
      return <ScheduleView />;
    case 'classes':
      return <MyClassesView />;
    case 'meet':
      return <GoogleMeetView />;
    case 'attendance':
      return <ComingSoonView feature="attendance" />;
    case 'help':
      return <HelpView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <TodayView />;
  }
};

export function App() {
  return (
    <TarsProvider>
      <AppLayout>
        <MainContent />
      </AppLayout>
    </TarsProvider>
  );
}

export default App;
