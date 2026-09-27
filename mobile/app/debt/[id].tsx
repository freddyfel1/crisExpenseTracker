import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { useDebts, useDeleteDebt, useSaveDebt } from '../../src/hooks/useAppData'
import { projectAmortization, standardMonthlyPayment } from '../../src/data/selectors'
import type { Debt, DebtType } from '../../src/types'
import { colors } from '../../src/theme'
import { formatMoney } from '../../src/utils/format'

const DEBT_TYPES: { value: DebtType; label: string }[] = [
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'personal_loan', label: 'Personal loan' },
  { value: 'credit_card', label: 'Credit card' },
  { value: 'friend_loan', label: 'Loan to a friend' },
  { value: 'other', label: 'Other' },
]

export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const debts = useDebts()
  const saveDebt = useSaveDebt()
  const deleteDebt = useDeleteDebt()

  const existing = debts.data?.find((d) => d.id === id)
  const [draft, setDraft] = useState<Debt | null>(existing ?? null)
  // Seeds the draft once, the first time `existing` loads — resyncing on every later
  // refetch would silently overwrite an in-progress edit whenever this same debt
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
    await saveDebt.mutateAsync(draft)
    router.back()
  }

  const remove = () => {
    const doDelete = async () => {
      await deleteDebt.mutateAsync(draft.id)
      router.back()
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this debt and all its logged payments? This cannot be undone.')) doDelete()
      return
    }

    Alert.alert('Delete debt', 'This deletes all its logged payments too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }

  // Projects the full original loan (not the current balance) at its monthly payment to
  // see what it actually costs over its life — principal plus every dollar of interest
  // that payment schedule adds up to. Mirrors web's Debts.tsx DebtModal.
  const schedule =
    draft.monthlyPayment > 0 ? projectAmortization(draft.principal, draft.interestRate, draft.monthlyPayment) : []
  const totalWithInterest = schedule.length > 0 ? draft.principal + schedule.reduce((sum, r) => sum + r.interest, 0) : null

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Name">
          <TextInput style={styles.input} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} />
        </Field>

        <Field label="Type">
          <View style={styles.chipRow}>
            {DEBT_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setDraft({ ...draft, debtType: value })}
                style={[
                  styles.chip,
                  { borderColor: colors.primary },
                  draft.debtType === value && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={{ color: colors.primaryInk, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Institution (optional)">
          <TextInput
            style={styles.input}
            value={draft.institution ?? ''}
            onChangeText={(v) => setDraft({ ...draft, institution: v || null })}
            placeholder="e.g. Chase"
          />
        </Field>

        <NumberField
          label="Original amount"
          value={draft.principal}
          onCommit={(v) => setDraft({ ...draft, principal: v })}
          helper={totalWithInterest != null ? `${formatMoney(totalWithInterest)} with interest` : undefined}
        />

        <NumberField
          label="Interest rate (annual %)"
          value={draft.interestRate}
          onCommit={(v) => setDraft({ ...draft, interestRate: v })}
        />

        <NumberField
          label="Term (months, 0 if open-ended)"
          value={draft.termMonths}
          onCommit={(v) => {
            const suggested = v > 0 ? standardMonthlyPayment(draft.principal, draft.interestRate, v) : draft.monthlyPayment
            setDraft({ ...draft, termMonths: v, monthlyPayment: v > 0 ? Math.round(suggested * 100) / 100 : draft.monthlyPayment })
          }}
        />

        <NumberField
          label="Monthly payment"
          value={draft.monthlyPayment}
          onCommit={(v) => setDraft({ ...draft, monthlyPayment: v })}
        />

        <Field label="Start date">
          <TextInput
            style={styles.input}
            value={draft.startDate.slice(0, 10)}
            onChangeText={(v) => setDraft({ ...draft, startDate: v })}
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
          <Pressable style={styles.saveButton} onPress={save} disabled={saveDebt.isPending}>
            {saveDebt.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save changes</Text>}
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
// investment-transaction/[id].tsx's NumberField — see that file for the full rationale.
function NumberField({
  label,
  value,
  onCommit,
  helper,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
  helper?: string
}) {
  const [text, setText] = useState(String(value))
  return (
    <Field label={label}>
      <View style={styles.fieldRow}>
        <TextInput
          style={[styles.input, helper ? { flex: 1 } : undefined]}
          keyboardType="decimal-pad"
          value={text}
          onChangeText={setText}
          onFocus={() => setText('')}
          onBlur={() => {
            const next = text.trim() === '' ? value : Number(text)
            const safe = Number.isNaN(next) ? value : next
            onCommit(safe)
            setText(String(safe))
          }}
        />
        {helper && (
          <Text style={styles.helperText} numberOfLines={2}>
            {helper}
          </Text>
        )}
      </View>
    </Field>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  label: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  helperText: { flexShrink: 1, fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'right' },
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
