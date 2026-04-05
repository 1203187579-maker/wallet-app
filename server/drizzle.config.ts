import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/storage/database/shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: 'postgresql://postgres.gtqzclgfsxjnttnyrsea:Zheng%40hua123@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  },
});
