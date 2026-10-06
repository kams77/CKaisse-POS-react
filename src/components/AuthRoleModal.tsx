import React, { useState } from 'react';
import {
  ShieldCheck,
  User,
  Smartphone,
  KeyRound,
  CheckCircle2,
  X,
  Lock,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Building2,
  Radio,
} from 'lucide-react';
import { UserRole, UserSession } from '../types';
import { INITIAL_USER_SESSIONS } from '../data/initialData';

interface AuthRoleModalProps {
  currentSession: UserSession;
  onUpdateSession: (newSession: UserSession) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const AuthRoleModal: React.FC<AuthRoleModalProps> = ({
  currentSession,
  onUpdateSession,
  isOpen,
  onClose,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentSession.role);
  const [phoneInput, setPhoneInput] = useState(currentSession.phone);
  const [step, setStep] = useState<'select' | '2fa'>('select');
  const [otpInput, setOtpInput] = useState('');
  const [sentOtpCode, setSentOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSendingSms, setIsSendingSms] = useState(false);

  if (!isOpen) return null;

  const handleInitiateLogin = () => {
    setErrorMsg('');
    setIsSendingSms(true);
    // Generate 6-digit test OTP code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentOtpCode(generatedCode);

    setTimeout(() => {
      setIsSendingSms(false);
      setStep('2fa');
    }, 600);
  };

  const handleVerify2fa = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.trim() !== sentOtpCode && otpInput.trim() !== '123456') {
      setErrorMsg('Code 2FA invalide. Veuillez réessayer.');
      return;
    }

    const baseSession = INITIAL_USER_SESSIONS[selectedRole] || {
      id: `user-${Date.now()}`,
      name:
        selectedRole === 'admin'
          ? 'Administrateur Principal'
          : selectedRole === 'organizer'
          ? 'Organisateur Événement'
          : 'Agent Sécurité Entrée',
      phone: phoneInput,
      role: selectedRole,
      token: `jwt-${Date.now()}`,
      twoFactorVerified: true,
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    };

    onUpdateSession({
      ...baseSession,
      phone: phoneInput,
      twoFactorVerified: true,
    });
    setStep('select');
    setOtpInput('');
    onClose();
  };

  const handleQuickSwitch = (role: UserRole) => {
    const session = INITIAL_USER_SESSIONS[role];
    if (session) {
      onUpdateSession(session);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-sky-300 bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-200 bg-sky-100 text-sky-800">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Authentification & Rôles
              </h3>
              <p className="text-xs text-slate-500">
                Connexion sécurisée avec double facteur SMS (2FA)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {step === 'select' ? (
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Sélectionnez le Profil d&apos;Accès
              </label>
              <div className="mt-2 grid grid-cols-1 gap-2.5">
                {[
                  {
                    role: 'admin' as UserRole,
                    title: 'Super Administrateur',
                    desc: 'Vue globale, validation reversements, gestion fraude & blacklist',
                    icon: ShieldCheck,
                    badgeColor: 'border-rose-300 bg-rose-50 text-rose-800',
                  },
                  {
                    role: 'organizer' as UserRole,
                    title: 'Organisateur / Promoteur',
                    desc: 'Création d’événements, ventes en direct, ordres de virement 93%',
                    icon: Building2,
                    badgeColor: 'border-sky-300 bg-sky-50 text-sky-800',
                  },
                  {
                    role: 'agent' as UserRole,
                    title: 'Agent de Contrôle (Entrée)',
                    desc: 'Viseur caméra haute vitesse, alertes audio, check-in portes',
                    icon: Radio,
                    badgeColor: 'border-emerald-300 bg-emerald-50 text-emerald-800',
                  },
                ].map((item) => (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(item.role);
                      const prefPhone =
                        INITIAL_USER_SESSIONS[item.role]?.phone || phoneInput;
                      setPhoneInput(prefPhone);
                    }}
                    className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                      selectedRole === item.role
                        ? 'border-sky-500 bg-sky-50/60 shadow-xs ring-1 ring-sky-400'
                        : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${item.badgeColor}`}
                    >
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
                          {item.title}
                        </span>
                        {currentSession.role === item.role && (
                          <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                            Actif
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700">
                Numéro de téléphone mobile (pour le code SMS 2FA)
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border-2 border-sky-200 bg-slate-50 px-3 py-2 text-xs font-mono">
                <Smartphone className="h-4 w-4 text-sky-600" />
                <input
                  type="text"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+243 81 000 0000"
                  className="w-full bg-transparent text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleQuickSwitch(selectedRole)}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                title="Bascule immédiate sans re-saisie du SMS"
              >
                Connexion directe
              </button>

              <button
                type="button"
                onClick={handleInitiateLogin}
                disabled={isSendingSms}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
              >
                {isSendingSms ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Envoi SMS...</span>
                  </>
                ) : (
                  <>
                    <span>Recevoir SMS 2FA</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: 2FA Verification */
          <form onSubmit={handleVerify2fa} className="mt-5 space-y-4">
            <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-3.5 text-xs text-sky-900">
              <div className="flex items-center gap-2 font-bold text-sky-800">
                <Smartphone className="h-4 w-4 text-sky-600" />
                <span>SMS de sécurité envoyé !</span>
              </div>
              <p className="mt-1 text-[11px] text-sky-700">
                Un code d&apos;authentification à 6 chiffres a été expédié au{' '}
                <strong className="font-mono">{phoneInput}</strong>.
              </p>
              <div className="mt-2.5 rounded-lg border border-sky-300 bg-white p-2 text-center">
                <span className="text-[10px] text-slate-500">
                  Simulation code reçu :{' '}
                </span>
                <span className="font-mono text-sm font-bold text-rose-700 tracking-wider">
                  {sentOtpCode}
                </span>
                <button
                  type="button"
                  onClick={() => setOtpInput(sentOtpCode)}
                  className="ml-2 text-[10px] font-semibold text-sky-700 underline"
                >
                  (Insérer)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Code de vérification 2FA
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border-2 border-sky-300 bg-white px-3 py-2.5 text-center">
                <Lock className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="Ex: 482910"
                  className="w-full text-center font-mono text-lg font-bold tracking-widest text-slate-900 focus:outline-none"
                  autoFocus
                />
              </div>
              {errorMsg && (
                <p className="mt-1.5 text-xs font-semibold text-rose-700 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{errorMsg}</span>
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Retour
              </button>

              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-rose-600 bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 transition-colors shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Valider la Session 2FA</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
