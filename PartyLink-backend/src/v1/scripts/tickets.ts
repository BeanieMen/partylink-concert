import { config } from 'dotenv';
import crypto from 'crypto';
import { migrate } from '../db/migrate';
import { get, run } from '../db/client';

config();

type TicketStatus = 'reserved' | 'paid' | 'checked_in' | 'cancelled' | 'refunded';
type TicketCommand = 'create' | 'delete';

const ALLOWED_STATUSES: readonly TicketStatus[] = ['reserved', 'paid', 'checked_in', 'cancelled', 'refunded'];

function getArg(args: string[], name: string): string | undefined {
  const longName = `--${name}`;
  const directMatchIndex = args.indexOf(longName);
  if (directMatchIndex >= 0) {
    return args[directMatchIndex + 1];
  }

  const withEqualsPrefix = `${longName}=`;
  const withEquals = args.find((arg) => arg.startsWith(withEqualsPrefix));
  if (withEquals) {
    return withEquals.slice(withEqualsPrefix.length);
  }

  return undefined;
}

function printUsage(): void {
  console.log(`Usage:
  bun run tickets create --party <partyId> --user <userId> [--status <reserved|paid|checked_in|cancelled|refunded>]
  bun run tickets delete --ticket <ticketId>
  bun run tickets delete --party <partyId> --user <userId>

Examples:
  bun run tickets create --party seed-party-001 --user user_2wtTmZinMA4Fjq0ygbn3iOdryC1
  bun run tickets delete --party seed-party-001 --user user_2wtTmZinMA4Fjq0ygbn3iOdryC1
  bun run tickets delete --ticket 7bcbfafe-2ea7-4a0f-8308-2052f7f850db`);
}

function parseCommand(args: string[]): TicketCommand {
  const command = args[0];
  if (command === 'create' || command === 'delete') {
    return command;
  }

  throw new Error(`Unknown subcommand: ${command ?? '(missing)'}`);
}

function parseStatus(args: string[]): TicketStatus {
  const status = getArg(args, 'status') ?? 'paid';
  if (ALLOWED_STATUSES.includes(status as TicketStatus)) {
    return status as TicketStatus;
  }

  throw new Error(`Invalid --status value "${status}". Allowed: ${ALLOWED_STATUSES.join(', ')}`);
}

async function assertPartyExists(partyId: string): Promise<void> {
  const party = await get<{ id: string }>('SELECT id FROM parties WHERE id = ?', [partyId]);
  if (!party?.id) {
    throw new Error(`Party not found: ${partyId}`);
  }
}

async function assertUserExists(userId: string): Promise<void> {
  const user = await get<{ id: string }>('SELECT id FROM users WHERE id = ?', [userId]);
  if (!user?.id) {
    throw new Error(`User not found: ${userId}`);
  }
}

async function createTicket(args: string[]): Promise<void> {
  const partyId = getArg(args, 'party');
  const userId = getArg(args, 'user');
  const status = parseStatus(args);

  if (!partyId || !userId) {
    throw new Error('create requires --party <partyId> and --user <userId>');
  }

  await assertPartyExists(partyId);
  await assertUserExists(userId);

  const existing = await get<{ id: string; status: string }>(
    'SELECT id, status FROM tickets WHERE party_id = ? AND user_id = ?',
    [partyId, userId],
  );

  if (existing?.id) {
    await run('UPDATE tickets SET status = ? WHERE id = ?', [status, existing.id]);
    console.log(`[v1] Updated ticket ${existing.id} -> status=${status}`);
    return;
  }

  const ticketId = crypto.randomUUID();
  await run('INSERT INTO tickets(id, party_id, user_id, status) VALUES(?,?,?,?)', [
    ticketId,
    partyId,
    userId,
    status,
  ]);
  console.log(`[v1] Created ticket ${ticketId} (party=${partyId}, user=${userId}, status=${status})`);
}

async function deleteTicket(args: string[]): Promise<void> {
  const ticketId = getArg(args, 'ticket');
  if (ticketId) {
    const result = await run('DELETE FROM tickets WHERE id = ?', [ticketId]);
    if (result.changes === 0) {
      console.log(`[v1] No ticket found for id=${ticketId}`);
      return;
    }

    console.log(`[v1] Deleted ticket id=${ticketId}`);
    return;
  }

  const partyId = getArg(args, 'party');
  const userId = getArg(args, 'user');
  if (!partyId || !userId) {
    throw new Error('delete requires --ticket <ticketId> or --party <partyId> --user <userId>');
  }

  const result = await run('DELETE FROM tickets WHERE party_id = ? AND user_id = ?', [partyId, userId]);
  if (result.changes === 0) {
    console.log(`[v1] No ticket found for party=${partyId}, user=${userId}`);
    return;
  }

  console.log(`[v1] Deleted ticket for party=${partyId}, user=${userId}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const command = parseCommand(args);
  const commandArgs = args.slice(1);

  await migrate();

  if (command === 'create') {
    await createTicket(commandArgs);
    return;
  }

  await deleteTicket(commandArgs);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[v1] tickets script failed: ${message}`);
  printUsage();
  process.exit(1);
});