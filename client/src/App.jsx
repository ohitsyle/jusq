import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider } from './context/AppContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useMaintenanceMode } from './hooks/useMaintenanceMode.js';

import UnifiedLogin from './pages/account/UnifiedLogin';
import Kiosk from './pages/kiosk/Kiosk';
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
import MotorpoolDashboard from './pages/admin/Motorpool/Dashboard';
import RoutesPage from './pages/admin/Motorpool/Routes';
import DriversPage from './pages/admin/Motorpool/Drivers';
import ShuttlesPage from './pages/admin/Motorpool/Shuttles';
import TripsPage from './pages/admin/Motorpool/Trips';
import PhonesPage from './pages/admin/Motorpool/Phones';
import MotorpoolConcernsPage from './pages/admin/Motorpool/Concerns';
import MotorpoolConfigurationsPage from './pages/admin/Motorpool/Configurations';

// Merchant Pages
import MerchantDashboard from './pages/admin/Merchant/Dashboard';
import MerchantsPage from './pages/admin/Merchant/Merchants';
import MerchantPhonesPage from './pages/admin/Merchant/Phones';
import MerchantConcernsPage from './pages/admin/Merchant/Concerns';
import MerchantConfigurationsPage from './pages/admin/Merchant/Configurations';

// Treasury Pages
import TreasuryDashboard from './pages/admin/Treasury/TreasuryDashboard';
import RegistrationForm from './pages/admin/Treasury/RegistrationForm';
import TreasuryTransactionsPage from './pages/admin/Treasury/TransactionsPage';
import TreasuryMerchantsPage from './pages/admin/Treasury/MerchantsPage';
import TreasuryConcernsPage from './pages/admin/Treasury/ConcernsPage';
import TreasuryConfigPage from './pages/admin/Treasury/ConfigPage';

// Accounting Pages
import AccountingHome from './pages/admin/Accounting/AccountingHome';
// Accounting reuses the Treasury merchants page (read-only GETs) so both roles see identical data/UI.
import AccountingMerchantsPage from './pages/admin/Treasury/MerchantsPage';
// Reuse Treasury pages for read-only views
import AccountingTransactionsPage from './pages/admin/Treasury/TransactionsPage';

// Marketing Pages
import MarketingLayout from './components/layouts/MarketingLayout';
import MarketingHome from './pages/admin/Marketing/MarketingHome';
import MarketingPromos from './pages/admin/Marketing/Promos';
import MarketingConfig from './pages/admin/Marketing/Config';

// Shared Admin Pages
import LogsPage from './pages/admin/Shared/Logs';
import ProfilePage from './pages/admin/Shared/Profile';
import ConcernsPage from './pages/admin/Shared/Concerns';
import Merchants from './pages/admin/Shared/Merchants';
import TreasuryLogs from './pages/admin/Shared/Logs';
import ConcernsManagement from './pages/admin/Shared/ConcernsManagement';
import Config from './pages/admin/Shared/Config';

// User Pages
import UserDashboard from './pages/user/UserDashboard';
import TransactionHistory from './pages/user/TransactionHistory';
import UserConcerns from './pages/user/UserConcerns';
import UserPromotions from './pages/user/UserPromotions';
import UserProfile from './pages/user/UserProfile';
import FAQ from './pages/user/FAQ';

// System Admin Pages
import SysadDashboard from './pages/admin/Sysad/Dashboard';
import ManageUsers from './pages/admin/Sysad/ManageUsers';
import TransferCard from './pages/admin/Sysad/TransferCard';
import SysadConcernsPage from './pages/admin/Sysad/ConcernsPage';
import SysadConfigPage from './pages/admin/Sysad/ConfigPage';
import SysadSystemAlerts from './pages/admin/Sysad/SystemAlerts';

// Maintenance Mode Page
import MaintenanceMode from './pages/MaintenanceMode';

// Legal Pages
import TermsAndConditions from './pages/legal/TermsAndConditions';
import PrivacyPolicy from './pages/legal/PrivacyPolicy';

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
