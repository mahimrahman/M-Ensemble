import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth';
import { ToastProvider, useAsync } from '@/ui';
import { api } from '@/api';
import { SignIn } from '@/pages/SignIn';
import { Overview } from '@/pages/Overview';
import { Mosques } from '@/pages/Mosques';
import { MosqueDetail } from '@/pages/MosqueDetail';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Billing } from '@/pages/Billing';
import { InvoiceDetail } from '@/pages/InvoiceDetail';
import { Partners } from '@/pages/Partners';
import { Campaigns } from '@/pages/Campaigns';
import { CampaignDetail } from '@/pages/CampaignDetail';
import { Support } from '@/pages/Support';
import { TicketDetail } from '@/pages/TicketDetail';
import { Events } from '@/pages/Events';
import { AuditLog } from '@/pages/AuditLog';

/**
 * The console's shell and routing.
 *
 * Nothing is rendered until the stored token has been checked, so the app never
 * flashes the sign-in screen at somebody who is already signed in — and never
 * flashes a dashboard at somebody whose token has expired.
 */

const THEME_KEY = 'mensemble.admin.theme';

function useThemeToggle(): [string, () => void] {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | null) ?? 'system';
    } catch {
      return 'system';
    }
  });

  useEffect(() => {
    // `system` removes the attribute entirely rather than writing a value, so
    // the stylesheet's `prefers-color-scheme` block is what decides — which is
    // the only way "follow the OS" can keep following it after a change.
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* storage blocked — the theme still applies for this session */
    }
  }, [theme]);

  const cycle = () =>
    setTheme((current) =>
      current === 'system' ? 'light' : current === 'light' ? 'dark' : 'system',
    );

  return [theme, cycle];
}

function Rail(): React.JSX.Element {
  const { session, signOut } = useAuth();

  // The two counts that mean "somebody is waiting on you". Refreshed on every
  // navigation, which is often enough for an inbox and cheap enough not to poll.
  const location = useLocation();
  const support = useAsync(() => api.supportStats(), [location.pathname]);
  const campaigns = useAsync(
    () => api.campaigns({ status: 'pending', pageSize: 1 }),
    [location.pathname],
  );

  const open = support.data ? support.data.open + support.data.pending : 0;
  const pending = campaigns.data?.total ?? 0;

  return (
    <nav className="rail">
      <div className="rail-brand">
        <div>
          <strong>M&apos;Ensemble</strong>
          <span>Platform console</span>
        </div>
      </div>

      <div className="rail-group">
        <p>Overview</p>
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/audit">Audit log</NavLink>
      </div>

      <div className="rail-group">
        <p>Community</p>
        <NavLink to="/mosques">Mosques</NavLink>
        <NavLink to="/users">People</NavLink>
        <NavLink to="/events">Events</NavLink>
        <NavLink to="/support">
          Support
          {open > 0 && <span className="rail-count">{open}</span>}
        </NavLink>
      </div>

      <div className="rail-group">
        <p>Revenue</p>
        <NavLink to="/billing">Billing</NavLink>
        <NavLink to="/partners">Partners</NavLink>
        <NavLink to="/campaigns">
          Campaigns
          {pending > 0 && <span className="rail-count">{pending}</span>}
        </NavLink>
      </div>

      <div className="rail-foot">
        <b>{session?.name}</b>
        {session?.platformRole === 'superadmin' ? 'Super admin' : 'Support'}
        <button
          className="btn ghost sm"
          style={{ marginTop: 8, color: 'inherit', width: '100%' }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}

function Shell(): React.JSX.Element {
  const [theme, cycleTheme] = useThemeToggle();

  return (
    <div className="shell">
      <Rail />
      <div className="main">
        <div className="topbar">
          <span className="spacer" />
          <button
            className="btn ghost sm"
            onClick={cycleTheme}
            title={`Theme: ${theme}. Click to change.`}
          >
            {theme === 'dark' ? '◐ Dark' : theme === 'light' ? '◑ Light' : '◒ System'}
          </button>
        </div>
        <div className="content">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/mosques" element={<Mosques />} />
            <Route path="/mosques/:id" element={<MosqueDetail />} />
            <Route path="/users" element={<Users />} />
            <Route path="/users/:id" element={<UserDetail />} />
            <Route path="/events" element={<Events />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/billing/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/support" element={<Support />} />
            <Route path="/support/:id" element={<TicketDetail />} />
            <Route path="/audit" element={<AuditLog />} />
            {/* An alert's href or a stale bookmark lands here rather than on a
                blank screen. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function Gate(): React.JSX.Element {
  const { session, checking } = useAuth();

  if (checking) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <span className="spinner" aria-hidden="true" />
        Checking your session…
      </div>
    );
  }
  return session ? <Shell /> : <SignIn />;
}

export function App(): React.JSX.Element {
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  );
}
