import React, { useMemo } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { createStyles } from './styles';
import { alert } from '@/utils/alert';

interface ArticleItem {
  id: string;
  icon: string;
  title: string;
  description: string;
  content?: string;
}

const HELP_ARTICLES: ArticleItem[] = [
  {
    id: 'what-is-ai',
    icon: 'coins',
    title: '什么是 AI 代币？',
    description: '了解 AI 代币的基本概念和用途',
    content: `AI 是 BoostAra 平台的治理代币，基于区块链技术发行。

主要用途：
• 行情交易：AI 是平台行情展示的主要代币
• 治理投票：持有 AI 可参与平台治理决策
• 手续费抵扣：使用 AI 支付手续费可享折扣

总供应量：10亿枚
初始流通：1亿枚`,
  },
  {
    id: 'what-is-gpu',
    icon: 'microchip',
    title: '什么是 GPU 代币？',
    description: '了解 GPU 代币的基本概念和用途',
    content: `GPU 是 BoostAra 平台的功能代币。

主要用途：
• C2C交易：GPU 是平台C2C交易的主要代币
• 质押挖矿：持有 GPU 可参与质押获取收益
• 群组扩容：使用 GPU 扩容群组容量

获取方式：
• C2C交易区购买
• 质押收益
• 推广奖励`,
  },
  {
    id: 'how-to-get-tokens',
    icon: 'hand-holding-dollar',
    title: '如何获取代币？',
    description: '多种方式获取 AI/GPU 代币',
    content: `获取代币的方式：

1. C2C交易
   在平台C2C交易区购买其他用户出售的GPU

2. 质押收益
   参与平台质押活动，获得GPU作为收益

3. 推广奖励
   邀请好友注册并完成交易，获得奖励

4. 空投活动
   关注平台公告，参与各类空投活动`,
  },
  {
    id: 'stake-guide',
    icon: 'seedling',
    title: 'GPU 质押指南',
    description: '如何通过质押 GPU 获取收益',
    content: `GPU 质押说明：

质押方式：
• 活期质押：随时可取，日收益率约0.3%
• 180天定期：日收益率约0.5%
• 360天定期：日收益率约0.8%

质押流程：
1. 进入"质押"页面
2. 选择质押方式和金额
3. 确认质押
4. 每日自动发放收益

注意事项：
• 定期质押中途不可取出
• 收益以GPU形式发放
• 质押越多，收益越高`,
  },
  {
    id: 'c2c-guide',
    icon: 'arrow-right-arrow-left',
    title: 'C2C交易指南',
    description: '如何使用 GPU 进行C2C交易',
    content: `GPU C2C交易说明：

买家流程：
1. 发布买单，填写购买数量和价格
2. 等待卖家匹配
3. 卖家匹配后，按提示付款
4. 付款后等待卖家放币

卖家流程：
1. 浏览买单列表
2. 选择合适的买单点击出售
3. GPU将被冻结
4. 等待买家付款
5. 确认收款后放币

安全提示：
• 请在平台内完成所有交易
• 不要私下转账给陌生人
• 如有纠纷请及时申诉`,
  },
  {
    id: 'security',
    icon: 'shield-halved',
    title: '安全提示',
    description: '保护您的资产安全',
    content: `安全建议：

钱包安全：
• 妥善保管助记词，不要告诉任何人
• 定期更换钱包密码
• 不要截图保存助记词

交易安全：
• 确认收款后再放币
• 警惕低价诱惑
• 使用平台担保交易

账户安全：
• 开启二次验证
• 不要使用公共WiFi交易
• 定期检查账户活动`,
  },
  {
    id: 'faq',
    icon: 'circle-question',
    title: '常见问题',
    description: '常见问题解答',
    content: `常见问题：

Q: 提现需要多久？
A: 提现通常在10分钟内完成。

Q: 最小交易数量是多少？
A: 最小交易数量为10 GPU。

Q: 交易手续费是多少？
A: C2C交易手续费为0.5%。

Q: 如何联系客服？
A: 点击"帮助中心"或发送邮件至support@boostara.io`,
  },
];

export default function EducationScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();

  const handleArticlePress = (article: ArticleItem) => {
    // 可以跳转到详情页或显示Modal
    // 这里简化处理，直接显示内容
    alert(article.title, article.content);
  };

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <FontAwesome6 name="arrow-left" size={20} color={theme.textPrimary} />
          </TouchableOpacity>
          <ThemedText variant="h3" style={styles.headerTitle}>
            帮助中心
          </ThemedText>
          <View style={{ width: 40 }} />
        </View>

        {/* Banner */}
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <FontAwesome6 name="rocket" size={32} color={theme.primary} />
          </View>
          <View style={styles.bannerContent}>
            <ThemedText variant="title" style={styles.bannerTitle}>
              了解平台代币
            </ThemedText>
            <ThemedText variant="small" style={styles.bannerDesc}>
              AI 用于行情交易，GPU 用于 C2C 和质押
            </ThemedText>
          </View>
        </View>

        {/* Articles */}
        <View style={styles.section}>
          <ThemedText variant="smallMedium" style={styles.sectionTitle}>
            新手入门
          </ThemedText>
          {HELP_ARTICLES.slice(0, 3).map((article) => (
            <TouchableOpacity 
              key={article.id}
              style={styles.articleCard}
              onPress={() => handleArticlePress(article)}
            >
              <View style={styles.articleIcon}>
                <FontAwesome6 name={article.icon as any} size={20} color={theme.primary} />
              </View>
              <View style={styles.articleContent}>
                <ThemedText variant="smallMedium" style={styles.articleTitle}>
                  {article.title}
                </ThemedText>
                <ThemedText variant="caption" style={styles.articleDesc}>
                  {article.description}
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <ThemedText variant="smallMedium" style={styles.sectionTitle}>
            进阶指南
          </ThemedText>
          {HELP_ARTICLES.slice(3).map((article) => (
            <TouchableOpacity 
              key={article.id}
              style={styles.articleCard}
              onPress={() => handleArticlePress(article)}
            >
              <View style={styles.articleIcon}>
                <FontAwesome6 name={article.icon as any} size={20} color={theme.primary} />
              </View>
              <View style={styles.articleContent}>
                <ThemedText variant="smallMedium" style={styles.articleTitle}>
                  {article.title}
                </ThemedText>
                <ThemedText variant="caption" style={styles.articleDesc}>
                  {article.description}
                </ThemedText>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={theme.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact */}
        <View style={styles.contactSection}>
          <ThemedText variant="smallMedium" style={styles.sectionTitle}>
            联系我们
          </ThemedText>
          <View style={styles.contactCard}>
            <TouchableOpacity style={styles.contactItem}>
              <FontAwesome6 name="envelope" size={20} color={theme.primary} />
              <ThemedText variant="small" style={styles.contactText}>
                support@boostara.io
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactItem}>
              <FontAwesome6 name="globe" size={20} color={theme.primary} />
              <ThemedText variant="small" style={styles.contactText}>
                www.boostara.io
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}
