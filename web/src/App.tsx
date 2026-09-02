import { Route, Routes } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { MobileNav } from './components/MobileNav'
import { Dashboard } from './pages/Dashboard'
import { Transactions } from './pages/Transactions'
import { Categories } from './pages/Categories'
import { BudgetPlanner } from './pages/BudgetPlanner'
import { SavingsGoals } from './pages/SavingsGoals'
import { Reports } from './pages/Reports'
import { Settings } from './pages/Settings'

function App() {
  return (
    <div className="flex min-h-screen bg-[var(--paper)]">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden px-4 py-6 pb-20 sm:px-6 lg:px-8 md:pb-6">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/transactions/:id" element={<Transactions />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/budget-planner" element={<BudgetPlanner />} />
            <Route path="/savings-goals" element={<SavingsGoals />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </main>
      <MobileNav />
    </div>
  )
}

export default App
