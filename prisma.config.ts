import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Las migraciones necesitan conexión directa: a través del pooler de Neon
 * (PgBouncer en modo transacción) `migrate deploy` no consigue el advisory
 * lock y muere con timeout. Si no hay una URL sin pooler declarada, la
 * derivamos sacando el sufijo "-pooler" del host, que es la forma que tiene
 * Neon de nombrar la conexión directa. En una base que no sea Neon el
 * reemplazo no encuentra nada y la URL queda igual.
 */
function directUrl() {
  const explicit = process.env["DATABASE_URL_UNPOOLED"] || process.env["DIRECT_URL"];
  if (explicit) return explicit;

  const url = process.env["DATABASE_URL"];
  return url?.replace("-pooler.", ".");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: directUrl(),
  },
});
