import { config } from 'dotenv';
import crypto from 'crypto';
import { migrate } from '../db/migrate';
import { get, run } from '../db/client';

config();

const SEED_USER_ID = 'user_2wtTmZinMA4Fjq0ygbn3iOdryC1';
const SEED_USER_ID_2 = 'user_2xBg1FuwYbO1Y2EbwV2p2CMlxc2';
const SEED_HOST_ID = 'seed-host-001';
const SEED_PARTY_ID = 'seed-party-001';
const SEED_PARTY_ID_2 = 'seed-party-002';
const SEED_PARTY_ID_3 = 'seed-party-003';

interface SeedParty {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  locationName: string;
  locationAddress: string;
  locationPlaceId: string;
  locationLat: number;
  locationLng: number;
  daysFromNow: number;
  startHourUtc: number;
  capacity: number;
  priceCents: number;
}

const SEEDED_PARTIES: SeedParty[] = [
  {
    id: SEED_PARTY_ID,
    title: 'Lifafa',
    description: 'Seeded Delhi show for local discovery + map radius testing.',
    imageUrl: 'lifafa.jpg',
    locationName: 'Sunder Nursery Lawns',
    locationAddress: 'Sunder Nursery, Nizamuddin East, New Delhi, Delhi 110013',
    locationPlaceId: 'ChIJh3m8fVriDDkR1nX4sXzT4Ew',
    locationLat: 28.5933,
    locationLng: 77.2467,
    daysFromNow: 3,
    startHourUtc: 14,
    capacity: 220,
    priceCents: 1800,
  },
  {
    id: SEED_PARTY_ID_2,
    title: 'Darzi',
    description: 'Seeded Delhi party in Connaught Place for proximity filters.',
    imageUrl: 'darzi.jpg',
    locationName: 'The Darzi Bar & Kitchen',
    locationAddress: 'Connaught Place, New Delhi, Delhi 110001',
    locationPlaceId: 'ChIJLz9f6-njDDkRSG9m6lWJ6Ck',
    locationLat: 28.6328,
    locationLng: 77.2195,
    daysFromNow: 5,
    startHourUtc: 15,
    capacity: 180,
    priceCents: 2200,
  },
  {
    id: SEED_PARTY_ID_3,
    title: 'Ye',
    description: 'Seeded Delhi night event near Saket for 5 km nearby search.',
    imageUrl: 'ye.jpg',
    locationName: 'Select CITYWALK Plaza',
    locationAddress: 'A-3, District Centre, Saket, New Delhi, Delhi 110017',
    locationPlaceId: 'ChIJR4xw8d7jDDkRrJ9spN3A8A8',
    locationLat: 28.5273,
    locationLng: 77.2197,
    daysFromNow: 8,
    startHourUtc: 14,
    capacity: 260,
    priceCents: 1600,
  },
];

function getUpcomingWindow(daysFromNow: number, startHourUtc: number, durationHours = 4): {
  startsAt: string;
  endsAt: string;
} {
  const now = new Date();
  const startsAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysFromNow, startHourUtc, 0, 0, 0),
  );
  const endsAt = new Date(startsAt.getTime() + durationHours * 3600 * 1000);

  return {
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
  };
}

function generateTicketCode(length: number = 9): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function ensureUser(params: {
  id: string;
  username: string;
  email: string;
}): Promise<string> {
  const existingById = await get<{ id: string }>('SELECT id FROM users WHERE id = ?', [params.id]);
  if (existingById?.id) {
    await run('UPDATE users SET email = ?, username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
      params.email,
      params.username,
      params.id,
    ]);
    await run(
      `INSERT INTO user_profiles(user_id, display_name)
       VALUES(?,?)
       ON CONFLICT(user_id) DO UPDATE SET
         display_name = excluded.display_name,
         updated_at = CURRENT_TIMESTAMP`,
      [params.id, params.username],
    );
    return existingById.id;
  }

  const existingByUsername = await get<{ id: string }>('SELECT id FROM users WHERE username = ?', [
    params.username,
  ]);
  if (existingByUsername?.id) return existingByUsername.id;

  await run('INSERT INTO users(id, email, username) VALUES(?,?,?)', [
    params.id,
    params.email,
    params.username,
  ]);
  await run('INSERT OR IGNORE INTO user_profiles(user_id, display_name) VALUES(?,?)', [
    params.id,
    params.username,
  ]);
  return params.id;
}

async function seed(): Promise<void> {
  await migrate();

  const userId = await ensureUser({
    id: SEED_USER_ID,
    username: 'ticket_user',
    email: 'jainarjav886@gmail.com',
  });
  const userId2 = await ensureUser({
    id: SEED_USER_ID_2,
    username: 'ticket_user_2',
    email: 'rakshit.c16@gmail.com',
  });
  const hostId = await ensureUser({
    id: SEED_HOST_ID,
    username: 'partylink_host',
    email: 'host@local.partylink',
  });

  for (const party of SEEDED_PARTIES) {
    const { startsAt, endsAt } = getUpcomingWindow(party.daysFromNow, party.startHourUtc);

    await run(
      `INSERT INTO parties(
         id,
         host_user_id,
         title,
         description,
         image_url,
         location_name,
         location_address,
         location_place_id,
         location_lat,
         location_lng,
         starts_at,
         ends_at,
         capacity,
         price_cents
       )
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         host_user_id = excluded.host_user_id,
         title = excluded.title,
         description = excluded.description,
         image_url = excluded.image_url,
         location_name = excluded.location_name,
         location_address = excluded.location_address,
         location_place_id = excluded.location_place_id,
         location_lat = excluded.location_lat,
         location_lng = excluded.location_lng,
         starts_at = excluded.starts_at,
         ends_at = excluded.ends_at,
         capacity = excluded.capacity,
         price_cents = excluded.price_cents,
         updated_at = CURRENT_TIMESTAMP`,
      [
        party.id,
        hostId,
        party.title,
        party.description,
        party.imageUrl,
        party.locationName,
        party.locationAddress,
        party.locationPlaceId,
        party.locationLat,
        party.locationLng,
        startsAt,
        endsAt,
        party.capacity,
        party.priceCents,
      ],
    );

    // Generate ticket codes pool
    console.log(`[v1] Generating ${party.capacity} ticket codes for party ${party.id}...`);
    for (let i = 0; i < party.capacity; i++) {
      let code = generateTicketCode();
      await run('INSERT OR IGNORE INTO party_ticket_codes(id, party_id, code) VALUES(?,?,?)', [
        crypto.randomUUID(),
        party.id,
        code,
      ]);
    }
  }

  console.log('[v1] Seed complete');
  console.log(`[v1] Test user seeded with id: ${userId}`);
  console.log(`[v1] Test user seeded with id: ${userId2}`);
  console.log(`[v1] Seeded parties: ${SEEDED_PARTIES.map((party) => party.title).join(', ')}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
