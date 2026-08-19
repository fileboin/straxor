import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth, isAdmin } from "./lib/auth.js";
import { ThemeProvider } from "./lib/theme.js";
import ErrorBoundary from "./components/ErrorBoundary.js";
// onboarding gating removed: onboarding is optional and not required to access agents
import Layout from "./components/Layout.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import ForgotPassword from "./pages/ForgotPassword.js";
import ResetPassword from "./pages/ResetPassword.js";
import VerifyEmail from "./pages/VerifyEmail.js";
import GitHubAuthCallback from "./pages/GitHubAuthCallback.js";
import OnboardingPage from "./pages/Onboarding.js";

// Route-level code splitting: heavy pages load on demand so the initial
// bundle stays small and one failing chunk doesn't blank the whole app.
const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const Workspace = lazy(() => import("./pages/Workspace.js"));
const Admin = lazy(() => import("./pages/Admin.js"));
const Help = lazy(() => import("./pages/Help.js"));
const DeployManager = lazy(() => import("./pages/DeployManager.js"));
const Knowledge = lazy(() => import("./pages/Knowledge.js"));
const ImageStudio = lazy(() => import("./pages/ImageStudio.js"));
const ImageAgent = lazy(() => import("./pages/ImageAgent.js"));
const Marketplace = lazy(() => import("./pages/Marketplace.js"));
const Connections = lazy(() => import("./pages/Connections.js"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // onboarding is not required to access the app core
  return (
    <ErrorBoundary fallback={<RouteCrashFallback />}>{children}</ErrorBoundary>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin(user)) return <Navigate to="/" replace />;
  return (
    <ErrorBoundary fallback={<RouteCrashFallback />}>{children}</ErrorBoundary>
  );
}

function OnboardingGuard(_props: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  // onboarding is optional; redirect logged-in users to main workspace
  return <Navigate to="/" replace />;
}

function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return (
    <ErrorBoundary fallback={<RouteCrashFallback />}>{children}</ErrorBoundary>
  );
}

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <span className="text-sm text-text-muted animate-pulse">Učitavanje…</span>
    </div>
  );
}

// A crash inside one page (e.g. a failed lazy chunk or a bad API response)
// must never blank the whole app or look like a logout. Each protected route
// gets its own boundary with a way back to the workspace.
function RouteCrashFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-6 text-center gap-4">
      <span className="text-4xl">💥</span>
      <h1 className="text-lg font-semibold text-text">Došlo je do greške u ovoj stranici</h1>
      <p className="text-sm text-text-muted max-w-md">
        Tvoja sesija je i dalje aktivna — problem je u prikazu ove stranice, ne u nalogu.
      </p>
      <div className="flex items-center gap-2">
        <Link to="/" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-85 transition-opacity">
          ← Nazad na radni prostor
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-lg bg-surface-2 border border-border text-text-secondary text-sm font-medium hover:text-text transition-colors"
        >
          Pokušaj ponovo
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Layout>
          <Suspense fallback={<RouteFallback />}>
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
          </Suspense>
        </Layout>
      </AuthProvider>
    </ThemeProvider>
  );
}
