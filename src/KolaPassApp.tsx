// src/KolaPassApp.tsx — application KolaPass reliée au serveur (données partagées entre postes).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CurrencyCode, EventTicketPass, OfflineScanItem, StoreSettings, TicketBatchRange, TicketingEvent, UserSession } from './types';
import { api, ApiError, op, SESSION_EXPIRED_EVENT, type ServerState, type ServerUser } from './lib/api';
import { LoginScreen } from './components/LoginScreen';
import { AdminPanel } from './components/AdminPanel';
import { SubTab, TicketingProjectView } from './components/TicketingProjectView';

type Tab = SubTab | 'admin';

const ROLE_LABEL = { admin: 'Administrateur', organizer: 'Organisateur', agent: 'Agent de contrôle' } as const;

/** Onglets visibles selon le rôle. */
function tabsFor(role: ServerUser['role'], counts: { batches: number; passes: number; logs: number }) {
  const all: Array<{ id: Tab; label: string; roles: ServerUser['role'][] }> = [
    { id: 'events', label: 'Événements & Vente', roles: ['admin', 'organizer'] },
    { id: 'batches', label: `Plages (${counts.batches})`, roles: ['admin', 'organizer'] },
    { id: 'scanner', label: 'Portique (scan)', roles: ['admin', 'organizer', 'agent'] },
    { id: 'passes', label: `Billets (${counts.passes})`, roles: ['admin', 'organizer', 'agent'] },
    { id: 'logs', label: `Journal des scans (${counts.logs})`, roles: ['admin', 'organizer', 'agent'] },
    { id: 'organizers', label: 'Reversements', roles: ['admin', 'organizer'] },
    { id: 'monetization', label: 'Rentabilité', roles: ['admin'] },
    { id: 'admin', label: 'Administration', roles: ['admin'] },
  ];
  return all.filter(t => t.roles.includes(role));
}

interface Toast { id: number; type: 'success' | 'error'; message: string }

export const KolaPassApp: React.FC = () => {
  const [user, setUser] = useState<ServerUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [state, setState] = useState<ServerState | null>(null);
  const [online, setOnline] = useState(true);
  const [tab, setTab] = useState<Tab>('events');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const versionRef = useRef(0);

  const notify = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t.slice(-3), { id, type, message }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000);
  }, []);

  // Session existante ?
  useEffect(() => {
    api<{ user: ServerUser }>('GET', '/api/auth/me')
      .then(r => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    const onExpired = () => { setUser(null); setState(null); setNotice('Votre session a expiré : reconnectez-vous.'); };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const ready = !!user && !user.mustChangePassword;

  // Chargement + actualisation automatique (toutes les 5 s, ou au retour sur l'onglet).
  const refresh = useCallback(async (force = false) => {
    try {
      const r = await api<ServerState & { unchanged?: boolean }>('GET', `/api/state${force ? '' : `?since=${versionRef.current}`}`);
      setOnline(true);
      if (r.unchanged) return;
      versionRef.current = r.version;
      setState(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOnline(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    refresh(true);
    const t = setInterval(() => refresh(), 5000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, [ready, refresh]);

  useEffect(() => {
    if (user && state) {
      const allowed = tabsFor(user.role, { batches: 0, passes: 0, logs: 0 }).map(t => t.id);
      if (!allowed.includes(tab)) setTab(allowed[0]);
    }
  }, [user, state, tab]);

  // Exécute une opération serveur, puis recharge les données.
  const mutate = useCallback(async <T,>(fn: () => Promise<T>, success?: string): Promise<T> => {
    try {
      const result = await fn();
      if (success) notify('success', success);
      await refresh(true);
      return result;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Erreur inattendue.';
      notify('error', msg);
      throw e;
    }
  }, [notify, refresh]);

  const logout = async () => {
    try { await api('POST', '/api/auth/logout'); } catch { /* déjà déconnecté */ }
    setUser(null); setState(null); setAccountOpen(false); versionRef.current = 0;
  };

  // --- Adaptateurs vers l'écran billetterie existant ---------------------------
  const session: UserSession | undefined = useMemo(() => user ? {
    id: user.id, name: user.name, phone: user.phone || '', role: user.role,
    token: '', twoFactorVerified: true, avatarUrl: '',
  } : undefined, [user]);

  const storeSettings: StoreSettings | null = useMemo(() => state ? ({
    storeName: state.settings.organizationName || 'KolaPass',
    address: '', phone: state.settings.phone || '', taxId: '', cashierName: user?.name || '',
    receiptFooter: '', defaultCurrency: 'USD', taxRatePercent: 0, adminPassword: '',
    rates: state.settings.rates, sector: 'pharmacy', availableStylists: [],
  } as StoreSettings) : null, [state, user]);

  if (checking) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Chargement…</div>;
  if (!user || user.mustChangePassword) {
    return <LoginScreen pendingUser={user?.mustChangePassword ? user : null} notice={notice} onAuthenticated={u => { setNotice(null); setUser(u); }} />;
  }
  if (!state || !storeSettings || !session) return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Chargement des données…</div>;

  const tabs = tabsFor(user.role, { batches: state.batches.length, passes: state.passes.length, logs: state.logs.length });
  const organizers = state.users.filter(u => u.role === 'organizer' && u.active).map(u => ({ id: u.id, name: u.name, phone: u.phone }));

  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-sky-50 via-sky-100/30 to-blue-50/50 text-slate-900">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b-2 border-sky-300 bg-white/95 backdrop-blur-xs px-4 sm:px-6 py-3 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-600 bg-rose-700 text-white font-mono text-sm font-bold">KP</span>
          <span className="text-lg font-black text-slate-950">{state.settings.organizationName || 'KolaPass'}</span>
          <span className={`hidden sm:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold ${online ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-amber-400 bg-amber-50 text-amber-900'}`}>
            <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {online ? 'Connecté au serveur' : 'Serveur injoignable'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Devise d'affichage" value={currency} onChange={e => setCurrency(e.target.value as CurrencyCode)} className="rounded-lg border-2 border-slate-300 bg-slate-100 px-2 py-1.5 text-xs font-mono font-bold">
            <option value="USD">USD ($)</option><option value="CDF">CDF (FC)</option><option value="XOF">XOF</option><option value="EUR">EUR (€)</option>
          </select>
          <div className="relative">
            <button type="button" onClick={() => setAccountOpen(o => !o)} className="rounded-lg border-2 border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:border-slate-800">
              {user.name} · <span className="text-rose-800">{ROLE_LABEL[user.role]}</span>
            </button>
            {accountOpen && <AccountMenu onLogout={logout} onClose={() => setAccountOpen(false)} notify={notify} />}
          </div>
        </div>
      </header>

      <nav aria-label="Navigation principale" className="flex items-center gap-1.5 overflow-x-auto border-b-2 border-slate-300 bg-slate-100 px-3 py-2">
        {tabs.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold whitespace-nowrap border transition-all ${tab === t.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-200'}`}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 mx-auto w-full max-w-[1400px] px-3 sm:px-6 py-6">
        {tab === 'admin' ? (
          <AdminPanel state={state} currentUser={user} onChanged={() => refresh(true)} onNotify={notify} />
        ) : (
          <TicketingProjectView
            events={state.events}
            passes={state.passes}
            batches={state.batches}
            accessLogs={state.logs}
            organizerPayouts={state.payouts}
            displayCurrency={currency}
            settings={storeSettings}
            activeSubTab={tab as SubTab}
            onSubTabChange={t => setTab(t)}
            currentUserSession={session}
            onOpenAccount={() => setAccountOpen(true)}
            promoCodes={state.settings.promoCodes || []}
            maxDiscountPercent={user.role === 'admin' ? 100 : state.settings.maxDiscountPercent ?? 0}
            gates={state.settings.gates?.length ? state.settings.gates : ['Entrée principale']}
            organizers={user.role === 'admin' ? organizers : undefined}
            onCreateEvent={data => mutate(() => op<TicketingEvent>('POST', '/api/events', data), 'Événement créé.')}
            onPurchaseTicketPasses={payload => mutate(async () => (await op<{ passes: EventTicketPass[] }>('POST', '/api/passes/sell', payload)).passes, 'Billets émis.')}
            onGenerateBatch={payload => mutate(() => op<{ batch: TicketBatchRange; passes: EventTicketPass[] }>('POST', '/api/batches', payload), 'Plage générée.')}
            onScanTicketPass={async (code, gate, eventId) => {
              const r = await op<any>('POST', '/api/scan', { code, gate, eventId });
              refresh(true);
              return r;
            }}
            onSetEventStatus={(id, status) => { mutate(() => op('PATCH', `/api/events/${id}`, { status }), status === 'completed' ? 'Événement clôturé.' : 'Événement rouvert.').catch(() => {}); }}
            onRequestOrganizerPayout={payload => { mutate(() => op('POST', '/api/payouts', payload), 'Demande de reversement envoyée à l\'administrateur.').catch(() => {}); }}
            onBlacklistPass={(id, reason) => { mutate(() => op('POST', `/api/passes/${id}/blacklist`, { reason }), 'Billet bloqué.').catch(() => {}); }}
            onReactivatePass={id => { mutate(() => op('POST', `/api/passes/${id}/reactivate`, {}), 'Billet réactivé.').catch(() => {}); }}
            onSyncOfflineScans={async (scans: OfflineScanItem[]) => {
              const r = await mutate(() => op<{ results: Array<{ code: string; outcome: string }> }>('POST', '/api/scan/sync', { scans }));
              const dup = r.results.filter(x => x.outcome !== 'valid_entry').length;
              notify(dup ? 'error' : 'success', `${r.results.length} scan(s) synchronisé(s)${dup ? ` — ${dup} refusé(s) par le serveur (doublon, bloqué ou inconnu) : voir le journal` : ''}.`);
            }}
          />
        )}
      </main>

      <div aria-live="polite" className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold shadow-lg ${t.type === 'success' ? 'border-emerald-400 bg-emerald-50 text-emerald-900' : 'border-rose-400 bg-rose-50 text-rose-900'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Menu du compte : changement de mot de passe, déconnexion. */
const AccountMenu: React.FC<{ onLogout: () => void; onClose: () => void; notify: (t: 'success' | 'error', m: string) => void }> = ({ onLogout, onClose, notify }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="absolute right-0 mt-2 w-72 rounded-xl border-2 border-slate-300 bg-white p-4 shadow-xl z-40 space-y-3 text-xs">
      <form className="space-y-2" onSubmit={async e => {
        e.preventDefault();
        setBusy(true);
        try {
          await api('POST', '/api/auth/password', { currentPassword: current, newPassword: next });
          notify('success', 'Mot de passe changé. Les autres postes connectés avec ce compte ont été déconnectés.');
          setCurrent(''); setNext(''); onClose();
        } catch (err) { notify('error', err instanceof ApiError ? err.message : 'Erreur.'); } finally { setBusy(false); }
      }}>
        <p className="font-bold text-slate-800">Changer mon mot de passe</p>
        <input type="password" aria-label="Mot de passe actuel" placeholder="Mot de passe actuel" required value={current} onChange={e => setCurrent(e.target.value)} className="w-full rounded-lg border-2 border-slate-300 px-2 py-1.5" />
        <input type="password" aria-label="Nouveau mot de passe" placeholder="Nouveau (10 caractères min.)" required value={next} onChange={e => setNext(e.target.value)} className="w-full rounded-lg border-2 border-slate-300 px-2 py-1.5" />
        <button disabled={busy} className="w-full rounded-lg border-2 border-slate-800 bg-slate-800 py-1.5 font-bold text-white disabled:opacity-50">Enregistrer</button>
      </form>
      <button type="button" onClick={onLogout} className="w-full rounded-lg border-2 border-rose-400 py-1.5 font-bold text-rose-800 hover:bg-rose-50">Se déconnecter</button>
    </div>
  );
};
