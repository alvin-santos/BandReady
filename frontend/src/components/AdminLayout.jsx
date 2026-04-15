import { Col, Container, Nav, Row } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/admin', end: true, label: 'Dashboard', icon: 'bi-speedometer2' },
  { to: '/admin/exams', label: 'Exams', icon: 'bi-mortarboard' },
  { to: '/admin/sections', label: 'Sections', icon: 'bi-layout-three-columns' },
  { to: '/admin/tests', label: 'Tests', icon: 'bi-journal-text' },
  { to: '/admin/exam-nav', label: 'CELPIP tasks', icon: 'bi-grid-3x3-gap' },
  { to: '/admin/questions', label: 'Questions', icon: 'bi-patch-question' },
  { to: '/admin/question-bank', label: 'Question bank', icon: 'bi-collection' },
  { to: '/admin/openai-questionnaire', label: 'AI generate', icon: 'bi-robot' },
  { to: '/admin/openai-questionnaire/prompts', label: 'AI prompt library', icon: 'bi-journal-text' },
  { to: '/admin/tts-voices', label: 'TTS voices', icon: 'bi-mic' },
  { to: '/admin/ads', label: 'Advertisements', icon: 'bi-badge-ad' },
  { to: '/admin/stats', label: 'Analytics', icon: 'bi-graph-up-arrow' },
  { to: '/admin/ranking-settings', label: 'Rankings', icon: 'bi-trophy' },
  { to: '/admin/bandie-tutor', label: 'Bandie', icon: 'bi-chat-heart' },
  { to: '/admin/downloadables', label: 'Downloads', icon: 'bi-file-earmark-arrow-down' },
  { to: '/admin/messages', label: 'Messages', icon: 'bi-envelope-open' },
  { to: '/admin/database-backups', label: 'DB backups', icon: 'bi-cloud-arrow-up' },
];

export default function AdminLayout() {
  return (
    <Container fluid className="py-3">
      <Row className="g-3">
        <Col lg={3} xl={2}>
          <div className="br-card p-3 admin-sidebar">
            <div className="small text-uppercase text-muted fw-semibold mb-2 px-2">Administration</div>
            <Nav className="flex-column gap-1">
              {links.map((item) => (
                <NavLink
                  key={item.to + (item.end ? '-index' : '')}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `nav-link rounded px-2 py-2 d-flex align-items-center gap-2 admin-nav-link${isActive ? ' active' : ''}`
                  }
                >
                  <i className={`bi ${item.icon}`} aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </Nav>
          </div>
        </Col>
        <Col lg={9} xl={10}>
          <Outlet />
        </Col>
      </Row>
    </Container>
  );
}
