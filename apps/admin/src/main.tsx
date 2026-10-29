import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import { App } from '@/App';
import '@/styles.css';

/**
 * Error reporting is on only when there is somewhere to report to **and** this
 * is a production build. A DSN in a dev shell would send every hot-reload
 * hiccup to the project, and `enabled: false` is cheaper than not calling
 * `init` because the `ErrorBoundary` below still works without a DSN — it just
 * renders the fallback and reports nothing.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: !!dsn && import.meta.env.PROD,
  // One request in ten is plenty for a console a handful of people use.
  tracesSampleRate: 0.1,
});

function Crashed(): React.JSX.Element {
  return (
    <div className="signin">
      <div className="signin-inner" style={{ textAlign: 'center' }}>
        <img className="signin-logo" src="/logo-on-dark.png" alt="M'Ensemble" />
        <p className="signin-note">
          Something went wrong in the console. It has been reported — reload to carry on.
        </p>
        <button className="btn" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('No #root element — index.html has changed.');

createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<Crashed />}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
