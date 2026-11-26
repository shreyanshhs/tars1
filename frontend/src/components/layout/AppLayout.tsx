import React, { useState } from 'react';
import { useTars } from '../../context/TarsContext';
import { api } from '../../services/api';
import type { ViewTab, Role } from '../../types/tars';

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, setRole, currentView, setCurrentView, activeFacultyId, setActiveFacultyId } = useTars();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingPersona, setPendingPersona] = useState<{
    role: Role;
    facultyId?: string;
    name: string;
    loginId: string;
  } | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handlePromptPersona = (newRole: Role, facultyId?: string, name?: string, loginId?: string) => {
    setUserDropdownOpen(false);
    setAuthError(null);
    setPasswordInput('');
    setPendingPersona({
      role: newRole,
      facultyId,
      name: name || newRole,
      loginId: loginId || (newRole === 'hod' ? 'H_SKB' : newRole === 'student' ? 'S0000' : (facultyId || 'F_CDB')),
    });
  };

  const handleConfirmAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingPersona) return;
    setIsAuthLoading(true);
    setAuthError(null);
    try {
      const res = await api.auth.login(pendingPersona.loginId, passwordInput);
      if (res && res.token) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`tars_pw_${pendingPersona.loginId}`, passwordInput);
        }
        if (pendingPersona.role === 'faculty') {
          setActiveFacultyId(pendingPersona.facultyId || 'F_CDB');
        }
        setRole(pendingPersona.role, pendingPersona.facultyId);
        if (pendingPersona.role === 'hod') {
          setCurrentView('approvals');
        } else {
          setCurrentView('home');
        }
        setPendingPersona(null);
        setPasswordInput('');
      } else {
        throw new Error('Authentication rejected');
      }
    } catch {
      setAuthError('Authentication failed: Invalid credentials or password (HTTP 401).');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Active persona based on role & faculty identity (Safeguard 1: F_SMP and F_GPL demo personas)
  const isSmp = role === 'faculty' && activeFacultyId === 'F_SMP';
  const isGpl = role === 'faculty' && activeFacultyId === 'F_GPL';
  const persona =
    role === 'student'
      ? {
          name: 'Shreyansh',
          title: 'Student · CSE-10',
          roleLabel: 'Student',
          initials: 'SH',
        }
      : role === 'hod'
      ? {
          name: 'Dr. Surekha K B',
          title: 'Professor & HOD · CSE',
          roleLabel: 'HOD',
          initials: 'SK',
        }
      : isSmp
      ? {
          name: 'Mr. Syed Matheen Pasha',
          title: 'Assistant Professor · AI/ML (Substitute)',
          roleLabel: 'Faculty (Substitute)',
          initials: 'SP',
        }
      : isGpl
      ? {
          name: 'Mrs. Geetha P L',
          title: 'Assistant Professor · CSE (Lab Substitute)',
          roleLabel: 'Faculty (Substitute)',
          initials: 'GP',
        }
      : {
          name: 'Prof. Chaitra D B',
          title: 'Assistant Professor · AI/ML',
          roleLabel: 'Faculty',
          initials: 'CD',
        };

  // Build role-based navigation groups following Google Stitch design
  const getNavGroups = () => {
    if (role === 'faculty') {
      return [
        {
          title: 'General',
          items: [
            { id: 'home' as ViewTab, label: 'Home', icon: 'home' },
            { id: 'inbox' as ViewTab, label: 'Inbox', icon: 'inbox', badge: 3 },
            { id: 'schedule' as ViewTab, label: 'Schedule', icon: 'calendar_today' },
          ],
        },
        {
          title: 'Requests',
          items: [
            { id: 'leave' as ViewTab, label: 'Leave', icon: 'event_busy' },
            { id: 'nptel' as ViewTab, label: 'NPTEL', icon: 'workspace_premium', badge: 6 },
            { id: 'events' as ViewTab, label: 'Events', icon: 'event' },
          ],
        },
        {
          title: 'Coming soon',
          items: [
            { id: 'meet' as ViewTab, label: 'Google Meet', icon: 'videocam', badgeText: 'BETA' },
            { id: 'classes' as ViewTab, label: 'Classes', icon: 'school', badgeText: 'BETA' },
            { id: 'attendance' as ViewTab, label: 'Attendance', icon: 'fact_check', badgeText: 'BETA' },
          ],
        },
      ];
    }

    if (role === 'hod') {
      return [
        {
          title: 'General',
          items: [
            { id: 'home' as ViewTab, label: 'Home', icon: 'home' },
            { id: 'approvals' as ViewTab, label: 'Approvals', icon: 'check_circle', badge: 2, badgeColor: 'bg-status-waiting-bg text-status-waiting border border-status-waiting-border' },
            { id: 'inbox' as ViewTab, label: 'Inbox', icon: 'inbox', badge: 3 },
            { id: 'schedule' as ViewTab, label: 'Schedule', icon: 'calendar_today' },
          ],
        },
        {
          title: 'Requests',
          items: [
            { id: 'leave' as ViewTab, label: 'Leave', icon: 'event_busy' },
            { id: 'nptel' as ViewTab, label: 'NPTEL', icon: 'workspace_premium', badge: 6 },
            { id: 'events' as ViewTab, label: 'Events', icon: 'event' },
          ],
        },
        {
          title: 'Insights',
          items: [
            { id: 'activity' as ViewTab, label: 'TARS activity', icon: 'auto_awesome' },
            { id: 'insights' as ViewTab, label: 'Department', icon: 'bar_chart' },
          ],
        },
        {
          title: 'Coming soon',
          items: [
            { id: 'meet' as ViewTab, label: 'Google Meet', icon: 'videocam', badgeText: 'BETA' },
            { id: 'classes' as ViewTab, label: 'Classes', icon: 'school', badgeText: 'BETA' },
            { id: 'attendance' as ViewTab, label: 'Attendance', icon: 'fact_check', badgeText: 'BETA' },
          ],
        },
      ];
    }

    // Default: Student
    return [
      {
        title: 'General',
        items: [
          { id: 'home' as ViewTab, label: 'Home', icon: 'home' },
          { id: 'inbox' as ViewTab, label: 'Inbox', icon: 'inbox', badge: 1 },
          { id: 'schedule' as ViewTab, label: 'Schedule', icon: 'calendar_today' },
        ],
      },
      {
        title: 'Requests',
        items: [
          { id: 'nptel' as ViewTab, label: 'NPTEL', icon: 'workspace_premium' },
          { id: 'events' as ViewTab, label: 'Events', icon: 'event' },
        ],
      },
      {
        title: 'Coming soon',
        items: [
          { id: 'meet' as ViewTab, label: 'Google Meet', icon: 'videocam', badgeText: 'BETA' },
          { id: 'classes' as ViewTab, label: 'Classes', icon: 'school', badgeText: 'BETA' },
          { id: 'attendance' as ViewTab, label: 'Attendance', icon: 'fact_check', badgeText: 'BETA' },
        ],
      },
    ];
  };

  const navGroups = getNavGroups();

  return (
    <div className="min-h-screen flex bg-surface text-on-surface font-body antialiased">
      {/* Mobile Top Navbar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-sidebar text-on-sidebar border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-on-primary font-headline text-label-md shrink-0">
            T
          </span>
          <span className="font-title text-title-sm text-on-sidebar">TARS · BMSIT CSE</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded text-sidebar-muted hover:text-on-sidebar hover:bg-sidebar-surface transition-colors"
          aria-label="Toggle navigation menu"
        >
          <span className="material-symbols-outlined text-[22px]">
            {mobileMenuOpen ? 'close' : 'menu'}
          </span>
        </button>
      </div>

      {/* Dark Navy Sidebar (Google Stitch Design Source of Truth) */}
      <aside
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:flex fixed lg:sticky top-0 left-0 z-40 h-screen w-60 shrink-0 flex-col justify-between bg-sidebar text-on-sidebar border-r border-sidebar-border px-3.5 py-5 overflow-y-auto select-none`}
      >
        <div className="flex flex-col gap-6">
          {/* Workspace Switcher */}
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded bg-sidebar-surface border border-sidebar-border text-left hover:opacity-90 transition-opacity duration-state-change"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-sm bg-primary text-on-primary font-headline text-label-md shrink-0">
                T
              </span>
              <span className="font-title text-title-sm text-on-sidebar truncate">
                TARS · BMSIT CSE
              </span>
            </div>
            <span className="material-symbols-outlined text-[18px] text-sidebar-muted shrink-0" aria-hidden="true">
              unfold_more
            </span>
          </button>

          {/* Navigation Groups */}
          <nav aria-label="Primary navigation" className="flex flex-col gap-5">
            {navGroups.map((group) => (
              <div key={group.title} className="flex flex-col gap-1">
                <p className="px-2.5 pb-1 font-label text-label-sm text-sidebar-muted">
                  {group.title}
                </p>
                {group.items.map((item: any) => {
                  const isActive =
                    currentView === item.id ||
                    (item.id === 'home' && currentView === 'today') ||
                    (item.id === 'leave' && currentView === 'cover');

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCurrentView(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded transition-colors duration-state-change text-left ${
                        isActive
                          ? 'bg-sidebar-surface text-on-sidebar font-medium'
                          : 'text-sidebar-muted hover:bg-sidebar-surface hover:text-on-sidebar'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`material-symbols-outlined text-[18px] ${
                            isActive ? 'text-on-sidebar' : 'text-sidebar-muted'
                          }`}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        <span className="font-label text-label-md truncate">{item.label}</span>
                      </span>

                      {item.badge !== undefined && (
                        <span
                          role="status"
                          className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full tabular-nums text-label-sm ${
                            item.badgeColor || 'bg-sidebar-surface text-on-sidebar border border-sidebar-border'
                          }`}
                        >
                          <span className="font-label text-label-sm">{item.badge}</span>
                        </span>
                      )}

                      {item.badgeText && (
                        <span className="px-1.5 py-0.5 rounded-sm bg-sidebar-surface border border-sidebar-border text-on-sidebar font-label text-label-sm">
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
        <div className="flex flex-col gap-3 pt-4">
          {/* Time Saved Card */}
          <div className="p-3 rounded-md bg-sidebar-surface border border-sidebar-border flex items-start gap-2.5">
            <span
              className="material-symbols-outlined text-[18px] text-primary-soft shrink-0 mt-0.5"
              aria-hidden="true"
            >
              schedule
            </span>
            <p className="font-body text-body-sm text-on-sidebar text-pretty">
              TARS saved you 3 h this week
            </p>
          </div>

          {/* Help & Settings */}
          <div className="flex flex-col gap-1 border-t border-sidebar-border pt-3">
            <button
              type="button"
              onClick={() => {
                setCurrentView('help');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors duration-state-change text-left ${
                currentView === 'help'
                  ? 'bg-sidebar-surface text-on-sidebar font-medium'
                  : 'text-sidebar-muted hover:bg-sidebar-surface hover:text-on-sidebar'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentView === 'help' ? 'text-on-sidebar' : 'text-sidebar-muted'
                }`}
                aria-hidden="true"
              >
                help_outline
              </span>
              <span className="font-label text-label-md">Help</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentView('settings');
                setMobileMenuOpen(false);
              }}
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded transition-colors duration-state-change text-left ${
                currentView === 'settings'
                  ? 'bg-sidebar-surface text-on-sidebar font-medium'
                  : 'text-sidebar-muted hover:bg-sidebar-surface hover:text-on-sidebar'
              }`}
            >
              <span
                className={`material-symbols-outlined text-[18px] ${
                  currentView === 'settings' ? 'text-on-sidebar' : 'text-sidebar-muted'
                }`}
                aria-hidden="true"
              >
                settings
              </span>
              <span className="font-label text-label-md">Settings</span>
            </button>
          </div>

          {/* User Card & Role Switcher */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-md bg-sidebar-surface border border-sidebar-border hover:opacity-90 transition-opacity text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-on-primary font-label text-label-sm shrink-0">
                  {persona.initials}
                </span>
                <div className="min-w-0">
                  <p className="font-title text-title-sm text-on-sidebar truncate">{persona.name}</p>
                  <p className="font-body text-body-sm text-sidebar-muted truncate">{persona.roleLabel}</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-[16px] text-sidebar-muted shrink-0">
                unfold_more
              </span>
            </button>

            {/* Persona Switcher Dropdown */}
            {userDropdownOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-lg bg-[#1E293B] border border-[#334155] shadow-2xl flex flex-col gap-1 z-50">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Switch Persona (Demo)
                </p>
                <button
                  type="button"
                  onClick={() => handlePromptPersona('faculty', 'F_CDB', 'Prof. Chaitra D B', 'F_CDB')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                    role === 'faculty' && activeFacultyId !== 'F_SMP' && activeFacultyId !== 'F_GPL'
                      ? 'bg-primary text-white font-semibold'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-900 font-bold text-[10px] flex items-center justify-center">
                    CD
                  </span>
                  <div>
                    <p className="font-medium">Prof. Chaitra D B</p>
                    <p className="text-[10px] opacity-75">Assistant Professor · AI/ML</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptPersona('faculty', 'F_SMP', 'Mr. Syed Matheen Pasha', 'F_SMP')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                    role === 'faculty' && activeFacultyId === 'F_SMP'
                      ? 'bg-primary text-white font-semibold'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-cyan-200 text-cyan-900 font-bold text-[10px] flex items-center justify-center">
                    SP
                  </span>
                  <div>
                    <p className="font-medium">Mr. Syed Matheen Pasha</p>
                    <p className="text-[10px] opacity-75">Assistant Professor · Substitute (AI)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptPersona('faculty', 'F_GPL', 'Mrs. Geetha P L', 'F_GPL')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                    role === 'faculty' && activeFacultyId === 'F_GPL'
                      ? 'bg-primary text-white font-semibold'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center">
                    GP
                  </span>
                  <div>
                    <p className="font-medium">Mrs. Geetha P L</p>
                    <p className="text-[10px] opacity-75">Assistant Professor · Substitute (Lab)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptPersona('hod', undefined, 'Dr. Surekha K B', 'H_SKB')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                    role === 'hod'
                      ? 'bg-primary text-white font-semibold'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-900 font-bold text-[10px] flex items-center justify-center">
                    SK
                  </span>
                  <div>
                    <p className="font-medium">Dr. Surekha K B</p>
                    <p className="text-[10px] opacity-75">Professor &amp; HOD · CSE</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handlePromptPersona('student', undefined, 'Shreyansh', 'S0000')}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                    role === 'student'
                      ? 'bg-primary text-white font-semibold'
                      : 'text-slate-200 hover:bg-slate-700/60'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 font-bold text-[10px] flex items-center justify-center">
                    SH
                  </span>
                  <div>
                    <p className="font-medium">Shreyansh</p>
                    <p className="text-[10px] opacity-75">Student · CSE-10</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col pt-14 lg:pt-0">
        {children}
      </div>

      {/* Password Authentication Modal */}
      {pendingPersona && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl flex flex-col gap-4 text-white animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-400">lock</span>
                <span>Sign in to switch persona</span>
              </h3>
              <button
                type="button"
                onClick={() => { setPendingPersona(null); setAuthError(null); }}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs flex flex-col gap-1">
              <span className="font-semibold text-slate-100 text-sm">{pendingPersona.name}</span>
              <div className="flex items-center justify-between text-slate-400 text-[11px] font-mono">
                <span>Login ID: {pendingPersona.loginId}</span>
                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300 uppercase">{pendingPersona.role}</span>
              </div>
            </div>

            {authError && (
              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">error</span>
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAuth} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-300 font-medium">Password</label>
                <input
                  type="password"
                  autoFocus
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter password (e.g. bmsit)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => { setPendingPersona(null); setAuthError(null); }}
                  className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuthLoading || !passwordInput}
                  className="px-4 py-1.5 rounded text-xs bg-blue-600 hover:bg-blue-700 font-semibold text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isAuthLoading ? (
                    <>
                      <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Authenticate</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
