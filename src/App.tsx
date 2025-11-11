
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionsProvider } from "@/contexts/PermissionsContext";
import { EmployeeAuthProvider } from "@/contexts/EmployeeAuthContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { EmployeeProtectedRoute } from "@/components/layout/EmployeeProtectedRoute";
import { useActivitySync, useRoutePrefetching } from "@/hooks/useActivitySync";
import { queryClient } from "@/lib/query-client";
import PublicHome from "./pages/PublicHome";
import Index from "./pages/Index";
import Employees from "./pages/Employees";
import Clients from "./pages/Clients";
import Leaves from "./pages/Leaves";
import Documents from "./pages/Documents";
import Compliance from "./pages/Compliance";
import ComplianceType from "./pages/ComplianceType";
import ClientCompliance from "./pages/ClientCompliance";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import UserManagement from "./pages/UserManagement";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeChangePassword from "./pages/EmployeeChangePassword";
import UnifiedAuth from "./pages/UnifiedAuth";
import JobApplication from "./pages/JobApplication";
import JobApplications from "./pages/JobApplications";
import DocumentSigning from "./pages/DocumentSigning";
import DocumentSigningView from "./pages/DocumentSigningView";
import EmployeeDocumentSigningView from "./pages/EmployeeDocumentSigningView";
import Reference from "./pages/Reference";
import EmployeeCareWorkerStatements from "./pages/EmployeeCareWorkerStatements";
import NotFound from "./pages/NotFound";



// Employee routes wrapper with EmployeeAuthProvider
function EmployeeRoutes() {
  return (
    <EmployeeAuthProvider>
      <Routes>
        <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        <Route path="/employee-change-password" element={<EmployeeChangePassword />} />
      </Routes>
    </EmployeeAuthProvider>
  );
}

// App content with permissions and activity sync
function AppContent() {
  const location = useLocation();
  
  // Enable global activity synchronization and route-based prefetching
  useActivitySync();
  useRoutePrefetching(location.pathname);
  
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<UnifiedAuth />} />
      <Route path="/job-application" element={<JobApplication />} />
      <Route path="/reference" element={<Reference />} />
      <Route path="/sign/:token" element={<DocumentSigningView />} />
      <Route path="/employee-sign/:token" element={
        <EmployeeDocumentSigningView />
      } />
      
      {/* Legacy redirects */}
      <Route path="/auth" element={<Navigate to="/login" replace />} />
      <Route path="/employee-login" element={<UnifiedAuth />} />
      
      {/* Employee routes with their own provider and protection */}
      <Route path="/employee-dashboard" element={
        <EmployeeAuthProvider>
          <EmployeeProtectedRoute>
            <EmployeeDashboard />
          </EmployeeProtectedRoute>
        </EmployeeAuthProvider>
      } />
      <Route path="/employee-change-password" element={
        <EmployeeAuthProvider>
          <EmployeeProtectedRoute>
            <EmployeeChangePassword />
          </EmployeeProtectedRoute>
        </EmployeeAuthProvider>
      } />
      <Route path="/employee-statements" element={
        <EmployeeAuthProvider>
          <EmployeeProtectedRoute>
            <EmployeeCareWorkerStatements />
          </EmployeeProtectedRoute>
        </EmployeeAuthProvider>
      } />
      
      {/* Admin routes */}
      <Route path="/admin" element={
        <ProtectedRoute requiredPage="/">
          <Index />
        </ProtectedRoute>
      } />
      <Route path="/employees" element={
        <ProtectedRoute requiredPage="/employees">
          <Employees />
        </ProtectedRoute>
      } />
      <Route path="/clients" element={
        <ProtectedRoute requiredPage="/clients">
          <Clients />
        </ProtectedRoute>
      } />
      <Route path="/leaves" element={
        <ProtectedRoute requiredPage="/leaves">
          <Leaves />
        </ProtectedRoute>
      } />
      <Route path="/documents" element={
        <ProtectedRoute requiredPage="/documents">
          <Documents />
        </ProtectedRoute>
      } />
      <Route path="/compliance" element={
        <ProtectedRoute requiredPage="/compliance">
          <Compliance />
        </ProtectedRoute>
      } />
      <Route path="/compliance/:id" element={
        <ProtectedRoute requiredPage="/compliance">
          <ComplianceType />
        </ProtectedRoute>
      } />
      <Route path="/client-compliance/:id" element={
        <ProtectedRoute requiredPage="/compliance">
          <ClientCompliance />
        </ProtectedRoute>
      } />
      <Route path="/reports" element={
        <ProtectedRoute requiredPage="/reports">
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute requiredPage="/settings">
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/user-management" element={
        <ProtectedRoute requiredPage="/user-management">
          <UserManagement />
        </ProtectedRoute>
      } />
      <Route path="/job-applications" element={
        <ProtectedRoute requiredPage="/job-applications">
          <JobApplications />
        </ProtectedRoute>
      } />
      <Route path="/document-signing" element={
        <ProtectedRoute requiredPage="/document-signing">
          <DocumentSigning />
        </ProtectedRoute>
      } />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <PermissionsProvider>
          <CompanyProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
              <ReactQueryDevtools initialIsOpen={false} />
            </TooltipProvider>
          </CompanyProvider>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
