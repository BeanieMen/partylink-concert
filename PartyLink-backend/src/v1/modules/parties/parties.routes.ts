import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { all, get, run } from '../../db/client';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { HttpError } from '../../types/http';
import { ok, paged } from '../../utils/http';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { BANNERS_DIR } from '../../config/paths.js';

const router = Router();

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 5;

const partiesListQuerySchema = z
  .object({
    limit: z.coerce.number().min(1).max(50).default(20),
    cursor: z.string().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().min(0.1).max(50).optional(),
    radiusKm: z.coerce.number().min(0.1).max(50).optional(),
  });

type PartyRow = {
  id: string;
  title: string;
  image_url: string | null;
  location_name: string;
  location_address: string | null;
  location_place_id: string | null;
  location_lat: number | null;
  location_lng: number | null;
  starts_at: string;
  ends_at: string;
  capacity: number | null;
  price_cents: number;
  sold_count: number;
  distance_km?: number;
};

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(originLat: number, originLng: number, targetLat: number, targetLng: number): number {
  const dLat = toRadians(targetLat - originLat);
  const dLng = toRadians(targetLng - originLng);
  const startLat = toRadians(originLat);
  const endLat = toRadians(targetLat);

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

function getBoundingBox(originLat: number, originLng: number, radiusKm: number): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / 111.32;
  const lngDegreesPerKm = 111.32 * Math.cos(toRadians(originLat));
  const safeLngDegreesPerKm = Math.max(0.000001, Math.abs(lngDegreesPerKm));
  const lngDelta = radiusKm / safeLngDegreesPerKm;

  return {
    minLat: originLat - latDelta,
    maxLat: originLat + latDelta,
    minLng: originLng - lngDelta,
    maxLng: originLng + lngDelta,
  };
}

function buildLocationMeta(params: {
  locationName: string;
  locationAddress: string | null;
  locationPlaceId: string | null;
  locationLat: number | null;
  locationLng: number | null;
  distanceKm?: number;
}) {
  const hasCoordinates = params.locationLat !== null && params.locationLng !== null;
  const hasLocationMeta = hasCoordinates || params.locationAddress !== null || params.locationPlaceId !== null;

  if (!hasLocationMeta) return null;

  return {
    name: params.locationName,
    address: params.locationAddress,
    place_id: params.locationPlaceId,
    geometry: hasCoordinates
      ? {
        location: {
          lat: params.locationLat,
          lng: params.locationLng,
        },
      }
      : null,
    distance_km: params.distanceKm ?? null,
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

function mapPartyRow(row: PartyRow) {
  const starts = new Date(row.starts_at);
  const totalTickets = row.capacity ?? 999;
  const ticketsLeft = row.capacity === null ? 999 : Math.max(row.capacity - row.sold_count, 0);
  return {
    party_id: row.id,
    name: row.title,
    party_date: starts.toISOString().slice(0, 10),
    party_time: starts.toISOString().slice(11, 16),
    location: row.location_name,
    location_meta: buildLocationMeta({
      locationName: row.location_name,
      locationAddress: row.location_address,
      locationPlaceId: row.location_place_id,
      locationLat: row.location_lat,
      locationLng: row.location_lng,
      distanceKm: row.distance_km,
    }),
    image_url: row.image_url,
    tickets_left: ticketsLeft,
    total_tickets: totalTickets,
    price: row.price_cents,
  };
}

router.get(
  '/',
  validate({ query: partiesListQuerySchema }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = partiesListQuerySchema.parse(req.query);
      const limit = q.limit;
      const cursor = q.cursor;
      const latitude = q.latitude ?? q.lat;
      const longitude = q.longitude ?? q.lng;

      if ((latitude === undefined) !== (longitude === undefined)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'Both latitude and longitude must be provided for radius search');
      }

      if (latitude === undefined && longitude === undefined && (q.radius_km !== undefined || q.radiusKm !== undefined)) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'radius_km/radiusKm requires latitude and longitude');
      }

      const radiusKm = q.radiusKm ?? q.radius_km ?? DEFAULT_RADIUS_KM;

      let rows: PartyRow[] = [];

      if (latitude !== undefined && longitude !== undefined) {
        const { minLat, maxLat, minLng, maxLng } = getBoundingBox(latitude, longitude, radiusKm);
        const candidateLimit = Math.min(500, Math.max(limit + 1, (limit + 1) * 20));

        const nearbyRows = await all<PartyRow>(
          cursor
            ? `SELECT id, title, image_url, location_name, location_address, location_place_id, location_lat, location_lng, starts_at, ends_at, capacity, price_cents,
                      (SELECT COUNT(*) FROM tickets t WHERE t.party_id = parties.id AND t.status IN ('reserved','paid','checked_in')) AS sold_count
               FROM parties
               WHERE starts_at < ?
                 AND location_lat IS NOT NULL
                 AND location_lng IS NOT NULL
                 AND location_lat BETWEEN ? AND ?
                 AND location_lng BETWEEN ? AND ?
               ORDER BY starts_at DESC
               LIMIT ?`
            : `SELECT id, title, image_url, location_name, location_address, location_place_id, location_lat, location_lng, starts_at, ends_at, capacity, price_cents,
                      (SELECT COUNT(*) FROM tickets t WHERE t.party_id = parties.id AND t.status IN ('reserved','paid','checked_in')) AS sold_count
               FROM parties
               WHERE location_lat IS NOT NULL
                 AND location_lng IS NOT NULL
                 AND location_lat BETWEEN ? AND ?
                 AND location_lng BETWEEN ? AND ?
               ORDER BY starts_at DESC
               LIMIT ?`,
          cursor
            ? [cursor, minLat, maxLat, minLng, maxLng, candidateLimit]
            : [minLat, maxLat, minLng, maxLng, candidateLimit],
        );

        const filtered: PartyRow[] = [];
        for (const row of nearbyRows) {
          if (row.location_lat === null || row.location_lng === null) continue;

          const distanceKm = calculateDistanceKm(latitude, longitude, row.location_lat, row.location_lng);
          if (distanceKm <= radiusKm) {
            filtered.push({
              ...row,
              distance_km: Number(distanceKm.toFixed(3)),
            });
          }
        }

        rows = filtered;
      } else {
        rows = await all<PartyRow>(
          cursor
            ? `SELECT id, title, image_url, location_name, location_address, location_place_id, location_lat, location_lng, starts_at, ends_at, capacity, price_cents,
                      (SELECT COUNT(*) FROM tickets t WHERE t.party_id = parties.id AND t.status IN ('reserved','paid','checked_in')) AS sold_count
               FROM parties
               WHERE starts_at < ?
               ORDER BY starts_at DESC LIMIT ?`
            : `SELECT id, title, image_url, location_name, location_address, location_place_id, location_lat, location_lng, starts_at, ends_at, capacity, price_cents,
                      (SELECT COUNT(*) FROM tickets t WHERE t.party_id = parties.id AND t.status IN ('reserved','paid','checked_in')) AS sold_count
               FROM parties
               ORDER BY starts_at DESC LIMIT ?`,
          cursor ? [cursor, limit + 1] : [limit + 1],
        );
      }

      const mapped = rows.map(mapPartyRow);

      const hasMore = mapped.length > limit;
      const data = hasMore ? mapped.slice(0, limit) : mapped;
      const nextCursor = hasMore ? rows[limit]!.starts_at : null;
      paged(res, data, { requestId: req.requestId, nextCursor, hasMore, limit });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:partyId/banner',
  validate({ params: z.object({ partyId: z.string().min(1).max(128) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const party = await get<{ image_url: string | null }>('SELECT image_url FROM parties WHERE id = ?', [req.params.partyId]);
      const defaultBannerPath = path.join(BANNERS_DIR, 'default_banner.jpeg');
      const imageName = party?.image_url ?? 'default_banner.jpeg';
      const bannerPath = path.join(BANNERS_DIR, imageName);
      if (fs.existsSync(bannerPath)) {
        res.header('Cross-Origin-Resource-Policy', 'cross-origin');
        res.header('Access-Control-Allow-Origin', '*');
        res.sendFile(bannerPath);
        return;
      }

      if (fs.existsSync(defaultBannerPath)) {
        res.header('Cross-Origin-Resource-Policy', 'cross-origin');
        res.header('Access-Control-Allow-Origin', '*');
        res.sendFile(defaultBannerPath);
        return;
      }

      res.status(404).json({ error: 'Banner not found' });
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  '/:partyId',
  validate({ params: z.object({ partyId: z.string().min(1).max(128) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const partyRow = await get<{
        id: string;
        title: string;
        description: string | null;
        image_url: string | null;
        location_name: string;
        location_address: string | null;
        location_place_id: string | null;
        location_lat: number | null;
        location_lng: number | null;
        starts_at: string;
        ends_at: string;
        capacity: number | null;
        price_cents: number;
        sold_count: number;
      }>(
        `SELECT id, title, description, image_url, location_name, location_address, location_place_id, location_lat, location_lng, starts_at, ends_at, capacity, price_cents,
                (SELECT COUNT(*) FROM tickets t WHERE t.party_id = parties.id AND t.status IN ('reserved','paid','checked_in')) AS sold_count
         FROM parties
         WHERE id = ?`,
        [req.params.partyId],
      );
      if (!partyRow) throw new HttpError(404, 'NOT_FOUND', 'Party not found');

      // Get the current user's ticket code if they are attending
      let ticketCode: string | null = null;
      if (req.headers['x-user-id']) {
        const ticket = await get<{ code: string }>(
          'SELECT code FROM tickets WHERE party_id = ? AND user_id = ?',
          [req.params.partyId, req.headers['x-user-id']]
        );
        ticketCode = ticket?.code ?? null;
      }

      const starts = new Date(partyRow.starts_at);
      ok(
        res,
        {
          party_id: partyRow.id,
          name: partyRow.title,
          description: partyRow.description,
          party_date: starts.toISOString().slice(0, 10),
          party_time: starts.toISOString().slice(11, 16),
          location: partyRow.location_name,
          location_meta: buildLocationMeta({
            locationName: partyRow.location_name,
            locationAddress: partyRow.location_address,
            locationPlaceId: partyRow.location_place_id,
            locationLat: partyRow.location_lat,
            locationLng: partyRow.location_lng,
          }),
          image_url: partyRow.image_url,
          total_tickets: partyRow.capacity ?? 999,
          tickets_left: partyRow.capacity === null ? 999 : Math.max(partyRow.capacity - partyRow.sold_count, 0),
          price: partyRow.price_cents,
          ticket_code: ticketCode,
        },
        { requestId: req.requestId },
      );
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  '/:partyId/attend',
  requireAuth,
  validate({ params: z.object({ partyId: z.string().min(1).max(128) }) }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const party = await get<{ id: string; capacity: number | null }>('SELECT id, capacity FROM parties WHERE id = ?', [
        req.params.partyId,
      ]);
      if (!party) throw new HttpError(404, 'NOT_FOUND', 'Party not found');

      const existing = await get('SELECT id FROM tickets WHERE party_id = ? AND user_id = ?', [
        req.params.partyId,
        req.authUserId!,
      ]);
      if (existing) {
        ok(res, { alreadyAttending: true }, { requestId: req.requestId });
        return;
      }

      const count = await get<{ c: number }>('SELECT COUNT(*) as c FROM tickets WHERE party_id = ? AND status IN (\'reserved\',\'paid\',\'checked_in\')', [req.params.partyId]);
      if (party.capacity !== null && (count?.c ?? 0) >= party.capacity) {
        throw new HttpError(409, 'CONFLICT', 'Party is full');
      }

      const ticketId = crypto.randomUUID();
      let ticketCode = null;
      const unassignedCode = await get<{ code: string }>(
        'SELECT code FROM party_ticket_codes WHERE party_id = ? AND is_assigned = 0 LIMIT 1',
        [req.params.partyId]
      );
      if (unassignedCode) {
        ticketCode = unassignedCode.code;
        await run('UPDATE party_ticket_codes SET is_assigned = 1 WHERE party_id = ? AND code = ?', [req.params.partyId, ticketCode]);
      } else {
        ticketCode = generateTicketCode();
      }
      
      await run('INSERT INTO tickets(id, party_id, user_id, status, code) VALUES(?,?,?,?,?)', [
        ticketId,
        req.params.partyId,
        req.authUserId!,
        'paid',
        ticketCode,
      ]);

      ok(
        res,
        { success: true, message: "Successfully RSVP'd to the party!", ticketId, ticketCode, status: 'paid', partyId: req.params.partyId },
        { requestId: req.requestId },
      );
    } catch (error) {
      next(error);
    }
  },
);


export default router;
