import { useEffect, useState } from 'react'
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
]

export default function InvestmentTransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const transactions = useInvestmentTransactions()
  const saveTransaction = useSaveInvestmentTransaction()
  const deleteTransaction = useDeleteInvestmentTransaction()

  const existing = transactions.data?.find((t) => t.id === id)
  const [draft, setDraft] = useState<InvestmentTransaction | null>(existing ?? null)

  useEffect(() => {
    if (existing) setDraft(existing)
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

        <Field label="Quantity">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(draft.quantity)}
            onChangeText={(v) => setDraft({ ...draft, quantity: Number(v) || 0 })}
          />
        </Field>

        <Field label="Price per unit">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(draft.pricePerUnit)}
            onChangeText={(v) => setDraft({ ...draft, pricePerUnit: Number(v) || 0 })}
          />
        </Field>

        <Field label="Fees">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(draft.fees)}
            onChangeText={(v) => setDraft({ ...draft, fees: Number(v) || 0 })}
          />
        </Field>

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
