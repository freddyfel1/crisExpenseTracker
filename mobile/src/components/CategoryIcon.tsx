import * as Icons from 'lucide-react-native'
import type { LucideProps, LucideIcon } from 'lucide-react-native'

interface Props extends LucideProps {
  name: string
}

export function CategoryIcon({ name, ...rest }: Props) {
  const Icon = (Icons as unknown as Record<string, LucideIcon>)[name] ?? Icons.CircleDashed
  return <Icon {...rest} />
}
