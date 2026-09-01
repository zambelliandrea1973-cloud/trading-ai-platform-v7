import { Activity, ArrowRightLeft, BarChart3, Cpu, History, LayoutDashboard, LineChart, LogOut, Newspaper, Radar, Settings, ShieldCheck, SlidersHorizontal, WalletCards, X } from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { type ReactNode } from 'react';
import { useI18n, type Locale } from '@/lib/i18n';

const navGroups = [
  { key: 'observe', items: [
    { href: '/', key: 'overview', icon: LayoutDashboard },
    { href: '/markets', key: 'markets', icon: LineChart },
    { href: '/opportunities', key: 'opportunities', icon: Radar },
    { href: '/news', key: 'news', icon: Newspaper },
  ]},
  { key: 'decide', items: [
    { href: '/portfolio', key: 'portfolio', icon: WalletCards },
    { href: '/simulator', key: 'simulator', icon: SlidersHorizontal },
    { href: '/strategies', key: 'strategies', label: 'Confronto strategie', icon: ArrowRightLeft },
    { href: '/history', key: 'history', icon: History },
  ]},
  { key: 'control', items: [
    { href: '/risk', key: 'risk', icon: ShieldCheck },
    { href: '/backtest', key: 'backtest', icon: BarChart3 },
    { href: '/system', key: 'system', icon: Cpu },
    { href: '/settings', key: 'settings', icon: Settings },
  ]},
];

function Logo() {
  return <Link href="/" className="flex items-center gap-3 no-underline" data-testid="link-brand">
    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm"><Activity size={19} strokeWidth={2.4} /></span>
    <span className="leading-tight"><span className="block display text-[15px] font-bold tracking-tight text-foreground">VECTOR / AI</span><span className="mono text-[9px] uppercase tracking-[.2em] text-muted-foreground">paper cockpit</span></span>
  </Link>;
}

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { locale, setLocale, t } = useI18n();
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || t('shell.analyst');
  const initials = displayName.slice(0, 2).toUpperCase();
  const navLabel = (item: { key: string; label?: string }) => item.label ?? t(`nav.${item.key}` as Parameters<typeof t>[0]);
  return <div className="app-shell">
    <aside className="app-sidebar">
      <div className="mb-9 flex items-center justify-between"><Logo /><span className="hidden rounded border border-primary/30 px-1.5 py-1 mono text-[9px] text-primary md:block">V7</span></div>
      <nav className="sidebar-nav space-y-7" aria-label="Primary navigation">
        {navGroups.map((group) => <div key={group.key}>
          <p className="eyebrow mb-2 px-3">{t(`nav.${group.key}` as Parameters<typeof t>[0])}</p>
          <div className="space-y-1">{group.items.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/' ? location === '/' : location.startsWith(item.href);
            const label = navLabel(item);
            return <Link key={item.href} href={item.href} className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-semibold no-underline transition ${active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`} data-testid={`link-nav-${item.key}`}>
              <Icon size={16} strokeWidth={active ? 2.5 : 1.8} /><span>{label}</span>{item.key === 'opportunities' && <span className={`ml-auto rounded-full px-1.5 py-0.5 mono text-[9px] ${active ? 'bg-background/20' : 'bg-accent/15 text-accent'}`}>04</span>}
            </Link>;
          })}</div>
        </div>)}
      </nav>
      <div className="mt-10 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_0_3px_hsl(var(--accent)/.15)]" /><span className="mono text-[10px] uppercase tracking-wider text-accent">{t('shell.paperMode')}</span></div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t('shell.noRealOrders')}</p>
      </div>
      <div className="mt-auto hidden border-t border-sidebar-border pt-5 md:block"><div className="flex items-center gap-2.5"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary mono text-xs text-primary">{initials}</div><div className="min-w-0"><p className="truncate text-xs font-semibold text-foreground">{displayName}</p><p className="mono text-[10px] text-muted-foreground">{t('shell.signedInAs')} · {t('shell.beginner')}</p></div></div><button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL.replace(/\/$/, '') || '/' })} className="mt-4 inline-flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive" data-testid="button-sign-out"><LogOut size={14} />{t('shell.signOut')}</button></div>
    </aside>
    <main className="main-canvas">
      <header className="flex h-[68px] items-center justify-between border-b border-border px-5 md:px-9">
        <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-accent" /><span className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">{t('shell.marketData')}</span><span className="text-border">/</span><span className="mono text-[10px] text-muted-foreground">{t('shell.delayed')}</span></div>
        <div className="flex items-center gap-3"><span className="hidden rounded-full border border-accent/25 bg-accent/5 px-3 py-1.5 mono text-[10px] text-accent sm:inline-flex">{t('shell.paperOnly')}</span><div className="flex rounded-md border border-border p-0.5" role="group" aria-label={t('language.label')}><button onClick={() => setLocale('it')} className={`px-2 py-1 mono text-[10px] ${locale === 'it' ? 'rounded bg-primary text-primary-foreground' : 'text-muted-foreground'}`} aria-pressed={locale === 'it'}>IT</button><button onClick={() => setLocale('en')} className={`px-2 py-1 mono text-[10px] ${locale === 'en' ? 'rounded bg-primary text-primary-foreground' : 'text-muted-foreground'}`} aria-pressed={locale === 'en'}>EN</button></div><button className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" data-testid="button-dismiss-alert" onClick={() => undefined} aria-label={t('shell.dismiss')}><X size={16} /></button></div>
      </header>
      {children}
    </main>
    <nav className="mobile-nav fixed bottom-0 left-0 right-0 z-10 hidden items-center justify-around border-t border-border bg-sidebar/95 p-2 backdrop-blur" aria-label="Mobile navigation">
      {[navGroups[0].items[0], navGroups[0].items[2], navGroups[1].items[0], navGroups[2].items[0], navGroups[2].items[3]].map((item) => { const Icon = item.icon; const label = navLabel(item); return <Link key={item.href} href={item.href} className={`flex flex-col items-center gap-1 px-3 py-1.5 text-[9px] no-underline ${location === item.href ? 'text-primary' : 'text-muted-foreground'}`} data-testid={`link-mobile-${item.key}`}><Icon size={17} /><span>{label.split(' ')[0]}</span></Link>; })}
    </nav>
  </div>;
}