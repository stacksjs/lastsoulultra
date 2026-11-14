import { describe, expect, it } from 'bun:test'
import { trainingSchema } from '../scripts/sync-training-erd'

describe('training schema reference', () => {
  it('keeps nullable references, later additions, changed types and compound constraints', () => {
    const result = trainingSchema([
      { name: '001.sql', sql: 'CREATE TABLE IF NOT EXISTS "users" (\n"id" BIGSERIAL PRIMARY KEY\n);\nCREATE TABLE IF NOT EXISTS "training_blocks" (\n"id" BIGSERIAL PRIMARY KEY,\n"user_id" bigint not null REFERENCES "users"("id"),\n"sequence" integer not null,\n"review_note" varchar(200) not null,\n"legacy" text\n);\nCREATE UNIQUE INDEX IF NOT EXISTS "block_sequence" ON "training_blocks" ("user_id", "sequence");' },
      { name: '002.sql', sql: 'ALTER TABLE "training_blocks" ADD COLUMN IF NOT EXISTS "reviewed_by_user_id" bigint;\nALTER TABLE "training_blocks" ADD CONSTRAINT "reviewer_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id");\nALTER TABLE "training_blocks" ALTER COLUMN "review_note" TYPE text USING "review_note"::text;\nALTER TABLE "training_blocks" ALTER COLUMN "review_note" DROP NOT NULL;\nALTER TABLE "training_blocks" DROP COLUMN IF EXISTS "legacy";' },
    ], ['users', 'training_blocks'])
    const blocks = result.tables.get('training_blocks')!
    expect(blocks.columns.get('id')).toMatchObject({ type: 'BIGSERIAL', primary: true, nullable: false })
    expect(blocks.columns.get('user_id')).toMatchObject({ references: 'users.id', nullable: false })
    expect(blocks.columns.get('reviewed_by_user_id')).toMatchObject({ references: 'users.id', nullable: true })
    expect(blocks.columns.get('review_note')).toMatchObject({ type: 'text', nullable: true })
    expect(blocks.columns.has('legacy')).toBe(false)
    expect(blocks.uniqueTogether).toEqual([['user_id', 'sequence']])
    expect(blocks.columns.get('user_id')?.unique).toBeUndefined()
    expect(result.inputs.map(input => input.file)).toEqual(['001.sql', '002.sql'])
  })

  it('fails rather than publishing a schema with missing tables or unresolved references', () => {
    expect(() => trainingSchema([], ['training_blocks'])).toThrow('Missing selected table')
    expect(() => trainingSchema([{ name: '001.sql', sql: 'CREATE TABLE IF NOT EXISTS "blocks" (\n"id" BIGSERIAL PRIMARY KEY,\n"owner_id" bigint REFERENCES "users"("id")\n);' }], ['blocks'])).toThrow('Unresolved foreign key')
  })

  it('refuses an unsupported selected-table alteration instead of silently losing it', () => {
    expect(() => trainingSchema([{ name: '001.sql', sql: 'CREATE TABLE IF NOT EXISTS "blocks" (\n"id" BIGSERIAL PRIMARY KEY\n);\nALTER TABLE "blocks" RENAME COLUMN "id" TO "block_id";' }], ['blocks'])).toThrow('Unsupported alteration')
  })
})
