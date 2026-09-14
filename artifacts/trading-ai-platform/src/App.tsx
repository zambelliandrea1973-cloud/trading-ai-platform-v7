import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Shell } from '@/components/shell';
import { I18nProvider, useI18n } from '@/lib/i18n';
import { DashboardV71Page } from '@/pages/dashboard-v71';
import { StrategyComparisonPage } from '@/pages/strategy-comparison';
import { AssetPage, BacktestPage, HistoryPage, MarketsPage, NewsPage, OpportunitiesPage, PortfolioPage, RiskPage, SettingsPage, SimulatorPage, SystemPage } from '@/pages/platform';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#f5a623',
    colorForeground: '#f5f7fb',
    colorMutedForeground: '#9aa4b5',
    colorDanger: '#f06b6b',
    colorBackground: '#151a24',
    colorInput: '#0f131b',
    colorInputForeground: '#f5f7fb',
    colorNeutral: '#2b3443',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.55rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#151a24] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#2b3443]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f5f7fb] font-bold',
    headerSubtitle: 'text-[#9aa4b5]',
    socialButtonsBlockButtonText: 'text-[#f5f7fb]',
    formFieldLabel: 'text-[#f5f7fb]',
    footerActionLink: 'text-[#f5a623]',
    footerActionText: 'text-[#9aa4b5]',
    dividerText: 'text-[#9aa4b5]',
    identityPreviewEditButton: 'text-[#f5a623]',
    formFieldSuccessText: 'text-[#38c7b0]',
    alertText: 'text-[#f5f7fb]',
    logoBox: 'mb-4',
    logoImage: 'h-10 w-10',
    socialButtonsBlockButton: 'border-[#2b3443] bg-[#0f131b] hover:bg-[#202735]',
    formButtonPrimary: 'bg-[#f5a623] text-[#11151d] hover:bg-[#ffc45b]',
    formFieldInput: 'border-[#2b3443] bg-[#0f131b] text-[#f5f7fb]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#2b3443]',
    alert: 'border-[#f06b6b]/40 bg-[#f06b6b]/10',
    otpCodeFieldInput: 'border-[#2b3443] bg-[#0f131b] text-[#f5f7fb]',
    formFieldRow: 'mb-4',
    main: 'text-[#f5f7fb]',
  },
};

function LandingPage() {
  const { t } = useI18n();
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 py-12"><div className="w-full max-w-5xl"><div className="grid items-center gap-12 lg:grid-cols-[1.1fr_.9fr]"><div><div className="mb-8 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ActivityIcon /></span><div><p className="display text-lg font-bold text-foreground">VECTOR / AI</p><p className="mono text-[10px] uppercase tracking-[.2em] text-muted-foreground">paper cockpit</p></div></div><p className="eyebrow mb-4 text-primary">{t('landing.eyebrow')}</p><h1 className="display max-w-2xl text-4xl font-bold leading-tight text-foreground md:text-6xl">{t('landing.title')}</h1><p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground">{t('landing.subtitle')}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-in" className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-primary-foreground no-underline hover:brightness-110" data-testid="link-sign-in">{t('landing.signIn')}</Link><Link href="/sign-up" className="rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground no-underline hover:border-primary/50" data-testid="link-sign-up">{t('landing.signUp')}</Link></div></div><div className="panel p-6 md:p-8"><div className="mb-6 flex items-center justify-between"><span className="mono text-[10px] tracking-[.2em] text-accent">{t('landing.paperOnly')}</span><span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_4px_hsl(var(--accent)/.15)]" /></div><p className="text-lg font-semibold text-foreground">{t('landing.description')}</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-md bg-secondary/60 p-3"><p className="eyebrow">01</p><p className="mt-2 text-xs text-muted-foreground">{t('nav.observe')}</p></div><div className="rounded-md bg-secondary/60 p-3"><p className="eyebrow">02</p><p className="mt-2 text-xs text-muted-foreground">{t('nav.decide')}</p></div><div className="rounded-md bg-secondary/60 p-3"><p className="eyebrow">03</p><p className="mt-2 text-xs text-muted-foreground">{t('nav.control')}</p></div></div></div></div></div></main>;
}

function ActivityIcon() {
  return <span className="text-lg">⌁</span>;
}

function AuthLoading() {
  const { t } = useI18n();
  return <main className="flex min-h-[100dvh] items-center justify-center bg-background"><div className="mono text-xs text-muted-foreground">{t('system.checking')}</div></main>;
}

function ProtectedArea({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function AppRoutes() {
  return <Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/dashboard"><ProtectedArea><Shell><DashboardV71Page /></Shell></ProtectedArea></Route>
    <Route path="/strategies"><ProtectedArea><Shell><StrategyComparisonPage /></Shell></ProtectedArea></Route>
    <Route path="/markets"><ProtectedArea><Shell><MarketsPage /></Shell></ProtectedArea></Route>
    <Route path="/assets/:symbol"><ProtectedArea><Shell><AssetPage /></Shell></ProtectedArea></Route>
    <Route path="/opportunities"><ProtectedArea><Shell><OpportunitiesPage /></Shell></ProtectedArea></Route>
    <Route path="/portfolio"><ProtectedArea><Shell><PortfolioPage /></Shell></ProtectedArea></Route>
    <Route path="/simulator"><ProtectedArea><Shell><SimulatorPage /></Shell></ProtectedArea></Route>
    <Route path="/news"><ProtectedArea><Shell><NewsPage /></Shell></ProtectedArea></Route>
    <Route path="/risk"><ProtectedArea><Shell><RiskPage /></Shell></ProtectedArea></Route>
    <Route path="/backtest"><ProtectedArea><Shell><BacktestPage /></Shell></ProtectedArea></Route>
    <Route path="/history"><ProtectedArea><Shell><HistoryPage /></Shell></ProtectedArea></Route>
    <Route path="/system"><ProtectedArea><Shell><SystemPage /></Shell></ProtectedArea></Route>
    <Route path="/settings"><ProtectedArea><Shell><SettingsPage /></Shell></ProtectedArea></Route>
    <Route component={NotFound} />
  </Switch>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) client.clear();
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function ClerkApp() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your secure PAPER cockpit' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Start with a protected PAPER workspace' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={() => <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>} />
        <Route path="/sign-up/*?" component={() => <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>} />
        <Route component={AppRoutes} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <I18nProvider><TooltipProvider><WouterRouter base={basePath}><ErrorBoundary><ClerkApp /></ErrorBoundary></WouterRouter><Toaster /></TooltipProvider></I18nProvider>;
}

export default App;