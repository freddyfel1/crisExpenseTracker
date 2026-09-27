import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { useDebtPayments, useDebts, useDeleteDebtPayment, useSaveDebtPayment } from '../../src/hooks/useAppData'
import type { DebtPayment } from '../../src/types'
import { colors } from '../../src/theme'
import { formatMoney } from '../../src/utils/format'

export default function DebtPaymentDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const debts = useDebts()
  const payments = useDebtPayments()
  const savePayment = useSaveDebtPayment()
  const deletePayment = useDeleteDebtPayment()

  const existing = payments.data?.find((p) => p.id === id)
  const [draft, setDraft] = useState<DebtPayment | null>(existing ?? null)
  // Seeds the draft once, the first time `existing` loads — see investment-transaction/[id].tsx
  // for the full rationale (avoids a background refetch clobbering an in-progress edit).
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
    await savePayment.mutateAsync(draft)
    router.back()
  }

  const remove = () => {
    const doDelete = async () => {
      await deletePayment.mutateAsync(draft.id)
      router.back()
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this payment? This cannot be undone.')) doDelete()
      return
    }

    Alert.alert('Delete payment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Debt">
          <View style={styles.chipRow}>
            {(debts.data ?? []).map((d) => (
              <Pressable
                key={d.id}
                onPress={() => setDraft({ ...draft, debtId: d.id })}
                style={[
                  styles.chip,
                  { borderColor: colors.primary },
                  draft.debtId === d.id && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={{ color: colors.primaryInk, fontSize: 12, fontWeight: '600' }}>{d.name}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <CurrencyField label="Amount" value={draft.amount} onCommit={(v) => setDraft({ ...draft, amount: v })} />

        <Field label="Date">
          <TextInput
            style={styles.input}
            value={draft.date.slice(0, 10)}
            onChangeText={(v) => setDraft({ ...draft, date: v })}
            placeholder="YYYY-MM-DD"
          />
        </Field>

        <Field label="Notes">
          <TextInput
            style={[styles.input, { height: 72 }]}
            multiline
            value={draft.notes ?? ''}
            onChangeText={(v) => setDraft({ ...draft, notes: v })}
          />
        </Field>

        <View style={styles.actions}>
          <Pressable style={styles.saveButton} onPress={save} disabled={savePayment.isPending}>
            {savePayment.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
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

// Same "always clear on focus, empty text on blur means no change" pattern as
// investment-transaction/[id].tsx's CurrencyField — see that file for the full rationale.
function CurrencyField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(formatMoney(value))
  return (
    <Field label={label}>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        onFocus={() => setText('')}
        onBlur={() => {
          const next = text.trim() === '' ? value : Number(text.replace(/[^0-9.-]/g, ''))
          const safe = Number.isNaN(next) ? value : next
          onCommit(safe)
          setText(formatMoney(safe))
        }}
      />
    </Field>
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
