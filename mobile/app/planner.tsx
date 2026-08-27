import 'react-native-get-random-values'
import { useState } from 'react'
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Plus, Trash2 } from 'lucide-react-native'
import { v4 as uuidv4 } from 'uuid'
import {
  useBudgetLineItems,
  useBudgetSections,
  useDeleteBudgetLineItem,
  useDeleteBudgetSection,
  useProfile,
  useSaveBudgetLineItem,
  useSaveBudgetSection,
  useUpdateProfile,
} from '../src/hooks/useAppData'
import type { BudgetLineItem } from '../src/types'
import { formatMoney } from '../src/utils/format'
import { colors } from '../src/theme'

export default function Planner() {
  const profile = useProfile()
  const sections = useBudgetSections()
  const items = useBudgetLineItems()
  const updateProfile = useUpdateProfile()
  const saveSection = useSaveBudgetSection()
  const deleteSection = useDeleteBudgetSection()
  const saveItem = useSaveBudgetLineItem()
  const deleteItem = useDeleteBudgetLineItem()

  if (!profile.data || !sections.data || !items.data) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    )
  }

  const sortedSections = [...sections.data].sort((a, b) => a.sortOrder - b.sortOrder)
  const totalPlanned = items.data.reduce((sum, i) => sum + i.monthlyAmount, 0)
  const leftover = profile.data.monthlyIncome - profile.data.monthlySavings - totalPlanned

  const addSection = () => {
    saveSection.mutate({ id: uuidv4(), name: 'New section', sortOrder: sortedSections.length })
  }

  const addItem = (sectionId: string) => {
    const sortOrder = items.data.filter((i) => i.sectionId === sectionId).length
    saveItem.mutate({
      id: uuidv4(),
      sectionId,
      name: 'New item',
      monthlyAmount: 0,
      miscInfo: null,
      remarks: null,
      sortOrder,
    })
  }

  const confirmDeleteSection = (id: string) => {
    Alert.alert('Delete section', 'This removes all its items too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteSection.mutate(id) },
    ])
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Income & savings</Text>
          <MoneyField
            label="Monthly income"
            value={profile.data.monthlyIncome}
            onCommit={(v) => updateProfile.mutate({ monthlyIncome: v })}
          />
          <MoneyField
            label="Savings goal"
            value={profile.data.monthlySavings}
            onCommit={(v) => updateProfile.mutate({ monthlySavings: v })}
          />
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Planned expenses</Text>
            <Text style={styles.statValue}>{formatMoney(totalPlanned)}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Leftover</Text>
            <Text style={[styles.statValue, { color: leftover < 0 ? colors.warn : colors.primary }]}>
              {formatMoney(leftover)}
            </Text>
          </View>
        </View>

        {sortedSections.map((section) => {
          const sectionItems = items.data
            .filter((i) => i.sectionId === section.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          const sectionTotal = sectionItems.reduce((sum, i) => sum + i.monthlyAmount, 0)

          return (
            <View key={section.id} style={styles.card}>
              <View style={styles.sectionHeader}>
                <TextInput
                  style={styles.sectionName}
                  defaultValue={section.name}
                  onEndEditing={(e) => {
                    const name = e.nativeEvent.text.trim()
                    if (name) saveSection.mutate({ ...section, name })
                  }}
                />
                <Text style={styles.sectionTotal}>{formatMoney(sectionTotal)}</Text>
                <Pressable onPress={() => confirmDeleteSection(section.id)} hitSlop={8}>
                  <Trash2 size={16} color={colors.warn} />
                </Pressable>
              </View>

              {sectionItems.map((item) => (
                <LineItemRow key={item.id} item={item} onSave={saveItem.mutate} onDelete={deleteItem.mutate} />
              ))}

              <Pressable style={styles.addItem} onPress={() => addItem(section.id)}>
                <Plus size={14} color={colors.primary} />
                <Text style={styles.addItemText}>Add item</Text>
              </Pressable>
            </View>
          )
        })}

        <Pressable style={styles.addSection} onPress={addSection}>
          <Plus size={16} color={colors.text} />
          <Text style={styles.addSectionText}>Add section</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

function MoneyField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        defaultValue={String(value)}
        onEndEditing={(e) => onCommit(Number(e.nativeEvent.text) || 0)}
      />
    </View>
  )
}

function LineItemRow({
  item,
  onSave,
  onDelete,
}: {
  item: BudgetLineItem
  onSave: (i: BudgetLineItem) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <View style={styles.item}>
      <View style={styles.itemMainRow}>
        <TextInput
          style={[styles.input, styles.itemName]}
          defaultValue={item.name}
          onEndEditing={(e) => {
            const name = e.nativeEvent.text.trim()
            if (name) onSave({ ...item, name })
          }}
        />
        <TextInput
          style={[styles.input, styles.itemAmount]}
          keyboardType="decimal-pad"
          defaultValue={String(item.monthlyAmount)}
          onEndEditing={(e) => onSave({ ...item, monthlyAmount: Number(e.nativeEvent.text) || 0 })}
        />
        <Pressable onPress={() => onDelete(item.id)} hitSlop={8}>
          <Trash2 size={15} color={colors.warn} />
        </Pressable>
      </View>

      <Pressable onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.itemDetailsToggle}>{expanded ? 'Hide details' : 'Misc info / remarks'}</Text>
      </Pressable>

      {expanded && (
        <View style={{ gap: 8 }}>
          <TextInput
            style={styles.input}
            placeholder="Misc info"
            placeholderTextColor={colors.textSoft}
            defaultValue={item.miscInfo ?? ''}
            onEndEditing={(e) => onSave({ ...item, miscInfo: e.nativeEvent.text || null })}
          />
          <TextInput
            style={styles.input}
            placeholder="Remarks"
            placeholderTextColor={colors.textSoft}
            defaultValue={item.remarks ?? ''}
            onEndEditing={(e) => onSave({ ...item, remarks: e.nativeEvent.text || null })}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20, gap: 16, paddingBottom: 48 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.ink, marginBottom: 4 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textSoft },
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
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 12.5, color: colors.textSoft },
  statValue: { fontSize: 15, fontWeight: '600', color: colors.ink },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionName: { flex: 1, fontSize: 15, fontWeight: '600', paddingVertical: 4, paddingHorizontal: 0, borderWidth: 0 },
  sectionTotal: { fontSize: 13, color: colors.textSoft },
  item: {
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  itemMainRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemName: { flex: 1 },
  itemAmount: { width: 90 },
  itemDetailsToggle: { fontSize: 12, color: colors.primary },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  addItemText: { fontSize: 12.5, fontWeight: '600', color: colors.primary },
  addSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
  },
  addSectionText: { fontSize: 13, fontWeight: '600', color: colors.text },
})
