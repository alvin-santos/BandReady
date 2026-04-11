import { Container, Nav, Navbar, NavDropdown } from 'react-bootstrap';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import AppDisclaimer from './AppDisclaimer.jsx';
import PracticeNudge from './PracticeNudge.jsx';
import RouteSeo from './RouteSeo.jsx';
import SiteTrafficRecorder from './SiteTrafficRecorder.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { THEME_SWITCH_UI_ENABLED, useTheme } from '../context/ThemeContext.jsx';

export default function MainLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const verified = user?.email_verified;

  return (
    <div className="d-flex flex-column min-vh-100">
      <RouteSeo />
      <SiteTrafficRecorder />
      <Navbar expand="lg" className="br-sticky-header py-2">
        <Container>
          <Navbar.Brand as={Link} to="/" className="fw-bold d-flex align-items-center gap-2">
            <i className="bi bi-mortarboard-fill text-br-rose" aria-hidden />
            <span>
              Band<span className="text-br-rose">Ready</span>
            </span>
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="br-nav" />
          <Navbar.Collapse id="br-nav" className="justify-content-end">
            <Nav className="align-items-lg-center gap-lg-1 br-main-nav">
              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className="bi bi-journal-check" aria-hidden />
                    Practice
                  </span>
                }
                id="br-nav-dd-practice"
              >
                <NavDropdown.Item as={Link} to="/exam/start" className="d-flex align-items-center gap-2">
                  <i className="bi bi-play-circle" aria-hidden />
                  Start practice
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/practice-disclaimer" className="d-flex align-items-center gap-2">
                  <i className="bi bi-shield-exclamation" aria-hidden />
                  Practice disclaimer
                </NavDropdown.Item>
              </NavDropdown>

              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className="bi bi-people" aria-hidden />
                    Community
                  </span>
                }
                id="br-nav-dd-community"
              >
                <NavDropdown.Item as={Link} to="/forum" className="d-flex align-items-center gap-2">
                  <i className="bi bi-chat-square-text" aria-hidden />
                  Forum
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/rankings" className="d-flex align-items-center gap-2">
                  <i className="bi bi-trophy" aria-hidden />
                  Rankings
                </NavDropdown.Item>
              </NavDropdown>

              <NavDropdown
                title={
                  <span className="d-inline-flex align-items-center gap-2">
                    <i className="bi bi-three-dots" aria-hidden />
                    More
                  </span>
                }
                id="br-nav-dd-more"
              >
                <NavDropdown.Item as={Link} to="/subscription" className="d-flex align-items-center gap-2">
                  <i className="bi bi-star-fill" aria-hidden />
                  Pro
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/resources" className="d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-arrow-down" aria-hidden />
                  Resources
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/contact" className="d-flex align-items-center gap-2">
                  <i className="bi bi-envelope" aria-hidden />
                  Contact
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/why-bandready" className="d-flex align-items-center gap-2">
                  <i className="bi bi-info-circle" aria-hidden />
                  Why BandReady?
                </NavDropdown.Item>
              </NavDropdown>

              {THEME_SWITCH_UI_ENABLED && (
                <button type="button" className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1" onClick={toggle}>
                  <i className={theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars'} aria-hidden />
                  <span className="d-none d-sm-inline">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                </button>
              )}

              {user ? (
                <NavDropdown
                  title={
                    <span className="d-inline-flex align-items-center gap-2">
                      <i className="bi bi-person-badge" aria-hidden />
                      <span className="text-truncate" style={{ maxWidth: '10rem' }}>
                        {user.name}
                      </span>
                    </span>
                  }
                  align="end"
                  id="br-nav-dd-account"
                >
                  {!verified && (
                    <NavDropdown.Item
                      as={Link}
                      to="/verify-email"
                      className="d-flex align-items-center gap-2 text-warning"
                    >
                      <i className="bi bi-envelope-exclamation" aria-hidden />
                      Confirm email
                    </NavDropdown.Item>
                  )}
                  {verified && (
                    <>
                      <NavDropdown.Item as={Link} to="/dashboard" className="d-flex align-items-center gap-2">
                        <i className="bi bi-speedometer2" aria-hidden />
                        Dashboard
                      </NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/analytics" className="d-flex align-items-center gap-2">
                        <i className="bi bi-graph-up-arrow" aria-hidden />
                        Analytics
                      </NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/practice/mistakes" className="d-flex align-items-center gap-2">
                        <i className="bi bi-bullseye" aria-hidden />
                        Mistakes
                      </NavDropdown.Item>
                      <NavDropdown.Item as={Link} to="/profile" className="d-flex align-items-center gap-2">
                        <i className="bi bi-person-circle" aria-hidden />
                        Profile
                      </NavDropdown.Item>
                    </>
                  )}
                  {isAdmin && verified && (
                    <NavDropdown.Item as={Link} to="/admin" className="d-flex align-items-center gap-2">
                      <i className="bi bi-shield-lock" aria-hidden />
                      Admin
                    </NavDropdown.Item>
                  )}
                  <NavDropdown.Divider />
                  <NavDropdown.Item
                    className="d-flex align-items-center gap-2"
                    onClick={() => {
                      logout();
                      navigate('/');
                    }}
                  >
                    <i className="bi bi-box-arrow-right" aria-hidden />
                    Log out
                  </NavDropdown.Item>
                </NavDropdown>
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
      <main>
        <Outlet />
      </main>
      <PracticeNudge />
      <footer
        className="border-top mt-auto py-4"
        style={{ borderColor: 'color-mix(in srgb, var(--br-blush-edge) 40%, var(--br-border))' }}
      >
        <Container>
          <AppDisclaimer />
        </Container>
      </footer>
    </div>
  );
}
