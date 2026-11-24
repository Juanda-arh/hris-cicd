import Logo from './Logo';
import './AuthLayout.css';

// Shared frame for every public/auth screen: black brand panel on the left
// (on top in mobile) and the cream panel with the screen's own content.
export default function AuthLayout({ children }) {
  return (
    <main className="auth">
      <aside className="auth__brand">
        <Logo name="ms-systems" height={44} className="auth__logo" />

        <div className="auth__pitch">
          <p className="auth__eyebrow">Self-service portal · M&amp;S Mechanical LLC</p>
          <h1 className="auth__headline">
            Clear.
            <br />
            Precise.
            <br />&amp; Possible.
          </h1>
          <hr className="auth__rule" />
          <p className="auth__tagline">Your profile, pay stubs and requests in one place.</p>
        </div>

        <footer className="auth__brands">
          <Logo name="mephub" height={14} />
          <Logo name="vdclab" height={14} />
          <Logo name="permit-my-house" height={14} />
          <span className="auth__version">v1.0 · 2026</span>
        </footer>
      </aside>

      <section className="auth__panel">{children}</section>
    </main>
  );
}
