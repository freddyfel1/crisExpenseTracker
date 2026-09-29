import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ConnectSupabaseScreen } from '../src/components/ConnectSupabaseScreen'
import { SignInScreen } from '../src/components/SignInScreen'
import { isSupabaseConfigured } from '../src/lib/supabase'
import { useSession } from '../src/hooks/useSession'
import { PeriodProvider } from '../src/data/period'
import { ThemeProvider, useTheme } from '../src/data/theme'

const queryClient = new QueryClient()

function Gate() {
  const { session, loading } = useSession()

  if (!isSupabaseConfigured) return <ConnectSupabaseScreen />
  if (loading) return null
  if (!session) return <SignInScreen />

  return (
    <PeriodProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="investments-crypto" options={{ headerShown: true, title: 'Crypto' }} />
        <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal', headerShown: true, title: 'Transaction' }} />
        <Stack.Screen
          name="investment-account/[id]"
          options={{ presentation: 'modal', headerShown: true, title: 'Investment account' }}
        />
        <Stack.Screen
          name="investment-transaction/[id]"
          options={{ presentation: 'modal', headerShown: true, title: 'Investment transaction' }}
        />
      </Stack>
    </PeriodProvider>
  )
}

function ThemedStatusBar() {
  const { resolvedTheme } = useTheme()
  return <StatusBar style={resolvedTheme === 'dark' ? 'light' : 'dark'} />
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <ThemedStatusBar />
          <Gate />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
