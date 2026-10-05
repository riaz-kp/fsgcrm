import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import AttendancePage, { AttendanceDetail } from './pages/Attendance'
import Calendar from './pages/Calendar'
import ClientDetail from './pages/ClientDetail'
import Clients from './pages/Clients'
import Compliance from './pages/Compliance'
import Consultations from './pages/Consultations'
import Dashboard from './pages/Dashboard'
import EmployeeDetail from './pages/EmployeeDetail'
import Leads from './pages/Leads'
import Requirements from './pages/Requirements'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'
import Team from './pages/Team'

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
