-- Align Clip.duration with schema.prisma (Float / double precision).
-- The column was created as INTEGER in the init migration, but the Prisma
-- schema/client expect Float. The mismatch made the client bind `duration` as
-- a float8 value into an int4 column, raising Postgres 22P03
-- ("incorrect binary data format in bind parameter 8") on every clip insert,
-- which aborted the SAVING_CLIPS stage and failed the whole project.
ALTER TABLE "Clip" ALTER COLUMN "duration" TYPE DOUBLE PRECISION USING "duration"::double precision;
