import { useState, useEffect, useCallback } from 'react';
import { useTars } from '../../../context/TarsContext';

interface HealthStatus {
  loading: boolean;
  online: boolean;
  latencyMs: number | null;
  timestamp: string | null;
  error?: string;
}

export function SettingsView() {
  const { role, activeFacultyId, autonomousScheduleBannerVisible, dismissAutonomousBanner, acceptAutonomousBanner } = useTars();

  const isSmp = role === 'faculty' && activeFacultyId === 'F_SMP';
  const isGpl = role === 'faculty' && activeFacultyId === 'F_GPL';
  const persona =
    role === 'student'
      ? {
          name: 'Shreyansh',
          title: 'Student · CSE-10',
          roleLabel: 'Student',
          initials: 'SH',
          loginId: 'S0000',
        }
      : role === 'hod'
      ? {
          name: 'Dr. Surekha K B',
          title: 'Professor & HOD · CSE',
          roleLabel: 'HOD',
          initials: 'SK',
          loginId: 'H_SKB',
        }
      : isSmp
      ? {
          name: 'Mr. Syed Matheen Pasha',
          title: 'Assistant Professor · AI/ML (Substitute)',
          roleLabel: 'Faculty (Substitute)',
          initials: 'SP',
          loginId: 'F_SMP',
        }
      : isGpl
      ? {
          name: 'Mrs. Geetha P L',
          title: 'Assistant Professor · CSE (Lab Substitute)',
          roleLabel: 'Faculty (Substitute)',
          initials: 'GP',
          loginId: 'F_GPL',
        }
      : {
          name: 'Prof. Chaitra D B',
          title: 'Assistant Professor · AI/ML',
          roleLabel: 'Faculty',
          initials: 'CD',
          loginId: 'F_CDB',
        };

  // 1. Backend Health Probe
  const [health, setHealth] = useState<HealthStatus>({
    loading: true,
    online: false,
    latencyMs: null,
    timestamp: null,
  });

  const runHealthProbe = useCallback(async () => {
    setHealth((prev) => ({ ...prev, loading: true, error: undefined }));
    const startTime = performance.now();
    try {
      const res = await fetch('http://127.0.0.1:8000/health', { method: 'GET' });
      const duration = Math.round(performance.now() - startTime);
      if (res.ok) {
        setHealth({
          loading: false,
          online: true,
          latencyMs: duration,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setHealth({
          loading: false,
          online: false,
          latencyMs: duration,
          timestamp: new Date().toLocaleTimeString(),
          error: `HTTP ${res.status}`,
        });
      }
    } catch (err: unknown) {
      setHealth({
        loading: false,
        online: false,
        latencyMs: null,
        timestamp: new Date().toLocaleTimeString(),
        error: err instanceof Error ? err.message : 'Connection failed',
      });
    }
  }, []);

  useEffect(() => {
    runHealthProbe();
  }, [runHealthProbe]);

  // 2. Client-Persisted Preference: Timetable Slot Density
  const [density, setDensity] = useState<'comfortable' | 'compact'>(() => {
    if (typeof localStorage !== 'undefined') {
      return (localStorage.getItem('tars_pref_density') as 'comfortable' | 'compact') || 'comfortable';
    }
    return 'comfortable';
  });

  const handleDensityChange = (newDensity: 'comfortable' | 'compact') => {
    setDensity(newDensity);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tars_pref_density', newDensity);
    }
  };

  // 3. Client-Persisted Preference: Notification Audio Chime
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('tars_pref_sound') !== 'muted';
    }
    return true;
  });

  const [soundPlayedFeedback, setSoundPlayedFeedback] = useState(false);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundEnabled(enabled);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('tars_pref_sound', enabled ? 'enabled' : 'muted');
    }
  };

  // Genuine Web Audio synthesizer for chime test
  const playTestChime = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12); // E6 note

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);

      setSoundPlayedFeedback(true);
      window.setTimeout(() => setSoundPlayedFeedback(false), 1500);
    } catch {
      // Audio context restricted by browser policy
    }
  };

  return (
    <div className="flex-1 min-h-screen bg-surface p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col gap-1 border-b border-outline-variant pb-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[24px]">tune</span>
          <h1 className="font-headline text-headline-sm text-on-surface font-bold tracking-tight">
            Settings &amp; System Health
          </h1>
        </div>
        <p className="font-body text-body-sm text-on-surface-variant">
          Active identity profile, verified backend connectivity, and interface preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SECTION 1: Active Identity & Profile (Read-Only) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <span className="font-title text-title-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
              Active Identity (Read-Only)
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant text-[11px] font-mono text-on-surface-muted uppercase">
              {role}
            </span>
          </div>

          <div className="flex items-center gap-3.5 pt-1">
            <span className="w-12 h-12 rounded-full bg-primary text-on-primary font-headline text-title-md flex items-center justify-center font-bold shrink-0">
              {persona.initials}
            </span>
            <div className="flex flex-col min-w-0">
              <span className="font-title text-title-md text-on-surface font-semibold truncate">
                {persona.name}
              </span>
              <span className="font-body text-body-xs text-on-surface-muted truncate">
                {persona.title}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-0.5">
              <span className="text-on-surface-muted text-[10px] uppercase font-mono">Department</span>
              <span className="font-semibold text-on-surface truncate">CSE · BMSIT</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-0.5">
              <span className="text-on-surface-muted text-[10px] uppercase font-mono">Account ID</span>
              <span className="font-semibold text-on-surface font-mono truncate">{persona.loginId}</span>
            </div>
          </div>

          <p className="text-[11px] font-body text-on-surface-muted pt-1 leading-normal">
            Account authentication and persona switching are managed through the secure sign-in modal in the sidebar.
          </p>
        </div>

        {/* SECTION 2: Backend Connectivity & Health Probe */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <span className="font-title text-title-sm text-on-surface font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-primary">lan</span>
              Backend Connectivity Probe
            </span>
            <button
              type="button"
              onClick={runHealthProbe}
              disabled={health.loading}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface hover:bg-surface-container border border-outline-variant text-[11px] font-label text-on-surface transition-colors disabled:opacity-50"
            >
              <span className={`material-symbols-outlined text-[14px] ${health.loading ? 'animate-spin' : ''}`}>
                refresh
              </span>
              <span>Re-check</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-surface border border-outline-variant">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full shrink-0 ${
                  health.online ? 'bg-emerald-500 shadow-xs' : 'bg-rose-500'
                }`}
              />
              <div className="flex flex-col">
                <span className="font-label text-label-md font-semibold text-on-surface">
                  {health.online ? 'Online & Healthy' : 'Backend Unreachable'}
                </span>
                <span className="font-body text-body-xs text-on-surface-muted">
                  Endpoint: <code className="font-mono text-[11px]">http://127.0.0.1:8000/health</code>
                </span>
              </div>
            </div>

            {health.online && health.latencyMs !== null && (
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-mono font-semibold">
                {health.latencyMs} ms
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-0.5">
              <span className="text-on-surface-muted text-[10px] uppercase font-mono">Database</span>
              <span className="font-semibold text-on-surface">SQLite (tars.db)</span>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-outline-variant flex flex-col gap-0.5">
              <span className="text-on-surface-muted text-[10px] uppercase font-mono">Security</span>
              <span className="font-semibold text-on-surface">Password Auth Active</span>
            </div>
          </div>

          {health.timestamp && (
            <span className="text-[10px] font-mono text-on-surface-muted">
              Last probe checked at {health.timestamp}
            </span>
          )}
        </div>
      </div>

      {/* SECTION 3: Genuine, Verifiable Local Preferences */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">display_settings</span>
            <span className="font-title text-title-sm text-on-surface font-semibold">
              Interface Preferences (Client Persisted)
            </span>
          </div>
          <span className="text-[11px] font-label text-on-surface-muted">Instant local persistence</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Preference 1: Timetable Density */}
          <div className="p-4 rounded-lg bg-surface border border-outline-variant flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-label text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">density_medium</span>
                Timetable Slot Density
              </span>
              <p className="text-body-xs text-on-surface-muted leading-relaxed">
                Adjust grid height for lecture cards across Schedule and Today views.
              </p>
            </div>

            <div className="inline-flex rounded-md bg-surface-container p-0.5 border border-outline-variant text-xs mt-auto">
              <button
                type="button"
                onClick={() => handleDensityChange('comfortable')}
                className={`flex-1 py-1.5 px-2 rounded font-label text-center transition-colors ${
                  density === 'comfortable'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                    : 'text-on-surface-muted hover:text-on-surface'
                }`}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => handleDensityChange('compact')}
                className={`flex-1 py-1.5 px-2 rounded font-label text-center transition-colors ${
                  density === 'compact'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-xs'
                    : 'text-on-surface-muted hover:text-on-surface'
                }`}
              >
                Compact
              </button>
            </div>
          </div>

          {/* Preference 2: Notification Sound Alerts */}
          <div className="p-4 rounded-lg bg-surface border border-outline-variant flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-label text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">notifications_active</span>
                Urgent Alert Sound Cue
              </span>
              <p className="text-body-xs text-on-surface-muted leading-relaxed">
                Play an audio chime when high-priority relocation alerts arrive.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 mt-auto pt-1">
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-label text-on-surface">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => handleSoundToggle(e.target.checked)}
                  className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4"
                />
                <span>Chime {soundEnabled ? 'Enabled' : 'Muted'}</span>
              </label>

              <button
                type="button"
                onClick={playTestChime}
                className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant text-[11px] font-label text-on-surface transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">volume_up</span>
                <span>{soundPlayedFeedback ? 'Chimed!' : 'Test'}</span>
              </button>
            </div>
          </div>

          {/* Preference 3: Autonomous Schedule Banner */}
          <div className="p-4 rounded-lg bg-surface border border-outline-variant flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="font-label text-label-md font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-primary">campaign</span>
                Replanning Schedule Banner
              </span>
              <p className="text-body-xs text-on-surface-muted leading-relaxed">
                Control the visibility of the autonomous relocation banner on Today view.
              </p>
            </div>

            <div className="flex items-center justify-between gap-2 mt-auto pt-1">
              <span className="text-xs font-label text-on-surface-muted">
                Status: {autonomousScheduleBannerVisible ? 'Visible' : 'Hidden'}
              </span>

              {autonomousScheduleBannerVisible ? (
                <button
                  type="button"
                  onClick={dismissAutonomousBanner}
                  className="px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high border border-outline-variant text-[11px] font-label text-on-surface transition-colors"
                >
                  Dismiss
                </button>
              ) : (
                <button
                  type="button"
                  onClick={acceptAutonomousBanner}
                  className="px-2.5 py-1 rounded bg-primary text-on-primary text-[11px] font-label font-semibold transition-opacity hover:opacity-90"
                >
                  Restore
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: Institutional Roadmap & Beta Integrations (Read-Only) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-on-surface-muted">explore</span>
            <span className="font-title text-title-sm text-on-surface font-semibold">
              Institutional Roadmap &amp; External Integrations
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-semibold uppercase">
            Phase 2 Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm font-semibold text-on-surface">Contineo Biometric</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">ROADMAP</span>
            </div>
            <p className="text-[11px] font-body text-on-surface-muted leading-normal">
              Direct biometric fingerprint punch sync scheduled for Phase 2 deployment.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm font-semibold text-on-surface">Google Calendar</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">BETA</span>
            </div>
            <p className="text-[11px] font-body text-on-surface-muted leading-normal">
              Two-way institutional Google Calendar OAuth sync currently in review.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm font-semibold text-on-surface">Telegram SMS Gateway</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">BETA</span>
            </div>
            <p className="text-[11px] font-body text-on-surface-muted leading-normal">
              Automated Telegram notification bot simulated locally for evaluation.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-surface border border-outline-variant flex flex-col gap-1.5 opacity-80">
            <div className="flex items-center justify-between">
              <span className="font-label text-label-sm font-semibold text-on-surface">Relocation Weights</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">POLICY</span>
            </div>
            <p className="text-[11px] font-body text-on-surface-muted leading-normal">
              AI constraint optimization penalties governed centrally by HOD department rules.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}