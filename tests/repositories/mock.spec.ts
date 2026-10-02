import type { ListingDraft } from '@/domain/types'
import {
  MockActivityRepository,
  MockListingsRepository,
  migrateListing,
} from '@/services/repositories/mock'
import type { StorageAdapter } from '@/services/storage'

class MemoryStorage implements StorageAdapter {
  values = new Map<string, string>()

  read<T>(key: string, fallback: T): T {
    const value = this.values.get(key)
    return value === undefined ? fallback : (JSON.parse(value) as T)
  }

  write<T>(key: string, value: T): boolean {
    this.values.set(key, JSON.stringify(value))
    return true
  }

  remove(key: string): void {
    this.values.delete(key)
  }
}

const draft: ListingDraft = {
  title: 'Тестовое объявление',
  description: 'Описание',
  price: 1000,
  categoryId: 'ram-ddr5',
  condition: 'good',
  cityId: 'tomsk',
  city: 'Томск',
  regionId: 'tomsk-oblast',
  address: 'ул. Ленина, 41',
  locationCell: { id: 'tomsk-cell', centerLat: 56.46, centerLng: 84.95 },
  images: ['data:image/png;base64,abc'],
}

describe('mock repositories', () => {
  it('migrates legacy categories and strips precise coordinates', () => {
    const listing = migrateListing({
      id: 1002,
      sellerId: 0,
      title: 'Старая оперативная память',
      description: 'Работает',
      price: 1000,
      category: 'electronics',
      subcategory: 'computers',
      condition: 'good',
      city: 'Томск',
      latitude: 56.58823,
      longitude: 84.95123,
      images: [],
    })

    expect(listing?.categoryId).toBeTruthy()
    expect(listing?.id).toBe('1002')
    expect(listing).not.toHaveProperty('latitude')
    expect(listing).not.toHaveProperty('areaId')
    expect(listing?.address).toBe('ул. Ленина, 55')
    expect(listing?.locationCell?.centerLat).toBe(56.586)
  })

  it('creates and updates only persisted user listings', async () => {
    const storage = new MemoryStorage()
    const repository = new MockListingsRepository(storage)
    const created = await repository.create(draft)
    const updated = await repository.update(created.id, { ...draft, title: 'Обновлено' })

    expect(created.sellerId).toBe('0')
    expect(updated?.title).toBe('Обновлено')
    expect((await repository.list()).some((item) => item.title === 'Обновлено')).toBe(true)
  })

  it('normalizes numeric favorite ids', async () => {
    const storage = new MemoryStorage()
    storage.write('ryadom.favorites.v1', [2, 9])
    const repository = new MockActivityRepository(storage)

    expect(await repository.favorites()).toEqual(['2', '9'])
  })
})
