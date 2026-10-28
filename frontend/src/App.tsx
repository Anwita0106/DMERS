import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ThemeProvider, ToastProvider } from './contexts/AppContext';
import PublicLayout from './layouts/PublicLayout';
import CommandLayout from './layouts/CommandLayout';
import { Spinner } from './components/ui';
import Home from './pages/public/Home';
import Login from './pages/public/Login';
import { About, Contact, NotFound } from './pages/public/Info';

const Alerts = lazy(() => import('./pages/public/Alerts'));
const Shelters = lazy(() => import('./pages/public/Shelters'));
const Report = lazy(() => import('./pages/public/Report'));
const MyReports = lazy(() => import('./pages/public/MyReports'));
const Dashboard = lazy(() => import('./pages/command/Dashboard'));
const Incidents = lazy(() => import('./pages/command/Incidents'));
const Resources = lazy(() => import('./pages/command/Resources'));
const Units = lazy(() => import('./pages/command/Units'));
const Zones = lazy(() => import('./pages/command/Zones'));
const Analytics = lazy(() => import('./pages/command/Analytics'));
const Dispatches = lazy(() => import('./pages/command/Operations').then((m) => ({ default: m.Dispatches })));
const Allocations = lazy(() => import('./pages/command/Operations').then((m) => ({ default: m.Allocations })));
const UsersPage = lazy(() => import('./pages/command/Admin').then((m) => ({ default: m.UsersPage })));
const SettingsPage = lazy(() => import('./pages/command/Admin').then((m) => ({ default: m.SettingsPage })));

export default function App() {
  return (
    <ThemeProvider><ToastProvider><AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Home />} />
              <Route path="alerts" element={<Alerts />} />
              <Route path="shelters" element={<Shelters />} />
              <Route path="report" element={<Report />} />
              <Route path="my-reports" element={<MyReports />} />
              <Route path="about" element={<About />} />
              <Route path="contact" element={<Contact />} />
              <Route path="login" element={<Login />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route path="command" element={<CommandLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="incidents" element={<Incidents />} />
              <Route path="resources" element={<Resources />} />
              <Route path="units" element={<Units />} />
              <Route path="zones" element={<Zones />} />
              <Route path="dispatches" element={<Dispatches />} />
              <Route path="allocations" element={<Allocations />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            {/* V6 paths */}
            <Route path="dashboard/*" element={<Navigate to="/command" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider></ToastProvider></ThemeProvider>
  );
}
