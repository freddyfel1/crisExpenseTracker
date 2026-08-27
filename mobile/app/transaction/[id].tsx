import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Trash2 } from 'lucide-react-native'
import { getReceiptSignedUrl } from '../../src/data/api'
import { useCategories, useDeleteTransaction, useSaveTransaction, useTransactions } from '../../src/hooks/useAppData'
import type { Transaction } from '../../src/types'
import { colors } from '../../src/theme'

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const transactions = useTransactions()
  const categories = useCategories()
  const saveTransaction = useSaveTransaction()
  const deleteTransaction = useDeleteTransaction()

  const existing = transactions.data?.find((t) => t.id === id)
  const [draft, setDraft] = useState<Transaction | null>(existing ?? null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (existing) setDraft(existing)
  }, [existing])

  useEffect(() => {
    if (existing?.receiptImagePath) {
      getReceiptSignedUrl(existing.receiptImagePath).then(setImageUrl)
    }
  }, [existing?.receiptImagePath])

  if (!draft) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const save = async () => {
    await saveTransaction.mutateAsync(draft)
    router.back()
  }

  const remove = () => {
    const doDelete = async () => {
      await deleteTransaction.mutateAsync(draft.id)
      router.back()
    }

    if (Platform.OS === 'web') {
      // react-native-web's Alert.alert doesn't support interactive buttons.
      if (window.confirm('Delete transaction? This cannot be undone.')) doDelete()
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
        {imageUrl && <Image source={{ uri: imageUrl }} style={styles.receipt} resizeMode="cover" />}

        <Field label="Merchant">
          <TextInput
            style={styles.input}
            value={draft.merchant}
            onChangeText={(v) => setDraft({ ...draft, merchant: v })}
          />
        </Field>

        <Field label="Amount">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={String(draft.amount)}
            onChangeText={(v) => setDraft({ ...draft, amount: Number(v) || 0 })}
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

        <Field label="Category">
          <View style={styles.chipRow}>
            {(categories.data ?? []).map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setDraft({ ...draft, categoryId: c.id })}
                style={[
                  styles.chip,
                  { borderColor: c.color },
                  draft.categoryId === c.id && { backgroundColor: `${c.color}22` },
                ]}
              >
                <Text style={{ color: c.color, fontSize: 12, fontWeight: '600' }}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
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
  receipt: { width: '100%', height: 200, borderRadius: 12, marginBottom: 4 },
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
