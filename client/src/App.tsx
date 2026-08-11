import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth, isAdmin } from "./lib/auth.js";
import { ThemeProvider } from "./lib/theme.js";
import { isOnboardingComplete } from "./lib/onboarding.js";
import Layout from "./components/Layout.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import ForgotPassword from "./pages/ForgotPassword.js";
import ResetPassword from "./pages/ResetPassword.js";
import VerifyEmail from "./pages/VerifyEmail.js";
import GitHubAuthCallback from "./pages/GitHubAuthCallback.js";
import Dashboard from "./pages/Dashboard.js";
import Workspace from "./pages/Workspace.js";
import OnboardingPage from "./pages/Onboarding.js";
import Admin from "./pages/Admin.js";
import Help from "./pages/Help.js";
import DeployManager from "./pages/DeployManager.js";
import Knowledge from "./pages/Knowledge.js";
import ImageStudio from "./pages/ImageStudio.js";
import ImageAgent from "./pages/ImageAgent.js";
import Marketplace from "./pages/Marketplace.js";
import Connections from "./pages/Connections.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isOnboardingComplete()) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (isOnboardingComplete()) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              }
            />
            <Route
              path="/register"
              element={
                <GuestRoute>
                  <Register />
                </GuestRoute>
              }
            />
            <Route
              path="/forgot-password"
              element={
                <GuestRoute>
                  <ForgotPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/reset-password"
              element={
                <GuestRoute>
                  <ResetPassword />
                </GuestRoute>
              }
            />
            <Route
              path="/verify-email"
              element={
                <GuestRoute>
                  <VerifyEmail />
                </GuestRoute>
              }
            />
            <Route
              path="/auth/github/callback"
              element={
                <GuestRoute>
                  <GitHubAuthCallback />
                </GuestRoute>
              }
            />
            <Route
              path="/onboarding"
              element={
                <OnboardingGuard>
                  <OnboardingPage />
                </OnboardingGuard>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Workspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id"
              element={
                <ProtectedRoute>
                  <Workspace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id/deploy"
              element={
                <ProtectedRoute>
                  <DeployManager />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id/image"
              element={
                <ProtectedRoute>
                  <ImageStudio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id/image-agent"
              element={
                <ProtectedRoute>
                  <ImageAgent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:id/knowledge"
              element={
                <ProtectedRoute>
                  <Knowledge />
                </ProtectedRoute>
              }
            />
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <Help />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace/category/:category"
              element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <Connections />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Admin />
                </AdminRoute>
              }
            />
          </Routes>
        </Layout>
      </AuthProvider>
    </ThemeProvider>
  );
}
