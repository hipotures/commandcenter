import { QueryProvider } from './providers/QueryProvider';
import { ThemeSync } from './theme/ThemeSync';
import { DashboardPage } from '../pages/dashboard/DashboardPage';

export default function App() {
  return (
    <QueryProvider>
      <ThemeSync />
      <DashboardPage />
    </QueryProvider>
  );
}
