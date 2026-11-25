import React, { useEffect, useState, useCallback } from 'react';
import {
  apiRequest,
  buildApiUrl,
  clearAuthSession,
  extractCodeFromInput,
  getAuthToken,
  getStoredUser,
} from './utils/api';
import LandingGate from './components/LandingGate';
import PortalNavbar from './components/PortalNavbar';
import HodPortal from './portals/HodPortal';
import ProfessorPortal from './portals/ProfessorPortal';
import StudentPortal from './portals/StudentPortal';

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [hodExists, setHodExists] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sseConnected, setSseConnected] = useState(false);

  // Role-specific state
  const [hodClasses, setHodClasses] = useState([]);
  const [hodAuditLogs, setHodAuditLogs] = useState([]);
  const [profWorkspaces, setProfWorkspaces] = useState([]);
  const [profPending, setProfPending] = useState([]);
  const [studentDashboard, setStudentDashboard] = useState(null);
  const [initialJoinCode, setInitialJoinCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join') || params.get('code') || '';
    return code ? extractCodeFromInput(code) : '';
  });

  const loadBootstrap = useCallback(async () => {
    try {
      const data = await apiRequest('/api/auth/bootstrap-status');
      setHodExists(Boolean(data.hodExists));
    } catch {
      // ignore if backend starting
    }
  }, []);

  const loadPortalData = useCallback(async (activeUser) => {
    if (!activeUser) return;
    try {
      const notifRes = await apiRequest('/api/notifications');
      setNotifications(notifRes.notifications || []);
      setUnreadCount(notifRes.unreadCount || 0);

      if (activeUser.role === 'HOD') {
        const [clsRes, auditRes] = await Promise.all([
          apiRequest('/api/hod/classes'),
          apiRequest('/api/hod/audit-logs'),
        ]);
        setHodClasses(clsRes.classes || []);
        setHodAuditLogs(auditRes.auditLogs || []);
      } else if (activeUser.role === 'PROFESSOR') {
        const profRes = await apiRequest('/api/professor/workspaces');
        setProfWorkspaces(profRes.workspaces || []);
        setProfPending(profRes.pendingRequests || []);
      } else if (activeUser.role === 'STUDENT') {
        const stuRes = await apiRequest('/api/student/dashboard');
        setStudentDashboard(stuRes);
      }
    } catch (err) {
      if (err.status === 401) {
        clearAuthSession();
        setUser(null);
      }
    }
  }, []);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    if (!user) return;
    loadPortalData(user);

    const token = getAuthToken();
    if (!token) return;

    const es = new EventSource(buildApiUrl(`/api/events/stream?token=${encodeURIComponent(token)}`));
    const handleSync = () => {
      loadPortalData(user);
    };
    es.addEventListener('CONNECTED', () => setSseConnected(true));
    es.addEventListener('CLASS_SYNC', handleSync);
    es.addEventListener('RESULT_DEPLOYED', handleSync);
    es.onerror = () => setSseConnected(false);

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPortalData(user);
      }
    }, 8000);

    return () => {
      es.close();
      setSseConnected(false);
      clearInterval(poll);
    };
  }, [user, loadPortalData]);

  const handleMarkRead = async (id) => {
    await apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH' });
    loadPortalData(user);
  };

  const handleMarkAllRead = async () => {
    await apiRequest('/api/notifications/read-all', { method: 'PATCH' });
    loadPortalData(user);
  };

  const handleLogout = () => {
    clearAuthSession();
    setUser(null);
    setHodClasses([]);
    setHodAuditLogs([]);
    setProfWorkspaces([]);
    setProfPending([]);
    setStudentDashboard(null);
    setNotifications([]);
    setUnreadCount(0);
    loadBootstrap();
  };

  if (!user) {
    return (
      <LandingGate
        hodExists={hodExists}
        onAuthSuccess={(loggedUser) => {
          setUser(loggedUser);
          setHodExists(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PortalNavbar
        user={user}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onLogout={handleLogout}
        sseConnected={sseConnected}
      />

      <main className="flex-1 pb-12">
        {user.role === 'HOD' && (
          <HodPortal
            classes={hodClasses}
            auditLogs={hodAuditLogs}
            onRefresh={() => loadPortalData(user)}
          />
        )}

        {user.role === 'PROFESSOR' && (
          <ProfessorPortal
            workspaces={profWorkspaces}
            pendingRequests={profPending}
            onRefresh={() => loadPortalData(user)}
            initialInviteCode={initialJoinCode}
          />
        )}

        {user.role === 'STUDENT' && (
          <StudentPortal
            dashboard={studentDashboard}
            onRefresh={() => loadPortalData(user)}
            initialInviteCode={initialJoinCode}
          />
        )}
      </main>
    </div>
  );
}
