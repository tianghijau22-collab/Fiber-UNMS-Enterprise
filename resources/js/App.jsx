import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar.jsx';
import NavBar from './components/NavBar.jsx';
import { ThemeProvider } from './components/ThemeContext.jsx';
import { AuthProvider, useAuth } from './components/AuthContext.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NetworkInfrastructure from './pages/NetworkInfrastructure.jsx';
import GisTopologyMap from './pages/GisTopologyMap.jsx';
import FiberCoreMatrix from './pages/FiberCoreMatrix.jsx';
import CustomerManagement from './pages/CustomerManagement.jsx';
import TicketManagement from './pages/TicketManagement.jsx';
import InventoryManagement from './pages/InventoryManagement.jsx';
import OltManagement from './pages/OltManagement.jsx';
import OtdrFaultTracing from './pages/OtdrFaultTracing.jsx';
import CableRouteEditor from './pages/CableRouteEditor.jsx';
import FieldTechWorkOrders from './pages/FieldTechWorkOrders.jsx';
import UserManagement from './pages/UserManagement.jsx';
import AuditLogs from './pages/AuditLogs.jsx';
import PushNotificationBroadcast from './pages/PushNotificationBroadcast.jsx';
import BtsManagement from './pages/BtsManagement.jsx';
import DatabaseBackup from './pages/DatabaseBackup.jsx';
import PublicTicketTracking from './pages/PublicTicketTracking.jsx';
import Login from './pages/Login.jsx';
import VoiceCallManager from './components/VoiceCallManager.jsx';
import PageTransitionWrapper from './components/PageTransitionWrapper.jsx';

/**
 * PrivateRoute: jika belum login → redirect ke /login
 * Menyimpan path yang dituju agar setelah login bisa kembali ke halaman semula.
 */
function PrivateRoute({ children }) {
  const { currentUser, canAccessRoute } = useAuth();
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canAccessRoute(location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * PublicRoute: jika sudah login dan coba akses /login → langsung ke dashboard
 */
function PublicRoute({ children }) {
  const { currentUser } = useAuth();

  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const { currentUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          // Service worker registered cleanly
        })
        .catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-white dark:bg-black font-sans antialiased text-slate-900 dark:text-white transition-colors duration-200 overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <NavBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-white dark:bg-black">
          <PageTransitionWrapper>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"      element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/olt-management" element={<PrivateRoute><OltManagement /></PrivateRoute>} />
              <Route path="/otdr-tracing"   element={<PrivateRoute><OtdrFaultTracing /></PrivateRoute>} />
              <Route path="/cable-routes"   element={<PrivateRoute><CableRouteEditor /></PrivateRoute>} />
              <Route path="/field-tech"     element={<PrivateRoute><FieldTechWorkOrders /></PrivateRoute>} />
              <Route path="/bts-management" element={<PrivateRoute><BtsManagement /></PrivateRoute>} />
              <Route path="/network"        element={<PrivateRoute><NetworkInfrastructure /></PrivateRoute>} />
              <Route path="/gis-map"        element={<PrivateRoute><GisTopologyMap /></PrivateRoute>} />
              <Route path="/core-matrix"    element={<PrivateRoute><FiberCoreMatrix /></PrivateRoute>} />
              <Route path="/customers"      element={<PrivateRoute><CustomerManagement /></PrivateRoute>} />
              <Route path="/tickets"        element={<PrivateRoute><TicketManagement /></PrivateRoute>} />
              <Route path="/inventory"      element={<PrivateRoute><InventoryManagement /></PrivateRoute>} />
              <Route path="/users"          element={<PrivateRoute><UserManagement /></PrivateRoute>} />
              <Route path="/audit-logs"     element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
              <Route path="/database-backup" element={<PrivateRoute><DatabaseBackup /></PrivateRoute>} />
              <Route path="/broadcast-notifications" element={<PrivateRoute><PushNotificationBroadcast /></PrivateRoute>} />
              <Route path="*"               element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </PageTransitionWrapper>
        </main>
      </div>

      {/* Real-Time WebRTC In-App Voice Call Engine */}
      <VoiceCallManager currentUser={currentUser} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Halaman publik lacak tiket — tanpa login */}
            <Route path="/track-ticket" element={<PublicTicketTracking />} />
            <Route path="/track-ticket/:ticketNumber" element={<PublicTicketTracking />} />

            {/* Halaman publik — jika sudah login, redirect ke dashboard */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            {/* Semua halaman lain — wajib login */}
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
