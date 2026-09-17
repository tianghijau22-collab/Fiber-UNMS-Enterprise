import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import Sidebar from './components/Sidebar.jsx';
import NavBar from './components/NavBar.jsx';
import { ThemeProvider } from './components/ThemeContext.jsx';
import { AuthProvider, useAuth } from './components/AuthContext.jsx';
import VoiceCallManager from './components/VoiceCallManager.jsx';
import PageTransitionWrapper from './components/PageTransitionWrapper.jsx';
import GlobalAlertModal from './components/GlobalAlertModal.jsx';

// Route-based Code Splitting (On-demand Lazy Loading)
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NetworkInfrastructure = lazy(() => import('./pages/NetworkInfrastructure.jsx'));
const GisTopologyMap = lazy(() => import('./pages/GisTopologyMap.jsx'));
const FiberCoreMatrix = lazy(() => import('./pages/FiberCoreMatrix.jsx'));
const CustomerManagement = lazy(() => import('./pages/CustomerManagement.jsx'));
const TicketManagement = lazy(() => import('./pages/TicketManagement.jsx'));
const InventoryManagement = lazy(() => import('./pages/InventoryManagement.jsx'));
const OltManagement = lazy(() => import('./pages/OltManagement.jsx'));
const ServerMonitoring = lazy(() => import('./pages/ServerMonitoring.jsx'));
const SystemAlertChat = lazy(() => import('./pages/SystemAlertChat.jsx'));
const OtdrFaultTracing = lazy(() => import('./pages/OtdrFaultTracing.jsx'));
const CableRouteEditor = lazy(() => import('./pages/CableRouteEditor.jsx'));
const CableManagement = lazy(() => import('./pages/CableManagement.jsx'));
const FieldTechWorkOrders = lazy(() => import('./pages/FieldTechWorkOrders.jsx'));
const UserManagement = lazy(() => import('./pages/UserManagement.jsx'));
const AuditLogs = lazy(() => import('./pages/AuditLogs.jsx'));
const PushNotificationBroadcast = lazy(() => import('./pages/PushNotificationBroadcast.jsx'));
const BtsManagement = lazy(() => import('./pages/BtsManagement.jsx'));
const DatabaseBackup = lazy(() => import('./pages/DatabaseBackup.jsx'));
const OdpCheckManagement = lazy(() => import('./pages/OdpCheckManagement.jsx'));
const PublicTicketTracking = lazy(() => import('./pages/PublicTicketTracking.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const NetworkBridgeSetup = lazy(() => import('./pages/NetworkBridgeSetup.jsx'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh] w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-medium">Memuat halaman...</span>
      </div>
    </div>
  );
}

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
  const location = useLocation();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => {
          // Service worker registered cleanly
        })
        .catch(() => {});
    }
  }, []);

  // Dedicated Standalone Fullscreen GIS Map Route (No Sidebar, No Navbar, 100% pure viewport)
  if (location.pathname === '/gis-map/fullscreen') {
    return (
      <PrivateRoute>
        <Suspense fallback={<PageLoader />}>
          <GisTopologyMap isStandaloneFullscreen={true} />
        </Suspense>
      </PrivateRoute>
    );
  }

  return (
    <div className="flex min-h-screen bg-white dark:bg-black font-sans antialiased text-slate-900 dark:text-white transition-colors duration-200 overflow-x-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 w-full">
        <NavBar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-white dark:bg-black">
          <PageTransitionWrapper>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"         element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                <Route path="/server-monitoring" element={<PrivateRoute><ServerMonitoring /></PrivateRoute>} />
                <Route path="/system-alerts"     element={<PrivateRoute><SystemAlertChat /></PrivateRoute>} />
                <Route path="/olt-management"    element={<PrivateRoute><OltManagement /></PrivateRoute>} />
                <Route path="/network-bridge-setup" element={<PrivateRoute><NetworkBridgeSetup /></PrivateRoute>} />
                <Route path="/otdr-tracing"   element={<PrivateRoute><OtdrFaultTracing /></PrivateRoute>} />
                <Route path="/cable-management" element={<PrivateRoute><CableManagement /></PrivateRoute>} />
                <Route path="/cables" element={<Navigate to="/cable-management" replace />} />
                <Route path="/cable-routes"   element={<PrivateRoute><CableRouteEditor /></PrivateRoute>} />
                <Route path="/field-tech"     element={<PrivateRoute><FieldTechWorkOrders /></PrivateRoute>} />
                <Route path="/odp-checks"     element={<PrivateRoute><OdpCheckManagement /></PrivateRoute>} />
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
            </Suspense>
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
          <Suspense fallback={<PageLoader />}>
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
          </Suspense>
          <GlobalAlertModal />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
