import { pgTable, serial, varchar, timestamp, boolean, integer, numeric, text, jsonb, index, uniqueIndex, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ==================== 系统表 ====================
export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// ==================== 用户相关 ====================

// 用户表
export const users = pgTable("users", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	phone: varchar("phone", { length: 20 }).unique(),
	email: varchar("email", { length: 100 }),
	password_hash: varchar("password_hash", { length: 255 }),
	nickname: varchar("nickname", { length: 50 }),
	avatar_url: varchar("avatar_url", { length: 500 }),
	referral_code: varchar("referral_code", { length: 20 }).unique(), // 我的推广码
	referred_by: varchar("referred_by", { length: 36 }), // 推荐人ID
	is_kyc_verified: boolean("is_kyc_verified").default(false).notNull(),
	is_active: boolean("is_active").default(true).notNull(),
	is_banned: boolean("is_banned").default(false).notNull(), // 账号封禁状态（级联封禁）
	banned_until: timestamp("banned_until", { withTimezone: true }), // 封禁到期时间，NULL表示永久封禁或未封禁
	ban_reason: varchar("ban_reason", { length: 500 }), // 封禁原因
	disabled_features: jsonb("disabled_features").default([]).$type<string[]>(), // 禁用的功能列表: login, api, asset, wallet, plaza, referral, kyc
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("users_phone_idx").on(table.phone),
	index("users_referral_code_idx").on(table.referral_code),
	index("users_referred_by_idx").on(table.referred_by),
]);

// 钱包表
export const wallets = pgTable("wallets", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	wallet_type: varchar("wallet_type", { length: 20 }).notNull(), // created, imported
	address: varchar("address", { length: 100 }).notNull(),
	encrypted_mnemonic: text("encrypted_mnemonic"), // 加密后的助记词
	encrypted_private_key: text("encrypted_private_key"), // 加密后的私钥
	is_primary: boolean("is_primary").default(false).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("wallets_user_id_idx").on(table.user_id),
	uniqueIndex("wallets_address_idx").on(table.address),
]);

// 资产表
export const assets = pgTable("assets", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	wallet_id: varchar("wallet_id", { length: 36 }).references(() => wallets.id),
	token_symbol: varchar("token_symbol", { length: 20 }).notNull(), // BTC, ETH, USDT, PLATFORM
	balance: numeric("balance", { precision: 20, scale: 8 }).default("0").notNull(),
	frozen_balance: numeric("frozen_balance", { precision: 20, scale: 8 }).default("0").notNull(), // 冻结余额
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("assets_user_id_idx").on(table.user_id),
	index("assets_wallet_id_idx").on(table.wallet_id),
	index("assets_token_symbol_idx").on(table.token_symbol),
]);

// KYC认证记录表
export const kycRecords = pgTable("kyc_records", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	face_hash: varchar("face_hash", { length: 64 }).notNull(), // 人脸特征哈希，防重复认证
	face_image: text("face_image"), // 人脸图片base64，用于AI比对
	liveness_score: numeric("liveness_score", { precision: 5, scale: 2 }), // 活体检测分数
	liveness_actions: jsonb("liveness_actions"), // 活体检测动作记录
	status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, approved, rejected
	reject_reason: varchar("reject_reason", { length: 200 }),
	reviewer_id: varchar("reviewer_id", { length: 36 }), // 审核人ID
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("kyc_records_user_id_idx").on(table.user_id),
	index("kyc_records_face_hash_idx").on(table.face_hash),
	index("kyc_records_status_idx").on(table.status),
]);

// ==================== 质押相关 ====================

// 质押记录表
export const stakeRecords = pgTable("stake_records", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	stake_type: varchar("stake_type", { length: 20 }).notNull(), // flexible, fixed_180, fixed_360
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	token_symbol: varchar("token_symbol", { length: 20 }).default("PLATFORM").notNull(),
	daily_rate: numeric("daily_rate", { precision: 8, scale: 6 }).notNull(), // 日利率
	start_date: timestamp("start_date", { withTimezone: true }).notNull(),
	end_date: timestamp("end_date", { withTimezone: true }), // 定期质押结束日期
	status: varchar("status", { length: 20 }).default("active").notNull(), // active, redeemed, expired
	total_reward: numeric("total_reward", { precision: 20, scale: 8 }).default("0").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("stake_records_user_id_idx").on(table.user_id),
	index("stake_records_status_idx").on(table.status),
	index("stake_records_stake_type_idx").on(table.stake_type),
]);

// 收益发放表
export const stakeRewards = pgTable("stake_rewards", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	stake_record_id: varchar("stake_record_id", { length: 36 }).notNull().references(() => stakeRecords.id),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	reward_date: timestamp("reward_date", { withTimezone: true }).notNull(),
	status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, claimed, expired
	expired_at: timestamp("expired_at", { withTimezone: true }), // 收益过期时间，24小时后失效
	claimed_at: timestamp("claimed_at", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("stake_rewards_user_id_idx").on(table.user_id),
	index("stake_rewards_stake_record_id_idx").on(table.stake_record_id),
	index("stake_rewards_status_idx").on(table.status),
	index("stake_rewards_reward_date_idx").on(table.reward_date),
	index("stake_rewards_expired_at_idx").on(table.expired_at),
]);

// ==================== C2C交易相关 ====================

// 买单表
export const buyOrders = pgTable("buy_orders", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	token_symbol: varchar("token_symbol", { length: 20 }).default("USDT").notNull(),
	price: numeric("price", { precision: 20, scale: 8 }).notNull(), // 单价
	total_price: numeric("total_price", { precision: 20, scale: 8 }).notNull(), // 总价
	order_type: varchar("order_type", { length: 20 }).notNull(), // small, big - 大小单分区
	status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, matched, completed, cancelled
	matched_count: integer("matched_count").default(0), // 已匹配次数（用于判断部分成交后跳过）
	expired_at: timestamp("expired_at", { withTimezone: true }), // 过期时间
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("buy_orders_user_id_idx").on(table.user_id),
	index("buy_orders_status_idx").on(table.status),
	index("buy_orders_order_type_idx").on(table.order_type),
	index("buy_orders_created_at_idx").on(table.created_at),
]);

// C2C订单表
export const c2cOrders = pgTable("c2c_orders", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	buy_order_id: varchar("buy_order_id", { length: 36 }).notNull().references(() => buyOrders.id),
	buyer_id: varchar("buyer_id", { length: 36 }).notNull().references(() => users.id),
	seller_id: varchar("seller_id", { length: 36 }).notNull().references(() => users.id),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	token_symbol: varchar("token_symbol", { length: 20 }).default("USDT").notNull(),
	price: numeric("price", { precision: 20, scale: 8 }).notNull(),
	total_price: numeric("total_price", { precision: 20, scale: 8 }).notNull(),
	fee: numeric("fee", { precision: 20, scale: 8 }).notNull(), // 手续费
	status: varchar("status", { length: 20 }).default("pending_payment").notNull(), // pending_payment, paid, completed, cancelled, appealing
	payment_proof: text("payment_proof"), // 付款凭证图片URL
	paid_at: timestamp("paid_at", { withTimezone: true }),
	completed_at: timestamp("completed_at", { withTimezone: true }),
	cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
	cancel_reason: varchar("cancel_reason", { length: 200 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("c2c_orders_buy_order_id_idx").on(table.buy_order_id),
	index("c2c_orders_buyer_id_idx").on(table.buyer_id),
	index("c2c_orders_seller_id_idx").on(table.seller_id),
	index("c2c_orders_status_idx").on(table.status),
	index("c2c_orders_created_at_idx").on(table.created_at),
]);

// 聊天消息表
export const c2cChats = pgTable("c2c_chats", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	order_id: varchar("order_id", { length: 36 }).notNull().references(() => c2cOrders.id),
	sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => users.id),
	message: text("message").notNull(),
	message_type: varchar("message_type", { length: 20 }).default("text").notNull(), // text, image
	is_read: boolean("is_read").default(false).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("c2c_chats_order_id_idx").on(table.order_id),
	index("c2c_chats_sender_id_idx").on(table.sender_id),
	index("c2c_chats_created_at_idx").on(table.created_at),
]);

// 申诉单表
export const appeals = pgTable("appeals", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	order_id: varchar("order_id", { length: 36 }).notNull().references(() => c2cOrders.id),
	appellant_id: varchar("appellant_id", { length: 36 }).notNull().references(() => users.id),
	reason: text("reason").notNull(),
	evidence: text("evidence"), // 证据图片URL，JSON数组
	status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, processing, resolved
	result: varchar("result", { length: 20 }), // buyer_win, seller_win
	handler_id: varchar("handler_id", { length: 36 }), // 处理人ID
	handler_note: text("handler_note"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("appeals_order_id_idx").on(table.order_id),
	index("appeals_appellant_id_idx").on(table.appellant_id),
	index("appeals_status_idx").on(table.status),
]);

// ==================== 推广体系 ====================

// 推荐关系统计表
export const referralStats = pgTable("referral_stats", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id).unique(),
	level: integer("level").default(1).notNull(), // S1-S6级别
	direct_count: integer("direct_count").default(0).notNull(), // 直推人数
	direct_stake: numeric("direct_stake", { precision: 20, scale: 8 }).default("0").notNull(), // 直推质押总额
	team_count: integer("team_count").default(0).notNull(), // 团队人数
	team_stake: numeric("team_stake", { precision: 20, scale: 8 }).default("0").notNull(), // 团队质押总额
	big_zone_stake: numeric("big_zone_stake", { precision: 20, scale: 8 }).default("0").notNull(), // 大区质押
	small_zone_stake: numeric("small_zone_stake", { precision: 20, scale: 8 }).default("0").notNull(), // 小区质押
	total_reward: numeric("total_reward", { precision: 20, scale: 8 }).default("0").notNull(), // 总奖励
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("referral_stats_user_id_idx").on(table.user_id),
	index("referral_stats_level_idx").on(table.level),
]);

// 层级收益记录表
export const referralRewards = pgTable("referral_rewards", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id), // 获得奖励的用户
	from_user_id: varchar("from_user_id", { length: 36 }).notNull().references(() => users.id), // 贡献奖励的用户
	level: integer("level").notNull(), // 第几层
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	source_type: varchar("source_type", { length: 20 }).notNull(), // stake, c2c
	source_id: varchar("source_id", { length: 36 }), // 来源记录ID
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("referral_rewards_user_id_idx").on(table.user_id),
	index("referral_rewards_from_user_id_idx").on(table.from_user_id),
	index("referral_rewards_created_at_idx").on(table.created_at),
]);

// ==================== 配置相关 ====================

// 系统配置表
export const systemConfig = pgTable("system_config", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	config_key: varchar("config_key", { length: 100 }).notNull().unique(),
	config_value: text("config_value").notNull(),
	description: varchar("description", { length: 200 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	uniqueIndex("system_config_key_idx").on(table.config_key),
]);

// 代币价格表
export const tokenPrices = pgTable("token_prices", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	token_symbol: varchar("token_symbol", { length: 20 }).notNull().unique(),
	price_usd: numeric("price_usd", { precision: 20, scale: 8 }).notNull(),
	change_24h: numeric("change_24h", { precision: 10, scale: 4 }), // 24h涨跌幅
	volume_24h: numeric("volume_24h", { precision: 20, scale: 2 }), // 24h成交量
	high_24h: numeric("high_24h", { precision: 20, scale: 8 }), // 24h最高价
	low_24h: numeric("low_24h", { precision: 20, scale: 8 }), // 24h最低价
	market_cap: numeric("market_cap", { precision: 20, scale: 2 }), // 市值
	circulating_supply: numeric("circulating_supply", { precision: 20, scale: 2 }), // 流通量
	price_source: varchar("price_source", { length: 20 }).default("third_party"), // 价格来源
	is_platform_token: boolean("is_platform_token").default(false).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	uniqueIndex("token_prices_symbol_idx").on(table.token_symbol),
]);

// 交易对配置表
export const tradingPairs = pgTable("trading_pairs", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	base_currency: varchar("base_currency", { length: 20 }).notNull(),
	quote_currency: varchar("quote_currency", { length: 20 }).default("USDT").notNull(),
	pair_symbol: varchar("pair_symbol", { length: 40 }).notNull().unique(),
	price_source: varchar("price_source", { length: 20 }).default("third_party").notNull(), // third_party / manual / ai
	is_active: boolean("is_active").default(true).notNull(),
	is_trading_enabled: boolean("is_trading_enabled").default(true).notNull(), // 是否开放交易
	min_trade_amount: numeric("min_trade_amount", { precision: 20, scale: 8 }).default("10"),
	price_decimals: integer("price_decimals").default(4),
	amount_decimals: integer("amount_decimals").default(2),
	display_order: integer("display_order").default(0),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("trading_pairs_base_currency_idx").on(table.base_currency),
	index("trading_pairs_is_active_idx").on(table.is_active),
]);

// K线数据表
export const klines = pgTable("klines", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	pair_symbol: varchar("pair_symbol", { length: 40 }).notNull(),
	interval: varchar("interval", { length: 10 }).notNull(), // 1m, 5m, 15m, 1h, 4h, 1d
	open_time: bigint("open_time", { mode: "number" }).notNull(),
	open_price: numeric("open_price", { precision: 20, scale: 8 }).notNull(),
	high_price: numeric("high_price", { precision: 20, scale: 8 }).notNull(),
	low_price: numeric("low_price", { precision: 20, scale: 8 }).notNull(),
	close_price: numeric("close_price", { precision: 20, scale: 8 }).notNull(),
	volume: numeric("volume", { precision: 20, scale: 8 }).default("0"),
	quote_volume: numeric("quote_volume", { precision: 20, scale: 8 }).default("0"),
	trades_count: integer("trades_count").default(0),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("klines_pair_interval_time_idx").on(table.pair_symbol, table.interval, table.open_time),
]);

// AI价格调控记录表
export const araPriceAdjustments = pgTable("ara_price_adjustments", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	old_price: numeric("old_price", { precision: 20, scale: 8 }).notNull(),
	new_price: numeric("new_price", { precision: 20, scale: 8 }).notNull(),
	price_change_percent: numeric("price_change_percent", { precision: 10, scale: 4 }),
	adjustment_type: varchar("adjustment_type", { length: 20 }).notNull(), // manual / ai_auto
	reason: text("reason"),
	ai_strategy: varchar("ai_strategy", { length: 50 }), // trend_follow, mean_revert, volatility
	target_kline_pattern: varchar("target_kline_pattern", { length: 50 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	created_by: varchar("created_by", { length: 36 }),
}, (table) => [
	index("ara_price_adjustments_created_at_idx").on(table.created_at),
]);

// 质押配置表
export const stakeConfig = pgTable("stake_config", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	stake_type: varchar("stake_type", { length: 20 }).notNull(), // flexible, fixed_180, fixed_360
	daily_rate: numeric("daily_rate", { precision: 8, scale: 6 }).notNull(),
	duration_days: integer("duration_days"), // 定期天数
	min_amount: numeric("min_amount", { precision: 20, scale: 8 }).default("100").notNull(),
	accumulate_rewards: boolean("accumulate_rewards").default(true).notNull(), // 是否累计收益：true=累计，false=24小时不领取则失效
	rate_config: jsonb("rate_config").$type<{ day: number; rate: number }[]>(), // 灵活质押收益配置
	daily_rate_display: varchar("daily_rate_display", { length: 50 }), // 前端显示的日收益率范围，如 "0.5-1.5%"
	is_active: boolean("is_active").default(true).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("stake_config_stake_type_idx").on(table.stake_type),
]);

// 推广配置表
export const referralConfig = pgTable("referral_config", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	level: integer("level").notNull(), // 1-10层
	reward_rate: numeric("reward_rate", { precision: 5, scale: 4 }).notNull(), // 奖励比例
	required_direct_count: integer("required_direct_count").default(0).notNull(), // 解锁所需直推人数
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("referral_config_level_idx").on(table.level),
]);

// 级差配置表
export const levelConfig = pgTable("level_config", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	level_name: varchar("level_name", { length: 20 }).notNull(), // S1-S6
	min_team_stake: numeric("min_team_stake", { precision: 20, scale: 8 }).notNull(), // 业绩门槛
	big_zone_rate: numeric("big_zone_rate", { precision: 5, scale: 4 }), // 大区奖励比例
	small_zone_rate: numeric("small_zone_rate", { precision: 5, scale: 4 }), // 小区奖励比例
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("level_config_level_name_idx").on(table.level_name),
]);

// ==================== 流水相关 ====================

// 交易流水表
export const transactions = pgTable("transactions", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	type: varchar("type", { length: 30 }).notNull(), // deposit, withdraw, transfer, stake, reward, c2c_buy, c2c_sell, airdrop
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	token_symbol: varchar("token_symbol", { length: 20 }).notNull(),
	balance_before: numeric("balance_before", { precision: 20, scale: 8 }).notNull(),
	balance_after: numeric("balance_after", { precision: 20, scale: 8 }).notNull(),
	from_address: varchar("from_address", { length: 100 }),
	to_address: varchar("to_address", { length: 100 }),
	related_id: varchar("related_id", { length: 36 }), // 关联记录ID
	status: varchar("status", { length: 20 }).default("completed").notNull(), // pending, completed, failed
	note: varchar("note", { length: 200 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("transactions_user_id_idx").on(table.user_id),
	index("transactions_type_idx").on(table.type),
	index("transactions_status_idx").on(table.status),
	index("transactions_created_at_idx").on(table.created_at),
]);

// 交易历史表
export const tradeHistory = pgTable("trade_history", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	trade_type: varchar("trade_type", { length: 10 }).notNull(), // buy / sell
	base_currency: varchar("base_currency", { length: 20 }).notNull(),
	quote_currency: varchar("quote_currency", { length: 20 }).default("USDT").notNull(),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	price: numeric("price", { precision: 20, scale: 8 }).notNull(),
	total_value: numeric("total_value", { precision: 20, scale: 8 }).notNull(),
	fee: numeric("fee", { precision: 20, scale: 8 }).default("0").notNull(), // 手续费
	trader_type: varchar("trader_type", { length: 10 }).default("user").notNull(), // user / bot 交易者类型
	bot_id: varchar("bot_id", { length: 36 }), // 如果是机器人交易，记录机器人ID
	status: varchar("status", { length: 20 }).default("completed").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("trade_history_user_idx").on(table.user_id),
	index("trade_history_trader_type_idx").on(table.trader_type),
	index("trade_history_created_at_idx").on(table.created_at),
]);

// ==================== 管理后台 ====================

// 管理员表
export const adminUsers = pgTable("admin_users", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	username: varchar("username", { length: 50 }).notNull().unique(),
	password_hash: varchar("password_hash", { length: 255 }).notNull(),
	nickname: varchar("nickname", { length: 50 }),
	role: varchar("role", { length: 20 }).default("admin").notNull(), // super_admin, admin
	permissions: jsonb("permissions").default([]), // 权限列表
	is_active: boolean("is_active").default(true).notNull(),
	last_login_at: timestamp("last_login_at", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	uniqueIndex("admin_users_username_idx").on(table.username),
]);

// 管理员操作日志表
export const adminLogs = pgTable("admin_logs", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	admin_id: varchar("admin_id", { length: 36 }).notNull().references(() => adminUsers.id),
	action: varchar("action", { length: 50 }).notNull(),
	target_type: varchar("target_type", { length: 50 }), // 操作对象类型
	target_id: varchar("target_id", { length: 36 }), // 操作对象ID
	details: jsonb("details"), // 操作详情
	ip_address: varchar("ip_address", { length: 50 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("admin_logs_admin_id_idx").on(table.admin_id),
	index("admin_logs_action_idx").on(table.action),
	index("admin_logs_created_at_idx").on(table.created_at),
]);

// ==================== 机器人市值管理 ====================

// 机器人交易配置表
export const botTradingConfig = pgTable("bot_trading_config", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	token_symbol: varchar("token_symbol", { length: 20 }).notNull(), // 代币符号
	enabled: boolean("enabled").default(false).notNull(), // 是否启用
	// 交易策略配置
	strategy: varchar("strategy", { length: 30 }).default("market_making").notNull(), // market_making, trend_follow, mean_revert
	buy_enabled: boolean("buy_enabled").default(true).notNull(), // 允许买入
	sell_enabled: boolean("sell_enabled").default(true).notNull(), // 允许卖出
	// 价格控制
	target_price: numeric("target_price", { precision: 20, scale: 8 }), // 目标价格
	price_floor: numeric("price_floor", { precision: 20, scale: 8 }).notNull(), // 价格下限
	price_ceiling: numeric("price_ceiling", { precision: 20, scale: 8 }).notNull(), // 价格上限
	max_price_change_percent: numeric("max_price_change_percent", { precision: 6, scale: 2 }).default("5").notNull(), // 单次最大价格变动百分比
	// 交易量控制
	daily_buy_limit: numeric("daily_buy_limit", { precision: 20, scale: 8 }).default("10000").notNull(), // 每日买入限额
	daily_sell_limit: numeric("daily_sell_limit", { precision: 20, scale: 8 }).default("10000").notNull(), // 每日卖出限额
	min_order_amount: numeric("min_order_amount", { precision: 20, scale: 8 }).default("10").notNull(), // 最小挂单金额
	max_order_amount: numeric("max_order_amount", { precision: 20, scale: 8 }).default("100").notNull(), // 最大挂单金额
	// 频率控制
	order_interval_seconds: integer("order_interval_seconds").default(60).notNull(), // 挂单间隔（秒）
	max_open_orders: integer("max_open_orders").default(5).notNull(), // 最大同时挂单数
	// 统计数据（实时更新）
	today_buy_amount: numeric("today_buy_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 今日已买入量
	today_sell_amount: numeric("today_sell_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 今日已卖出量
	last_order_at: timestamp("last_order_at", { withTimezone: true }), // 上次挂单时间
	// 时间戳
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("bot_trading_config_symbol_idx").on(table.token_symbol),
]);

// 市值统计表（按小时汇总）
export const marketCapStats = pgTable("market_cap_stats", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	token_symbol: varchar("token_symbol", { length: 20 }).notNull(),
	stat_time: timestamp("stat_time", { withTimezone: true }).notNull(), // 统计时间（整点）
	stat_type: varchar("stat_type", { length: 10 }).default("hourly").notNull(), // hourly / daily
	// 价格数据
	open_price: numeric("open_price", { precision: 20, scale: 8 }).notNull(),
	close_price: numeric("close_price", { precision: 20, scale: 8 }).notNull(),
	high_price: numeric("high_price", { precision: 20, scale: 8 }).notNull(),
	low_price: numeric("low_price", { precision: 20, scale: 8 }).notNull(),
	// 用户交易统计
	user_buy_count: integer("user_buy_count").default(0).notNull(), // 用户买入次数
	user_buy_amount: numeric("user_buy_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 用户买入总量
	user_buy_value: numeric("user_buy_value", { precision: 20, scale: 8 }).default("0").notNull(), // 用户买入总值
	user_sell_count: integer("user_sell_count").default(0).notNull(), // 用户卖出次数
	user_sell_amount: numeric("user_sell_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 用户卖出总量
	user_sell_value: numeric("user_sell_value", { precision: 20, scale: 8 }).default("0").notNull(), // 用户卖出总值
	// 机器人交易统计
	bot_buy_count: integer("bot_buy_count").default(0).notNull(), // 机器人买入次数
	bot_buy_amount: numeric("bot_buy_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 机器人买入总量
	bot_buy_value: numeric("bot_buy_value", { precision: 20, scale: 8 }).default("0").notNull(), // 机器人买入总值
	bot_sell_count: integer("bot_sell_count").default(0).notNull(), // 机器人卖出次数
	bot_sell_amount: numeric("bot_sell_amount", { precision: 20, scale: 8 }).default("0").notNull(), // 机器人卖出总量
	bot_sell_value: numeric("bot_sell_value", { precision: 20, scale: 8 }).default("0").notNull(), // 机器人卖出总值
	// 总计
	total_trade_count: integer("total_trade_count").default(0).notNull(), // 总交易次数
	total_trade_value: numeric("total_trade_value", { precision: 20, scale: 8 }).default("0").notNull(), // 总交易额
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("market_cap_stats_symbol_time_idx").on(table.token_symbol, table.stat_time),
	index("market_cap_stats_type_idx").on(table.stat_type),
]);

// 空投记录表
export const airdropRecords = pgTable("airdrop_records", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	token_symbol: varchar("token_symbol", { length: 20 }).default("PLATFORM").notNull(),
	type: varchar("type", { length: 20 }).notNull(), // kyc_reward, referral_reward, promo
	status: varchar("status", { length: 20 }).default("completed").notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("airdrop_records_user_id_idx").on(table.user_id),
	index("airdrop_records_type_idx").on(table.type),
]);

// 客服消息表
export const supportMessages = pgTable("support_messages", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	sender_type: varchar("sender_type", { length: 20 }).notNull(), // user, admin, ai
	sender_id: varchar("sender_id", { length: 36 }), // 管理员ID（如果是管理员回复）
	message: text("message").notNull(),
	message_type: varchar("message_type", { length: 20 }).default("text").notNull(), // text, image
	is_read: boolean("is_read").default(false).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("support_messages_user_id_idx").on(table.user_id),
	index("support_messages_created_at_idx").on(table.created_at),
]);

// 系统设置表
export const systemSettings = pgTable("system_settings", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	setting_key: varchar("setting_key", { length: 100 }).notNull().unique(),
	setting_value: text("setting_value").notNull(),
	description: varchar("description", { length: 255 }),
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("system_settings_key_idx").on(table.setting_key),
]);

// ==================== AI广场相关 ====================

// AI机器人表
export const aiBots = pgTable("ai_bots", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 50 }).notNull(),
	avatar_url: varchar("avatar_url", { length: 500 }),
	description: text("description"),
	system_prompt: text("system_prompt").notNull(),
	model: varchar("model", { length: 50 }).default("doubao-seed-1-6-lite-251015").notNull(),
	is_active: boolean("is_active").default(true).notNull(),
	created_by: varchar("created_by", { length: 36 }).references(() => adminUsers.id),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("ai_bots_is_active_idx").on(table.is_active),
]);

// 群组表
export const chatGroups = pgTable("chat_groups", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 100 }).notNull(),
	description: text("description"),
	avatar_url: varchar("avatar_url", { length: 500 }),
	owner_id: varchar("owner_id", { length: 36 }).notNull().references(() => users.id),
	// 群设置
	announcement: text("announcement"), // 群公告
	join_setting: varchar("join_setting", { length: 20 }).default("admin_approval"), // free: 自由加入, admin_approval: 管理员审核, invite_only: 仅邀请
	message_frequency: varchar("message_frequency", { length: 20 }).default("unlimited"), // unlimited: 不限制, limited: 限制
	message_frequency_limit: integer("message_frequency_limit").default(10), // 每分钟发言限制数
	auto_delete: boolean("auto_delete").default(false), // 自动删除开关
	auto_delete_days: integer("auto_delete_days").default(7), // 自动删除天数
	capacity: integer("capacity").default(50000), // 群容量
	settings: jsonb("settings").default({
		allowImage: true,           // 允许发图片
		allowVideo: true,           // 允许发视频
		allowAddFriend: true,       // 允许互加好友
		bannedWords: [],            // 违禁词列表
		onlyAdminCanSend: false,    // 仅管理员可发言
	}).notNull(),
	member_count: integer("member_count").default(1).notNull(),
	is_public: boolean("is_public").default(true).notNull(),  // 是否公开群
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("chat_groups_owner_id_idx").on(table.owner_id),
	index("chat_groups_is_public_idx").on(table.is_public),
	index("chat_groups_created_at_idx").on(table.created_at),
]);

// 群成员表
export const chatGroupMembers = pgTable("chat_group_members", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	group_id: varchar("group_id", { length: 36 }).notNull().references(() => chatGroups.id),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	role: varchar("role", { length: 20 }).default("member").notNull(), // owner, admin, member
	nickname: varchar("nickname", { length: 50 }), // 群昵称
	muted: boolean("muted").default(false).notNull(), // 是否禁言
	is_pinned: boolean("is_pinned").default(false).notNull(), // 是否置顶
	is_muted: boolean("is_muted").default(false).notNull(), // 消息免打扰
	joined_at: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("chat_group_members_group_id_idx").on(table.group_id),
	index("chat_group_members_user_id_idx").on(table.user_id),
]);

// 群消息表
export const chatGroupMessages = pgTable("chat_group_messages", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	group_id: varchar("group_id", { length: 36 }).notNull().references(() => chatGroups.id),
	sender_id: varchar("sender_id", { length: 36 }), // user_id 或 bot_id
	sender_type: varchar("sender_type", { length: 20 }).default("user").notNull(), // user, ai_bot, system
	message: text("message").notNull(),
	message_type: varchar("message_type", { length: 20 }).default("text").notNull(), // text, image, video, red_packet
	extra_data: jsonb("extra_data"), // 额外数据，如红包ID等
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("chat_group_messages_group_id_idx").on(table.group_id),
	index("chat_group_messages_created_at_idx").on(table.created_at),
]);

// 群机器人关联表
export const chatGroupBots = pgTable("chat_group_bots", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	group_id: varchar("group_id", { length: 36 }).notNull().references(() => chatGroups.id),
	bot_id: varchar("bot_id", { length: 36 }).notNull().references(() => aiBots.id),
	added_by: varchar("added_by", { length: 36 }).notNull().references(() => users.id),
	added_at: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("chat_group_bots_group_id_idx").on(table.group_id),
]);

// 红包表
export const redPackets = pgTable("red_packets", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	group_id: varchar("group_id", { length: 36 }).references(() => chatGroups.id), // null表示私聊红包
	sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => users.id),
	total_amount: numeric("total_amount", { precision: 20, scale: 8 }).notNull(),
	total_count: integer("total_count").notNull(),
	remaining_amount: numeric("remaining_amount", { precision: 20, scale: 8 }).notNull(),
	remaining_count: integer("remaining_count").notNull(),
	packet_type: varchar("packet_type", { length: 20 }).default("random").notNull(), // random, fixed, lucky
	message: varchar("message", { length: 100 }).default("恭喜发财，大吉大利"),
	status: varchar("status", { length: 20 }).default("active").notNull(), // active, finished, expired
	expires_at: timestamp("expires_at", { withTimezone: true }).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("red_packets_group_id_idx").on(table.group_id),
	index("red_packets_sender_id_idx").on(table.sender_id),
	index("red_packets_status_idx").on(table.status),
]);

// 红包领取记录
export const redPacketClaims = pgTable("red_packet_claims", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	red_packet_id: varchar("red_packet_id", { length: 36 }).notNull().references(() => redPackets.id),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	amount: numeric("amount", { precision: 20, scale: 8 }).notNull(),
	claimed_at: timestamp("claimed_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("red_packet_claims_red_packet_id_idx").on(table.red_packet_id),
	index("red_packet_claims_user_id_idx").on(table.user_id),
]);

// 好友关系表
export const friendships = pgTable("friendships", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
	friend_id: varchar("friend_id", { length: 36 }).notNull().references(() => users.id),
	status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, accepted, rejected
	request_message: varchar("request_message", { length: 100 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("friendships_user_id_idx").on(table.user_id),
	index("friendships_friend_id_idx").on(table.friend_id),
	index("friendships_status_idx").on(table.status),
]);

// 私聊消息表
export const privateMessages = pgTable("private_messages", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	sender_id: varchar("sender_id", { length: 36 }).notNull().references(() => users.id),
	receiver_id: varchar("receiver_id", { length: 36 }).notNull().references(() => users.id),
	message: text("message").notNull(),
	message_type: varchar("message_type", { length: 20 }).default("text").notNull(),
	is_read: boolean("is_read").default(false).notNull(),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("private_messages_sender_id_idx").on(table.sender_id),
	index("private_messages_receiver_id_idx").on(table.receiver_id),
	index("private_messages_created_at_idx").on(table.created_at),
]);

// ==================== 违禁词管理 ====================

// 违禁词表
export const bannedWords = pgTable("banned_words", {
	id: serial("id").primaryKey(),
	word: varchar("word", { length: 200 }).notNull(),
	type: varchar("type", { length: 20 }).default("keyword").notNull(), // keyword, regex, sensitive
	replace_text: varchar("replace_text", { length: 100 }), // 替换文本
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("banned_words_word_idx").on(table.word),
	index("banned_words_type_idx").on(table.type),
]);

// ==================== 公告管理 ====================

// 公告表
export const announcements = pgTable("announcements", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	title: varchar("title", { length: 200 }).notNull(),
	content: text("content").notNull(),
	type: varchar("type", { length: 20 }).default("announcement").notNull(), // announcement: 公告, intro: 平台介绍, tutorial: 教程
	is_popup: boolean("is_popup").default(false).notNull(), // 是否弹窗显示
	is_active: boolean("is_active").default(true).notNull(), // 是否启用
	sort_order: integer("sort_order").default(0).notNull(), // 排序（数字越大越靠前）
	created_by: varchar("created_by", { length: 36 }).references(() => adminUsers.id),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("announcements_type_idx").on(table.type),
	index("announcements_is_active_idx").on(table.is_active),
	index("announcements_is_popup_idx").on(table.is_popup),
]);
