import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors } from '../theme'

export function ConnectSupabaseScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Connect Supabase</Text>
        <Text style={styles.body}>
          This app needs a Supabase project to store transactions, categories, and budgets — the
          same database the web dashboard uses.
        </Text>
        <View style={styles.step}>
          <Text style={styles.stepTitle}>1. Create a project</Text>
          <Text style={styles.body}>Free tier at supabase.com.</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepTitle}>2. Run the migration</Text>
          <Text style={styles.body}>supabase/migrations/0001_init.sql, via the SQL Editor.</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepTitle}>3. Add credentials</Text>
          <Text style={styles.body}>
            Create mobile/.env with EXPO_PUBLIC_SUPABASE_URL and{'\n'}EXPO_PUBLIC_SUPABASE_ANON_KEY,
            then restart the dev server.
          </Text>
        </View>
        <Text style={styles.footnote}>Full steps: supabase/README.md</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 24, gap: 16 },
  title: { fontSize: 26, fontWeight: '600', color: colors.ink },
  body: { fontSize: 14, color: colors.text, lineHeight: 20 },
  step: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  stepTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  footnote: { fontSize: 12, color: colors.textSoft, marginTop: 8 },
})
