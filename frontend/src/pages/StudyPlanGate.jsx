import { Container, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import StudyPlan from './StudyPlan.jsx';
import StudyPlanAbout from './StudyPlanAbout.jsx';

export default function StudyPlanGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" role="status" className="text-br-rose" />
      </Container>
    );
  }

  if (!user) {
    return <StudyPlanAbout />;
  }

  if (!user.email_verified) {
    return (
      <Container className="py-5">
        <p className="mb-0">
          Verify your email to use the Smart Exam Planner.{' '}
          <Link to="/verify-email">Continue to verification</Link>
        </p>
      </Container>
    );
  }

  return <StudyPlan />;
}
