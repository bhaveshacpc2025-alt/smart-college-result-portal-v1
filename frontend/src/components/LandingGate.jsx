import React, { useState } from 'react';
import {
  Building2,
  UserCheck,
  BookOpenCheck,
  GraduationCap,
  ShieldCheck,
  X,
  ArrowRight,
  Lock,
  UserPlus,
  LogIn,
  Sparkles,
} from 'lucide-react';
import { apiRequest, setAuthSession } from '../utils/api';

const ROLE_CONFIG = {
  HOD: {
    title: 'HOD / Class Login',
    subtitle: 'Create classes, configure grading rules, approve faculty & students, and deploy official results.',
    idLabel: 'HOD ID',
    idPlaceholder: 'e.g. HOD-CSE-01',
    deptPlaceholder: 'e.g. Computer Science & Engineering',
    accentBg: 'from-navy-900 to-navy-800',
    ringColor: 'focus:ring-navy-700',
    badgeText: 'Administrative Control',
  },
  PROFESSOR: {
    title: 'Professor / Subject Login',
    subtitle: 'Join classes via QR/Invite Code, manage marks, run AI Auto-Remarks, and lock subject grades.',
    idLabel: 'Professor ID',
    idPlaceholder: 'e.g. PROF-104',
    deptPlaceholder: 'e.g. Computer Science & Engineering',
    accentBg: 'from-emerald-800 to-teal-900',
    ringColor: 'focus:ring-emerald-700',
    badgeText: 'Faculty Workspace',
  },
  STUDENT: {
    title: 'Student Login',
    subtitle: 'Enroll via Class QR, track approval & release status, view AI insights, and download official PDF.',
    idLabel: 'Enrollment Number',
    idPlaceholder: 'e.g. ENR2026001',
    deptPlaceholder: 'e.g. B.Tech CSE',
    accentBg: 'from-amber-700 to-amber-900',
    ringColor: 'focus:ring-amber-600',
    badgeText: '100% Private Transcript Portal',
  },
};

export default function LandingGate({ hodExists, onAuthSuccess }) {
  const [activeRole, setActiveRole] = useState(null); // 'HOD' | 'PROFESSOR' | 'STUDENT' | null
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const openModal = (role) => {
    setActiveRole(role);
    // If no HOD exists yet and user clicks HOD, default right into First-Time Setup tab!
    setAuthTab(role === 'HOD' && !hodExists ? 'register' : 'login');
    setIdentifier('');
    setName('');
    setDepartment('');
    setPassword('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeRole) return;
    setError('');
    setLoading(true);
    try {
      const endpoint = authTab === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        authTab === 'register'
          ? { role: activeRole, identifier, name, department, password }
          : { role: activeRole, identifier, password };

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthSession(data.token, data.user);
      onAuthSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const cfg = activeRole ? ROLE_CONFIG[activeRole] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-indigo-50/40 flex flex-col">
      {/* Top Academic Header Banner */}
      <header className="bg-navy-900 text-white border-b-4 border-gold-500 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gold-500/20 border-2 border-gold-300/60 flex items-center justify-center shadow-inner">
              <GraduationCap className="w-7 h-7 text-gold-300" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                Smart College Result &amp; AI Report Card Portal
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Synchronized Academic Evaluation, Audit-Logged Grading &amp; Official Digital Transcript System
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold bg-navy-800 border border-navy-700 px-3.5 py-2 rounded-full text-gold-300">
            <ShieldCheck className="w-4 h-4" />
            <span>Role-Isolated • Atomic DB Sync</span>
          </div>
        </div>
      </header>

      {/* Main Centered 3-Card Entry Gate */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-5xl w-full space-y-8">
          <div className="text-center space-y-2.5 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-900/5 border border-navy-900/15 text-navy-900 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-gold-600" />
              Select Your Academic Portal
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-navy-900 tracking-tight">
              Welcome to the Examination Gateway
            </h2>
            <p className="text-sm sm:text-base text-slate-600">
              {!hodExists
                ? 'Clean-slate system ready. Start with First-Time HOD Setup to create a class, configure grading rules, and invite Faculty & Students.'
                : 'Choose your role below to sign in or register a new academic account.'}
            </p>
          </div>

          {/* 3 Large Centered Interactive Role Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: HOD / Class Login */}
            <button
              type="button"
              onClick={() => openModal('HOD')}
              className="group relative text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-navy-800 p-7 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              {!hodExists && (
                <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full bg-gold-500 text-white text-[11px] font-bold shadow">
                  Start Here: First-Time Setup
                </span>
              )}
              <div>
                <div className="w-14 h-14 rounded-2xl bg-navy-900 text-gold-300 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <Building2 className="w-7 h-7" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-navy-900">HOD / Class Login</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Create classes, upload valid enrollment whitelists, configure dynamic grade boundaries, approve permissions, and deploy synchronized results.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-navy-900">
                <span>{!hodExists ? 'Setup HOD Account' : 'Enter HOD Portal'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Card 2: Professor / Subject Login */}
            <button
              type="button"
              onClick={() => openModal('PROFESSOR')}
              className="group relative text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-700 p-7 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform gap-0.5">
                  <UserCheck className="w-6 h-6" />
                  <BookOpenCheck className="w-5 h-5 text-emerald-200" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">Professor / Subject Login</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Scan class QR codes, request subject access, bulk-import Excel marksheets, generate AI Auto-Remarks, and lock final subject marks.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-emerald-700">
                <span>Enter Faculty Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>

            {/* Card 3: Student Login */}
            <button
              type="button"
              onClick={() => openModal('STUDENT')}
              className="group relative text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-600 p-7 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="w-14 h-14 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <h3 className="mt-5 text-xl font-bold text-slate-900">Student Login</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Join your class via QR or Invite Code, track live result deployment status, view AI Weak-Area Insights, and export official A4 PDF transcripts.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-sm font-semibold text-amber-700">
                <span>Enter Student Portal</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Role Login & Onboarding / Registration Modal */}
      {activeRole && cfg && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className={`bg-gradient-to-r ${cfg.accentBg} text-white px-6 py-5 flex items-start justify-between gap-4`}>
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">
                  {cfg.badgeText}
                </span>
                <h3 className="text-xl font-bold mt-0.5">{cfg.title}</h3>
                <p className="text-xs text-white/80 mt-1">{cfg.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveRole(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {/* Login vs Onboarding/Register Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('login');
                    setError('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    authTab === 'login' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthTab('register');
                    setError('');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    authTab === 'register' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {activeRole === 'HOD' ? 'First-Time HOD Setup' : 'New Registration'}
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {cfg.idLabel} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={cfg.idPlaceholder}
                    className={`w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 ${cfg.ringColor}`}
                  />
                </div>

                {authTab === 'register' && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={
                          activeRole === 'HOD'
                            ? 'e.g. Dr. Ananya Sharma'
                            : activeRole === 'PROFESSOR'
                            ? 'e.g. Prof. Rajesh Verma'
                            : 'e.g. Aarav Patel'
                        }
                        className={`w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 ${cfg.ringColor}`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Department / Program
                      </label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder={cfg.deptPlaceholder}
                        className={`w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 ${cfg.ringColor}`}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (min 4 characters)"
                      className={`w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-xl outline-none focus:ring-2 ${cfg.ringColor}`}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 disabled:opacity-60 text-white font-semibold text-sm shadow-md transition-colors"
                >
                  {loading
                    ? 'Authenticating...'
                    : authTab === 'register'
                    ? `Create ${activeRole} Account & Enter`
                    : `Sign In as ${activeRole}`}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
