import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import {
  useBudgetLineItems,
  useBudgetSections,
  useDeleteBudgetLineItem,
  useDeleteBudgetSection,
  useDuplicateBudgetMonth,
  useMonthlyIncomes,
  useSaveBudgetLineItem,
  useSaveBudgetSection,
} from '../../src/hooks/useAppData'
import { budgetStatsForMonth, groupBudgetItemsBySection } from '../../src/data/selectors'
import { usePeriod } from '../../src/data/period'
import type { BudgetLineItem, BudgetSection } from '../../src/types'
import { formatMoney } from '../../src/utils/format'
import { colors } from '../../src/theme'
import { MonthPicker } from '../../src/components/MonthPicker'

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
  const monthlyIncomes = useMonthlyIncomes()
  const sections = useBudgetSections()
  const lineItems = useBudgetLineItems()
  const saveSection = useSaveBudgetSection()
  const deleteSection = useDeleteBudgetSection()
  const saveItem = useSaveBudgetLineItem()
  const deleteItem = useDeleteBudgetLineItem()
  const duplicateBudgetMonth = useDuplicateBudgetMonth()
  const { month } = usePeriod()

  const allSections = sections.data ?? []
  const items = lineItems.data ?? []
  const itemsBySection = useMemo(() => groupBudgetItemsBySection(items), [items])
  const monthSections = useMemo(
    () => allSections.filter((s) => s.monthKey === month).sort((a, b) => a.sortOrder - b.sortOrder),
    [allSections, month],
  )

  // The first time a month with no plan yet is opened, carry the nearest month's
  // sections/line items forward so the user edits amounts rather than rebuilding the
  // whole spreadsheet from scratch — mirrors web/src/pages/BudgetPlanner.tsx.
  const duplicateRequestedFor = useRef<string | null>(null)
  useEffect(() => {
    if (sections.isLoading || lineItems.isLoading) return
    if (monthSections.length > 0 || duplicateRequestedFor.current === month) return
    const monthsWithData = Array.from(new Set(allSections.map((s) => s.monthKey))).sort()
    const sourceMonth = [...monthsWithData].reverse().find((m) => m < month) ?? monthsWithData.find((m) => m > month)
    if (!sourceMonth) return
    duplicateRequestedFor.current = month
    const sourceSections = allSections.filter((s) => s.monthKey === sourceMonth)
    duplicateBudgetMonth.mutate({ fromSections: sourceSections, fromItemsBySection: itemsBySection, toMonthKey: month })
  }, [month, allSections, monthSections.length, itemsBySection, duplicateBudgetMonth, sections.isLoading, lineItems.isLoading])

  if (monthlyIncomes.isLoading || sections.isLoading || lineItems.isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const { income, expenses, savings, difference, balance } = budgetStatsForMonth(
    month,
    allSections,
    itemsBySection,
    monthlyIncomes.data ?? [],
  )

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Budget Planner</Text>
        <Text style={styles.subtitle}>A planned monthly budget, like a spreadsheet.</Text>
        <MonthPicker />

        {duplicateBudgetMonth.isPending && (
          <Text style={styles.statSub}>Copying last month's plan into this month…</Text>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Income" value={income} />
            <SummaryStat label="Expenses" value={expenses} />
            <SummaryStat label="Difference" value={difference} warn={difference < 0} />
            <SummaryStat label="Savings" value={savings} />
            <SummaryStat label="Balance" value={balance} warn={balance < 0} />
          </View>
        </View>

        {monthSections.map((section) => {
          const sectionItems = (itemsBySection.get(section.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
          return (
            <SectionBlock
              key={section.id}
              section={section}
              items={sectionItems}
              onAddItem={() =>
                saveItem.mutate({
                  sectionId: section.id,
                  name: 'New item',
                  monthlyAmount: 0,
                  sortOrder: sectionItems.length,
                })
              }
              isAddingItem={saveItem.isPending}
              onSaveItem={(item) => saveItem.mutate(item)}
              onDeleteItem={(id) => confirmDelete('Delete this line item?', () => deleteItem.mutate(id))}
              onRenameSection={(name) =>
                saveSection.mutate({ id: section.id, name, sortOrder: section.sortOrder, monthKey: section.monthKey })
              }
              onDeleteSection={() =>
                confirmDelete(`Delete "${section.name}" and all its line items?`, () => deleteSection.mutate(section.id))
              }
            />
          )
        })}

        <Pressable
          style={styles.addSectionButton}
          onPress={() => saveSection.mutate({ name: 'New section', sortOrder: monthSections.length, monthKey: month })}
          disabled={saveSection.isPending}
        >
          <Plus size={15} color={colors.textSoft} />
          <Text style={styles.addSectionText}>Add section</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function SummaryStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, warn && { color: colors.warn }]}>{formatMoney(value)}</Text>
    </View>
  )
}

function SectionBlock({
  section,
  items,
  onAddItem,
  isAddingItem,
  onSaveItem,
  onDeleteItem,
  onRenameSection,
  onDeleteSection,
}: {
  section: BudgetSection
  items: BudgetLineItem[]
  onAddItem: () => void
  isAddingItem: boolean
  onSaveItem: (item: Partial<BudgetLineItem> & { id?: string; sectionId: string }) => void
  onDeleteItem: (id: string) => void
  onRenameSection: (name: string) => void
  onDeleteSection: () => void
}) {
  const total = items.reduce((sum, i) => sum + i.monthlyAmount, 0)
  // RN's TextInput onBlur event carries no `.text` (its nativeEvent is a plain
  // TargetedEvent) — the current value has to be tracked in state via onChangeText
  // and read from there on blur instead.
  const [name, setName] = useState(section.name)

  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <TextInput
          value={name}
          onChangeText={setName}
          onBlur={() => name.trim() && onRenameSection(name.trim())}
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

      <Pressable style={styles.addItemButton} onPress={onAddItem} disabled={isAddingItem}>
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
  // See SectionBlock's `name` state — onBlur's nativeEvent has no `.text`, so each
  // field's current value is tracked via onChangeText and read from state on blur.
  const [name, setName] = useState(item.name)
  const [amount, setAmount] = useState(String(item.monthlyAmount))
  const [miscInfo, setMiscInfo] = useState(item.miscInfo ?? '')
  const [remarks, setRemarks] = useState(item.remarks ?? '')

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemTopRow}>
        <TextInput
          value={name}
          placeholder="Name"
          onChangeText={setName}
          onBlur={() => onSave({ ...item, name })}
          style={[styles.itemInput, { flex: 1.4 }]}
        />
        <TextInput
          value={amount}
          placeholder="Monthly"
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          onBlur={() => onSave({ ...item, monthlyAmount: Number(amount) || 0 })}
          style={[styles.itemInput, { flex: 0.8 }]}
        />
        <Pressable onPress={onDelete} hitSlop={8}>
          <Trash2 size={14} color={colors.textSoft} />
        </Pressable>
      </View>
      <Text style={styles.itemYearly}>{formatMoney(item.monthlyAmount * 12)}/yr</Text>
      <View style={styles.itemBottomRow}>
        <TextInput
          value={miscInfo}
          placeholder="Misc info"
          onChangeText={setMiscInfo}
          onBlur={() => onSave({ ...item, miscInfo: miscInfo || null })}
          style={[styles.itemInput, { flex: 1 }]}
        />
        <TextInput
          value={remarks}
          placeholder="Remarks"
          onChangeText={setRemarks}
          onBlur={() => onSave({ ...item, remarks: remarks || null })}
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
