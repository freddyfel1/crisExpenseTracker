import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import {
  useDeleteInvestmentTransaction,
  useInvestmentTransactions,
  useSaveInvestmentTransaction,
} from '../../src/hooks/useAppData'
import type { AssetType, InvestmentTransaction, InvestmentTransactionType } from '../../src/types'
import { colors } from '../../src/theme'
import { formatMoney } from '../../src/utils/format'

const ASSET_TYPES: { value: AssetType; label: string }[] = [
  { value: 'etf', label: 'ETF' },
  { value: 'stock', label: 'Stock' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
]

const TRANSACTION_TYPES: { value: InvestmentTransactionType; label: string }[] = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'other', label: 'Other' },
]

export default function InvestmentTransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const transactions = useInvestmentTransactions()
  const saveTransaction = useSaveInvestmentTransaction()
  const deleteTransaction = useDeleteInvestmentTransaction()

  const existing = transactions.data?.find((t) => t.id === id)
  const [draft, setDraft] = useState<InvestmentTransaction | null>(existing ?? null)
  // Seeds the draft once, the first time `existing` loads — resyncing on every later
  // refetch would silently overwrite an in-progress edit whenever this same transaction
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
    await saveTransaction.mutateAsync({ ...draft, symbol: draft.symbol.trim().toUpperCase() })
    router.back()
  }

  const remove = () => {
    const doDelete = async () => {
      await deleteTransaction.mutateAsync(draft.id)
      router.back()
    }

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this transaction? This cannot be undone.')) doDelete()
      return
    }

    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Field label="Symbol">
          <TextInput
            style={styles.input}
            value={draft.symbol}
            onChangeText={(v) => setDraft({ ...draft, symbol: v })}
            autoCapitalize="characters"
            placeholder="VOO, BTC..."
          />
        </Field>

        <Field label="Asset type">
          <View style={styles.chipRow}>
            {ASSET_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setDraft({ ...draft, assetType: value })}
                style={[
                  styles.chip,
                  { borderColor: colors.primary },
                  draft.assetType === value && { backgroundColor: colors.primarySoft },
                ]}
              >
                <Text style={{ color: colors.primaryInk, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <Field label="Transaction">
          <View style={styles.chipRow}>
            {TRANSACTION_TYPES.map(({ value, label }) => (
              <Pressable
                key={value}
                onPress={() => setDraft({ ...draft, transactionType: value })}
                style={[
                  styles.chip,
                  { borderColor: colors.gold },
                  draft.transactionType === value && { backgroundColor: colors.goldSoft },
                ]}
              >
                <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>

        <NumberField
          label="Quantity"
          value={draft.quantity}
          onCommit={(v) => setDraft({ ...draft, quantity: v })}
        />

        <CurrencyField
          label="Price per unit"
          value={draft.pricePerUnit}
          onCommit={(v) => setDraft({ ...draft, pricePerUnit: v })}
        />

        <CurrencyField label="Fees" value={draft.fees} onCommit={(v) => setDraft({ ...draft, fees: v })} />

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
          <Pressable style={styles.saveButton} onPress={save} disabled={saveTransaction.isPending}>
            {saveTransaction.isPending ? (
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

// A plain-number TextInput bound directly to `value={String(n)}` snaps back to the
// formatted number after every keystroke, silently eating a just-typed decimal point (typing
// "12.5" becomes "125" since the "." never survives a re-render). Keeping the input's own
// text as local state — synced back to the parent only on blur — lets the user type freely.
// Tapping in always clears the field (not just when it's already 0), so on a fresh "Add
// transaction" — or editing any of these — there's never a leading "0" to delete by hand
// first. Tapping out without typing anything leaves the value unchanged rather than saving
// an emptied field as 0 (Number('') is 0, not NaN — that footgun bit a few web number
// fields earlier; same guard here).
function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <Field label={label}>
      <TextInput
        style={styles.input}
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
    </Field>
  )
}

// Same fix as NumberField, plus shows a formatted dollar amount while not focused (matching
// the web app's Amount field) instead of a bare number.
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
