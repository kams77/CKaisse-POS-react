import React, { useEffect, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, User } from 'lucide-react';
import { api, ApiError, type ServerUser } from '../lib/api';

interface Props {
  /** Utilisateur connecté qui doit changer son mot de passe provisoire. */
  pendingUser?: ServerUser | null;
  notice?: string | null;
  onAuthenticated: (user: ServerUser) => void;
}

const inputClass =
  'w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-slate-800 focus:outline-none';

export const LoginScreen: React.FC<Props> = ({ pendingUser, notice, onAuthenticated }) => {
  const [status, setStatus] = useState<{ initialized: boolean; organizationName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Connexion
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  // Installation
  const [setupCode, setSetupCode] = useState('');
  const [orgName, setOrgName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');
  const [confirm, setConfirm] = useState('');
  // Changement de mot de passe
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');

  useEffect(() => {
    api<{ initialized: boolean; organizationName: string }>('GET', '/api/public/status')
      .then(setStatus)
      .catch(e => setError(e instanceof ApiError ? e.message : 'Serveur injoignable.'));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Erreur inattendue.'); } finally { setBusy(false); }
  };

  const title = status?.organizationName || 'KolaPass';

  const card = (heading: string, sub: string, body: React.ReactNode) => (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-sky-50 via-sky-100/30 to-blue-50/50 p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-600 bg-rose-700 font-mono text-sm font-bold text-white">KP</span>
          <div>
            <h1 className="text-lg font-black text-slate-950">{heading}</h1>
            <p className="text-xs text-slate-500">{sub}</p>
          </div>
        </div>
        {notice && <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">{error}</p>}
        {body}
      </div>
    </div>
  );

  if (pendingUser) {
    return card('Nouveau mot de passe', `Bonjour ${pendingUser.name} : choisissez un mot de passe personnel.`, (
      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault();
          if (next !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
          run(async () => {
            const r = await api<{ user: ServerUser }>('POST', '/api/auth/password', { currentPassword: current, newPassword: next });
            onAuthenticated(r.user);
          });
        }}
      >
        <label className="block text-xs font-bold text-slate-700">Mot de passe provisoire
          <input id="current-password" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-bold text-slate-700">Nouveau mot de passe
          <input id="new-password" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)} className={inputClass} />
        </label>
        <p className="text-[11px] text-slate-500">Au moins 10 caractères, avec des lettres et des chiffres, sans votre identifiant.</p>
        <label className="block text-xs font-bold text-slate-700">Confirmer
          <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
        </label>
        <button disabled={busy} className="w-full rounded-xl border-2 border-slate-800 bg-slate-800 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60">
          {busy ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
      </form>
    ));
  }

  if (!status) return card(title, 'Connexion au serveur…', <p className="text-xs text-slate-500">{error ? 'Vérifiez que le serveur est démarré.' : 'Chargement…'}</p>);

  if (!status.initialized) {
    return card('Installation de KolaPass', 'Premier démarrage : créez le compte administrateur.', (
      <form
        className="space-y-3"
        onSubmit={e => {
          e.preventDefault();
          if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.');
          run(async () => {
            const r = await api<{ user: ServerUser }>('POST', '/api/setup', { setupCode, organizationName: orgName, name: adminName, login, phone, password });
            onAuthenticated(r.user);
          });
        }}
      >
        <label className="block text-xs font-bold text-slate-700">Code d'installation (SETUP_CODE du serveur)
          <input id="setup-code" required value={setupCode} onChange={e => setSetupCode(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-bold text-slate-700">Nom de l'organisation
          <input id="setup-org" required value={orgName} onChange={e => setOrgName(e.target.value)} className={inputClass} placeholder="Ex. KolaPass Kinshasa" />
        </label>
        <label className="block text-xs font-bold text-slate-700">Nom de l'administrateur
          <input id="setup-name" required value={adminName} onChange={e => setAdminName(e.target.value)} className={inputClass} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-bold text-slate-700">Identifiant
            <input id="setup-login" required autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} className={inputClass} placeholder="ex. admin" />
          </label>
          <label className="block text-xs font-bold text-slate-700">Téléphone
            <input id="setup-phone" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} placeholder="+243 …" />
          </label>
        </div>
        <label className="block text-xs font-bold text-slate-700">Mot de passe
          <input id="setup-password" type="password" required autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
        </label>
        <label className="block text-xs font-bold text-slate-700">Confirmer le mot de passe
          <input id="setup-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
        </label>
        <button disabled={busy} className="w-full rounded-xl border-2 border-rose-700 bg-rose-700 py-2.5 text-sm font-bold text-white hover:bg-rose-800 disabled:opacity-60 flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4" /> {busy ? 'Création…' : 'Créer le compte administrateur'}
        </button>
      </form>
    ));
  }

  return card(title, 'Billetterie & contrôle d\'accès — connexion', (
    <form
      className="space-y-3"
      onSubmit={e => {
        e.preventDefault();
        run(async () => {
          const r = await api<{ user: ServerUser }>('POST', '/api/auth/login', { login, password });
          setPassword('');
          onAuthenticated(r.user);
        });
      }}
    >
      <label className="block text-xs font-bold text-slate-700">
        <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Identifiant</span>
        <input id="login-identifier" required autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} className={inputClass} />
      </label>
      <label className="block text-xs font-bold text-slate-700">
        <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Mot de passe</span>
        <input id="login-password" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
      </label>
      <button disabled={busy} className="w-full rounded-xl border-2 border-slate-800 bg-slate-800 py-2.5 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60 flex items-center justify-center gap-2">
        <KeyRound className="h-4 w-4" /> {busy ? 'Connexion…' : 'Se connecter'}
      </button>
      <p className="text-[11px] text-slate-500">Compte oublié ou bloqué : demandez à l'administrateur de réinitialiser votre mot de passe.</p>
    </form>
  ));
};
