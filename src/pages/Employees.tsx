import { MainLayout } from "@/components/layout/MainLayout";
import { EmployeesContent } from "@/components/employees/EmployeesContent";

export default function EmployeesPage() {
  console.log('[EmployeesPage] Rendering');
  return (
    <MainLayout>
      <EmployeesContent />
    </MainLayout>
  );
}