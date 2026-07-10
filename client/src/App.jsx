import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { ToastContainer } from 'react-toastify'; // aliased to NotifyHost (themed pop-ups)
import { useMaintenanceMode } from './hooks/useMaintenanceMode.js';

import UnifiedLogin from './pages/account/UnifiedLogin';
const Kiosk = lazy(() => import('./pages/kiosk/Kiosk'));
import AccountActivation from './pages/account/AccountActivation';

// Layout Components
import AdminLayout from './components/layouts/AdminLayout';
import MerchantLayout from './components/layouts/MerchantLayout';
import TreasuryLayout from './components/layouts/TreasuryLayout';
import AccountingLayout from './components/layouts/AccountingLayout';
import SysadLayout from './components/layouts/SysadLayout';
import UserLayout from './components/layouts/UserLayout';
import { isMobileDevice } from './utils/isMobile';
import ExportCompleteModal from './components/shared/ExportCompleteModal';
import ConfirmDialogHost from './components/shared/ConfirmDialogHost';
import DesktopOnlyGuard from './components/DesktopOnlyGuard';

// Route Guards
import ProtectedRoute from './components/routes/ProtectedRoute';
import AdminRoute from './components/routes/AdminRoute';

// Motorpool Pages
const MotorpoolDashboard = lazy(() => import('./pages/admin/Motorpool/Dashboard'));
const RoutesPage = lazy(() => import('./pages/admin/Motorpool/Routes'));
const DriversPage = lazy(() => import('./pages/admin/Motorpool/Drivers'));
const ShuttlesPage = lazy(() => import('./pages/admin/Motorpool/Shuttles'));
const TripsPage = lazy(() => import('./pages/admin/Motorpool/Trips'));
const PhonesPage = lazy(() => import('./pages/admin/Motorpool/Phones'));
const MotorpoolConcernsPage = lazy(() => import('./pages/admin/Motorpool/Concerns'));
const MotorpoolConfigurationsPage = lazy(() => import('./pages/admin/Motorpool/Configurations'));

// Merchant Pages
const MerchantDashboard = lazy(() => import('./pages/admin/Merchant/Dashboard'));
const MerchantsPage = lazy(() => import('./pages/admin/Merchant/Merchants'));
const MerchantPhonesPage = lazy(() => import('./pages/admin/Merchant/Phones'));
const MerchantConcernsPage = lazy(() => import('./pages/admin/Merchant/Concerns'));
const MerchantConfigurationsPage = lazy(() => import('./pages/admin/Merchant/Configurations'));

// Treasury Pages
const TreasuryDashboard = lazy(() => import('./pages/admin/Treasury/TreasuryDashboard'));
const RegistrationForm = lazy(() => import('./pages/admin/Treasury/RegistrationForm'));
const TreasuryTransactionsPage = lazy(() => import('./pages/admin/Treasury/TransactionsPage'));
const TreasuryMerchantsPage = lazy(() => import('./pages/admin/Treasury/MerchantsPage'));
const TreasuryConcernsPage = lazy(() => import('./pages/admin/Treasury/ConcernsPage'));
const TreasuryConfigPage = lazy(() => import('./pages/admin/Treasury/ConfigPage'));

// Accounting Pages
const AccountingHome = lazy(() => import('./pages/admin/Accounting/AccountingHome'));
// Accounting reuses the Treasury merchants page (read-only GETs) so both roles see identical data/UI.
const AccountingMerchantsPage = lazy(() => import('./pages/admin/Treasury/MerchantsPage'));
// Reuse Treasury pages for read-only views
const AccountingTransactionsPage = lazy(() => import('./pages/admin/Treasury/TransactionsPage'));

// Marketing Pages
import MarketingLayout from './components/layouts/MarketingLayout';
const MarketingHome = lazy(() => import('./pages/admin/Marketing/MarketingHome'));
const MarketingPromos = lazy(() => import('./pages/admin/Marketing/Promos'));
const MarketingConfig = lazy(() => import('./pages/admin/Marketing/Config'));

// Shared Admin Pages
const LogsPage = lazy(() => import('./pages/admin/Shared/Logs'));
const ProfilePage = lazy(() => import('./pages/admin/Shared/Profile'));
const ConcernsPage = lazy(() => import('./pages/admin/Shared/Concerns'));
const Merchants = lazy(() => import('./pages/admin/Shared/Merchants'));
const TreasuryLogs = lazy(() => import('./pages/admin/Shared/Logs'));
const ConcernsManagement = lazy(() => import('./pages/admin/Shared/ConcernsManagement'));
const Config = lazy(() => import('./pages/admin/Shared/Config'));

// User Pages
import UserDashboard from './pages/user/UserDashboard';
import TransactionHistory from './pages/user/TransactionHistory';
import UserConcerns from './pages/user/UserConcerns';
import UserPromotions from './pages/user/UserPromotions';
import UserProfile from './pages/user/UserProfile';
import FAQ from './pages/user/FAQ';

// System Admin Pages
const SysadDashboard = lazy(() => import('./pages/admin/Sysad/Dashboard'));
const ManageUsers = lazy(() => import('./pages/admin/Sysad/ManageUsers'));
const TransferCard = lazy(() => import('./pages/admin/Sysad/TransferCard'));
const SysadConcernsPage = lazy(() => import('./pages/admin/Sysad/ConcernsPage'));
const SysadConfigPage = lazy(() => import('./pages/admin/Sysad/ConfigPage'));
const SysadSystemAlerts = lazy(() => import('./pages/admin/Sysad/SystemAlerts'));

// Maintenance Mode Page
import MaintenanceMode from './pages/MaintenanceMode';

// Legal Pages
import TermsAndConditions from './pages/legal/TermsAndConditions';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';

// Shown while a lazy route chunk downloads
const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 36, height: 36, border: '4px solid rgba(59,130,246,0.25)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'pageLoaderSpin 0.8s linear infinite' }} />
    <style>{'@keyframes pageLoaderSpin { to { transform: rotate(360deg); } }'}</style>
  </div>
);

// Protected Route wrapper for Motorpool Admin
const MotorpoolProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'motorpool') {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
};

// Protected Route wrapper for Merchant Admin
const MerchantProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'merchant') {
    return <Navigate to="/login" replace />;
  }

  return <MerchantLayout>{children}</MerchantLayout>;
};

// Protected Route wrapper for Treasury Admin
const TreasuryProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'treasury') {
    return <Navigate to="/login" replace />;
  }

  return <TreasuryLayout>{children}</TreasuryLayout>;
};

// Protected Route wrapper for Accounting Admin
const AccountingProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'accounting') {
    return <Navigate to="/login" replace />;
  }

  return <AccountingLayout>{children}</AccountingLayout>;
};

// Protected Route wrapper for Marketing Admin
const MarketingProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'marketing') {
    return <Navigate to="/login" replace />;
  }

  return <MarketingLayout>{children}</MarketingLayout>;
};

// Protected Route wrapper for User
const UserProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('userToken');

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <UserLayout>{children}</UserLayout>;
};

// Protected Route wrapper for System Admin
const SysadProtectedRoute = ({ children }) => {
  if (isMobileDevice()) return <DesktopOnlyGuard />;
  const token = localStorage.getItem('adminToken');
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (adminData.role && adminData.role !== 'sysad') {
    return <Navigate to="/login" replace />;
  }

  return <SysadLayout>{children}</SysadLayout>;
};

// Main App component with maintenance mode
function AppContent() {
  const { isMaintenanceMode, maintenanceMessage, isSysadmin } = useMaintenanceMode();

  // Show maintenance mode for non-sysadmin users
  if (isMaintenanceMode && !isSysadmin) {
    return <MaintenanceMode message={maintenanceMessage} />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Login Routes */}
      <Route path="/login" element={<UnifiedLogin />} />
      {/* Public self-service registration kiosk */}
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/activate" element={<AccountActivation />} />
      <Route path="/maintenance" element={<MaintenanceMode />} />
      
      {/* Legal Pages */}
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* ================= USER ROUTES ================= */}
      <Route
        path="/user/dashboard"
        element={
          <UserProtectedRoute>
            <UserDashboard />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/user/history"
        element={
          <UserProtectedRoute>
            <TransactionHistory />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/user/promotions"
        element={
          <UserProtectedRoute>
            <UserPromotions />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/user/concerns"
        element={
          <UserProtectedRoute>
            <UserConcerns />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/user/profile"
        element={
          <UserProtectedRoute>
            <UserProfile />
          </UserProtectedRoute>
        }
      />
      <Route
        path="/faq"
        element={
          <UserProtectedRoute>
            <FAQ />
          </UserProtectedRoute>
        }
      />
      {/* Legacy route redirect */}
      <Route path="/users-dashboard" element={<Navigate to="/user/dashboard" replace />} />

      {/* ================= TREASURY ROUTES ================= */}
      <Route
        path="/admin/treasury/dashboard"
        element={
          <TreasuryProtectedRoute>
            <TreasuryDashboard />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/register"
        element={
          <TreasuryProtectedRoute>
            <RegistrationForm />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/transactions"
        element={
          <TreasuryProtectedRoute>
            <TreasuryTransactionsPage />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/merchants"
        element={
          <TreasuryProtectedRoute>
            <TreasuryMerchantsPage />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/logs"
        element={
          <TreasuryProtectedRoute>
            <LogsPage />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/concerns"
        element={
          <TreasuryProtectedRoute>
            <TreasuryConcernsPage />
          </TreasuryProtectedRoute>
        }
      />
      <Route
        path="/admin/treasury/config"
        element={
          <TreasuryProtectedRoute>
            <TreasuryConfigPage />
          </TreasuryProtectedRoute>
        }
      />
      {/* Treasury Profile */}
      <Route
        path="/admin/treasury/profile"
        element={
          <TreasuryProtectedRoute>
            <ProfilePage />
          </TreasuryProtectedRoute>
        }
      />
      {/* Treasury default redirect */}
      <Route path="/admin/treasury" element={<Navigate to="/admin/treasury/dashboard" replace />} />

      {/* ================= ACCOUNTING ROUTES ================= */}
      <Route
        path="/admin/accounting/home"
        element={
          <AccountingProtectedRoute>
            <AccountingHome />
          </AccountingProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/transactions"
        element={
          <AccountingProtectedRoute>
            <AccountingTransactionsPage />
          </AccountingProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/merchants"
        element={
          <AccountingProtectedRoute>
            <AccountingMerchantsPage />
          </AccountingProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/logs"
        element={
          <AccountingProtectedRoute>
            <TreasuryLogs />
          </AccountingProtectedRoute>
        }
      />
      <Route
        path="/admin/accounting/config"
        element={
          <AccountingProtectedRoute>
            <Config />
          </AccountingProtectedRoute>
        }
      />
      {/* Accounting Profile */}
      <Route
        path="/admin/accounting/profile"
        element={
          <AccountingProtectedRoute>
            <ProfilePage />
          </AccountingProtectedRoute>
        }
      />
      {/* Accounting default redirect */}
      <Route path="/admin/accounting" element={<Navigate to="/admin/accounting/home" replace />} />

      {/* ================= MARKETING ROUTES ================= */}
      <Route path="/admin/marketing/home" element={<MarketingProtectedRoute><MarketingHome /></MarketingProtectedRoute>} />
      <Route path="/admin/marketing/promos" element={<MarketingProtectedRoute><MarketingPromos /></MarketingProtectedRoute>} />
      <Route path="/admin/marketing/logs" element={<MarketingProtectedRoute><TreasuryLogs /></MarketingProtectedRoute>} />
      <Route path="/admin/marketing/config" element={<MarketingProtectedRoute><MarketingConfig /></MarketingProtectedRoute>} />
      <Route path="/admin/marketing/profile" element={<MarketingProtectedRoute><ProfilePage /></MarketingProtectedRoute>} />
      <Route path="/admin/marketing" element={<Navigate to="/admin/marketing/home" replace />} />

      {/* ================= SYSTEM ADMIN ROUTES ================= */}
      <Route
        path="/admin/sysad/dashboard"
        element={
          <SysadProtectedRoute>
            <SysadDashboard />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/users"
        element={
          <SysadProtectedRoute>
            <ManageUsers />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/transfer-card"
        element={
          <SysadProtectedRoute>
            <TransferCard />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/logs"
        element={
          <SysadProtectedRoute>
            <LogsPage />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/concerns"
        element={
          <SysadProtectedRoute>
            <SysadConcernsPage />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/config"
        element={
          <SysadProtectedRoute>
            <SysadConfigPage />
          </SysadProtectedRoute>
        }
      />
      <Route
        path="/admin/sysad/alerts"
        element={
          <SysadProtectedRoute>
            <SysadSystemAlerts />
          </SysadProtectedRoute>
        }
      />
      {/* Sysad Profile */}
      <Route
        path="/admin/sysad/profile"
        element={
          <SysadProtectedRoute>
            <ProfilePage />
          </SysadProtectedRoute>
        }
      />
      {/* Sysad default redirect */}
      <Route path="/admin/sysad" element={<Navigate to="/admin/sysad/dashboard" replace />} />

      {/* ================= MOTORPOOL ADMIN ROUTES ================= */}
      <Route
        path="/admin/motorpool"
        element={
          <MotorpoolProtectedRoute>
            <MotorpoolDashboard />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/routes"
        element={
          <MotorpoolProtectedRoute>
            <RoutesPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/drivers"
        element={
          <MotorpoolProtectedRoute>
            <DriversPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/shuttles"
        element={
          <MotorpoolProtectedRoute>
            <ShuttlesPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/trips"
        element={
          <MotorpoolProtectedRoute>
            <TripsPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/phones"
        element={
          <MotorpoolProtectedRoute>
            <PhonesPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/concerns"
        element={
          <MotorpoolProtectedRoute>
            <MotorpoolConcernsPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/motorpool/configurations"
        element={
          <MotorpoolProtectedRoute>
            <MotorpoolConfigurationsPage />
          </MotorpoolProtectedRoute>
        }
      />
      {/* Motorpool Profile */}
      <Route
        path="/admin/motorpool/profile"
        element={
          <MotorpoolProtectedRoute>
            <ProfilePage />
          </MotorpoolProtectedRoute>
        }
      />

      {/* ================= MERCHANT ADMIN ROUTES ================= */}
      <Route
        path="/admin/merchant"
        element={
          <MerchantProtectedRoute>
            <MerchantDashboard />
          </MerchantProtectedRoute>
        }
      />
      <Route
        path="/admin/merchant/merchants"
        element={
          <MerchantProtectedRoute>
            <MerchantsPage />
          </MerchantProtectedRoute>
        }
      />
      <Route
        path="/admin/merchant/phones"
        element={
          <MerchantProtectedRoute>
            <MerchantPhonesPage />
          </MerchantProtectedRoute>
        }
      />
      <Route
        path="/admin/merchant/concerns"
        element={
          <MerchantProtectedRoute>
            <MerchantConcernsPage />
          </MerchantProtectedRoute>
        }
      />
      <Route
        path="/admin/merchant/configurations"
        element={
          <MerchantProtectedRoute>
            <MerchantConfigurationsPage />
          </MerchantProtectedRoute>
        }
      />
      {/* Merchant Profile */}
      <Route
        path="/admin/merchant/profile"
        element={
          <MerchantProtectedRoute>
            <ProfilePage />
          </MerchantProtectedRoute>
        }
      />
      {/* Merchant Logs */}
      <Route
        path="/admin/merchant/logs"
        element={
          <MerchantProtectedRoute>
            <LogsPage />
          </MerchantProtectedRoute>
        }
      />

      {/* ================= SHARED ADMIN ROUTES ================= */}
      <Route
        path="/admin/logs"
        element={
          <MotorpoolProtectedRoute>
            <LogsPage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/profile"
        element={
          <MotorpoolProtectedRoute>
            <ProfilePage />
          </MotorpoolProtectedRoute>
        }
      />
      <Route
        path="/admin/concerns"
        element={
          <MotorpoolProtectedRoute>
            <ConcernsPage />
          </MotorpoolProtectedRoute>
        }
      />

      {/* Default redirects */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/admin" element={<Navigate to="/admin/motorpool" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <ToastContainer />
          <ExportCompleteModal />
          <ConfirmDialogHost />
          <AppContent />
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}

export default App;
