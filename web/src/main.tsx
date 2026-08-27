import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { PeriodProvider } from './data/period'
import { ConnectSupabaseScreen } from './components/ConnectSupabaseScreen'
import { SignInScreen } from './components/SignInScreen'
import { ResetPasswordScreen } from './components/ResetPasswordScreen'
import { isSupabaseConfigured } from './lib/supabase'
import { useSession } from './hooks/useSession'

const queryClient = new QueryClient()

function Gate() {
  const { session, loading, isPasswordRecovery, clearPasswordRecovery } = useSession()

  if (!isSupabaseConfigured) return <ConnectSupabaseScreen />
  if (loading) return null
  if (isPasswordRecovery) return <ResetPasswordScreen onDone={clearPasswordRecovery} />
  if (!session) return <SignInScreen />

  return (
    <PeriodProvider>
      <App />
    </PeriodProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
