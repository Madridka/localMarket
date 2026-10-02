export type EntityId = string

export type ConditionId = 'new' | 'excellent' | 'good' | 'fair'
export type SortMode = 'recommended' | 'distance' | 'newest' | 'price-asc' | 'price-desc'

export interface LocationCell {
  id: string
  centerLat: number
  centerLng: number
}

export interface City {
  id: string
  name: string
  genitive: string
  dative: string
  prepositional: string
  regionId: string
  centerLat: number
  centerLng: number
}

export interface LocationState {
  cityId: string
  city: string
  radiusKm: number
}

export interface Condition {
  id: ConditionId
  label: string
}

export interface CategoryAttribute {
  id: string
  label: string
  type: 'text' | 'number' | 'select'
  options?: string[]
}

export interface Category {
  id: string
  name: string
  slug: string
  children: Category[]
  searchAliases?: string[]
  attributes?: CategoryAttribute[]
  path?: Category[]
}

export interface Listing {
  id: EntityId
  title: string
  description: string
  price: number
  categoryId: string
  condition: ConditionId
  cityId: string
  city: string
  regionId: string
  address: string
  locationCell: LocationCell | null
  sellerId: EntityId
  images: string[]
  createdAt: string
  views: number
  attributes?: Record<string, string>
}

export type ListingDraft = Omit<Listing, 'id' | 'sellerId' | 'createdAt' | 'views'>

export interface Seller {
  id: EntityId
  name: string
  city: string
  rating: number | null
  reviewsCount: number
  registeredAt: string
  verifiedPhone: boolean
  responseTime: string
  avatar?: string
}

export interface Review {
  id: EntityId
  sellerId: EntityId
  author: string
  rating: number
  text: string
  createdAt: string
}

export interface Message {
  sender: 'me' | 'seller'
  text: string
  timestamp: string
}

export interface Chat {
  id: EntityId
  listingId: EntityId
  sellerId: EntityId
  messages: Message[]
  createdAt?: string
}

export interface CatalogQuery {
  query: string
  category: string
  min: string
  max: string
  conditions: ConditionId[]
  location: LocationState
  sort: SortMode
}

export type SavedSearch = CatalogQuery
