import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import AppDisclaimer from './AppDisclaimer.jsx';
import BandieTutor from './BandieTutor.jsx';
import FloatingBgIcons from './FloatingBgIcons.jsx';
import PracticeNudge from './PracticeNudge.jsx';
import RouteSeo from './RouteSeo.jsx';
import SiteTrafficRecorder from './SiteTrafficRecorder.jsx';
import ProBadge from './ProBadge.jsx';
import { BandieTutorProvider } from '../context/BandieTutorContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { THEME_SWITCH_UI_ENABLED, useTheme } from '../context/ThemeContext.jsx';

const navItem = 'd-flex align-items-center gap-2';

export default function MainLayout() {
  const { user, logout, isAdmin, isSubscribed } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const verified = user?.email_verified;

  return (
    <BandieTutorProvider>
    <div className="d-flex flex-column min-vh-100">
      <RouteSeo />
      <SiteTrafficRecorder />
      <Navbar expand="lg" variant="dark" className="br-sticky-header py-2">
        <Container>
          <Navbar.Brand
            as={Link}
            to="/"
            aria-label="BandReady home"
            className="fw-bold d-flex align-items-center gap-2"
          >
            <img
              src="/bandready-mark.png"
              alt=""
              width={32}
              height={32}
              className="flex-shrink-0 rounded-2"
              decoding="async"
            />
            <span>
              Band<span className="text-br-rose">Ready</span>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="br-nav" />
          <Navbar.Collapse id="br-nav" className="justify-content-end">
            <Nav className="align-items-lg-center flex-lg-wrap justify-content-lg-end gap-lg-2 br-main-nav">
              <Nav.Link as={Link} to="/exam/start" className={`${navItem} br-nav-cta`}>
                <i className="bi bi-stopwatch" aria-hidden />
                Start practice
              </Nav.Link>
              <Nav.Link as={Link} to="/practice-disclaimer" className={navItem}>
                <i className="bi bi-shield-exclamation" aria-hidden />
                Disclaimer
              </Nav.Link>
              <Nav.Link as={Link} to="/subscription" className={navItem}>
                <i className="bi bi-star-fill" aria-hidden />
                Pro               
              </Nav.Link>
              

              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className="bi bi-compass" aria-hidden />
                    Explore
                  </span>
                }
                id="br-nav-dd-explore"
              >
                <NavDropdown.Item as={Link} to="/rankings" className={navItem}>
                  <i className="bi bi-trophy" aria-hidden />
                  Rankings
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/forum" className={navItem}>
                  <i className="bi bi-chat-square-text" aria-hidden />
                  Forum
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/resources" className={navItem}>
                  <i className="bi bi-file-earmark-arrow-down" aria-hidden />
                  Resources
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/why-bandready" className={navItem}>
                  <i className="bi bi-info-circle" aria-hidden />
                  Why BandReady
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/contact" className={navItem}>
                  <i className="bi bi-envelope" aria-hidden />
                  Contact
                </NavDropdown.Item>
              </NavDropdown>

              {user && verified && (
                <>
                  <Nav.Link as={Link} to="/dashboard" className={navItem}>
                    <i className="bi bi-speedometer2" aria-hidden />
                    Dashboard
                  </Nav.Link>
                  <Nav.Link as={Link} to="/profile" className={navItem}>
                    <i className="bi bi-person-circle" aria-hidden />
                    Profile
                    {isSubscribed && <ProBadge variant="nav" className="ms-1" />}
                  </Nav.Link>
                  <NavDropdown
                    title={
                      <span className="d-inline-flex align-items-center gap-2">
                        <i className="bi bi-graph-up" aria-hidden />
                        Insights
                      </span>
                    }
                    id="br-nav-dd-insights"
                  >
                    <NavDropdown.Item as={Link} to="/settings/tts-voices" className={navItem}>
                      <i className="bi bi-mic" aria-hidden />
                      TTS voices
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/analytics" className={navItem}>
                      <i className="bi bi-graph-up-arrow" aria-hidden />
                      Analytics
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/practice/mistakes" className={navItem}>
                      <i className="bi bi-bullseye" aria-hidden />
                      Mistakes
                    </NavDropdown.Item>
                    {isAdmin && (
                      <>
                        <NavDropdown.Divider />
                        <NavDropdown.Item as={Link} to="/admin" className={navItem}>
                          <i className="bi bi-shield-lock" aria-hidden />
                          Admin
                        </NavDropdown.Item>
                      </>
                    )}
                  </NavDropdown>
                </>
              )}

              {THEME_SWITCH_UI_ENABLED && (
                <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={toggle}>
                  <i className={theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars'} aria-hidden />
                  <span className="d-none d-sm-inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              )}

              {user ? (
                <>
                  {!verified && (
                    <Nav.Link as={Link} to="/verify-email" className="d-flex align-items-center gap-2 text-warning">
                      <i className="bi bi-envelope-exclamation" aria-hidden />
                      Confirm email
                    </Nav.Link>
                  )}
                  <Nav.Link
                    as="button"
                    type="button"
                    className={navItem}
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    <i className="bi bi-box-arrow-right" aria-hidden />
                    Log out
                  </Nav.Link>
                </>
              ) : (
                <>
                  <Nav.Link as={Link} to="/login" className="d-flex align-items-center gap-2">
                    <i className="bi bi-box-arrow-in-right" aria-hidden />
                    Log in
                  </Nav.Link>
                  <Link to="/register" className="btn btn-sm btn-primary d-inline-flex align-items-center gap-1">
                    <i className="bi bi-person-plus" aria-hidden />
                    Sign up
                  </Link>
                </>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <FloatingBgIcons />
      <main className="br-page-stack">
        <Outlet />
      </main>
      <PracticeNudge />
      <BandieTutor />
      <footer
        className="br-page-stack border-top mt-auto py-4"
        style={{ borderColor: 'color-mix(in srgb, var(--br-blush-edge) 40%, var(--br-border))' }}
      >
        <Container>
          <AppDisclaimer />
        </Container>
      </footer>
    </div>
    </BandieTutorProvider>
  );
}
