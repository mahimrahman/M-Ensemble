import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  Banknote,
  Building2,
  CalendarDays,
  Handshake,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ScrollText,
  Users as UsersIcon,
} from 'lucide-react';
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
 * Nothing renders until the stored token has been checked, so the app never
 * flashes the sign-in screen at somebody already signed in, or a dashboard at
 * somebody whose token has expired.
 *
 * **Light only, like the app.** There is no theme toggle: the app has one look
 * and the console is the same product. See the header of `styles.css`.
 */

const ICON = 17;

function Rail(): React.JSX.Element {
  const { session, signOut } = useAuth();

  // The two counts that mean "somebody is waiting on you". Refreshed on every
  // navigation — often enough for an inbox, cheap enough not to poll.
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
        {/* The cut recoloured for a dark ground — the master's black crescent
            becomes white there, so the shape survives the gradient. */}
        <img src="/logo-on-dark.png" alt="M'Ensemble" />
        <span>Platform console</span>
      </div>

      <div className="rail-group">
        <NavLink to="/" end>
          <LayoutDashboard size={ICON} />
          Dashboard
        </NavLink>
      </div>

      <div className="rail-group">
        <p>Community</p>
        <NavLink to="/mosques">
          <Building2 size={ICON} />
          Mosques
        </NavLink>
        <NavLink to="/users">
          <UsersIcon size={ICON} />
          People
        </NavLink>
        <NavLink to="/events">
          <CalendarDays size={ICON} />
          Events
        </NavLink>
        <NavLink to="/support">
          <LifeBuoy size={ICON} />
          Support
          {open > 0 && <span className="rail-count">{open}</span>}
        </NavLink>
      </div>

      <div className="rail-group">
        <p>Revenue</p>
        <NavLink to="/billing">
          <Banknote size={ICON} />
          Billing
        </NavLink>
        <NavLink to="/partners">
          <Handshake size={ICON} />
          Partners
        </NavLink>
        <NavLink to="/campaigns">
          <Megaphone size={ICON} />
          Campaigns
          {pending > 0 && <span className="rail-count">{pending}</span>}
        </NavLink>
      </div>

      <div className="rail-group">
        <p>Record</p>
        <NavLink to="/audit">
          <ScrollText size={ICON} />
          Activity log
        </NavLink>
      </div>

      <div className="rail-foot">
        <b>{session?.name}</b>
        {session?.platformRole === 'superadmin' ? 'Super admin' : 'Support'}
        <button className="btn sm" onClick={signOut}>
          Sign out
        </button>
      </div>
    </nav>
  );
}

function Shell(): React.JSX.Element {
  const { session } = useAuth();

  return (
    <div className="shell">
      <Rail />
      <div className="main">
        <div className="topbar">
          <span className="spacer" />
          {session?.platformRole === 'support' && (
            <span>Read-only — a super admin makes the changes.</span>
          )}
          <span className="muted">{session?.email}</span>
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
      <div className="signin">
        <div className="signin-inner" style={{ textAlign: 'center' }}>
          <img className="signin-logo" src="/logo-on-dark.png" alt="M'Ensemble" />
          <p className="signin-note">
            <span className="spinner on-dark" aria-hidden="true" /> Checking your session…
          </p>
        </div>
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
