import React, { useState, useRef, useEffect } from 'react';
import { Bell, UserCircle, LogOut, GraduationCap, CheckCheck, Radio } from 'lucide-react';

export default function PortalNavbar({
  user,
  notifications = [],
  unreadCount = 0,
  onMarkRead,
  onMarkAllRead,
  onLogout,
  sseConnected = false,
}) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const notifRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const roleBadge = {
    HOD: { label: 'HOD / Class Admin', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    PROFESSOR: { label: 'Professor / Subject', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    STUDENT: { label: 'Student Portal', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  }[user.role] || { label: user.role, cls: 'bg-slate-100 text-slate-800 border-slate-200' };

  const idLabel =
    user.role === 'STUDENT' ? 'Enrollment No.' : user.role === 'PROFESSOR' ? 'Professor ID' : 'HOD ID';

  return (
    <header className="sticky top-0 z-40 bg-navy-900 text-white border-b border-navy-700 shadow-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-gold-500/20 border border-gold-400/50 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-gold-300" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-bold tracking-tight text-base sm:text-lg truncate">
                Smart College Result Portal
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleBadge.cls}`}>
                {roleBadge.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1">
                <Radio className={`w-3 h-3 ${sseConnected ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                {sseConnected ? 'Live Sync Active' : 'Auto-Sync'}
              </span>
              <span className="hidden sm:inline text-slate-500">•</span>
              <span className="hidden sm:inline truncate">{user.department || 'Academic Administration'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Bell (Notifications) */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-100" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center shadow">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-50">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-semibold text-sm text-navy-900">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllRead}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No notifications yet. Real-time updates across portals will appear here.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => !n.isRead && onMarkRead(n.id)}
                        className={`p-3.5 cursor-pointer transition-colors ${
                          n.isRead ? 'bg-white hover:bg-slate-50' : 'bg-indigo-50/60 hover:bg-indigo-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-navy-900">{n.title}</p>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* UserCircle (Profile) */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-navy-700 transition-colors"
            >
              <UserCircle className="w-5 h-5 text-gold-300" />
              <span className="hidden md:inline text-sm font-medium max-w-[140px] truncate">{user.name}</span>
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 p-4 z-50">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <div className="w-11 h-11 rounded-full bg-navy-900 text-gold-300 flex items-center justify-center font-bold text-lg">
                    {user.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-navy-900 truncate">{user.name}</p>
                    <p className="text-xs text-slate-500">{roleBadge.label}</p>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">{idLabel}:</dt>
                    <dd className="font-mono font-semibold text-slate-900">{user.identifier}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Department:</dt>
                    <dd className="font-medium text-slate-900 text-right">{user.department || 'Not specified'}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Role Scope:</dt>
                    <dd className="font-semibold text-indigo-700">{user.role}</dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* LogOut */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
