import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';
import type { ViewTab, Role } from '../../types/tars';
import {
  Home,
  Inbox,
  Calendar,
  CalendarDays,
  FileText,
  Award,
  Sparkles,
  BarChart3,
  CheckSquare,
  School,
  Clock,
  HelpCircle,
  Settings,
  ChevronUp,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

interface NavItem {
  id: ViewTab;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
}

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, setRole, currentView, setCurrentView } = useTars();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Active persona based on role
  const persona = {
    student: {
      name: 'Shreyansh',
      title: 'Student · CSE-10',
      initials: 'SH',
      loginId: 'shreyansh',
    },
    faculty: {
      name: 'Prof. Chaitra D B',
      title: 'Assistant Professor · AI/ML',
      initials: 'CD',
      loginId: 'chaitra',
    },
    hod: {
      name: 'Dr. Surekha K B',
      title: 'Professor & HOD · CSE',
      initials: 'SK',
      loginId: 'surekha',
    },
  }[role] || {
    name: 'Prof. Chaitra D B',
    title: 'Assistant Professor',
    initials: 'CD',
    loginId: 'chaitra',
  };

  // Build role-based navigation groups
  const getNavGroups = () => {
    if (role === 'faculty') {
      return [
        {
          title: 'General',
          items: [
            { id: 'home' as ViewTab, label: 'Home', icon: <Home className="w-4 h-4" /> },
            { id: 'inbox' as ViewTab, label: 'Inbox', icon: <Inbox className="w-4 h-4" />, badge: 3 },
            { id: 'schedule' as ViewTab, label: 'Schedule', icon: <CalendarDays className="w-4 h-4" /> },
          ],
        },
        {
          title: 'Requests',
          items: [
            { id: 'leave' as ViewTab, label: 'Leave', icon: <FileText className="w-4 h-4" /> },
            { id: 'nptel' as ViewTab, label: 'NPTEL', icon: <Award className="w-4 h-4" />, badge: 6 },
            { id: 'events' as ViewTab, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
          ],
        },
        {
          title: 'Coming soon',
          items: [
            { id: 'classes' as ViewTab, label: 'Classes', icon: <School className="w-4 h-4" />, badgeText: 'BETA' },
            { id: 'attendance' as ViewTab, label: 'Attendance', icon: <CheckSquare className="w-4 h-4" />, badgeText: 'BETA' },
          ],
        },
      ];
    }

    if (role === 'hod') {
      return [
        {
          title: 'General',
          items: [
            { id: 'home' as ViewTab, label: 'Home', icon: <Home className="w-4 h-4" /> },
            { id: 'approvals' as ViewTab, label: 'Approvals', icon: <CheckCircle2 className="w-4 h-4" />, badge: 1, badgeColor: 'bg-amber-500' },
            { id: 'inbox' as ViewTab, label: 'Inbox', icon: <Inbox className="w-4 h-4" />, badge: 3 },
            { id: 'schedule' as ViewTab, label: 'Schedule', icon: <CalendarDays className="w-4 h-4" /> },
          ],
        },
        {
          title: 'Requests',
          items: [
            { id: 'leave' as ViewTab, label: 'Leave', icon: <FileText className="w-4 h-4" /> },
            { id: 'nptel' as ViewTab, label: 'NPTEL', icon: <Award className="w-4 h-4" />, badge: 6 },
            { id: 'events' as ViewTab, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
          ],
        },
        {
          title: 'Insights',
          items: [
            { id: 'activity' as ViewTab, label: 'TARS activity', icon: <Sparkles className="w-4 h-4" /> },
            { id: 'insights' as ViewTab, label: 'Department', icon: <BarChart3 className="w-4 h-4" /> },
          ],
        },
        {
          title: 'Coming soon',
          items: [
            { id: 'classes' as ViewTab, label: 'Classes', icon: <School className="w-4 h-4" />, badgeText: 'BETA' },
            { id: 'attendance' as ViewTab, label: 'Attendance', icon: <CheckSquare className="w-4 h-4" />, badgeText: 'BETA' },
          ],
        },
      ];
    }

    // Default: Student
    return [
      {
        title: 'General',
        items: [
          { id: 'home' as ViewTab, label: 'Home', icon: <Home className="w-4 h-4" /> },
          { id: 'inbox' as ViewTab, label: 'Inbox', icon: <Inbox className="w-4 h-4" />, badge: 1 },
          { id: 'schedule' as ViewTab, label: 'Schedule', icon: <CalendarDays className="w-4 h-4" /> },
        ],
      },
      {
        title: 'Requests',
        items: [
          { id: 'nptel' as ViewTab, label: 'NPTEL', icon: <Award className="w-4 h-4" /> },
          { id: 'events' as ViewTab, label: 'Events', icon: <Calendar className="w-4 h-4" /> },
        ],
      },
      {
        title: 'Coming soon',
        items: [
          { id: 'classes' as ViewTab, label: 'Classes', icon: <School className="w-4 h-4" />, badgeText: 'BETA' },
          { id: 'attendance' as ViewTab, label: 'Attendance', icon: <CheckSquare className="w-4 h-4" />, badgeText: 'BETA' },
        ],
      },
    ];
  };

  const navGroups = getNavGroups();

  const handleSwitchPersona = (newRole: Role) => {
    setRole(newRole);
    setUserDropdownOpen(false);
    setCurrentView('home');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F8FAFC] font-sans text-slate-800">
      {/* Dark Navy Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col justify-between bg-[#0F172A] text-[#F8FAFC] border-r border-[#334155] px-3.5 py-4 z-20 select-none">
        <div className="flex flex-col gap-5 overflow-y-auto pr-1">
          {/* Workspace Switcher */}
          <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#1E293B] border border-[#334155]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-[#4F46E5] text-white font-bold text-sm shrink-0">
                T
              </span>
              <span className="font-semibold text-sm text-[#F8FAFC] truncate">
                TARS · BMSIT CSE
              </span>
            </div>
          </div>

          {/* Navigation Groups */}
          <nav aria-label="Primary navigation" className="flex flex-col gap-4">
            {navGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  {group.title}
                </p>
                {group.items.map((item: any) => {
                  const isActive = currentView === item.id || (item.id === 'home' && currentView === 'today');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setCurrentView(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-[#1E293B] text-white border border-[#334155]'
                          : 'text-[#94A3B8] hover:bg-[#1E293B]/70 hover:text-[#F8FAFC]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className={isActive ? 'text-[#818CF8]' : 'text-[#94A3B8]'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>

                      {item.badge !== undefined && (
                        <span
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold text-white tabular-nums ${
                            item.badgeColor || 'bg-[#4F46E5]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}

                      {item.badgeText && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#1E293B] border border-[#334155] text-[#94A3B8]">
                          {item.badgeText}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Sidebar Stack */}
        <div className="flex flex-col gap-3 pt-3 border-t border-[#334155]">
          {/* Time Saved Card */}
          <div className="p-3 rounded-lg bg-[#1E293B] border border-[#334155] flex items-start gap-2.5">
            <Clock className="w-4 h-4 text-[#818CF8] shrink-0 mt-0.5" />
            <p className="text-xs text-[#F8FAFC] leading-snug">
              TARS saved you <span className="font-semibold text-indigo-400">3 h</span> this week
            </p>
          </div>

          {/* Help & Settings */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Help & Docs</span>
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
          </div>

          {/* User Card & Demo Persona Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg bg-[#1E293B] border border-[#334155] hover:border-slate-500 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#4F46E5] text-white font-bold text-xs shrink-0">
                  {persona.initials}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F8FAFC] truncate">{persona.name}</p>
                  <p className="text-[11px] text-[#94A3B8] truncate">{persona.title}</p>
                </div>
              </div>
              <ChevronUp className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
            </button>

            {/* Persona Switcher Popover */}
            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-2 rounded-lg bg-[#1E293B] border border-[#334155] shadow-xl z-50 flex flex-col gap-1 text-xs">
                <div className="px-2 py-1 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Switch Demo Account
                </div>
                <button
                  onClick={() => handleSwitchPersona('faculty')}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                    role === 'faculty' ? 'bg-[#4F46E5] text-white font-semibold' : 'text-slate-300 hover:bg-[#334155]'
                  }`}
                >
                  <span>Prof. Chaitra D B (Faculty)</span>
                  {role === 'faculty' && <UserCheck className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleSwitchPersona('hod')}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                    role === 'hod' ? 'bg-[#4F46E5] text-white font-semibold' : 'text-slate-300 hover:bg-[#334155]'
                  }`}
                >
                  <span>Dr. Surekha K B (HOD)</span>
                  {role === 'hod' && <UserCheck className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => handleSwitchPersona('student')}
                  className={`w-full text-left px-2 py-1.5 rounded flex items-center justify-between ${
                    role === 'student' ? 'bg-[#4F46E5] text-white font-semibold' : 'text-slate-300 hover:bg-[#334155]'
                  }`}
                >
                  <span>Shreyansh (Student · CSE-10)</span>
                  {role === 'student' && <UserCheck className="w-3.5 h-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Page Area */}
      <main className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {children}
      </main>
    </div>
  );
};
