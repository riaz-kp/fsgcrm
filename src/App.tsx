import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'

// Each screen is fetched when it is first opened, so the first load stays small (the PDF maker alone is ~400 kB).
const AttendancePage = lazy(() => import('./pages/Attendance'))
const AttendanceDetail = lazy(() => import('./pages/Attendance').then((m) => ({ default: m.AttendanceDetail })))
const Calendar = lazy(() => import('./pages/Calendar'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const Clients = lazy(() => import('./pages/Clients'))
const Compliance = lazy(() => import('./pages/Compliance'))
const Consultations = lazy(() => import('./pages/Consultations'))
const EmployeeDetail = lazy(() => import('./pages/EmployeeDetail'))
const Leads = lazy(() => import('./pages/Leads'))
const Requirements = lazy(() => import('./pages/Requirements'))
const Settings = lazy(() => import('./pages/Settings'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Team = lazy(() => import('./pages/Team'))

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="filings/:tab?" element={<Compliance />} />
          <Route path="consultations" element={<Consultations />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="attendance/:id" element={<AttendanceDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetail />} />
          <Route path="leads" element={<Leads />} />
          <Route path="requirements" element={<Requirements />} />
          <Route path="settings/:tab?" element={<Settings />} />
          <Route path="team" element={<Team />} />
          <Route path="team/:id" element={<EmployeeDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
