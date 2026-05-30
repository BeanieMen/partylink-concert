# Partylink

Partylink is a concert and event ticketing platform i made because of my love for songs, music and peter cat recording co (going to their concert on june 7)

## Tech Stack

### Frontend
- Next JS
- Tailwind CSS
- Capacitor
- Clerk

### Backend
- Express
- Sqlite

### Infrastructure
- pmc for process management
- Oracle vps

## Prerequisites
- Android Studio + SDK + JDK (for Android builds)
- Node (obviously)
- bun
- clerk (you can use my clerk key or get your own)

## Quick start (local)

1) Clone
```bash
git clone --recursive https://github.com/BeanieMen/partylink-concert
cd partylink-concert
```

3) Start the backend:

```bash
cd PartyLink-backend
bun i
bun seed
bun dev
```

3) Start the frontend:

```bash
cd PartyLink
bun i
bun dev
```

The app is gonna run at `http://localhost:8081` and the API runs at `http://localhost:4000`.
If you want you can build for android by
```bash
bun cap sync
bun cap run android
```

# AI USAGE
ai or specifically gpt 5.2 was used in the making of the frontend ONLY. i dont trust it enough for the backend

