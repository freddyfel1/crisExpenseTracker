import 'react-native-get-random-values'
import { useState } from 'react'
import { ActivityIndicator, Alert, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { Camera as CameraIcon, Image as ImageIcon } from 'lucide-react-native'
import { v4 as uuidv4 } from 'uuid'
import { parseReceipt, uploadReceiptPhoto } from '../../src/data/api'
import { useSaveTransaction } from '../../src/hooks/useAppData'
import { useSession } from '../../src/hooks/useSession'
import { colors } from '../../src/theme'

export default function Capture() {
  const { session } = useSession()
  const router = useRouter()
  const saveTransaction = useSaveTransaction()
  const [preview, setPreview] = useState<string | null>(null)
  const [stage, setStage] = useState<'idle' | 'uploading' | 'reading'>('idle')

  const handleImage = async (uri: string) => {
    if (!session) return
    setPreview(uri)
    setStage('uploading')
    try {
      const path = await uploadReceiptPhoto(session.user.id, uri)
      const id = uuidv4()
      await saveTransaction.mutateAsync({
        id,
        merchant: 'New receipt',
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        categoryId: null,
        tags: [],
        receiptImagePath: path,
      })

      setStage('reading')
      try {
        const parsed = await parseReceipt(path)
        if (!parsed.error) {
          await saveTransaction.mutateAsync({
            id,
            merchant: parsed.merchant || 'New receipt',
            amount: parsed.amount ?? 0,
            date: parsed.date ?? new Date().toISOString().slice(0, 10),
            categoryId: parsed.categoryId ?? null,
            tax: parsed.tax ?? null,
            tip: parsed.tip ?? null,
            tags: [],
            receiptImagePath: path,
          })
        }
      } catch {
        // Auto-extraction is best-effort — the blank transaction we already saved
        // is still there for the user to fill in by hand.
      }

      router.push(`/transaction/${id}`)
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setStage('idle')
      setPreview(null)
    }
  }

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access in Settings to photograph receipts.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true })
    if (!result.canceled) await handleImage(result.assets[0].uri)
  }

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Enable photo library access in Settings to attach a receipt.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true })
    if (!result.canceled) await handleImage(result.assets[0].uri)
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Capture a receipt</Text>
        <Text style={styles.subtitle}>
          Snap a photo — Claude reads the merchant, amount, and category for you. You'll get a
          chance to review and fix anything before it's saved.
        </Text>

        {preview && (
          <Image source={{ uri: preview }} style={styles.preview} />
        )}

        {stage !== 'idle' ? (
          <View style={{ marginTop: 24, alignItems: 'center', gap: 8 }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.subtitle}>
              {stage === 'uploading' ? 'Uploading photo…' : 'Reading receipt…'}
            </Text>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={takePhoto}>
              <CameraIcon size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={pickPhoto}>
              <ImageIcon size={18} color={colors.text} />
              <Text style={styles.secondaryButtonText}>Choose from library</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  content: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 22, fontWeight: '600', color: colors.ink, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSoft, textAlign: 'center', lineHeight: 19, marginBottom: 12 },
  preview: { width: 160, height: 160, borderRadius: 12, marginBottom: 12 },
  actions: { width: '100%', gap: 10 },
  primaryButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600', fontSize: 15 },
})
