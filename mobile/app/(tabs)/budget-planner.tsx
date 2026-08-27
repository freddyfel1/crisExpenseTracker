import { useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import {
  useBudgetLineItems,
  useBudgetSections,
  useDeleteBudgetLineItem,
  useDeleteBudgetSection,
  useProfile,
  useSaveBudgetLineItem,
  useSaveBudgetSection,
  useUpdateProfile,
} from '../../src/hooks/useAppData'
import type { BudgetLineItem, BudgetSection } from '../../src/types'
import { formatMoney } from '../../src/utils/format'
import { colors } from '../../src/theme'

function confirmDelete(message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(message)) onConfirm()
    return
  }
  Alert.alert('Delete', message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ])
}

export default function BudgetPlannerScreen() {
  const profile = useProfile()
  const sections = useBudgetSections()
  const lineItems = useBudgetLineItems()
  const updateProfile = useUpdateProfile()
  const saveSection = useSaveBudgetSection()
  const deleteSection = useDeleteBudgetSection()
  const saveItem = useSaveBudgetLineItem()
  const deleteItem = useDeleteBudgetLineItem()

  if (profile.isLoading || sections.isLoading || lineItems.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const income = profile.data?.monthlyIncome ?? 0
  const savings = profile.data?.monthlySavings ?? 0
  const items = lineItems.data ?? []
  const expenses = items.reduce((sum, i) => sum + i.monthlyAmount, 0)
  const difference = income - expenses
  const balance = difference - savings
  const sortedSections = [...(sections.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Budget Planner</Text>
        <Text style={styles.subtitle}>A planned monthly budget, like a spreadsheet.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryStat
              label="Income"
              value={income}
              editable
              onSave={(v) => updateProfile.mutate({ monthlyIncome: v })}
            />
            <SummaryStat label="Expenses" value={expenses} />
            <SummaryStat label="Difference" value={difference} warn={difference < 0} />
            <SummaryStat
              label="Savings"
              value={savings}
              editable
              onSave={(v) => updateProfile.mutate({ monthlySavings: v })}
            />
            <SummaryStat label="Balance" value={balance} warn={balance < 0} />
          </View>
        </View>

        {sortedSections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            items={items.filter((i) => i.sectionId === section.id).sort((a, b) => a.sortOrder - b.sortOrder)}
            onAddItem={() =>
              saveItem.mutate({
                sectionId: section.id,
                name: 'New item',
                monthlyAmount: 0,
                sortOrder: items.filter((i) => i.sectionId === section.id).length,
              })
            }
            onSaveItem={(item) => saveItem.mutate(item)}
            onDeleteItem={(id) => confirmDelete('Delete this line item?', () => deleteItem.mutate(id))}
            onRenameSection={(name) => saveSection.mutate({ id: section.id, name, sortOrder: section.sortOrder })}
            onDeleteSection={() =>
              confirmDelete(`Delete "${section.name}" and all its line items?`, () => deleteSection.mutate(section.id))
            }
          />
        ))}

        <Pressable
          style={styles.addSectionButton}
          onPress={() => saveSection.mutate({ name: 'New section', sortOrder: sortedSections.length })}
        >
          <Plus size={15} color={colors.textSoft} />
          <Text style={styles.addSectionText}>Add section</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryStat({
  label,
  value,
  warn,
  editable,
  onSave,
}: {
  label: string
  value: number
  warn?: boolean
  editable?: boolean
  onSave?: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const commit = () => {
    const parsed = Number(draft)
    if (!Number.isNaN(parsed)) onSave?.(parsed)
    setEditing(false)
  }

  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      {editable && editing ? (
        <TextInput
          autoFocus
          style={[styles.summaryValue, styles.summaryInput]}
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
          onBlur={commit}
          onSubmitEditing={commit}
        />
      ) : (
        <Pressable
          onPress={
            editable
              ? () => {
                  setDraft(String(value))
                  setEditing(true)
                }
              : undefined
          }
        >
          <Text style={[styles.summaryValue, warn && { color: colors.warn }]}>{formatMoney(value)}</Text>
        </Pressable>
      )}
    </View>
  )
}

function SectionBlock({
  section,
  items,
  onAddItem,
  onSaveItem,
  onDeleteItem,
  onRenameSection,
  onDeleteSection,
}: {
  section: BudgetSection
  items: BudgetLineItem[]
  onAddItem: () => void
  onSaveItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onDeleteItem: (id: string) => void
  onRenameSection: (name: string) => void
  onDeleteSection: () => void
}) {
  const total = items.reduce((sum, i) => sum + i.monthlyAmount, 0)

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <TextInput
          defaultValue={section.name}
          onBlur={(e) => e.nativeEvent.text.trim() && onRenameSection(e.nativeEvent.text.trim())}
          style={styles.sectionName}
        />
        <Text style={styles.sectionTotal}>{formatMoney(total)}/mo</Text>
        <Pressable onPress={onDeleteSection} hitSlop={8}>
          <Trash2 size={15} color={colors.textSoft} />
        </Pressable>
      </View>

      {items.length === 0 && <Text style={styles.statSub}>No line items yet.</Text>}
      {items.map((item) => (
        <LineItemRow key={item.id} item={item} onSave={onSaveItem} onDelete={() => onDeleteItem(item.id)} />
      ))}

      <Pressable style={styles.addItemButton} onPress={onAddItem}>
        <Plus size={13} color={colors.primary} />
        <Text style={styles.addItemText}>Add line item</Text>
      </Pressable>
    </View>
  )
}

function LineItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: BudgetLineItem
  onSave: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onDelete: () => void
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemTopRow}>
        <TextInput
          defaultValue={item.name}
          placeholder="Name"
          onBlur={(e) => onSave({ ...item, name: e.nativeEvent.text })}
          style={[styles.itemInput, { flex: 1.4 }]}
        />
        <TextInput
          defaultValue={String(item.monthlyAmount)}
          placeholder="Monthly"
          keyboardType="decimal-pad"
          onBlur={(e) => onSave({ ...item, monthlyAmount: Number(e.nativeEvent.text) || 0 })}
          style={[styles.itemInput, { flex: 0.8 }]}
        />
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={14} color={colors.textSoft} />
        </Pressable>
      </View>
      <Text style={styles.itemYearly}>{formatMoney(item.monthlyAmount * 12)}/yr</Text>
      <View style={styles.itemBottomRow}>
        <TextInput
          defaultValue={item.miscInfo ?? ''}
          placeholder="Misc info"
          onBlur={(e) => onSave({ ...item, miscInfo: e.nativeEvent.text || null })}
          style={[styles.itemInput, { flex: 1 }]}
        />
        <TextInput
          defaultValue={item.remarks ?? ''}
          placeholder="Remarks"
          onBlur={(e) => onSave({ ...item, remarks: e.nativeEvent.text || null })}
          style={[styles.itemInput, { flex: 1 }]}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.textSoft, marginTop: -8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  summaryStat: { minWidth: 90 },
  summaryLabel: { fontSize: 10, color: colors.textSoft, letterSpacing: 0.5, textTransform: 'uppercase' },
  summaryValue: { fontSize: 17, fontWeight: '600', color: colors.ink, marginTop: 2 },
  summaryInput: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 1, minWidth: 70 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  sectionTotal: { fontSize: 12.5, color: colors.textSoft, fontVariant: ['tabular-nums'] },
  statSub: { fontSize: 12, color: colors.textSoft },
  itemRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  itemTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemBottomRow: { flexDirection: 'row', gap: 8 },
  itemInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12.5,
    color: colors.ink,
  },
  itemYearly: { fontSize: 11, color: colors.textSoft },
  addItemButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  addItemText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  addSectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  addSectionText: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
})
