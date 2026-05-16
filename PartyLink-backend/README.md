# party-server

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run dev
```

To initialize starter data (including three Delhi example parties: Lifafa, Darzi, and Ye):

```bash
bun run seed
```

To create or delete tickets from the command line:

```bash
bun run tickets create --party <partyId> --user <userId>
bun run tickets delete --party <partyId> --user <userId>
# or by ticket id
bun run tickets delete --ticket <ticketId>
```

Security defaults added:

- Basic hardening response headers
- Request rate limiting
- Request JSON body limit (1MB)
- SQLite safety pragmas (WAL, FULL synchronous, busy timeout)

Set optional environment variables:

- LOCAL_DB_PATH: path to SQLite db file (default ./local-v1.db)
- CORS_ORIGIN: comma-separated allowlist (default * in non-production)
- V1_PORT: optional API port override (defaults to 4000)
- NODE_ENV: set to production in deployed environments

This project was created using `bun init` in bun v1.2.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
