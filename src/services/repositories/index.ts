import {
  MockActivityRepository,
  MockListingsRepository,
  MockMessagingRepository,
  MockProfilesRepository,
} from '@/services/repositories/mock'
import { storage } from '@/services/storage'

export const listingsRepository = new MockListingsRepository(storage)
export const profilesRepository = new MockProfilesRepository()
export const messagingRepository = new MockMessagingRepository(storage, listingsRepository)
export const activityRepository = new MockActivityRepository(storage)
