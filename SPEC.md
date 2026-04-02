# Agent Prompt: Build "TrailStr" — A Trail & Activity Social App on Nostr

You are building a full-featured web application called **TrailStr** that combines the best of Strava (activity tracking, social feed, kudos) and AllTrails (trail discovery, reviews, photos) into a single unified experience. **All data persistence uses the Nostr protocol** — there is no traditional backend database. The user's Nostr identity (nsec/npub keypair) is their account, and all content is published as signed Nostr events to relays.

---

## 1. Tech Stack

- **Frontend:** React 18+ with TypeScript, Vite bundler
- **Routing:** React Router v6
- **Styling:** Tailwind CSS 3+
- **Maps:** MapLibre GL JS with OpenFreeMap or Protomaps tile source (no API key required). Fallback: Leaflet + OpenStreetMap tiles
- **Charts:** Recharts (for elevation profiles, pace charts, heart rate overlays)
- **Nostr:** `nostr-tools` npm package (event creation, signing, relay communication, NIP support)
- **GPS file parsing:** `gpx-parser-builder` and `@tmcw/togeojson` (for GPX/TCX/FIT import)
- **FIT file parsing:** `fit-file-parser` npm package (for Garmin .FIT files)
- **Photo handling:** Browser-native canvas API for resizing; photos are uploaded to a Nostr-compatible media host (see §6)
- **State management:** Zustand
- **Offline support:** Service worker + IndexedDB cache of own events

---

## 2. Nostr Identity & Auth

### 2.1 Login / Account Creation
- Support three auth methods:
  1. **NIP-07 browser extension** (e.g., nos2x, Alby) — preferred path; call `window.nostr.getPublicKey()` and `window.nostr.signEvent()`
  2. **nsec paste** — user pastes their nsec; derive the pubkey locally. Store the nsec ONLY in memory or in an encrypted local store (prompt user for a passphrase that encrypts the nsec via AES-256-GCM before writing to localStorage). Show prominent warnings about nsec handling.
  3. **Generate new keypair** — generate a fresh keypair via `nostr-tools/pure`, display the nsec ONCE with a "copy & save" prompt, then treat it the same as option 2.
- On successful auth, fetch the user's kind-0 profile metadata from relays and display their display name and avatar throughout the app.

### 2.2 Profile Editing
- Let the user update their kind-0 metadata (display_name, about, picture, banner, nip05, lud16). Publish the updated event to relays.

### 2.3 Relay Management
- Default relay list: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`, `wss://relay.primal.net`
- UI to add/remove relays and set read/write preferences (NIP-65 relay list, kind 10002).
- All publishes go to all write-relays; all reads merge from all read-relays and deduplicate by event id.

---

## 3. Nostr Event Schema Design

Define the following **custom parameterized replaceable and regular event kinds** using kinds in the 30000–39999 range (parameterized replaceable) and 1000–9999 range (regular) as appropriate. Use NIP-33 conventions for the replaceable ones. Tag extensively so events are filterable.

### 3.1 Trail Definition — kind 30530 (parameterized replaceable)
A trail is a describable route that anyone can create, edit (their own), and others can review.

```jsonc
{
  "kind": 30530,
  "tags": [
    ["d", "<unique-slug e.g. 'torrey-pines-loop'>"],
    ["name", "Torrey Pines State Reserve Loop"],
    ["summary", "Coastal bluff trail with ocean views..."],
    ["difficulty", "moderate"],          // easy | moderate | hard | expert
    ["trail_type", "loop"],              // loop | out-and-back | point-to-point
    ["distance_m", "10200"],             // meters
    ["elevation_gain_m", "230"],         // meters
    ["location", "San Diego, CA, US"],
    ["g", "<geohash of trailhead>"],     // NIP-52 geohash for geo queries
    ["L", "run"],                        // activity namespace label
    ["l", "hike", "run"],               // activity types this trail supports
    ["l", "walk", "run"],
    ["l", "trail_run", "run"],
    ["image", "<url>", "<blurhash>"],    // hero image
    ["published_at", "<unix-timestamp>"],
    // The trail's reference GPS track stored as an attached GeoJSON URL:
    ["route", "<url-to-geojson-file-on-media-host>"]
  ],
  "content": "Full markdown description of the trail. ## Directions\n\nPark at the south lot..."
}
```

### 3.2 Activity / Tracked Workout — kind 30531 (parameterized replaceable)
Represents a single completed activity (walk, hike, run, bike ride).

```jsonc
{
  "kind": 30531,
  "tags": [
    ["d", "<uuid>"],
    ["type", "hike"],                      // hike | walk | run | trail_run | bike | ...
    ["title", "Morning hike at Torrey Pines"],
    ["started_at", "<unix-timestamp>"],
    ["finished_at", "<unix-timestamp>"],
    ["elapsed_s", "5400"],                 // total elapsed seconds
    ["moving_s", "4800"],                  // moving time seconds
    ["distance_m", "10050"],
    ["elevation_gain_m", "225"],
    ["elevation_loss_m", "225"],
    ["avg_pace_s_per_km", "360"],
    ["avg_hr_bpm", "132"],                 // optional heart rate
    ["calories", "480"],                   // optional
    ["source", "garmin"],                  // import source identifier
    ["g", "<geohash>"],
    // Link to the trail if one exists:
    ["a", "30530:<trail-author-pubkey>:<trail-d-tag>", "<relay-hint>"],
    // GPS track + optional streams (HR, cadence) as attached file:
    ["track", "<url-to-geojson-or-gpx>"],
    // Photos attached to this activity:
    ["image", "<url1>", "<blurhash>"],
    ["image", "<url2>", "<blurhash>"],
    ["published_at", "<unix-timestamp>"]
  ],
  "content": "Optional user notes about the activity in markdown."
}
```

### 3.3 Trail Review / Rating — kind 30532 (parameterized replaceable)
One review per user per trail (the `d` tag encodes the trail reference so it's replaceable).

```jsonc
{
  "kind": 30532,
  "tags": [
    ["d", "review:<trail-author-pubkey>:<trail-d-tag>"],
    ["a", "30530:<trail-author-pubkey>:<trail-d-tag>", "<relay-hint>"],
    ["rating", "4"],                     // integer 1-5
    ["hiked_on", "<unix-timestamp>"],
    ["conditions", "muddy"],             // optional tags
    ["image", "<url>", "<blurhash>"],    // review photos
    ["image", "<url2>", "<blurhash>"]
  ],
  "content": "Great trail but the north section was washed out after the rain..."
}
```

### 3.4 Social Interactions
Use standard Nostr NIPs wherever possible:

| Feature | Nostr mechanism |
|---|---|
| **Follow** | kind 3 contact list (NIP-02) |
| **Reaction / Kudos** | kind 7 reaction (NIP-25): `+` emoji or custom emoji like 🥾👟🔥 referencing the activity's event id via `e` tag |
| **Comment** | kind 1 note (NIP-01) with an `e` tag referencing the activity or review, plus a root marker so threads work |
| **Repost / Share** | kind 6 repost (NIP-18) of the activity event |
| **Zap (tip)** | kind 9735 zap receipt (NIP-57) — if the user has a Lightning address in their profile, show a ⚡ zap button on activities |
| **DM** | kind 4 encrypted DM (NIP-04) or kind 1059 gift-wrap (NIP-17) for private messaging |

---

## 4. Core Feature Screens

### 4.1 Activity Feed (Home)
- Reverse-chronological feed of kind-30531 activities from people the user follows (fetch follow list from kind-3, then subscribe to those pubkeys' kind-30531 events).
- Each feed card shows: user avatar + name, activity title, mini map thumbnail of the GPS track, key stats (distance, elevation, moving time, pace), photo thumbnails (if any), reaction count, comment count.
- Tapping a card opens the full Activity Detail view.
- Infinite scroll with relay pagination (use `until` and `limit` filters).
- Pull-to-refresh on mobile.

### 4.2 Activity Detail
- Large interactive map (MapLibre) rendering the GPS track as a colored polyline. Color-code by pace, heart rate, or elevation — let the user toggle.
- Elevation profile chart (Recharts area chart) below the map. If HR data exists, overlay it.
- Stats grid: distance, moving time, elapsed time, avg pace, avg HR, calories, elevation gain/loss.
- Photo gallery — tapping a geotagged photo highlights its position on the map.
- Social section: list of reactions (with emoji breakdown), threaded comments. Input box to add a reaction or comment. Zap button.
- "Link to Trail" button — if the activity is linked to a kind-30530 trail, show a link to the Trail Detail page. If not linked, offer a search to link it.
- Edit/delete controls (only for own activities).

### 4.3 Record Activity (Manual)
- Form to manually create a kind-30531 event: title, type dropdown, date/time, distance, duration, elevation, notes.
- Drag-and-drop or file-picker to attach a GPX/TCX/FIT file; parse it client-side and extract the track, distance, elevation, timestamps, HR stream.
- Photo upload (multi-select).
- Optional: link to an existing trail via search.
- "Publish" signs the event and publishes to relays.

### 4.4 Live Record (Stretch Goal)
- Use the browser Geolocation API (watchPosition) to record a live GPS track.
- Show a live-updating map and running stats (distance, elapsed time, current pace).
- "Pause" / "Resume" / "Stop & Save" controls.
- On save, create the kind-30531 event from the recorded data.

### 4.5 Import from Wearables
This is critical for adoption. Support importing tracked activities from:

| Source | Method |
|---|---|
| **Garmin** | Bulk export: user downloads a ZIP from Garmin Connect's "Export Your Data" feature, or individual .FIT files. Parse .FIT client-side with `fit-file-parser`. Also support Garmin's `.gpx` exports. |
| **Apple Watch / Apple Health** | User exports a workout as a `.gpx` file from Apple Health or uses an app like HealthFit to export `.fit`. Parse client-side. |
| **Fitbit** | User exports from Fitbit settings → "Export Your Data". Parse the relevant `.tcx` files. |
| **Strava** | User requests a bulk export from Strava's settings (GDPR export). Parse the resulting `.gpx` and `.fit` files from the ZIP. Also accept individual GPX downloads from Strava activity pages. |
| **Generic GPX/TCX/FIT** | Drag-and-drop any standard file; auto-detect format and parse. |

**Import flow:**
1. User opens Import screen, drags files or selects a ZIP/folder.
2. App extracts and parses all activity files client-side. Show a list of detected activities with a preview (date, distance, duration, type guess).
3. User can select/deselect activities, edit titles, assign types, and bulk-link to trails.
4. "Import Selected" → for each activity, upload the track file to the media host, create and sign a kind-30531 event, publish to relays.
5. Show a progress bar and summary on completion.

### 4.6 Trail Explorer
- Full-screen map with trail markers clustered at low zoom levels.
- Fetch kind-30530 trail events using geohash-based filters (NIP-52 `g` tag prefix matching) for the visible map viewport.
- Sidebar/bottom-sheet list of trails sorted by distance from map center, filterable by difficulty, type, distance range, rating.
- Search bar with full-text search (query relay with NIP-50 search filter if supported, else client-side filter).
- Tapping a trail opens Trail Detail.

### 4.7 Trail Detail
- Hero image + trail name, location, difficulty badge, type badge.
- Interactive map showing the trail's reference route.
- Stats: distance, elevation gain, estimated time, avg rating (computed client-side from kind-30532 reviews).
- "Reviews" tab: list of kind-30532 reviews with star ratings, text, and photos. Input form to leave your own review (one per user — if an existing review exists, pre-fill the form for editing).
- "Activities" tab: recent kind-30531 activities from anyone that reference this trail.
- "Add to Wishlist" — publish a kind-30001 bookmark list item (NIP-51 named list) referencing this trail.
- "I've Done This" — shortcut to create an activity linked to this trail.

### 4.8 Create / Edit Trail
- Form: name, description (markdown editor), difficulty, type.
- Draw the trail route on the map using a polyline drawing tool (MapLibre Draw or custom click-to-add-waypoints tool).
- OR upload a GPX file for the route.
- Upload hero image and additional photos.
- Publish as kind-30530.

### 4.9 User Profile
- Display the user's kind-0 metadata: avatar, banner, display name, bio, nip05, lightning address.
- Tabs:
  - **Activities** — all their kind-30531 events, paginated.
  - **Trails** — trails they've created (kind-30530 by their pubkey).
  - **Reviews** — their kind-30532 reviews.
  - **Stats** — aggregate statistics: total distance (this week / month / year / all-time), total elevation, total activities, streak count. Compute client-side from their activities.
- Follow/Unfollow button (update kind-3 contact list).
- Zap button if they have a lightning address.

### 4.10 Notifications
- Subscribe to relay for events that tag the user's pubkey (`#p` filter):
  - Reactions on their activities
  - Comments on their activities or reviews
  - New followers
  - Zap receipts
- Show a notification bell with unread count. Notification dropdown lists recent interactions.

### 4.11 Explore / Discover
- "Popular Activities" — activities from anyone with the most reactions (requires relay with count support or client-side tallying).
- "Nearby Trails" — use browser geolocation to filter trails by proximity.
- "People to Follow" — show active users with public activity counts (lightweight discovery).

---

## 5. Map & Geo Implementation Details

- **Tile source:** Use OpenFreeMap (`https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf`) or Protomaps. No API key needed.
- **GPS track rendering:** Convert parsed track data to GeoJSON LineString. Add to the map as a source + line layer. Use `line-gradient` for pace/HR coloring.
- **Elevation profile:** Extract elevation values from the track's coordinate array. Plot with Recharts AreaChart. Sync hover on the chart with a moving marker on the map.
- **Geohash for queries:** Use the `ngeohash` npm package. When publishing trails or activities, compute a geohash from the start coordinates and include it as a `g` tag at multiple precision levels (e.g., "9mud", "9mudj", "9mudjk") so relays can do prefix filtering.
- **Clustering:** Use MapLibre's built-in clustering on a GeoJSON source of trail/activity start points.

---

## 6. Media / Photo Hosting

Since Nostr events are text-only, binary media (photos, track files) must be hosted externally and referenced by URL.

- Use **nostr.build** (`https://nostr.build/api/v2/upload/files`) or **void.cat** as the media host. Both support NIP-96 uploads authenticated with a signed Nostr event.
- Upload flow:
  1. Resize photos client-side (max 2048px on longest edge, JPEG quality 0.85) using canvas.
  2. Generate a blurhash for each photo using the `blurhash` npm package.
  3. Upload to the media host via NIP-96.
  4. Receive the public URL.
  5. Include the URL (and blurhash) in the event's `image` tags.
- For GPS track files (GeoJSON/GPX), upload them the same way and reference via the `track` or `route` tag.

---

## 7. Offline & Performance

- **IndexedDB cache:** Cache the user's own events and followed users' events locally using `idb-keyval` or Dexie. On app load, display cached data immediately, then sync with relays in the background.
- **Service worker:** Cache the app shell, map tiles, and static assets for offline access. Use a stale-while-revalidate strategy for API-like relay fetches.
- **Optimistic UI:** When the user publishes a reaction or comment, update the UI immediately before relay confirmation.
- **Lazy loading:** Lazy-load photos and map tiles. Use blurhash placeholders for images.

---

## 8. UI / UX Design Direction

- **Visual style:** Clean, modern, outdoor-adventure aesthetic. Use a nature-inspired color palette — forest greens, earth tones, sky blues — with a dark mode option.
- **Typography:** Use Inter or similar clean sans-serif for body text; use a slightly bolder display face for headings.
- **Mobile-first responsive design.** The app should feel native on phones (where most activity happens) but scale well to desktop.
- **Bottom navigation (mobile):** Feed | Explore | Record | Notifications | Profile
- **Top navigation (desktop):** Logo + horizontal nav items.
- **Card-based feed layout** — similar to Strava's feed.
- **Map interactions** should be smooth and touch-friendly; pinch to zoom, tap trail markers to preview.
- **Photo galleries** use a lightbox with swipe navigation.
- **Loading states:** Skeleton screens for feed cards, spinner for map data, blurhash for photos.
- **Empty states:** Friendly illustrations and CTAs when there are no activities, no reviews, etc.

---

## 9. Project Structure

```
trailstr/
├── public/
│   └── icons/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── routes/
│   │   ├── Feed.tsx
│   │   ├── ActivityDetail.tsx
│   │   ├── RecordActivity.tsx
│   │   ├── ImportActivities.tsx
│   │   ├── TrailExplorer.tsx
│   │   ├── TrailDetail.tsx
│   │   ├── CreateTrail.tsx
│   │   ├── Profile.tsx
│   │   ├── Settings.tsx
│   │   └── Login.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── BottomNav.tsx
│   │   │   ├── TopNav.tsx
│   │   │   └── Shell.tsx
│   │   ├── activity/
│   │   │   ├── ActivityCard.tsx
│   │   │   ├── StatsGrid.tsx
│   │   │   ├── ElevationChart.tsx
│   │   │   └── PhotoGallery.tsx
│   │   ├── trail/
│   │   │   ├── TrailCard.tsx
│   │   │   ├── TrailMap.tsx
│   │   │   ├── ReviewForm.tsx
│   │   │   └── ReviewList.tsx
│   │   ├── social/
│   │   │   ├── ReactionBar.tsx
│   │   │   ├── CommentThread.tsx
│   │   │   ├── FollowButton.tsx
│   │   │   └── ZapButton.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── TrackLayer.tsx
│   │   │   ├── ClusterLayer.tsx
│   │   │   └── DrawRoute.tsx
│   │   ├── import/
│   │   │   ├── FileDropZone.tsx
│   │   │   ├── ActivityPreviewList.tsx
│   │   │   └── parsers/
│   │   │       ├── gpx.ts
│   │   │       ├── tcx.ts
│   │   │       └── fit.ts
│   │   └── common/
│   │       ├── Avatar.tsx
│   │       ├── BlurhashImage.tsx
│   │       ├── StarRating.tsx
│   │       └── Skeleton.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   ├── relayStore.ts
│   │   ├── feedStore.ts
│   │   └── trailStore.ts
│   ├── nostr/
│   │   ├── client.ts          // relay pool management, subscribe, publish
│   │   ├── events.ts          // event builders for each kind
│   │   ├── signer.ts          // NIP-07 / nsec signing abstraction
│   │   ├── nip96.ts           // media upload
│   │   └── kinds.ts           // constants for custom kinds
│   ├── utils/
│   │   ├── geo.ts             // geohash, distance calculations
│   │   ├── units.ts           // metric/imperial conversion
│   │   ├── time.ts            // duration formatting
│   │   └── stats.ts           // aggregate stat calculations
│   └── types/
│       ├── activity.ts
│       ├── trail.ts
│       └── review.ts
├── index.html
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 10. Implementation Order

Build in this sequence to maintain a working app at every stage:

1. **Project scaffolding** — Vite + React + TS + Tailwind + routing shell with placeholder pages.
2. **Nostr auth** — Login screen with NIP-07 and nsec support. Auth store. Relay pool connection.
3. **Profile page** — Fetch and display kind-0 metadata. Profile edit form.
4. **Activity creation (manual)** — Form to create a kind-30531 event with basic fields (no file import yet). Publish to relays.
5. **Activity feed** — Fetch and display own activities. Then expand to followed users.
6. **Activity detail** — Full stats, map with track rendering, elevation chart.
7. **GPS file import** — GPX parser first, then FIT, then TCX. Bulk import flow.
8. **Social layer** — Reactions (kind-7), comments (kind-1 replies), follow/unfollow.
9. **Photo uploads** — NIP-96 media upload, blurhash generation, photo gallery component.
10. **Trail creation & explorer** — kind-30530 events, map-based discovery with geohash filtering.
11. **Trail reviews** — kind-30532 events, rating aggregation, review list.
12. **Notifications** — Real-time subscription for mentions/reactions.
13. **Offline caching** — IndexedDB, service worker.
14. **Live recording** — Geolocation API live track recording.
15. **Polish** — Dark mode, animations, empty states, error handling, mobile UX tuning.

---

## 11. Constraints & Non-Negotiables

- **Zero backend servers.** All data lives on Nostr relays. All computation is client-side. Media goes to existing Nostr-compatible media hosts.
- **No API keys required** for core functionality. Maps use free tile sources. Media hosts use NIP-96 auth.
- **Private keys never leave the client.** If using nsec directly, encrypt it at rest. Prefer NIP-07 extension signing.
- **Standard NIPs wherever possible.** Don't reinvent what already exists (profiles, contacts, reactions, reposts, zaps, bookmarks).
- **Accessible.** Semantic HTML, ARIA labels on interactive elements, keyboard navigation, sufficient color contrast.
- **Responsive.** Must work well on mobile screens (375px+) through desktop (1440px+).

---

## 12. Testing Notes

- Test relay connectivity with at least 3 relays simultaneously.
- Test GPX/FIT/TCX parsing with sample files from Garmin, Strava export, Apple Health export, and Fitbit export. Include edge cases: activities with no elevation data, no HR data, very short activities, very long activities.
- Test NIP-07 signing with nos2x browser extension.
- Test photo upload with images >5MB (should be resized client-side before upload).
- Test geohash-based trail filtering by panning the map to different regions.
- Test offline mode: load the app, go offline, verify cached data displays, verify queued publishes sync when back online.
