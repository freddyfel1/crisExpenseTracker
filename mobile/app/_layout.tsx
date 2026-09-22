import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ConnectSupabaseScreen } from '../src/components/ConnectSupabaseScreen'
import { SignInScreen } from '../src/components/SignInScreen'
import { isSupabaseConfigured } from '../src/lib/supabase'
import { useSession } from '../src/hooks/useSession'

const queryClient = new QueryClient()

function Gate() {
  const { session, loading } = useSession()

  if (!isSupabaseConfigured) return <ConnectSupabaseScreen />
  if (loading) return null
  if (!session) return <SignInScreen />

  return (
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
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Gate />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
