import type {
  Chat,
  EntityId,
  Listing,
  ListingDraft,
  Review,
  SavedSearch,
  Seller,
} from '@/domain/types'

export interface ListingsRepository {
  list(): Promise<Listing[]>
  get(id: EntityId): Promise<Listing | null>
  create(draft: ListingDraft): Promise<Listing>
  update(id: EntityId, draft: ListingDraft): Promise<Listing | null>
}

export interface ProfilesRepository {
  current(): Promise<Seller>
  get(id: EntityId): Promise<Seller | null>
  reviews(sellerId: EntityId): Promise<Review[]>
}

export interface MessagingRepository {
  list(): Promise<Chat[]>
  ensure(listingId: EntityId): Promise<Chat | null>
  send(chatId: EntityId, text: string): Promise<Chat | null>
}

export interface ActivityRepository {
  favorites(): Promise<EntityId[]>
  setFavorite(id: EntityId, active: boolean): Promise<EntityId[]>
  recent(): Promise<EntityId[]>
  markViewed(id: EntityId): Promise<EntityId[]>
  recentSearches(): Promise<string[]>
  addRecentSearch(query: string): Promise<string[]>
  savedSearches(): Promise<SavedSearch[]>
  setSavedSearch(search: SavedSearch, active: boolean): Promise<SavedSearch[]>
}
