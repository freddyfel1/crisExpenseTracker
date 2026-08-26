import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { LogOut } from 'lucide-react-native'
import { useProfile, useUpdateProfile } from '../../src/hooks/useAppData'
import { useSession } from '../../src/hooks/useSession'
import { supabase } from '../../src/lib/supabase'
import { colors } from '../../src/theme'

export default function Settings() {
  const { session } = useSession()
  const profile = useProfile()
  const updateProfile = useUpdateProfile()

  if (profile.isLoading || !profile.data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const toggle = (key: 'notifyBudgetAlerts' | 'notifyWeeklySummary' | 'notifyReceiptSync') => (value: boolean) =>
    updateProfile.mutate({ [key]: value })

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Text style={styles.rowLabel}>{profile.data.name || 'No name set'}</Text>
          <Text style={styles.meta}>{session?.user.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <Row label="Budget alerts" value={profile.data.notifyBudgetAlerts} onChange={toggle('notifyBudgetAlerts')} />
          <Row label="Weekly summary" value={profile.data.notifyWeeklySummary} onChange={toggle('notifyWeeklySummary')} />
          <Row label="Receipt sync" value={profile.data.notifyReceiptSync} onChange={toggle('notifyReceiptSync')} />
        </View>

        <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <LogOut size={16} color={colors.warn} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: colors.ink },
  meta: { fontSize: 12, color: colors.textSoft, marginTop: -6 },
  signOut: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', padding: 14 },
  signOutText: { color: colors.warn, fontWeight: '600', fontSize: 14 },
})
