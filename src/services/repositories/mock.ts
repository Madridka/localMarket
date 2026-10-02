import { conditions, seedChats, seedListings, seedReviews, seedSellers } from '@/data/seed'
import { getCategory, getCategoryPath, isLeafCategory, searchCategories } from '@/data/taxonomy'
import { CURRENT_USER_ID, STORAGE_KEYS } from '@/domain/constants'
import {
  CITY_LOCATIONS,
  createLocationCell,
  getCityLocation,
  normalizeLocationState,
} from '@/domain/location'
import type {
  Category,
  Chat,
  ConditionId,
  EntityId,
  Listing,
  ListingDraft,
  LocationCell,
  Message,
  Review,
  SavedSearch,
  Seller,
} from '@/domain/types'
import type {
  ActivityRepository,
  ListingsRepository,
  MessagingRepository,
  ProfilesRepository,
} from '@/services/repositories/contracts'
import type { StorageAdapter } from '@/services/storage'
import { sameId } from '@/utils/ids'

const currentUser: Seller = {
  id: CURRENT_USER_ID,
  name: 'Вы',
  city: 'Томск',
  rating: null,
  reviewsCount: 0,
  registeredAt: '2026-09-01',
  verifiedPhone: true,
  responseTime: 'Обычно отвечает в течение дня',
}

const legacyCategoryNames: Record<string, string> = {
  phones: 'Смартфоны',
  laptops: 'Ноутбуки',
  computers: 'Настольные компьютеры',
  games: 'Игровые приставки',
  audio: 'Наушники',
  appliances: 'Бытовая техника',
  furniture: 'Кресла',
  shoes: 'Обувь',
  outerwear: 'Куртки',
  jeans: 'Джинсы',
  strollers: 'Коляски',
  toys: 'Игрушки',
  music: 'Музыкальные инструменты',
  collectibles: 'Коллекционные товары',
  photography: 'Фотоаппараты',
  bikes: 'Велосипеды',
  fitness: 'Тренажёры',
  winter: 'Лыжи',
  tires: 'Шины',
  lighting: 'Люстры',
  fragrance: 'Парфюмерия',
  devices: 'Приборы для ухода',
  aquariums: 'Аквариумы',
  books: 'Книги',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function firstLeaf(category: Category | null): Category | null {
  if (!category) return null
  if (!category.children.length) return category
  for (const child of category.children) {
    const leaf = firstLeaf(child)
    if (leaf) return leaf
  }
  return null
}

function migratedCategoryId(source: Record<string, unknown>): string | null {
  const categoryId = String(source.categoryId ?? '')
  if (isLeafCategory(categoryId)) return categoryId
  const oldRoot = String(source.category ?? getCategoryPath(categoryId)[0]?.id ?? '')
  const hint = legacyCategoryNames[String(source.subcategory ?? '')] ?? ''
  const words = [
    ...String(source.title ?? '')
      .split(/[\s,.:()«»]+/)
      .filter((word) => word.length > 4),
    hint,
  ].filter(Boolean)
  for (const word of words) {
    const target = searchCategories(word, 80).find(
      (category) =>
        isLeafCategory(category.id) &&
        (!oldRoot || getCategoryPath(category.id)[0]?.id === oldRoot),
    )
    if (target) return target.id
  }
  return (
    firstLeaf(getCategory(categoryId || oldRoot))?.id ?? firstLeaf(getCategory('other'))?.id ?? null
  )
}

function normalizedCell(value: unknown, cityId: string): LocationCell | null {
  const source = asRecord(value)
  return createLocationCell(source.centerLat, source.centerLng, cityId)
}

export function migrateListing(value: unknown): Listing | null {
  const source = asRecord(value)
  const categoryId = migratedCategoryId(source)
  if (!categoryId) return null
  const city = getCityLocation(source.cityId ?? source.city) ?? CITY_LOCATIONS.tomsk!
  const rawPoint = createLocationCell(source.latitude, source.longitude, city.id)
  const existingCell = normalizedCell(source.locationCell, city.id)
  const numericId = Number(source.id) || 0
  const locationCell =
    existingCell ?? rawPoint ?? createLocationCell(city.centerLat, city.centerLng, city.id)
  const condition = conditions.some((item) => item.id === source.condition)
    ? (source.condition as ConditionId)
    : 'good'
  const attributes = Object.fromEntries(
    Object.entries(asRecord(source.attributes)).map(([key, item]) => [key, String(item)]),
  )
  return {
    id: String(source.id ?? ''),
    title: String(source.title ?? ''),
    description: String(source.description ?? ''),
    price: Number(source.price) || 0,
    categoryId,
    condition,
    cityId: city.id,
    city: city.name,
    regionId: city.regionId,
    address: String(source.address ?? '').trim() || `ул. Ленина, ${((numericId * 7) % 120) + 1}`,
    locationCell,
    sellerId: String(source.sellerId ?? CURRENT_USER_ID),
    images: Array.isArray(source.images)
      ? source.images.filter((image): image is string => typeof image === 'string')
      : [],
    createdAt: String(source.createdAt ?? new Date().toISOString()),
    views: Number(source.views) || 0,
    ...(Object.keys(attributes).length ? { attributes } : {}),
  }
}

function normalizeChat(value: unknown): Chat | null {
  const source = asRecord(value)
  if (source.id === undefined || source.listingId === undefined) return null
  const messages = Array.isArray(source.messages)
    ? source.messages
        .map((message): Message | null => {
          const item = asRecord(message)
          const sender = item.sender === 'seller' ? 'seller' : 'me'
          const text = String(item.text ?? '').trim()
          if (!text) return null
          return {
            sender,
            text,
            timestamp: String(item.timestamp ?? new Date().toISOString()),
          }
        })
        .filter((message): message is Message => Boolean(message))
    : []
  return {
    id: String(source.id),
    listingId: String(source.listingId),
    sellerId: String(source.sellerId ?? ''),
    messages,
    ...(source.createdAt ? { createdAt: String(source.createdAt) } : {}),
  }
}

function requireWrite(storage: StorageAdapter, key: string, value: unknown): void {
  if (!storage.write(key, value)) throw new Error('storage-write-failed')
}

export class MockListingsRepository implements ListingsRepository {
  constructor(private readonly storage: StorageAdapter) {}

  private stored(): Listing[] {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.listings, [])
    if (!Array.isArray(raw)) return []
    const migrated = raw.map(migrateListing).filter((item): item is Listing => Boolean(item))
    if (JSON.stringify(migrated) !== JSON.stringify(raw)) {
      this.storage.write(STORAGE_KEYS.listings, migrated)
    }
    return migrated
  }

  async list(): Promise<Listing[]> {
    const stored = this.stored()
    const storedIds = new Set(stored.map((listing) => listing.id))
    return [...stored, ...seedListings.filter((listing) => !storedIds.has(listing.id))]
  }

  async get(id: EntityId): Promise<Listing | null> {
    return (await this.list()).find((listing) => sameId(listing.id, id)) ?? null
  }

  async create(draft: ListingDraft): Promise<Listing> {
    if (!isLeafCategory(draft.categoryId)) throw new Error('invalid-category')
    const items = this.stored()
    const nextId = String(
      Math.max(1000, ...(await this.list()).map((item) => Number(item.id) || 0)) + 1,
    )
    const created: Listing = {
      ...draft,
      id: nextId,
      sellerId: CURRENT_USER_ID,
      createdAt: new Date().toISOString(),
      views: 0,
    }
    requireWrite(this.storage, STORAGE_KEYS.listings, [created, ...items])
    return created
  }

  async update(id: EntityId, draft: ListingDraft): Promise<Listing | null> {
    if (!isLeafCategory(draft.categoryId)) throw new Error('invalid-category')
    const items = this.stored()
    const index = items.findIndex(
      (item) => sameId(item.id, id) && item.sellerId === CURRENT_USER_ID,
    )
    if (index < 0) return null
    const updated: Listing = { ...items[index]!, ...draft, id: items[index]!.id }
    const next = [...items]
    next[index] = updated
    requireWrite(this.storage, STORAGE_KEYS.listings, next)
    return updated
  }
}

export class MockProfilesRepository implements ProfilesRepository {
  async current(): Promise<Seller> {
    return currentUser
  }

  async get(id: EntityId): Promise<Seller | null> {
    if (sameId(id, CURRENT_USER_ID)) return currentUser
    return seedSellers.find((seller) => sameId(seller.id, id)) ?? null
  }

  async reviews(sellerId: EntityId): Promise<Review[]> {
    return seedReviews.filter((review) => sameId(review.sellerId, sellerId))
  }
}

export class MockMessagingRepository implements MessagingRepository {
  constructor(
    private readonly storage: StorageAdapter,
    private readonly listings: ListingsRepository,
  ) {}

  async list(): Promise<Chat[]> {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.chats, seedChats)
    if (!Array.isArray(raw)) return seedChats
    return raw.map(normalizeChat).filter((chat): chat is Chat => Boolean(chat))
  }

  async ensure(listingId: EntityId): Promise<Chat | null> {
    const listing = await this.listings.get(listingId)
    if (!listing || listing.sellerId === CURRENT_USER_ID) return null
    const chats = await this.list()
    const existing = chats.find((chat) => sameId(chat.listingId, listingId))
    if (existing) return existing
    const created: Chat = {
      id: `chat-${Date.now()}`,
      listingId: listing.id,
      sellerId: listing.sellerId,
      messages: [],
      createdAt: new Date().toISOString(),
    }
    requireWrite(this.storage, STORAGE_KEYS.chats, [created, ...chats])
    return created
  }

  async send(chatId: EntityId, text: string): Promise<Chat | null> {
    const message = text.trim()
    if (!message) return null
    const chats = await this.list()
    const index = chats.findIndex((chat) => sameId(chat.id, chatId))
    if (index < 0) return null
    const updated: Chat = {
      ...chats[index]!,
      messages: [
        ...chats[index]!.messages,
        { sender: 'me', text: message, timestamp: new Date().toISOString() },
      ],
    }
    const next = [...chats]
    next[index] = updated
    requireWrite(this.storage, STORAGE_KEYS.chats, next)
    return updated
  }
}

export class MockActivityRepository implements ActivityRepository {
  constructor(private readonly storage: StorageAdapter) {}

  async favorites(): Promise<EntityId[]> {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.favorites, ['2', '9', '17'])
    return Array.isArray(raw) ? raw.map(String) : []
  }

  async setFavorite(id: EntityId, active: boolean): Promise<EntityId[]> {
    const items = await this.favorites()
    const next = active
      ? [...items.filter((item) => !sameId(item, id)), String(id)]
      : items.filter((item) => !sameId(item, id))
    requireWrite(this.storage, STORAGE_KEYS.favorites, next)
    return next
  }

  async recent(): Promise<EntityId[]> {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.recent, [])
    return Array.isArray(raw) ? raw.map(String) : []
  }

  async markViewed(id: EntityId): Promise<EntityId[]> {
    const items = [String(id), ...(await this.recent()).filter((item) => !sameId(item, id))].slice(
      0,
      5,
    )
    requireWrite(this.storage, STORAGE_KEYS.recent, items)
    return items
  }

  async recentSearches(): Promise<string[]> {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.searches, [])
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : []
  }

  async addRecentSearch(query: string): Promise<string[]> {
    const trimmed = query.trim()
    if (!trimmed) return this.recentSearches()
    const items = [
      trimmed,
      ...(await this.recentSearches()).filter(
        (item) => item.toLowerCase() !== trimmed.toLowerCase(),
      ),
    ].slice(0, 5)
    requireWrite(this.storage, STORAGE_KEYS.searches, items)
    return items
  }

  async savedSearches(): Promise<SavedSearch[]> {
    const raw = this.storage.read<unknown>(STORAGE_KEYS.savedSearches, [])
    if (!Array.isArray(raw)) return []
    return raw.map((value) => {
      const source = asRecord(value)
      return {
        query: String(source.query ?? ''),
        category: String(source.category ?? ''),
        min: String(source.min ?? ''),
        max: String(source.max ?? ''),
        conditions: Array.isArray(source.conditions)
          ? source.conditions.filter((item): item is ConditionId =>
              conditions.some((condition) => condition.id === item),
            )
          : [],
        location: normalizeLocationState(source.location),
        sort: ['recommended', 'distance', 'newest', 'price-asc', 'price-desc'].includes(
          String(source.sort),
        )
          ? (source.sort as SavedSearch['sort'])
          : 'recommended',
      }
    })
  }

  async setSavedSearch(search: SavedSearch, active: boolean): Promise<SavedSearch[]> {
    const serialized = JSON.stringify(search)
    const items = await this.savedSearches()
    const next = active
      ? [search, ...items.filter((item) => JSON.stringify(item) !== serialized)].slice(0, 15)
      : items.filter((item) => JSON.stringify(item) !== serialized)
    requireWrite(this.storage, STORAGE_KEYS.savedSearches, next)
    return next
  }
}
