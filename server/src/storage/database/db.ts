import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema';

// 从环境变量获取数据库连接 URL
const databaseUrl = process.env.COZE_SUPABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('COZE_SUPABASE_URL or DATABASE_URL is not set');
}

// 创建连接池
const pool = new Pool({
  connectionString: databaseUrl,
});

// 创建 drizzle 实例
export const db = drizzle(pool, { schema });

// 导出 pool 用于直接查询
export { pool };
