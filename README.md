# Cortex

A TypeScript monorepo for an MCP-first context, policy, and audit platform.

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm 9.x
- Docker (for local development with PostgreSQL and Redis)

### Installation

```sh
# Install dependencies
pnpm install

# Generate Prisma client (requires DATABASE_URL)
DATABASE_URL="postgresql://cortex:cortex@localhost:5432/cortex" pnpm --filter db db:generate
```

### Development

Start the development environment:

```sh
# Start PostgreSQL and Redis
docker-compose up -d

# Run all apps in development mode
pnpm dev
```

## Project Structure

### Apps

- `apps/web` - Admin Web (Next.js)
- `apps/docs` - Documentation site (Next.js)
- `apps/api` - API + MCP entrypoint (NestJS)

### Packages

- `packages/db` - Prisma schema and database client
- `packages/ui` - Shared React component library (`@cortex/ui`)
- `packages/shared` - Shared types and utilities (`@cortex/shared`)
- `packages/eslint-config` - ESLint configurations (`@cortex/eslint-config`)
- `packages/typescript-config` - TypeScript configurations (`@cortex/typescript-config`)

## Commands

```sh
# Install dependencies
pnpm install

# Build all workspaces
pnpm build

# Type-check all workspaces
pnpm check-types

# Lint all workspaces
pnpm lint

# Format code
pnpm format

# Run dev servers
pnpm dev
```

### Database Commands

```sh
# Generate Prisma client
pnpm --filter db db:generate

# Validate Prisma schema
pnpm --filter db db:validate

# Create a new migration
pnpm --filter db db:migrate

# Apply pending migrations (production)
pnpm --filter db db:migrate:deploy
```

## Docker Services

The `docker-compose.yml` provides:

- **PostgreSQL 16** - Available at `localhost:5432` (user: `cortex`, password: `cortex`, database: `cortex`)
- **Redis 7** - Available at `localhost:6379`

Start services:

```sh
docker-compose up -d
```

Stop services:

```sh
docker-compose down
```

## Tech Stack

- **Package Manager**: pnpm (workspace monorepo)
- **Task Runner**: Turborepo
- **Language**: TypeScript
- **Web Framework**: Next.js 16
- **API Framework**: NestJS
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis
- **Linting**: ESLint
- **Formatting**: Prettier

## License

ISC
