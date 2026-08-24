import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import { I18nProvider } from '@/lib/i18n';
import { AssetPage, BacktestPage, DashboardPage, HistoryPage, MarketsPage, NewsPage, OpportunitiesPage, PortfolioPage, RiskPage, SettingsPage, SimulatorPage, SystemPage } from '@/pages/platform';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/"><Shell><DashboardPage /></Shell></Route>
        <Route path="/markets"><Shell><MarketsPage /></Shell></Route>
        <Route path="/assets/:symbol"><Shell><AssetPage /></Shell></Route>
        <Route path="/opportunities"><Shell><OpportunitiesPage /></Shell></Route>
        <Route path="/portfolio"><Shell><PortfolioPage /></Shell></Route>
        <Route path="/simulator"><Shell><SimulatorPage /></Shell></Route>
        <Route path="/news"><Shell><NewsPage /></Shell></Route>
        <Route path="/risk"><Shell><RiskPage /></Shell></Route>
        <Route path="/backtest"><Shell><BacktestPage /></Shell></Route>
        <Route path="/history"><Shell><HistoryPage /></Shell></Route>
        <Route path="/system"><Shell><SystemPage /></Shell></Route>
        <Route path="/settings"><Shell><SettingsPage /></Shell></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}

export default App;
