CREATE TYPE "Category" AS ENUM ('GIT', 'DOCKER', 'SQL', 'JAVASCRIPT', 'TYPESCRIPT', 'OTHER');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "password_hash" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_normalized" CHECK ("email" = lower(trim("email")))
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "snippets" (
  "id" UUID NOT NULL,
  "owner_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "content" TEXT NOT NULL,
  "category" "Category" NOT NULL DEFAULT 'OTHER',
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "snippets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "snippets_title_not_blank" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "snippets_content_length" CHECK (char_length("content") BETWEEN 1 AND 50000),
  CONSTRAINT "snippets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "snippets_owner_id_updated_at_id_idx" ON "snippets"("owner_id", "updated_at", "id");
CREATE INDEX "snippets_owner_id_category_idx" ON "snippets"("owner_id", "category");

CREATE TABLE "sessions" (
  "sid" VARCHAR NOT NULL,
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");
