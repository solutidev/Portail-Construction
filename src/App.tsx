import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { PageSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth";
import { WorkspaceProvider } from "@/lib/workspace";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientDetailPage } from "@/pages/ClientDetailPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { TeamPage } from "@/pages/TeamPage";
import { UserAccessPage } from "@/pages/UserAccessPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ConfigUserPage } from "@/pages/config/ConfigUserPage";
import { ClientBillingPage } from "@/pages/ClientBillingPage";
import { AccountingBillingPage } from "@/pages/AccountingBillingPage";
import { ConfigSettingsPage } from "@/pages/config/ConfigSettingsPage";
import { PunchPage } from "@/pages/PunchPage";
import { TimesheetsPage } from "@/pages/TimesheetsPage";
import { DocumentsPage } from "@/pages/DocumentsPage";
import { DocumentsProjectsPage } from "@/pages/DocumentsProjectsPage";
import { ReportsPage } from "@/pages/ReportsPage";

function ProtectedLayout() {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-8">
        <div className="w-full max-w-4xl">
          <PageSkeleton />
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedLayout />}>
        <Route
          element={
            <WorkspaceProvider>
              <AppShell />
            </WorkspaceProvider>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/projects" element={<DocumentsProjectsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:clientId" element={<ClientDetailPage />} />
          <Route path="clients/:clientId/billing" element={<ClientBillingPage />} />
          <Route path="accounting/billing" element={<AccountingBillingPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/:section" element={<ProjectDetailPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="team/:userId" element={<UserAccessPage />} />
          <Route path="config/clients" element={<Navigate to="/settings?tab=clients" replace />} />
          <Route path="config/internal" element={<Navigate to="/settings?tab=users" replace />} />
          <Route path="config/groups" element={<Navigate to="/settings?tab=users" replace />} />
          <Route path="config/users/:userId" element={<ConfigUserPage />} />
          <Route path="config/settings" element={<Navigate to="/settings" replace />} />
          <Route path="settings" element={<ConfigSettingsPage />} />
          <Route path="tools/punch" element={<PunchPage />} />
          <Route path="tools/timesheets" element={<TimesheetsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
