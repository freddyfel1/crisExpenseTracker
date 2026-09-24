import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Wallet } from 'lucide-react-native'
import { supabase } from '../lib/supabase'
import { colors } from '../theme'

export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmNotice, setConfirmNotice] = useState(false)

  const submit = async () => {
    setError(null)
    setLoading(true)
    const { data, error: authError } =
      mode === 'sign-in'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (authError) {
      setError(authError.message)
      return
    }
    if (mode === 'sign-up' && !data.session) setConfirmNotice(true)
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.card}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Wallet size={20} color="#fff" />
            </View>
            <Text style={styles.title}>Budget Planner Plus</Text>
          </View>

          {confirmNotice ? (
            <Text style={styles.notice}>Check your email to confirm your account, then sign in.</Text>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.textSoft}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={colors.textSoft}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error && <Text style={styles.error}>{error}</Text>}

              <Pressable style={styles.button} onPress={submit} disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{mode === 'sign-in' ? 'Sign in' : 'Create account'}</Text>
                )}
              </Pressable>

              <Pressable onPress={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
                <Text style={styles.switchText}>
                  {mode === 'sign-in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  notice: { textAlign: 'center', color: colors.text, fontSize: 13, paddingVertical: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, alignSelf: 'center' },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  switchText: { textAlign: 'center', color: colors.textSoft, fontSize: 13, marginTop: 4 },
  error: { color: colors.warn, fontSize: 13 },
})
