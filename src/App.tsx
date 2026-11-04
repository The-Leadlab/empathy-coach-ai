import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "sonner";
import AppLayout from "@/components/layout/AppLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import RequireAdmin from "@/components/auth/RequireAdmin";
import MainLandingPage from "./pages/MainLandingPage";
import NotFound from "./pages/NotFound";
import AvatarSessionPage from "./pages/AvatarSessionPage";
import SessionWorkspacePage from "./pages/SessionWorkspacePage";
import JourneysDashboardPage from "./pages/JourneysDashboardPage";
import AdminChatPage from "./pages/AdminChatPage";
import LoginPage from "./pages/LoginPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import SkillsLibraryPage from "./pages/SkillsLibraryPage";
import WorkbookDetailPage from "./pages/WorkbookDetailPage";
import ProfileDashboardPage from "./pages/ProfileDashboardPage";
import JournalPage from "./pages/JournalPage";
import ResourcesPage from "./pages/ResourcesPage";
import SettingsPage from "./pages/SettingsPage";
import ClinicianWorkbooksPage from "./pages/ClinicianWorkbooksPage";
import ClinicianWorkbookNewPage from "./pages/ClinicianWorkbookNewPage";
import ClinicianWorkbookEditorPage from "./pages/ClinicianWorkbookEditorPage";

const queryClient = new QueryClient();

function EmailConfirmedToast() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    if (params.get("confirmed") !== "1") return;
    toast.success("Email confirmed — welcome to ShiftED AI");
    const next = new URLSearchParams(params);
    next.delete("confirmed");
    const qs = next.toString();
    window.history.replaceState({}, "", `${location.pathname}${qs ? `?${qs}` : ""}`);
  }, [params, location.pathname, setParams]);

  return null;
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <EmailConfirmedToast />
          <Routes>
            <Route path="/" element={<MainLandingPage />} />
            <Route path="/testing/login" element={<LoginPage />} />
            <Route path="/testing/reset-password" element={<ResetPasswordPage />} />
            <Route path="/adminchat" element={<AppLayout />}>
              <Route index element={<AdminChatPage />} />
            </Route>
            <Route path="/testing" element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/testing/journeys" replace />} />
                <Route path="journeys" element={<JourneysDashboardPage />} />
                <Route path="journeys/:journeyId" element={<SessionWorkspacePage />} />
                <Route path="avatar/session/:journeyId" element={<AvatarSessionPage />} />
                <Route path="avatar/session" element={<Navigate to="/testing/journeys" replace />} />
                <Route path="library" element={<SkillsLibraryPage />} />
                <Route path="library/:workbookId" element={<WorkbookDetailPage />} />
                <Route path="profile" element={<ProfileDashboardPage />} />
                <Route path="dashboard" element={<Navigate to="/testing/profile" replace />} />
                <Route path="journal" element={<JournalPage />} />
                <Route path="resources" element={<ResourcesPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="workbooks" element={<RequireAdmin />}>
                  <Route index element={<ClinicianWorkbooksPage />} />
                  <Route path="new" element={<ClinicianWorkbookNewPage />} />
                  <Route path=":id" element={<ClinicianWorkbookEditorPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/testing/journeys" replace />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
