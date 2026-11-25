import { Suspense, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Award, BarChart3, Calendar, CalendarDays, CheckCircle2, CheckSquare, ChevronDown,
  ChevronRight, FileText, Home, Inbox, Menu, School, Sparkles, UserCheck, X,
} from 'lucide-react';

import { useTars } from '../../context/TarsContext';
import type { Role, ViewTab } from '../../types/tars';
import './appLayout.css';

const personas = {
  student: { name: 'Shreyansh', roleLabel: 'Student', detail: 'Student · CSE-10', initials: 'SH' },
  faculty: { name: 'Prof. Chaitra D B', roleLabel: 'Faculty', detail: 'Assistant Professor · AI/ML', initials: 'CD' },
  hod: { name: 'Dr. Surekha K B', roleLabel: 'HOD', detail: 'Professor & HOD · CSE', initials: 'SK' },
} satisfies Record<Role, { name: string; roleLabel: string; detail: string; initials: string }>;

const items = {
  home: { id: 'home', label: 'Home', icon: Home },
  inbox: { id: 'inbox', label: 'Inbox', icon: Inbox },
  schedule: { id: 'schedule', label: 'Schedule', icon: CalendarDays },
  approvals: { id: 'approvals', label: 'Approvals', icon: CheckCircle2 },
  leave: { id: 'leave', label: 'Leave', icon: FileText },
  nptel: { id: 'nptel', label: 'NPTEL', icon: Award },
  events: { id: 'events', label: 'Events', icon: Calendar },
  activity: { id: 'activity', label: 'TARS activity', icon: Sparkles },
  insights: { id: 'insights', label: 'Department', icon: BarChart3 },
  classes: { id: 'classes', label: 'Classes', icon: School },
  attendance: { id: 'attendance', label: 'Attendance', icon: CheckSquare },
} satisfies Partial<Record<ViewTab, { id: ViewTab; label: string; icon: typeof Home }>>;

type NavKey = keyof typeof items;
type NavGroup = { label: string; pages: NavKey[] };

function navigation(role: Role): NavGroup[] {
  const staff = role !== 'student';
  return [
    { label: 'General', pages: role === 'hod' ? ['home', 'approvals', 'inbox', 'schedule'] : ['home', 'inbox', 'schedule'] },
    { label: 'Requests', pages: staff ? ['leave', 'nptel', 'events'] : ['nptel', 'events'] },
    ...(role === 'hod' ? [{ label: 'Insights', pages: ['activity', 'insights'] } satisfies NavGroup] : []),
    { label: 'Coming soon', pages: ['classes', 'attendance'] },
  ];
}

// App.tsx currently renders these views. Staff home and workflow routes are
// integrated by their owners when their screens are ready.
const routedViews = new Set<ViewTab>(['today', 'nudges', 'schedule', 'nptel', 'events', 'admin']);

function navKey(view: ViewTab): NavKey | undefined {
  if (view === 'today') return 'home';
  if (view === 'nudges') return 'inbox';
  return Object.hasOwn(items, view) ? view as NavKey : undefined;
}

function targetView(page: NavKey, role: Role): ViewTab {
  if (page === 'home' && role === 'student') return 'today';
  if (page === 'inbox') return 'nudges';
  return page;
}

function Brand() {
  return <div className="tars-shell-brand"><span aria-hidden="true">T</span> TARS <small>· BMSIT CSE</small></div>;
}

function PersonaPicker({ role, onChange, panelId }: { role: Role; onChange: (role: Role) => void; panelId: string }) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const profile = personas[role];
  return <div className="tars-shell-persona" onKeyDown={event => {
    if (event.key !== 'Escape' || !expanded) return;
    event.preventDefault();
    setExpanded(false);
    trigger.current?.focus();
  }}>
    <button ref={trigger} type="button" className="tars-shell-persona-trigger" aria-expanded={expanded}
      aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
      <span className="tars-shell-avatar" aria-hidden="true">{profile.initials}</span>
      <span><strong>{profile.name}</strong><small>{profile.detail}</small></span>
      <ChevronDown size={15} aria-hidden="true"/>
    </button>
    {expanded && <div className="tars-shell-persona-options" id={panelId} role="group" aria-label="Switch demo account">
      {Object.entries(personas).map(([key, person]) => <button type="button" key={key}
        aria-pressed={role === key}
        onClick={() => { setExpanded(false); trigger.current?.focus(); onChange(key as Role); }}>
        {person.name} ({person.roleLabel})
        {role === key && <UserCheck size={15} aria-hidden="true"/>}
      </button>)}
    </div>}
  </div>;
}

function SidebarContents({ role, groups, activePage, unreadNudgesCount, onNavigate, onRoleChange, onClose }: {
  role: Role;
  groups: NavGroup[];
  activePage?: NavKey;
  unreadNudgesCount: number;
  onNavigate: (page: NavKey) => void;
  onRoleChange: (role: Role) => void;
  onClose?: () => void;
}) {
  const mobile = Boolean(onClose);
  return <div className="tars-shell-sidebar-content">
    <div className="tars-shell-sidebar-pages">
      <div className="tars-shell-sidebar-heading"><Brand/>
        {mobile && <button type="button" className="tars-shell-icon-button" aria-label="Close navigation" onClick={onClose}><X size={19}/></button>}
      </div>
      <nav aria-label={mobile ? 'All pages' : 'Primary navigation'} className="tars-shell-nav">
        {groups.map(group => <div key={group.label} className="tars-shell-nav-group">
          <p>{group.label}</p>
          {group.pages.map(page => {
            const { icon: Icon, label: itemLabel } = items[page];
            return <button type="button" key={page} aria-current={activePage === page ? 'page' : undefined} onClick={() => onNavigate(page)}>
              <Icon size={17} aria-hidden="true"/><span>{itemLabel}</span>
              {page === 'inbox' && unreadNudgesCount > 0 && <span className="tars-shell-count" aria-label={`${unreadNudgesCount} unread`}>{unreadNudgesCount}</span>}
            </button>;
          })}
        </div>)}
      </nav>
    </div>
    <PersonaPicker role={role} onChange={onRoleChange} panelId={mobile ? 'mobile-personas' : 'desktop-personas'}/>
  </div>;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { role, setRole, currentView, setCurrentView, unreadNudgesCount } = useTars();
  const drawer = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const groups = navigation(role);
  const activePage = navKey(currentView);
  const profile = personas[role];
  const label = activePage ? items[activePage].label : currentView === 'admin' ? 'Admin' : 'Page';
  const staffHome = activePage === 'home' && role !== 'student';
  const isComingSoon = activePage === 'classes' || activePage === 'attendance';
  const showContent = routedViews.has(currentView) && !staffHome;
  const heading = staffHome ? `${profile.roleLabel} home` : label;

  useEffect(() => {
    document.title = `${heading} · TARS`;
    main.current?.scrollTo({ top:0, left:0 });
  }, [heading, role]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) drawer.current?.close();
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  function goTo(page: NavKey) {
    drawer.current?.close();
    setCurrentView(targetView(page, role));
  }

  function switchRole(next: Role) {
    drawer.current?.close();
    if (next === role) return;
    setRole(next);
    setCurrentView(targetView('home', next));
  }

  function openDrawer() {
    if (!drawer.current?.open) drawer.current?.showModal();
    setDrawerOpen(true);
  }

  const sidebarProps = { role, groups, activePage, unreadNudgesCount, onNavigate:goTo, onRoleChange:switchRole };

  return <div className="tars-shell">
    <a className="tars-shell-skip" href="#tars-main">Skip to content</a>
    <aside className="tars-shell-sidebar"><SidebarContents {...sidebarProps}/></aside>
    <div className="tars-shell-body">
      <header className="tars-shell-header">
        <button className="tars-shell-mobile-menu tars-shell-icon-button" type="button" aria-label="Open navigation"
          aria-controls="tars-navigation-drawer" aria-expanded={drawerOpen} onClick={openDrawer}><Menu size={21}/></button>
        <div className="tars-shell-location"><span>{profile.roleLabel}</span><ChevronRight size={14} aria-hidden="true"/><strong>{heading}</strong></div>
      </header>
      <main className="tars-shell-main" id="tars-main" tabIndex={-1} ref={main}>
        <div className={activePage === 'events' || activePage === 'nptel' ? 'tars-shell-content tars-shell-module' : 'tars-shell-content'}>
          {showContent ? <Suspense fallback={<p className="tars-shell-fallback" role="status">Loading {heading}…</p>}>{children}</Suspense>
            : <section className="tars-shell-fallback" aria-labelledby="tars-unavailable-title">
              <h1 id="tars-unavailable-title">{heading}</h1>
              <p>{isComingSoon ? 'This page is planned for a future release.' : 'This screen is awaiting integration in this demo.'}</p>
              <button type="button" onClick={() => goTo('events')}>Go to Events</button>
            </section>}
        </div>
      </main>
      <nav className="tars-shell-bottom-nav" aria-label="Mobile navigation">
        {(['home', 'inbox', 'schedule'] as const).map(page => {
          const { icon: Icon, label: itemLabel } = items[page];
          return <button type="button" key={page} aria-current={activePage === page ? 'page' : undefined} onClick={() => goTo(page)}>
            <Icon size={19} aria-hidden="true"/>{itemLabel}
          </button>;
        })}
        <button type="button" aria-controls="tars-navigation-drawer" aria-expanded={drawerOpen}
          data-current={groups[1].pages.some(page => page === activePage)} onClick={openDrawer}>
          <FileText size={19} aria-hidden="true"/>Requests
        </button>
      </nav>
    </div>
    <dialog className="tars-shell-drawer" id="tars-navigation-drawer" ref={drawer} aria-label="TARS navigation"
      onClose={() => setDrawerOpen(false)} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
      <SidebarContents {...sidebarProps} onClose={() => drawer.current?.close()}/>
    </dialog>
  </div>;
}
