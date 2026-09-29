import { useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { LogOut } from 'lucide-react-native'
import { useProfile, useUpdateProfile } from '../../src/hooks/useAppData'
import { useSession } from '../../src/hooks/useSession'
import { supabase } from '../../src/lib/supabase'
import { useTheme } from '../../src/data/theme'
import type { ThemeColors } from '../../src/theme'

export default function Settings() {
  const { session } = useSession()
  const profile = useProfile()
  const updateProfile = useUpdateProfile()
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const [name, setName] = useState(profile.data?.name ?? '')
  const [nameSeeded, setNameSeeded] = useState(false)

  if (profile.isLoading || !profile.data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  // Seeds the local input once the real name loads, same guard pattern as the
  // transaction drawer's draft — the query briefly returns before `profile.data`
  // is populated, and we don't want a later background refetch to stomp on
  // whatever the user is mid-typing.
  if (!nameSeeded) {
    setName(profile.data.name)
    setNameSeeded(true)
  }

  const toggle = (key: 'notifyBudgetAlerts' | 'notifyWeeklySummary' | 'notifyReceiptSync') => (value: boolean) =>
    updateProfile.mutate({ [key]: value })

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>{session?.user.email}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          <Field styles={styles} label="Name">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              onBlur={() => updateProfile.mutate({ name })}
              placeholder="Your name"
              placeholderTextColor={colors.textSoft}
            />
          </Field>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notifications</Text>
          <Row
            styles={styles}
            colors={colors}
            label="Budget alerts"
            sub="Get notified when a category nears its limit"
            value={profile.data.notifyBudgetAlerts}
            onChange={toggle('notifyBudgetAlerts')}
          />
          <Row
            styles={styles}
            colors={colors}
            label="Weekly summary"
            sub="A recap of spending every Monday"
            value={profile.data.notifyWeeklySummary}
            onChange={toggle('notifyWeeklySummary')}
          />
          <Row
            styles={styles}
            colors={colors}
            label="Receipt sync"
            sub="Notify when a new receipt syncs from the web app"
            value={profile.data.notifyReceiptSync}
            onChange={toggle('notifyReceiptSync')}
          />
        </View>

        <Text style={styles.note}>
          Bank sync, data export, and the how-to guide are available on the web app for now.
        </Text>

        <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
          <LogOut size={16} color={colors.warn} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({
  styles,
  label,
  children,
}: {
  styles: ReturnType<typeof makeStyles>
  label: string
  children: React.ReactNode
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

function Row({
  styles,
  colors,
  label,
  sub,
  value,
  onChange,
}: {
  styles: ReturnType<typeof makeStyles>
  colors: ThemeColors
  label: string
  sub: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  )
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: colors.textSoft },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 14, fontWeight: '500', color: colors.ink },
  rowSub: { fontSize: 12, color: colors.textSoft },
  note: { fontSize: 12, color: colors.textSoft, textAlign: 'center', paddingHorizontal: 8 },
  signOut: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
  },
  signOutText: { color: colors.warn, fontWeight: '600', fontSize: 14 },
  })
}
