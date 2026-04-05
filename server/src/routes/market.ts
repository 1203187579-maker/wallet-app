import { Router } from 'express';
import type { Request, Response } from 'express';
import { getSupabaseClient } from '../storage/database/supabase-client.js';

const router = Router();

// ==================== 价格接口 ====================

/**
 * 获取所有交易对实时价格
 * GET /api/v1/market/prices
 */
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('token_prices')
      .select('*')
      .order('token_symbol');

    if (error) throw error;

    // 获取交易对配置（包含 is_viewable）
    const { data: pairs } = await client
      .from('trading_pairs')
      .select('base_currency, is_viewable, is_trading_enabled')
      .eq('is_active', true);

    // 构建代币配置映射
    const pairConfigMap = new Map(
      (pairs || []).map((p: Record<string, unknown>) => [
        p.base_currency as string,
        { isViewable: p.is_viewable ?? true, isTradingEnabled: p.is_trading_enabled ?? true }
      ])
    );

    const prices = data?.map((item: Record<string, unknown>) => {
      const config = pairConfigMap.get(item.token_symbol as string) || { isViewable: true, isTradingEnabled: true };
      return {
        id: item.id,
        token_symbol: item.token_symbol,
        price_usd: item.price_usd,
        change_24h: item.change_24h,
        volume_24h: item.volume_24h,
        high_24h: item.high_24h,
        low_24h: item.low_24h,
        marketCap: item.market_cap,
        circulatingSupply: item.circulating_supply,
        priceSource: item.price_source,
        updatedAt: item.updated_at,
        isViewable: config.isViewable,
        isTradingEnabled: config.isTradingEnabled,
      };
    }) || [];

    res.json({
      success: true,
      data: prices,
    });
  } catch (error) {
    console.error('获取价格失败:', error);
    res.status(500).json({ success: false, error: '获取价格失败' });
  }
});

/**
 * 获取单个代币价格
 * GET /api/v1/market/price/:symbol
 */
router.get('/price/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = req.params.symbol as string;
    const upperSymbol = symbol.toUpperCase();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('token_prices')
      .select('*')
      .eq('token_symbol', upperSymbol)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: '代币不存在' });
    }

    // 转换字段为驼峰格式
    const priceData = {
      id: data.id,
      symbol: data.token_symbol,
      priceUsd: data.price_usd,
      change24h: data.change_24h,
      volume24h: data.volume_24h,
      high24h: data.high_24h,
      low24h: data.low_24h,
      marketCap: data.market_cap,
      circulatingSupply: data.circulating_supply,
      priceSource: data.price_source,
      updatedAt: data.updated_at,
      isPlatformToken: data.is_platform_token,
    };

    res.json({ success: true, data: priceData });
  } catch (error) {
    console.error('获取价格失败:', error);
    res.status(500).json({ success: false, error: '获取价格失败' });
  }
});

/**
 * 获取交易对列表
 * GET /api/v1/market/pairs
 */
router.get('/pairs', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data: pairs, error } = await client
      .from('trading_pairs')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (error) throw error;

    // 关联价格信息
    const pairsWithPrice = await Promise.all(
      (pairs || []).map(async (pair: Record<string, unknown>) => {
        const { data: price } = await client
          .from('token_prices')
          .select('*')
          .eq('token_symbol', pair.base_currency)
          .maybeSingle();
        return {
          id: pair.id,
          baseCurrency: pair.base_currency,
          quoteCurrency: pair.quote_currency,
          pairSymbol: pair.pair_symbol,
          priceSource: pair.price_source,
          isActive: pair.is_active,
          minTradeAmount: pair.min_trade_amount,
          priceDecimals: pair.price_decimals,
          amountDecimals: pair.amount_decimals,
          displayOrder: pair.display_order,
          price: price || null,
        };
      })
    );

    res.json({ success: true, data: pairsWithPrice });
  } catch (error) {
    console.error('获取交易对失败:', error);
    res.status(500).json({ success: false, error: '获取交易对失败' });
  }
});

// ==================== K线接口 ====================

/**
 * 获取K线数据
 * GET /api/v1/market/klines/:pairSymbol
 * Query: interval (1m, 5m, 15m, 1h, 4h, 1d), limit (默认100, 最大500)
 */
router.get('/klines/:pairSymbol', async (req: Request, res: Response) => {
  try {
    const pairSymbol = req.params.pairSymbol as string;
    const { interval = '1h', limit = '100' } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 100, 500);
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('klines')
      .select('*')
      .eq('pair_symbol', pairSymbol.toUpperCase())
      .eq('interval', interval as string)
      .order('open_time', { ascending: false })
      .limit(limitNum);

    if (error) throw error;

    // 按时间正序排列
    const sortedData = (data || []).reverse().map((k: Record<string, unknown>) => ({
      time: k.open_time,
      open: parseFloat(k.open_price as string),
      high: parseFloat(k.high_price as string),
      low: parseFloat(k.low_price as string),
      close: parseFloat(k.close_price as string),
      volume: parseFloat((k.volume as string) || '0'),
    }));

    res.json({ success: true, data: sortedData });
  } catch (error) {
    console.error('获取K线失败:', error);
    res.status(500).json({ success: false, error: '获取K线数据失败' });
  }
});

// ==================== AI价格管理接口 ====================

/**
 * 更新AI价格 (管理后台)
 * POST /api/v1/market/ai/price
 * Body: price, reason, adjustmentType
 */
router.post('/ai/price', async (req: Request, res: Response) => {
  try {
    const { price, reason, adjustmentType = 'manual' } = req.body;

    if (!price || isNaN(parseFloat(price))) {
      return res.status(400).json({ success: false, error: '无效的价格' });
    }

    const newPrice = parseFloat(price);
    const client = getSupabaseClient();

    // 获取当前价格
    const { data: currentPriceData } = await client
      .from('token_prices')
      .select('*')
      .eq('token_symbol', 'AI')
      .maybeSingle();

    const oldPrice = currentPriceData ? parseFloat(currentPriceData.price_usd as string) : 0;
    const priceChangePercent = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;

    // 更新或插入价格
    if (currentPriceData) {
      const { error } = await client
        .from('token_prices')
        .update({
          price_usd: newPrice.toString(),
          price_source: adjustmentType === 'ai_auto' ? 'ai' : 'manual',
          updated_at: new Date().toISOString(),
        })
        .eq('token_symbol', 'AI');

      if (error) throw error;
    } else {
      const { error } = await client
        .from('token_prices')
        .insert({
          token_symbol: 'AI',
          price_usd: newPrice.toString(),
          price_source: adjustmentType === 'ai_auto' ? 'ai' : 'manual',
          is_platform_token: true,
        });

      if (error) throw error;
    }

    // 记录调整历史
    await client
      .from('ara_price_adjustments')
      .insert({
        old_price: oldPrice.toString(),
        new_price: newPrice.toString(),
        price_change_percent: priceChangePercent.toFixed(4),
        adjustment_type: adjustmentType,
        reason: reason || null,
      });

    res.json({
      success: true,
      data: {
        oldPrice,
        newPrice,
        priceChangePercent: priceChangePercent.toFixed(2),
      },
    });
  } catch (error) {
    console.error('更新AI价格失败:', error);
    res.status(500).json({ success: false, error: '更新价格失败' });
  }
});

/**
 * 获取AI价格调整历史
 * GET /api/v1/market/ai/history
 * Query: limit, offset
 */
router.get('/ai/history', async (req: Request, res: Response) => {
  try {
    const { limit = '50', offset = '0' } = req.query;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('ara_price_adjustments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('获取历史失败:', error);
    res.status(500).json({ success: false, error: '获取历史失败' });
  }
});

/**
 * 生成模拟K线数据 (开发测试用)
 * POST /api/v1/market/klines/generate
 * Body: pairSymbol, interval, count, basePrice
 */
router.post('/klines/generate', async (req: Request, res: Response) => {
  try {
    const { pairSymbol, interval = '1h', count = 100, basePrice = 100 } = req.body;

    if (!pairSymbol) {
      return res.status(400).json({ success: false, error: '缺少交易对参数' });
    }

    const now = Date.now();
    const intervalMs: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };

    const ms = intervalMs[interval] || 3600000;
    const klineData: Record<string, unknown>[] = [];
    let price = parseFloat(basePrice);

    for (let i = count - 1; i >= 0; i--) {
      const openTime = now - i * ms;

      // 模拟价格波动 (±3%)
      const change = (Math.random() - 0.5) * 0.06;
      const open = price;
      const close = price * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = Math.random() * 10000 + 1000;

      klineData.push({
        pair_symbol: pairSymbol.toUpperCase(),
        interval,
        open_time: openTime,
        open_price: open.toFixed(8),
        high_price: high.toFixed(8),
        low_price: low.toFixed(8),
        close_price: close.toFixed(8),
        volume: volume.toFixed(8),
        quote_volume: (volume * price).toFixed(8),
        trades_count: Math.floor(Math.random() * 500) + 50,
      });

      price = close;
    }

    // 批量插入
    const client = getSupabaseClient();
    const { error } = await client
      .from('klines')
      .insert(klineData);

    if (error) throw error;

    res.json({
      success: true,
      message: `已生成 ${count} 条K线数据`,
      data: { count, pairSymbol, interval },
    });
  } catch (error) {
    console.error('生成K线失败:', error);
    res.status(500).json({ success: false, error: '生成K线数据失败' });
  }
});

// ==================== 代币信息接口 ====================

/**
 * 获取所有代币信息
 * GET /api/v1/market/token-info
 */
router.get('/token-info', async (req: Request, res: Response) => {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('token_info')
      .select('*')
      .order('token_symbol');

    if (error) throw error;

    const tokenInfoList = data?.map((item: Record<string, unknown>) => ({
      id: item.id,
      symbol: item.token_symbol,
      name: item.name,
      description: item.description,
      issueDate: item.issue_date,
      totalSupply: item.total_supply,
      consensusMechanism: item.consensus_mechanism,
      blockchainNetwork: item.blockchain_network,
      features: item.features || [],
      websiteUrl: item.website_url,
      whitepaperUrl: item.whitepaper_url,
      updatedAt: item.updated_at,
    })) || [];

    res.json({ success: true, data: tokenInfoList });
  } catch (error) {
    console.error('获取代币信息失败:', error);
    res.status(500).json({ success: false, error: '获取代币信息失败' });
  }
});

/**
 * 获取单个代币信息
 * GET /api/v1/market/token-info/:symbol
 */
router.get('/token-info/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol).toUpperCase();
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('token_info')
      .select('*')
      .eq('token_symbol', symbol)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: '代币信息不存在' });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        symbol: data.token_symbol,
        name: data.name,
        description: data.description,
        issueDate: data.issue_date,
        totalSupply: data.total_supply,
        consensusMechanism: data.consensus_mechanism,
        blockchainNetwork: data.blockchain_network,
        features: data.features || [],
        websiteUrl: data.website_url,
        whitepaperUrl: data.whitepaper_url,
        updatedAt: data.updated_at,
      },
    });
  } catch (error) {
    console.error('获取代币信息失败:', error);
    res.status(500).json({ success: false, error: '获取代币信息失败' });
  }
});

/**
 * 更新代币信息 (管理后台)
 * PUT /api/v1/market/token-info/:symbol
 * Body: name, description, issueDate, totalSupply, consensusMechanism, blockchainNetwork, features, websiteUrl, whitepaperUrl
 */
router.put('/token-info/:symbol', async (req: Request, res: Response) => {
  try {
    const symbol = String(req.params.symbol).toUpperCase();
    const {
      name,
      description,
      issueDate,
      totalSupply,
      consensusMechanism,
      blockchainNetwork,
      features,
      websiteUrl,
      whitepaperUrl,
    } = req.body;

    const client = getSupabaseClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (issueDate !== undefined) updateData.issue_date = issueDate;
    if (totalSupply !== undefined) updateData.total_supply = totalSupply;
    if (consensusMechanism !== undefined) updateData.consensus_mechanism = consensusMechanism;
    if (blockchainNetwork !== undefined) updateData.blockchain_network = blockchainNetwork;
    if (features !== undefined) updateData.features = features;
    if (websiteUrl !== undefined) updateData.website_url = websiteUrl;
    if (whitepaperUrl !== undefined) updateData.whitepaper_url = whitepaperUrl;

    const { data, error } = await client
      .from('token_info')
      .update(updateData)
      .eq('token_symbol', symbol)
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: '代币信息不存在' });
    }

    res.json({
      success: true,
      message: '更新成功',
      data: {
        id: data.id,
        symbol: data.token_symbol,
        name: data.name,
        description: data.description,
        issueDate: data.issue_date,
        totalSupply: data.total_supply,
        consensusMechanism: data.consensus_mechanism,
        blockchainNetwork: data.blockchain_network,
        features: data.features,
        websiteUrl: data.website_url,
        whitepaperUrl: data.whitepaper_url,
      },
    });
  } catch (error) {
    console.error('更新代币信息失败:', error);
    res.status(500).json({ success: false, error: '更新代币信息失败' });
  }
});

/**
 * 创建代币信息 (管理后台)
 * POST /api/v1/market/token-info
 * Body: symbol, name, description, issueDate, totalSupply, consensusMechanism, blockchainNetwork, features, websiteUrl, whitepaperUrl
 */
router.post('/token-info', async (req: Request, res: Response) => {
  try {
    const {
      symbol,
      name,
      description,
      issueDate,
      totalSupply,
      consensusMechanism,
      blockchainNetwork,
      features,
      websiteUrl,
      whitepaperUrl,
    } = req.body;

    if (!symbol || !name) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }

    const client = getSupabaseClient();

    const { data, error } = await client
      .from('token_info')
      .insert({
        token_symbol: symbol.toUpperCase(),
        name,
        description: description || '',
        issue_date: issueDate || null,
        total_supply: totalSupply || null,
        consensus_mechanism: consensusMechanism || null,
        blockchain_network: blockchainNetwork || null,
        features: features || [],
        website_url: websiteUrl || null,
        whitepaper_url: whitepaperUrl || null,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    res.json({
      success: true,
      message: '创建成功',
      data: {
        id: data?.id,
        symbol: data?.token_symbol,
        name: data?.name,
      },
    });
  } catch (error) {
    console.error('创建代币信息失败:', error);
    res.status(500).json({ success: false, error: '创建代币信息失败' });
  }
});

export default router;
