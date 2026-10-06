import React, { useEffect, useState } from 'react';
import { Download, KeyRound, Plus, Save, Settings, ShieldCheck, Upload, Users, Wallet } from 'lucide-react';
import { api, ApiError, op, type ServerState, type ServerUser, type PromoCode } from '../lib/api';
import type { UserRole } from '../types';

interface Props {
  state: ServerState;
  currentUser: ServerUser;
  onChanged: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const ROLE_LABEL: Record<UserRole, string> = { admin: 'Administrateur', organizer: 'Organisateur', agent: 'Agent de contrôle' };
const box = 'rounded-2xl border-2 border-sky-200 bg-white p-5 shadow-xs space-y-4';
const input = 'rounded-lg border-2 border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-slate-800 focus:outline-none';
const btn = 'inline-flex items-center gap-1.5 rounded-lg border-2 px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50';

export const AdminPanel: React.FC<Props> = ({ state, currentUser, onChanged, onNotify }) => {
  const [busy, setBusy] = useState(false);
  const [credential, setCredential] = useState<{ name: string; login: string; password: string } | null>(null);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    try { await fn(); if (success) onNotify('success', success); onChanged(); }
    catch (e) { onNotify('error', e instanceof ApiError ? e.message : 'Erreur inattendue.'); }
    finally { setBusy(false); }
  };

  // ----- Nouveau compte -----
  const [nu, setNu] = useState({ name: '', login: '', phone: '', role: 'agent' as UserRole });
  const createUser = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await api<{ user: ServerUser; temporaryPassword: string }>('POST', '/api/users', nu);
      setCredential({ name: r.user.name, login: r.user.login, password: r.temporaryPassword });
      setNu({ name: '', login: '', phone: '', role: nu.role });
    }, 'Compte créé.');
  };
  const patchUser = (u: ServerUser, body: Record<string, unknown>, success: string) =>
    run(async () => {
      const r = await api<{ user: ServerUser; temporaryPassword: string | null }>('PATCH', `/api/users/${u.id}`, body);
      if (r.temporaryPassword) setCredential({ name: r.user.name, login: r.user.login, password: r.temporaryPassword });
    }, success);

  // ----- Paramètres -----
  const s = state.settings;
  const [form, setForm] = useState({
    organizationName: s.organizationName || '',
    phone: s.phone || '',
    defaultCommissionPercent: String(s.defaultCommissionPercent ?? 10),
    maxDiscountPercent: String(s.maxDiscountPercent ?? 20),
    gates: (s.gates || []).join('\n'),
    CDF: String(s.rates.CDF), XOF: String(s.rates.XOF), EUR: String(s.rates.EUR),
  });
  const [promos, setPromos] = useState<PromoCode[]>(s.promoCodes || []);
  useEffect(() => { setPromos(state.settings.promoCodes || []); }, [state.settings.promoCodes]);
  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const n = (v: string) => Number(v.replace(',', '.'));
    run(() => op('PUT', '/api/settings', {
      organizationName: form.organizationName,
      phone: form.phone,
      defaultCommissionPercent: n(form.defaultCommissionPercent),
      maxDiscountPercent: n(form.maxDiscountPercent),
      gates: form.gates.split('\n').map(g => g.trim()).filter(Boolean),
      promoCodes: promos.filter(p => p.code.trim()),
      rates: { CDF: n(form.CDF), XOF: n(form.XOF), EUR: n(form.EUR) },
    }), 'Paramètres enregistrés.');
  };

  // ----- Reversements -----
  const pending = state.payouts.filter(p => p.status === 'pending');
  const decide = (id: string, status: 'completed' | 'rejected') => {
    const value = window.prompt(status === 'completed' ? 'Référence du transfert (Mobile Money / banque) :' : 'Motif du refus :');
    if (!value) return;
    run(() => op('PATCH', `/api/payouts/${id}`, status === 'completed' ? { status, reference: value } : { status, reason: value }),
      status === 'completed' ? 'Reversement marqué payé.' : 'Reversement refusé.');
  };

  // ----- Sauvegarde -----
  const restore = (file: File) => {
    if (!window.confirm('Restaurer cette sauvegarde remplacera TOUTES les données actuelles. Continuer ?')) return;
    file.text().then(text => run(async () => {
      await api('POST', '/api/restore', JSON.parse(text));
      window.location.reload();
    }, 'Sauvegarde restaurée.')).catch(() => onNotify('error', 'Fichier illisible.'));
  };

  const now = Date.now();

  return (
    <div className="space-y-6">
      {credential && (
        <div role="alert" className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 text-sm text-emerald-950 space-y-1">
          <p className="font-bold">Identifiants à remettre à {credential.name} (affichés une seule fois) :</p>
          <p className="font-mono">Identifiant : <strong>{credential.login}</strong> — Mot de passe provisoire : <strong data-testid="temp-password">{credential.password}</strong></p>
          <p className="text-xs">La personne devra choisir son propre mot de passe à la première connexion.</p>
          <button className={`${btn} border-emerald-700 bg-white text-emerald-900 mt-2`} onClick={() => setCredential(null)}>J'ai noté</button>
        </div>
      )}

      {/* COMPTES */}
      <section className={box}>
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Users className="h-4 w-4 text-sky-700" /> Comptes utilisateurs ({state.users.length})</h2>
        <form onSubmit={createUser} className="flex flex-wrap items-end gap-2">
          <input aria-label="Nom complet" required placeholder="Nom complet" value={nu.name} onChange={e => setNu({ ...nu, name: e.target.value })} className={`${input} w-48`} />
          <input aria-label="Identifiant" required placeholder="Identifiant (ex. agent.porteA)" value={nu.login} onChange={e => setNu({ ...nu, login: e.target.value })} className={`${input} w-52`} />
          <input aria-label="Téléphone" placeholder="Téléphone" value={nu.phone} onChange={e => setNu({ ...nu, phone: e.target.value })} className={`${input} w-36`} />
          <select aria-label="Rôle" value={nu.role} onChange={e => setNu({ ...nu, role: e.target.value as UserRole })} className={input}>
            <option value="agent">Agent de contrôle</option>
            <option value="organizer">Organisateur</option>
            <option value="admin">Administrateur</option>
          </select>
          <button disabled={busy} className={`${btn} border-slate-800 bg-slate-800 text-white`}><Plus className="h-3.5 w-3.5" /> Créer le compte</button>
        </form>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-slate-500 border-b border-slate-200">
              <tr><th className="py-2">Nom</th><th>Identifiant</th><th>Rôle</th><th>État</th><th>Dernière connexion</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.users.map(u => {
                const locked = !!u.lockedUntil && u.lockedUntil > now;
                const self = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td className="py-2 font-semibold text-slate-900">{u.name}{self && ' (vous)'}</td>
                    <td className="font-mono">{u.login}</td>
                    <td>
                      <select aria-label={`Rôle de ${u.name}`} value={u.role} disabled={busy || self} onChange={e => patchUser(u, { role: e.target.value }, 'Rôle modifié.')} className={input}>
                        {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                      </select>
                    </td>
                    <td>
                      {!u.active ? <span className="font-bold text-slate-500">Désactivé</span>
                        : locked ? <span className="font-bold text-rose-700">Bloqué</span>
                        : u.mustChangePassword ? <span className="font-bold text-amber-700">Mot de passe provisoire</span>
                        : <span className="font-bold text-emerald-700">Actif</span>}
                    </td>
                    <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : '—'}</td>
                    <td className="text-right space-x-1 whitespace-nowrap">
                      {locked && <button className={`${btn} border-rose-400 text-rose-800`} onClick={() => patchUser(u, { unlock: true }, 'Compte débloqué.')}>Débloquer</button>}
                      <button className={`${btn} border-slate-300 text-slate-700`} disabled={busy} onClick={() => { if (window.confirm(`Générer un nouveau mot de passe provisoire pour ${u.name} ?`)) patchUser(u, { resetPassword: true }, 'Mot de passe réinitialisé.'); }}>
                        <KeyRound className="h-3 w-3" /> Réinitialiser
                      </button>
                      {!self && (
                        <button className={`${btn} border-slate-300 text-slate-700`} disabled={busy} onClick={() => patchUser(u, { active: !u.active }, u.active ? 'Compte désactivé.' : 'Compte réactivé.')}>
                          {u.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* REVERSEMENTS */}
      <section className={box}>
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Wallet className="h-4 w-4 text-sky-700" /> Reversements à traiter ({pending.length})</h2>
        {pending.length === 0 ? <p className="text-xs text-slate-500">Aucune demande en attente.</p> : (
          <ul className="divide-y divide-slate-100 text-xs">
            {pending.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><strong>{p.amountUSD.toFixed(2)} $</strong> — {p.eventTitle} — {p.organizerName} → {p.paymentRail} {p.destinationAccount}</span>
                <span className="space-x-1">
                  <button className={`${btn} border-emerald-600 bg-emerald-600 text-white`} disabled={busy} onClick={() => decide(p.id, 'completed')}>Marquer payé</button>
                  <button className={`${btn} border-rose-400 text-rose-800`} disabled={busy} onClick={() => decide(p.id, 'rejected')}>Refuser</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* PARAMÈTRES */}
      <section className={box}>
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Settings className="h-4 w-4 text-sky-700" /> Paramètres</h2>
        <form onSubmit={saveSettings} className="grid gap-4 md:grid-cols-2 text-xs">
          <label className="space-y-1 font-bold text-slate-700">Nom de l'organisation
            <input value={form.organizationName} onChange={e => setForm({ ...form, organizationName: e.target.value })} className={`${input} w-full`} />
          </label>
          <label className="space-y-1 font-bold text-slate-700">Téléphone
            <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={`${input} w-full`} />
          </label>
          <label className="space-y-1 font-bold text-slate-700">Commission plateforme par défaut (%)
            <input inputMode="decimal" value={form.defaultCommissionPercent} onChange={e => setForm({ ...form, defaultCommissionPercent: e.target.value })} className={`${input} w-full`} />
          </label>
          <label className="space-y-1 font-bold text-slate-700">Remise manuelle maximale pour les organisateurs (%)
            <input inputMode="decimal" value={form.maxDiscountPercent} onChange={e => setForm({ ...form, maxDiscountPercent: e.target.value })} className={`${input} w-full`} />
          </label>
          <fieldset className="space-y-1 font-bold text-slate-700">
            <legend>Taux de change (pour 1 USD){s.ratesUpdatedAt ? ` — mis à jour le ${new Date(s.ratesUpdatedAt).toLocaleDateString('fr-FR')}` : ' — à confirmer'}</legend>
            <div className="flex gap-2">
              {(['CDF', 'XOF', 'EUR'] as const).map(k => (
                <label key={k} className="flex items-center gap-1 font-mono">{k}
                  <input aria-label={`Taux ${k}`} inputMode="decimal" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} className={`${input} w-24`} />
                </label>
              ))}
            </div>
          </fieldset>
          <label className="space-y-1 font-bold text-slate-700">Portiques / entrées (un par ligne)
            <textarea rows={3} value={form.gates} onChange={e => setForm({ ...form, gates: e.target.value })} className={`${input} w-full`} />
          </label>
          <fieldset className="md:col-span-2 space-y-2">
            <legend className="font-bold text-slate-700">Codes promotionnels</legend>
            {promos.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input aria-label="Code promo" placeholder="CODE" value={p.code} onChange={e => setPromos(promos.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} className={`${input} w-40 font-mono`} />
                <input aria-label="Remise du code (%)" inputMode="decimal" value={String(p.percent)} onChange={e => setPromos(promos.map((x, j) => (j === i ? { ...x, percent: Number(e.target.value) || 0 } : x)))} className={`${input} w-20`} />
                <span>%</span>
                <label className="flex items-center gap-1"><input type="checkbox" checked={p.active !== false} onChange={e => setPromos(promos.map((x, j) => (j === i ? { ...x, active: e.target.checked } : x)))} /> actif</label>
                <button type="button" className={`${btn} border-slate-300 text-slate-600`} onClick={() => setPromos(promos.filter((_, j) => j !== i))}>Retirer</button>
              </div>
            ))}
            <button type="button" className={`${btn} border-slate-300 text-slate-700`} onClick={() => setPromos([...promos, { code: '', percent: 10, active: true }])}><Plus className="h-3 w-3" /> Ajouter un code</button>
          </fieldset>
          <div className="md:col-span-2">
            <button disabled={busy} className={`${btn} border-slate-800 bg-slate-800 text-white`}><Save className="h-3.5 w-3.5" /> Enregistrer les paramètres</button>
          </div>
        </form>
      </section>

      {/* SAUVEGARDE */}
      <section className={box}>
        <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><ShieldCheck className="h-4 w-4 text-sky-700" /> Sauvegarde des données</h2>
        <p className="text-xs text-slate-600">Le serveur garde aussi une copie automatique par jour (14 derniers jours) dans son dossier de données.</p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/backup" className={`${btn} border-slate-800 bg-slate-800 text-white`}><Download className="h-3.5 w-3.5" /> Télécharger une sauvegarde</a>
          <label className={`${btn} border-rose-400 text-rose-800 cursor-pointer`}>
            <Upload className="h-3.5 w-3.5" /> Restaurer…
            <input type="file" accept="application/json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; }} />
          </label>
        </div>
      </section>

      {/* JOURNAL D'ADMINISTRATION */}
      <section className={box}>
        <h2 className="text-sm font-black text-slate-900">Journal d'administration (500 dernières actions)</h2>
        <ul className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
          {state.audit.map(a => (
            <li key={a.id} className="py-1.5"><span className="font-mono text-slate-500">{new Date(a.at).toLocaleString('fr-FR')}</span> — <strong>{a.userName}</strong> : {a.action} <span className="text-slate-500">{a.details}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
};
