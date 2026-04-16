import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout.jsx';
import AdminLayout from './components/AdminLayout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Forum from './pages/Forum.jsx';
import ForumCategory from './pages/ForumCategory.jsx';
import ForumThread from './pages/ForumThread.jsx';
import ContactAbout from './pages/ContactAbout.jsx';
import WhyBandReady from './pages/WhyBandReady.jsx';
import PracticeDisclaimer from './pages/PracticeDisclaimer.jsx';
import Analytics from './pages/Analytics.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ExamStart from './pages/ExamStart.jsx';
import ExamPage from './pages/ExamPage.jsx';
import Results from './pages/Results.jsx';
import Profile from './pages/Profile.jsx';
import GoogleAuthCallback from './pages/GoogleAuthCallback.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminExams from './pages/AdminExams.jsx';
import AdminSections from './pages/AdminSections.jsx';
import AdminTests from './pages/AdminTests.jsx';
import AdminQuestions from './pages/AdminQuestions.jsx';
import AdminQuestionBank from './pages/AdminQuestionBank.jsx';
import AdminAds from './pages/AdminAds.jsx';
import AdminStats from './pages/AdminStats.jsx';
import AdminDownloads from './pages/AdminDownloads.jsx';
import MistakesHub from './pages/MistakesHub.jsx';
import StudyPlanGate from './pages/StudyPlanGate.jsx';
import Resources from './pages/Resources.jsx';
import Subscription from './pages/Subscription.jsx';
import Rankings from './pages/Rankings.jsx';
import AdminRanking from './pages/AdminRanking.jsx';
import AdminTtsVoices from './pages/AdminTtsVoices.jsx';
import TtsVoicesSettingsPage from './pages/TtsVoicesSettingsPage.jsx';
import AdminContactMessages from './pages/AdminContactMessages.jsx';
import AdminOpenAiQuestionnaire from './pages/AdminOpenAiQuestionnaire.jsx';
import AdminOpenAiQuestionnairePrompts from './pages/AdminOpenAiQuestionnairePrompts.jsx';
import AdminDatabaseBackups from './pages/AdminDatabaseBackups.jsx';
import AdminBandieTutor from './pages/AdminBandieTutor.jsx';
import AdminExamNav from './pages/AdminExamNav.jsx';

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function PrivateVerified({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }
  return children;
}

function AdminOnly({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.email_verified) {
    return <Navigate to="/verify-email" replace />;
  }
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'why-bandready', element: <WhyBandReady /> },
      { path: 'practice-disclaimer', element: <PracticeDisclaimer /> },
      { path: 'contact', element: <ContactAbout /> },
      { path: 'forum', element: <Forum /> },
      { path: 'forum/category/:categoryId', element: <ForumCategory /> },
      { path: 'forum/thread/:threadId', element: <ForumThread /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'auth/google', element: <GoogleAuthCallback /> },
      {
        path: 'verify-email',
        element: (
          <Private>
            <VerifyEmail />
          </Private>
        ),
      },
      { path: 'subscription', element: <Subscription /> },
      { path: 'rankings', element: <Rankings /> },
      { path: 'resources', element: <Resources /> },
      {
        path: 'practice/mistakes',
        element: (
          <PrivateVerified>
            <MistakesHub />
          </PrivateVerified>
        ),
      },
      { path: 'exam/start', element: <ExamStart /> },
      { path: 'exam/run/:attemptId', element: <ExamPage /> },
      { path: 'results/:id', element: <Results /> },
      {
        path: 'dashboard',
        element: (
          <PrivateVerified>
            <Dashboard />
          </PrivateVerified>
        ),
      },
      {
        path: 'study-plan',
        element: <StudyPlanGate />,
      },
      {
        path: 'analytics',
        element: (
          <PrivateVerified>
            <Analytics />
          </PrivateVerified>
        ),
      },
      {
        path: 'profile',
        element: (
          <PrivateVerified>
            <Profile />
          </PrivateVerified>
        ),
      },
      {
        path: 'settings/tts-voices',
        element: (
          <PrivateVerified>
            <TtsVoicesSettingsPage variant="user" />
          </PrivateVerified>
        ),
      },
      {
        path: 'admin',
        element: (
          <AdminOnly>
            <AdminLayout />
          </AdminOnly>
        ),
        children: [
          { index: true, element: <AdminDashboard /> },
          { path: 'exams', element: <AdminExams /> },
          { path: 'sections', element: <AdminSections /> },
          { path: 'tests', element: <AdminTests /> },
          { path: 'exam-nav', element: <AdminExamNav /> },
          { path: 'questions', element: <AdminQuestions /> },
          { path: 'question-bank', element: <AdminQuestionBank /> },
          { path: 'openai-questionnaire', element: <AdminOpenAiQuestionnaire /> },
          { path: 'openai-questionnaire/prompts', element: <AdminOpenAiQuestionnairePrompts /> },
          { path: 'ads', element: <AdminAds /> },
          { path: 'stats', element: <AdminStats /> },
          { path: 'ranking-settings', element: <AdminRanking /> },
          { path: 'bandie-tutor', element: <AdminBandieTutor /> },
          { path: 'downloadables', element: <AdminDownloads /> },
          { path: 'tts-voices', element: <AdminTtsVoices /> },
          { path: 'messages', element: <AdminContactMessages /> },
          { path: 'database-backups', element: <AdminDatabaseBackups /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
