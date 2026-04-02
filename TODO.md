# TrailStr — Master Task List

## Phase 1: Project Scaffolding
- [x] Create GitHub repo `trailstr`
- [x] **Task 1:** Vite + React 18 + TypeScript + Tailwind CSS 3 setup
- [x] **Task 2:** React Router v6 shell with all placeholder pages (Feed, ActivityDetail, RecordActivity, ImportActivities, TrailExplorer, TrailDetail, CreateTrail, Profile, Settings, Login)
- [x] **Task 3:** Layout components (Shell, BottomNav, TopNav) with mobile-first responsive navigation
- [x] **Task 4:** Common components (Avatar, BlurhashImage, StarRating, Skeleton)

## Phase 2: Nostr Auth & Identity
- [x] **Task 5:** Nostr client module — relay pool management, subscribe, publish (`src/nostr/client.ts`)
- [x] **Task 6:** Signer abstraction — NIP-07 + nsec with AES-256-GCM encryption (`src/nostr/signer.ts`)
- [x] **Task 7:** Auth store (Zustand) + Login page with all 3 auth methods (NIP-07, nsec paste, generate keypair)
- [x] **Task 8:** Kind constants + event builder helpers (`src/nostr/kinds.ts`, `src/nostr/events.ts`)

## Phase 3: Profile
- [x] **Task 9:** Profile page — fetch/display kind-0 metadata, avatar, banner, bio, tabs structure
- [x] **Task 10:** Profile edit form — update kind-0 metadata and publish

## Phase 4: Activity Creation (Manual)
- [x] **Task 11:** Zustand stores for feed and trails (`feedStore.ts`, `trailStore.ts`, `relayStore.ts`)
- [x] **Task 12:** RecordActivity page — manual form for kind-30531 (title, type, date, distance, duration, elevation, notes)
- [x] **Task 13:** Publish activity to relays, optimistic UI

## Phase 5: Activity Feed
- [x] **Task 14:** ActivityCard component (avatar, title, mini map, stats, reaction/comment counts)
- [x] **Task 15:** Feed page — fetch kind-30531 from followed users, infinite scroll with `until`/`limit` pagination

## Phase 6: Activity Detail
- [x] **Task 16:** MapView component with MapLibre GL JS + OpenFreeMap tiles
- [x] **Task 17:** TrackLayer — render GPS track as colored polyline (pace/HR/elevation toggle)
- [x] **Task 18:** ElevationChart with Recharts — synced hover with map marker
- [x] **Task 19:** StatsGrid component
- [x] **Task 20:** ActivityDetail page — full map, elevation chart, stats, photos, social section

## Phase 7: GPS File Import
- [x] **Task 21:** GPX parser (`src/components/import/parsers/gpx.ts`)
- [x] **Task 22:** FIT parser (`src/components/import/parsers/fit.ts`)
- [x] **Task 23:** TCX parser (`src/components/import/parsers/tcx.ts`)
- [x] **Task 24:** FileDropZone + ActivityPreviewList components
- [x] **Task 25:** ImportActivities page — bulk import flow with progress bar

## Phase 8: Social Layer
- [x] **Task 26:** ReactionBar — kind-7 reactions with emoji support (🥾👟🔥)
- [x] **Task 27:** CommentThread — kind-1 replies with threading
- [x] **Task 28:** FollowButton — kind-3 contact list management
- [x] **Task 29:** ZapButton — NIP-57 zap integration (if lightning address present)

## Phase 9: Photo Uploads
- [ ] **Task 30:** NIP-96 media upload module (`src/nostr/nip96.ts`)
- [ ] **Task 31:** Client-side photo resize + blurhash generation
- [ ] **Task 32:** PhotoGallery component with lightbox + geotagged photo map highlights

## Phase 10: Trail Creation & Explorer
- [ ] **Task 33:** CreateTrail page — form + polyline drawing tool / GPX upload for route
- [ ] **Task 34:** Trail events (kind-30530) — publish/edit
- [ ] **Task 35:** TrailExplorer page — full-screen map with clustered trail markers
- [ ] **Task 36:** Geohash-based filtering (NIP-52 `g` tag prefix matching) for map viewport
- [ ] **Task 37:** TrailDetail page — hero image, map, stats, reviews tab, activities tab

## Phase 11: Trail Reviews
- [ ] **Task 38:** ReviewForm + ReviewList components
- [ ] **Task 39:** Kind-30532 review events — one per user per trail, rating aggregation

## Phase 12: Notifications
- [ ] **Task 40:** Real-time subscription for `#p` tagged events (reactions, comments, follows, zaps)
- [ ] **Task 41:** Notification bell with unread count + dropdown list

## Phase 13: Offline & Caching
- [ ] **Task 42:** IndexedDB cache with Dexie — cache own + followed users' events
- [ ] **Task 43:** Service worker — cache app shell, map tiles, stale-while-revalidate for relay data

## Phase 14: Live Recording (Stretch)
- [ ] **Task 44:** Geolocation API live track recording with live map + running stats
- [ ] **Task 45:** Pause/Resume/Stop & Save controls, create kind-30531 from recorded data

## Phase 15: Polish
- [ ] **Task 46:** Dark mode toggle with Tailwind dark classes
- [ ] **Task 47:** Empty states with illustrations + CTAs
- [ ] **Task 48:** Error handling, loading skeletons, animations
- [ ] **Task 49:** Accessibility pass — semantic HTML, ARIA labels, keyboard nav, color contrast
- [ ] **Task 50:** Mobile UX tuning — touch interactions, bottom sheet refinements

## Utility Modules (built as needed)
- `src/utils/geo.ts` — geohash computation, distance calculations
- `src/utils/units.ts` — metric/imperial conversion
- `src/utils/time.ts` — duration formatting
- `src/utils/stats.ts` — aggregate stat calculations
- `src/types/activity.ts`, `trail.ts`, `review.ts` — TypeScript type definitions
