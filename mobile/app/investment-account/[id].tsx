import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import {
  useDeleteInvestmentAccount,
  useInvestmentAccounts,
  useSaveInvestmentAccount,
} from '../../src/hooks/useAppData'
import type { InvestmentAccount, InvestmentAccountType } from '../../src/types'
import { colors } from '../../src/theme'

const ACCOUNT_TYPES: { value: InvestmentAccountType; label: string }[] = [
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'crypto', label: 'Crypto exchange' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'other', label: 'Other' },
]

export default function InvestmentAccountDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const accounts = useInvestmentAccounts()
  const saveAccount = useSaveInvestmentAccount()
  const deleteAccount = useDeleteInvestmentAccount()

  const existing = accounts.data?.find((a) => a.id === id)
  const [draft, setDraft] = useState<InvestmentAccount | null>(existing ?? null)
  // Seeds the draft once, the first time `existing` loads — resyncing on every later
  // refetch would silently overwrite an in-progress edit whenever this same account
  // changes server-side (edited on web, or another device) while open here.
  const hasSeededDraft = useRef(false)

  useEffect(() => {
    if (existing && !hasSeededDraft.current) {
      setDraft(existing)
      hasSeededDraft.current = true
    }
  }, [existing])

  if (!draft) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const save = async () => {
    await saveAccount.mutateAsync(draft)
    router.back()
  }

  const remove = () => {
    const doDelete = async () => {
      await deleteAccount.mutateAsync(draft.id)
      router.back()
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this account and all its transactions? This cannot be undone.')) doDelete()
      return
    }

    Alert.alert('Delete account', 'This deletes all its transactions too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Name">
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
        </Field>

        <Field label="Institution (optional)">
          <TextInput
            style={styles.input}
            value={draft.institution ?? ''}
            onChangeText={(v) => setDraft({ ...draft, institution: v || null })}
            placeholder="e.g. Sofi Bank"
          />
        </Field>

        <Field label="Account type">
          <View style={styles.chipRow}>
            {ACCOUNT_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setDraft({ ...draft, accountType: value })}
                style={[
                  styles.chip,
                  { borderColor: colors.primary },
                  draft.accountType === value && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={{ color: colors.primaryInk, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <View style={styles.actions}>
          <Pressable style={styles.saveButton} onPress={save} disabled={saveAccount.isPending}>
            {saveAccount.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save changes</Text>
            )}
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Trash2 size={18} color={colors.warn} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.ink,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  saveButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  deleteButton: {
    width: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
