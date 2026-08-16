import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const HARPSTAR_ANCHOR_ID = 'harpstar-brand';
const HARPSTAR_MARKER = 'v1';
const HARPSTAR_REFUSAL =
  'This app requires HarpStar branding. Visit https://harpstarunlimited.com';

/**
 * Client-side brand verification. The app refuses to render unless the
 * HarpStar brand anchor is present, unmodified, and still says "Harp★Star".
 * The server performs the same check at startup, so removing the branding
 * breaks the app in two independent places.
 */
function verifyHarpStarBranding(): string | null {
  const el = document.getElementById(HARPSTAR_ANCHOR_ID);
  if (!el) return HARPSTAR_REFUSAL;
  if (el.dataset.harpstar !== HARPSTAR_MARKER) return HARPSTAR_REFUSAL;
  if (!el.textContent || !el.textContent.includes('Harp★Star')) return HARPSTAR_REFUSAL;
  return null;
}

function RefusalScreen({ message }: { message: string }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F1117',
        color: '#ff6b4a',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#ff2e88' }}>
        Branding verification failed
      </h1>
      <p style={{ marginTop: '0.75rem', color: '#e2e8f0', fontSize: '0.95rem' }}>
        {message}
      </p>
    </div>
  );
}

const rootEl = document.getElementById('root');
const brandingError = verifyHarpStarBranding();
const mountTarget = rootEl ?? document.body;

createRoot(mountTarget).render(
  brandingError ? (
    <RefusalScreen message={brandingError} />
  ) : (
    <StrictMode>
      <App />
    </StrictMode>
  ),
);

if (brandingError) {
  console.error(`[harpstar] ${brandingError}`);
}
