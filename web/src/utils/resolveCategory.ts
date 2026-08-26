import type { Category } from '../types'

export const UNCATEGORIZED: Category = {
  id: '',
  name: 'Uncategorized',
  icon: 'CircleDashed',
  color: '#7c8175',
}

export const resolveCategory = (categories: Category[], id: string | null): Category =>
  categories.find((c) => c.id === id) ?? UNCATEGORIZED
