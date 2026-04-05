import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { 
  ScrollView, 
  View, 
  TouchableOpacity, 
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { FontAwesome6 } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { showAlert, alert, confirm } from '@/utils/alert';
import { c2cApi, type BuyOrder, type C2COrder, type ChatMessage, configApi } from '@/services/api';
import { getBaseUrl } from '@/services/api';
import { createFormDataFile } from '@/utils';
import { createStyles } from './styles';

// 排队购买动画组件
function QueueAnimation() {
  const [dots] = useState(() => new Animated.Value(0));
  
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(dots, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(dots, { toValue: 2, duration: 300, useNativeDriver: true }),
        Animated.timing(dots, { toValue: 3, duration: 300, useNativeDriver: true }),
        Animated.timing(dots, { toValue: 0, duration: 300, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [dots]);
  
  const dotOpacity1 = dots.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.3, 1, 1, 1] });
  const dotOpacity2 = dots.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.3, 0.3, 1, 1] });
  const dotOpacity3 = dots.interpolate({ inputRange: [0, 1, 2, 3], outputRange: [0.3, 0.3, 0.3, 1] });
  
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B', marginHorizontal: 1, opacity: dotOpacity1 }} />
      <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B', marginHorizontal: 1, opacity: dotOpacity2 }} />
      <Animated.View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#F59E0B', marginHorizontal: 1, opacity: dotOpacity3 }} />
    </View>
  );
}

// 动态GPU字体动画组件
interface DynamicLabelProps {
  text: string;
  color: string;
}

function DynamicGPULabel({ text, color }: DynamicLabelProps) {
  const [glowAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(1));
  
  useEffect(() => {
    // 发光脉冲动画
    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    
    // 轻微缩放动画
    const scaleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    
    glowAnimation.start();
    scaleAnimation.start();
    
    return () => {
      glowAnimation.stop();
      scaleAnimation.stop();
    };
  }, [glowAnim, scaleAnim]);
  
  const textShadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });
  
  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Animated.Text
        style={{
          fontSize: 18,
          fontWeight: '800',
          color: color,
          letterSpacing: 4,
          transform: [{ scale: scaleAnim }],
          textShadowColor: color,
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 8,
          opacity: textShadowOpacity.interpolate({
            inputRange: [0.3, 1],
            outputRange: [0.7, 1],
          }),
        }}
      >
        {text}
      </Animated.Text>
    </View>
  );
}

// 状态配置将在组件内部动态生成
const getStatusConfig = (t: any) => ({
  pending_payment: { label: t('c2c.pending'), color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)' },
  paid: { label: t('c2c.paid'), color: '#3B82F6', bgColor: 'rgba(59,130,246,0.15)' },
  completed: { label: t('c2c.completed'), color: '#22C55E', bgColor: 'rgba(34,197,94,0.15)' },
  cancelled: { label: t('c2c.cancelled'), color: '#6B7280', bgColor: 'rgba(107,114,128,0.15)' },
  appealing: { label: t('c2c.disputed'), color: '#EF4444', bgColor: 'rgba(239,68,68,0.15)' },
});

const getBuyOrderStatusConfig = (t: any) => ({
  pending: { label: t('c2c.pending'), color: '#F59E0B', bgColor: 'rgba(245,158,11,0.15)' },
  matched: { label: t('c2c.matched'), color: '#3B82F6', bgColor: 'rgba(59,130,246,0.15)' },
  completed: { label: t('c2c.completed'), color: '#22C55E', bgColor: 'rgba(34,197,94,0.15)' },
  cancelled: { label: t('c2c.cancelled'), color: '#6B7280', bgColor: 'rgba(107,114,128,0.15)' },
});

const getOrderStatusFilters = (t: any) => [
  { key: 'ongoing', label: t('c2c.ongoing') },
  { key: 'completed', label: t('c2c.completed') },
  { key: 'cancelled', label: t('c2c.cancelled') },
  { key: 'appealing', label: t('c2c.appealing') },
  { key: 'buying', label: t('c2c.buying') },
];

export default function C2CScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useSafeRouter();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  
  // 动态生成状态配置
  const STATUS_CONFIG = useMemo(() => getStatusConfig(t), [t]);
  const BUY_ORDER_STATUS_CONFIG = useMemo(() => getBuyOrderStatusConfig(t), [t]);
  const ORDER_STATUS_FILTERS = useMemo(() => getOrderStatusFilters(t), [t]);
  
  // 分区选择: 新人区/大单区
  const [zoneType, setZoneType] = useState<'newbie' | 'big'>('newbie');
  
  // 自动分配模式
  const [autoMatchEnabled, setAutoMatchEnabled] = useState(false);
  const [nextBuyOrder, setNextBuyOrder] = useState<BuyOrder | null>(null);
  
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // 数据
  const [buyOrders, setBuyOrders] = useState<BuyOrder[]>([]);
  const [myOrders, setMyOrders] = useState<C2COrder[]>([]);
  const [myBuyOrders, setMyBuyOrders] = useState<BuyOrder[]>([]);
  
  // C2C买家列表标签配置
  const [labelConfig, setLabelConfig] = useState<{ text: string; color: string; enabled: boolean }>({
    text: 'GPU',
    color: '#22C55E',
    enabled: true,
  });
  
  // 弹窗状态
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [showOrderDetail, setShowOrderDetail] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  
  // 选中的订单
  const [selectedOrder, setSelectedOrder] = useState<BuyOrder | null>(null);
  const [selectedC2COrder, setSelectedC2COrder] = useState<C2COrder | null>(null);
  
  // 订单筛选
  const [orderFilter, setOrderFilter] = useState('ongoing');
  
  // 表单状态
  const [buyAmount, setBuyAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('7.25');
  const [sellAmount, setSellAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // 聊天相关
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  
  // 付款凭证相关
  const [paymentProofUri, setPaymentProofUri] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  
  // 卖家收款信息
  const [sellerPaymentInfo, setSellerPaymentInfo] = useState<any[]>([]);
  // 买家手机号
  const [buyerPhone, setBuyerPhone] = useState<string | null>(null);
  // 买家选择的支付方式
  const [selectedPaymentType, setSelectedPaymentType] = useState<string | null>(null);
  // 聊天窗口中订单详情是否展开
  const [isOrderDetailExpanded, setIsOrderDetailExpanded] = useState(true);
  // 收款方式是否展开
  const [isPaymentMethodExpanded, setIsPaymentMethodExpanded] = useState(false);

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [authLoading, isAuthenticated]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      // 获取标签配置
      try {
        const configResult = await configApi.getPublic();
        if (configResult.success && configResult.data?.config?.c2c_buyer_list_label) {
          const labelStr = configResult.data.config.c2c_buyer_list_label;
          const parsed = JSON.parse(labelStr);
          setLabelConfig({
            text: parsed.text || 'GPU',
            color: parsed.color || '#22C55E',
            enabled: parsed.enabled !== false,
          });
        }
      } catch (e) {
        // 使用默认配置
      }
      
      // 获取自动分配配置
      const nextOrderResult = await c2cApi.getNextBuyOrder();
      if (nextOrderResult.success && nextOrderResult.data) {
        setAutoMatchEnabled(nextOrderResult.data.autoMatchEnabled);
        setNextBuyOrder(nextOrderResult.data.nextOrder);
      }
      
      // 如果自动分配未开启，加载买单列表
      if (!nextOrderResult.data?.autoMatchEnabled) {
        const orderType = zoneType === 'newbie' ? 'small' : 'big';
        const ordersResult = await c2cApi.getBuyOrders(orderType);
        if (ordersResult.success && ordersResult.data) {
          setBuyOrders(ordersResult.data.orders);
        }
      }
      
      // 加载我的订单
      const [myResult, myBuyOrdersResult] = await Promise.all([
        c2cApi.getMyOrders(),
        c2cApi.getMyBuyOrders(),
      ]);

      if (myResult.success && myResult.data) {
        setMyOrders(myResult.data.orders);
      }
      if (myBuyOrdersResult.success && myBuyOrdersResult.data) {
        setMyBuyOrders(myBuyOrdersResult.data.orders);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }, [zoneType, isAuthenticated]);

  // 页面获得焦点时加载数据
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  // 监听分区切换，重新加载数据
  useEffect(() => {
    if (isAuthenticated && !loading) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneType]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 加载聊天消息
  const loadMessages = async (orderId: string) => {
    setLoadingMessages(true);
    try {
      const result = await c2cApi.getChatMessages(orderId);
      if (result.success && result.data) {
        setMessages(result.data.messages);
      }
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedC2COrder) return;
    
    const messageText = inputMessage.trim();
    setInputMessage('');
    
    try {
      const result = await c2cApi.sendMessage(selectedC2COrder.id, messageText);
      if (result.success) {
        await loadMessages(selectedC2COrder.id);
      }
    } catch (error) {
      console.error('Send message error:', error);
      showAlert(t('c2c.sendFailed'), t('c2c.sendFailedMsg'));
    }
  };

  // 打开订单聊天
  const openOrderChat = async (order: C2COrder) => {
    setSelectedC2COrder(order);
    setShowOrderDetail(false);
    setShowChatModal(true);
    loadMessages(order.id);
    
    // 清空之前的数据
    setSellerPaymentInfo([]);
    setBuyerPhone(null);
    setSelectedPaymentType(null);
    
    // 加载卖家收款信息
    if (order.seller_id) {
      try {
        const response = await fetch(`${getBaseUrl()}/api/v1/payment-info/user/${order.seller_id}`);
        const data = await response.json();
        if (data.success && data.data) {
          const paymentInfo = data.data.payment_info || [];
          setSellerPaymentInfo(paymentInfo);
          // 默认选择第一种支付方式
          if (paymentInfo.length > 0) {
            setSelectedPaymentType(paymentInfo[0].payment_type);
          }
        }
      } catch (error) {
        console.error('Load seller payment info error:', error);
      }
    }
    
    // 加载买家手机号
    if (order.buyer_id) {
      try {
        const response = await fetch(`${getBaseUrl()}/api/v1/payment-info/user/${order.buyer_id}`);
        const data = await response.json();
        if (data.success && data.data && data.data.payment_info) {
          // 从收款信息中提取手机号
          const phoneInfo = data.data.payment_info.find((info: any) => info.phone);
          if (phoneInfo && phoneInfo.phone) {
            setBuyerPhone(phoneInfo.phone);
          }
        }
      } catch (error) {
        console.error('Load buyer phone error:', error);
      }
    }
  };

  // 出售操作
  const handleSell = async () => {
    // 自动分配模式：使用下一个待分配的买单
    // 手动模式：使用选中的买单
    const orderToSell = autoMatchEnabled ? nextBuyOrder : selectedOrder;
    
    if (!orderToSell) {
      showAlert('提示', autoMatchEnabled ? '暂无可匹配的买单' : '请选择买单');
      return;
    }
    
    // 必须输入出售数量
    if (!sellAmount || sellAmount.trim() === '') {
      showAlert('提示', '请输入出售数量');
      return;
    }
    
    // 验证出售数量
    const amount = parseFloat(sellAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('错误', '请输入有效的出售数量');
      return;
    }
    if (amount > parseFloat(orderToSell.amount)) {
      showAlert('错误', '出售数量不能超过买单数量');
      return;
    }
    
    try {
      setSubmitting(true);
      // 自动分配模式不传 buy_order_id，手动模式传 buy_order_id
      const result = autoMatchEnabled 
        ? await c2cApi.sell(undefined, sellAmount)
        : await c2cApi.sell(orderToSell.id, sellAmount);
      if (result.success) {
        showAlert('成功', '订单已创建，请等待买家付款');
        setShowSellModal(false);
        setSelectedOrder(null);
        setSellAmount('');
        loadData();
      } else {
        showAlert('出售失败', result.error || '请稍后重试');
      }
    } catch (error: any) {
      showAlert('出售失败', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // 放币操作
  const handleRelease = async (orderId: string) => {
    showAlert(
      '放币确认',
      '确定要放币吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定放币', 
          onPress: async () => {
            try {
              const result = await c2cApi.release(orderId);
              if (result.success) {
                showAlert('成功', '已放币，交易完成');
                setShowChatModal(false);
                setShowOrderDetail(false);
                loadData();
              } else {
                showAlert('放币失败', result.error || '请稀后重试');
              }
            } catch (error: any) {
              showAlert('放币失败', error.message || '网络错误');
            }
          }
        }
      ]
    );
  };

  // 选择付款凭证图片
  const handlePickPaymentProof = async () => {
    try {
      // 请求相册权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('权限不足', '需要相册访问权限才能选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPaymentProofUri(result.assets[0].uri);
      }
    } catch (error: any) {
      showAlert('选择图片失败', error.message || '请重试');
    }
  };

  // 上传付款凭证到服务器
  const uploadPaymentProof = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingProof(true);
      const formData = new FormData();
      const file = await createFormDataFile(imageUri, 'payment_proof.jpg', 'image/jpeg');
      formData.append('file', file as any);

      const response = await fetch(`${getBaseUrl()}/api/v1/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      if (result.success && result.url) {
        return result.url;
      }
      throw new Error(result.message || '上传失败');
    } catch (error: any) {
      console.error('Upload payment proof error:', error);
      return null;
    } finally {
      setUploadingProof(false);
    }
  };

  // 确认付款（带付款凭证）
  const handleConfirmPayment = async (orderId: string) => {
    // 如果没有选择付款凭证，提示先选择
    if (!paymentProofUri) {
      showAlert(
        t('common.hint'),
        t('c2c.paymentProofHint'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('c2c.selectImage'),
            onPress: handlePickPaymentProof
          }
        ]
      );
      return;
    }

    showAlert(
      t('c2c.confirmPayment'),
      t('c2c.confirmPaymentMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              setSubmitting(true);

              // 先上传付款凭证
              const proofUrl = await uploadPaymentProof(paymentProofUri);
              if (!proofUrl) {
                showAlert(t('c2c.uploadFailed'), t('c2c.paymentProofUploadFailed'));
                return;
              }

              // 确认付款
              const result = await c2cApi.confirmPayment(orderId, proofUrl);
              if (result.success) {
                showAlert(t('c2c.success'), t('c2c.paymentConfirmed'));
                setPaymentProofUri(null); // 清空凭证
                loadData();
                if (selectedC2COrder) {
                  loadMessages(selectedC2COrder.id);
                }
              } else {
                showAlert(t('c2c.confirmFailed'), result.error || t('c2c.pleaseRetry'));
              }
            } catch (error: any) {
              showAlert(t('c2c.confirmFailed'), error.message || t('common.networkError'));
            } finally {
              setSubmitting(false);
            }
          }
        }
      ]
    );
  };

  // 取消订单
  const handleCancelOrder = async (orderId: string) => {
    showAlert(
      '取消订单',
      '确定要取消此订单吗？',
      [
        { text: '返回', style: 'cancel' },
        { 
          text: '确定取消', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await c2cApi.cancel(orderId);
              if (result.success) {
                showAlert('成功', '订单已取消');
                setShowChatModal(false);
                setShowOrderDetail(false);
                loadData();
              } else {
                showAlert('取消失败', result.error || '请稀后重试');
              }
            } catch (error: any) {
              showAlert('取消失败', error.message || '网络错误');
            }
          }
        }
      ]
    );
  };

  // 卖家发起申诉
  const handleAppeal = async (orderId: string) => {
    showAlert(
      '发起申诉',
      '确定要对此订单发起申诉吗？客服将介入处理。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '确定申诉', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await c2cApi.appeal(orderId, '卖家发起申诉');
              if (result.success) {
                showAlert('成功', '申诉已提交，请等待处理');
                loadData();
              } else {
                showAlert('申诉失败', result.error || '请稀后重试');
              }
            } catch (error: any) {
              showAlert('申诉失败', error.message || '网络错误');
            }
          }
        }
      ]
    );
  };

  // 卖家取消申诉
  const handleCancelAppeal = async (orderId: string) => {
    showAlert(
      '取消申诉',
      '确定要取消申诉吗？订单将恢复正常状态。',
      [
        { text: '返回', style: 'cancel' },
        { 
          text: '确定取消', 
          onPress: async () => {
            try {
              const result = await c2cApi.cancelAppeal(orderId);
              if (result.success) {
                showAlert('成功', '申诉已取消');
                loadData();
              } else {
                showAlert('取消失败', result.error || '请稀后重试');
              }
            } catch (error: any) {
              showAlert('取消失败', error.message || '网络错误');
            }
          }
        }
      ]
    );
  };

  // 取消求购单
  const handleCancelBuyOrder = async (orderId: string) => {
    showAlert(
      '取消求购',
      '确定要取消此求购单吗？',
      [
        { text: '返回', style: 'cancel' },
        { 
          text: '确定取消', 
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await c2cApi.cancelBuyOrder(orderId);
              if (result.success) {
                showAlert('成功', '求购单已取消');
                loadData();
              } else {
                showAlert('取消失败', result.error || '请稀后重试');
              }
            } catch (error: any) {
              showAlert('取消失败', error.message || '网络错误');
            }
          }
        }
      ]
    );
  };

  // 发布买单
  const handleCreateBuyOrder = async () => {
    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      showAlert('错误', '请输入有效数量');
      return;
    }

    setSubmitting(true);
    try {
      const result = await c2cApi.createBuyOrder({
        amount: buyAmount,
        price: buyPrice,
        order_type: zoneType === 'newbie' ? 'small' : 'big',
      });

      if (result.success) {
        showAlert('成功', '买单发布成功！');
        setBuyAmount('');
        setShowBuyModal(false);
        loadData();
      } else {
        showAlert('发布失败', result.error || '请稀后重试');
      }
    } catch (error: any) {
      showAlert('发布失败', error.message || '网络错误');
    } finally {
      setSubmitting(false);
    }
  };

  // 筛选订单
  const getFilteredOrders = () => {
    if (orderFilter === 'buying') return [];
    if (orderFilter === 'ongoing') {
      // "进行中"包含 pending_payment 和 paid 两种状态
      return myOrders.filter(order => order.status === 'pending_payment' || order.status === 'paid');
    }
    return myOrders.filter(order => order.status === orderFilter);
  };

  // 显示加载状态
  if (authLoading || loading) {
    return (
      <Screen backgroundColor="#0D0D0D" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
          <ThemedText variant="caption" color="#6B7280" style={{ marginTop: 16 }}>
            {t('common.loading')}
          </ThemedText>
        </View>
      </Screen>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return null;
  }

  // 渲染求购单列表
  // 后端已根据 order_type (small/big) 筛选订单，前端无需额外过滤
  const renderBuyOrders = () => {
    // 直接使用后端返回的订单列表，无需再根据金额过滤
    if (buyOrders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <FontAwesome6 name="bag-shopping" size={32} color="#4B5563" />
          </View>
          <ThemedText variant="small" style={styles.emptyText}>
            {t('c2c.noBuyOrders')}
          </ThemedText>
        </View>
      );
    }

    return buyOrders.map((order) => (
      <View key={order.id} style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <FontAwesome6 name="user" size={14} color="#F59E0B" />
            </View>
            <View>
              <ThemedText variant="smallMedium" style={styles.userName}>
                {t('c2c.buyer')}
              </ThemedText>
              <ThemedText variant="caption" style={styles.orderTime}>
                {new Date(order.created_at).toLocaleDateString()}
              </ThemedText>
            </View>
          </View>
          <ThemedText variant="smallMedium" style={styles.orderTotal}>
            ¥{order.total_price}
          </ThemedText>
        </View>

        <View style={styles.orderDivider} />

        <View style={styles.orderDetails}>
          <View style={styles.orderDetailRow}>
            <ThemedText variant="small" style={styles.detailLabel}>{t('c2c.amount')}</ThemedText>
            <ThemedText variant="smallMedium" style={styles.detailValue}>{order.amount}</ThemedText>
          </View>
          
          {/* 动态标签分隔 - 后台可配置 */}
          {labelConfig.enabled && (
            <DynamicGPULabel text={labelConfig.text} color={labelConfig.color} />
          )}
          
          <View style={styles.orderDetailRow}>
            <ThemedText variant="small" style={styles.detailLabel}>{t('c2c.price')}</ThemedText>
            <ThemedText variant="smallMedium" style={styles.detailValue}>¥{order.price}</ThemedText>
          </View>
        </View>

        {/* 排队购买提示 */}
        <View style={styles.queueHint}>
          <FontAwesome6 name="spinner" size={12} color="#F59E0B" />
          <ThemedText variant="caption" style={styles.queueHintText}>
            {t('c2c.queueBuying')}
          </ThemedText>
          <QueueAnimation />
        </View>
      </View>
    ));
  };

  // 渲染聊天消息
  const renderChatMessage = (message: ChatMessage) => {
    const isMine = message.sender_id === user?.id;
    const isSystem = message.message_type === 'system';
    
    if (isSystem) {
      return (
        <View key={message.id} style={styles.systemMessage}>
          <ThemedText variant="caption" style={styles.systemMessageText}>
            {message.message}
          </ThemedText>
        </View>
      );
    }
    
    return (
      <View 
        key={message.id} 
        style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleOther]}
      >
        <ThemedText variant="small" style={isMine ? styles.messageTextMine : styles.messageTextOther}>
          {message.message}
        </ThemedText>
        <ThemedText variant="caption" style={styles.messageTime}>
          {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </View>
    );
  };

  // 渲染求购单（订单详情中的）
  const renderMyBuyOrders = () => {
    if (myBuyOrders.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <FontAwesome6 name="cart-shopping" size={32} color="#4B5563" />
          </View>
          <ThemedText variant="small" style={styles.emptyText}>
            {t('c2c.noBuyOrders')}
          </ThemedText>
        </View>
      );
    }

    return myBuyOrders.map((order) => {
      const statusInfo = BUY_ORDER_STATUS_CONFIG[order.status] || BUY_ORDER_STATUS_CONFIG.pending;
      
      return (
        <View key={order.id} style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <FontAwesome6 name="cart-shopping" size={14} color="#F59E0B" />
              </View>
              <View>
                <ThemedText variant="smallMedium" style={styles.userName}>
                  {t('c2c.buyOrder')}
                </ThemedText>
                <ThemedText variant="caption" style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleDateString()}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
              <ThemedText variant="captionMedium" style={{ color: statusInfo.color }}>
                {statusInfo.label}
              </ThemedText>
            </View>
          </View>

          <View style={styles.orderDivider} />

          <View style={styles.orderDetails}>
            <View style={styles.orderDetailRow}>
              <ThemedText variant="small" style={styles.detailLabel}>{t('c2c.buyAmount')}</ThemedText>
              <ThemedText variant="smallMedium" style={styles.detailValue}>{order.amount} GPU</ThemedText>
            </View>
            <View style={styles.orderDetailRow}>
              <ThemedText variant="small" style={styles.detailLabel}>{t('c2c.price')}</ThemedText>
              <ThemedText variant="smallMedium" style={styles.detailValue}>¥{order.price}</ThemedText>
            </View>
            <View style={styles.orderDetailRow}>
              <ThemedText variant="small" style={styles.detailLabel}>{t('c2c.total')}</ThemedText>
              <ThemedText variant="smallMedium" style={styles.detailValueHighlight}>¥{order.total_price}</ThemedText>
            </View>
          </View>

          {order.status === 'pending' && (
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={() => handleCancelBuyOrder(order.id)}
            >
              <ThemedText variant="smallMedium" style={styles.cancelButtonText}>
                {t('c2c.cancelBuy')}
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      );
    });
  };

  // 判断当前用户是否是卖家
  const isSeller = selectedC2COrder?.seller_id === user?.id;

  return (
    <Screen backgroundColor="#0D0D0D" statusBarStyle="light">
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#F59E0B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ThemedText variant="h2" style={styles.headerTitle}>
              {t('c2c.title')}
            </ThemedText>
            <ThemedText variant="caption" style={styles.headerSubtitle}>
              {t('c2c.subtitle')}
            </ThemedText>
          </View>
          <TouchableOpacity 
            style={styles.headerRight} 
            onPress={() => setShowOrderDetail(true)}
          >
            <FontAwesome6 name="clipboard-list" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.buyButton}
            onPress={() => setShowBuyModal(true)}
          >
            <View style={styles.buyButtonIcon}>
              <FontAwesome6 name="cart-plus" size={24} color="#F59E0B" />
            </View>
            <ThemedText variant="smallMedium" style={styles.buyButtonTitle}>
              {t('c2c.publishBuy')}
            </ThemedText>
            <ThemedText variant="caption" style={styles.buyButtonDesc}>
              {t('c2c.publishBuyDesc')}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.sellActionButton}
            onPress={() => {
              if (autoMatchEnabled) {
                // 自动分配模式：直接显示出售弹窗
                if (nextBuyOrder) {
                  setSelectedOrder(nextBuyOrder);
                  setShowSellModal(true);
                } else {
                  showAlert(t('common.hint'), t('c2c.noSellOrders'));
                }
              } else {
                // 手动模式：选择第一个买单
                if (buyOrders.length > 0) {
                  setSelectedOrder(buyOrders[0]);
                  setShowSellModal(true);
                } else {
                  showAlert(t('common.hint'), t('c2c.noSellOrders'));
                }
              }
            }}
          >
            <View style={styles.sellButtonIcon}>
              <FontAwesome6 name="coins" size={24} color="#000000" />
            </View>
            <ThemedText variant="smallMedium" style={styles.sellButtonTitle}>
              {t('c2c.sellAra')}
            </ThemedText>
            <ThemedText variant="caption" style={styles.sellButtonDesc}>
              {autoMatchEnabled ? '系统自动分配' : t('c2c.autoMatch')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* 自动分配模式：显示当前待分配的买单 */}
        {autoMatchEnabled && nextBuyOrder && (
          <View style={styles.autoMatchCard}>
            <View style={styles.autoMatchHeader}>
              <ThemedText variant="smallMedium" style={styles.autoMatchTitle}>
                当前待分配买单
              </ThemedText>
              <View style={[styles.zoneBadge, nextBuyOrder.order_type === 'big' ? styles.bigBadge : styles.smallBadge]}>
                <ThemedText variant="caption" style={styles.zoneBadgeText}>
                  {nextBuyOrder.order_type === 'big' ? '大单区' : '新人区'}
                </ThemedText>
              </View>
            </View>
            <View style={styles.autoMatchInfo}>
              <View style={styles.autoMatchRow}>
                <ThemedText variant="caption" style={styles.autoMatchLabel}>数量</ThemedText>
                <ThemedText variant="smallMedium" style={styles.autoMatchValue}>
                  {parseFloat(nextBuyOrder.amount).toFixed(2)} GPU
                </ThemedText>
              </View>
              <View style={styles.autoMatchRow}>
                <ThemedText variant="caption" style={styles.autoMatchLabel}>单价</ThemedText>
                <ThemedText variant="smallMedium" style={styles.autoMatchValue}>
                  ¥{parseFloat(nextBuyOrder.price).toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.autoMatchRow}>
                <ThemedText variant="caption" style={styles.autoMatchLabel}>总价</ThemedText>
                <ThemedText variant="title" style={styles.autoMatchValueHighlight}>
                  ¥{parseFloat(nextBuyOrder.total_price).toFixed(2)}
                </ThemedText>
              </View>
            </View>
          </View>
        )}

        {/* Zone Toggle - 仅在手动模式下显示 */}
        {!autoMatchEnabled && (
          <View style={styles.zoneToggle}>
            <TouchableOpacity 
              style={[styles.zoneBtn, zoneType === 'newbie' && styles.zoneBtnActive]}
              onPress={() => setZoneType('newbie')}
            >
              <ThemedText style={zoneType === 'newbie' ? styles.zoneTextActive : styles.zoneText}>
                {t('c2c.newbieZone')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.zoneBtn, zoneType === 'big' && styles.zoneBtnActive]}
              onPress={() => setZoneType('big')}
            >
              <ThemedText style={zoneType === 'big' ? styles.zoneTextActive : styles.zoneText}>
                {t('c2c.bigZone')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {/* Zone Content - 仅在手动模式下显示 */}
        {!autoMatchEnabled && (
          <View style={styles.zoneContent}>
            {renderBuyOrders()}
          </View>
        )}
        
        {/* 自动分配模式下无买单提示 */}
        {autoMatchEnabled && !nextBuyOrder && (
          <View style={styles.emptyContainer}>
            <ThemedText variant="smallMedium" style={styles.emptyText}>
              暂无可匹配的买单
            </ThemedText>
          </View>
        )}
      </ScrollView>

      {/* 订单详情弹窗 */}
      <Modal
        visible={showOrderDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOrderDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.orderDetailModal}>
            <View style={styles.modalHeader}>
              <ThemedText variant="title" style={styles.modalTitle}>{t('c2c.orderDetail')}</ThemedText>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowOrderDetail(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* 状态筛选 */}
            <View>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
                contentContainerStyle={styles.filterContainer}
              >
                {ORDER_STATUS_FILTERS.map(filter => (
                  <TouchableOpacity
                    key={filter.key}
                    style={[styles.filterBtn, orderFilter === filter.key && styles.filterBtnActive]}
                    onPress={() => setOrderFilter(filter.key)}
                  >
                    <ThemedText style={orderFilter === filter.key ? styles.filterTextActive : styles.filterText}>
                      {filter.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 订单列表 */}
            <ScrollView style={styles.orderList} showsVerticalScrollIndicator={false}>
              {/* 求购单列表 */}
              {orderFilter === 'buying' ? renderMyBuyOrders() : (
                <>
                  {getFilteredOrders().length > 0 ? getFilteredOrders().map((order) => {
                    const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.completed;
                    const isOrderSeller = order.seller_id === user?.id;
                    const isOrderClosed = order.status === 'completed' || order.status === 'cancelled';
                    
                    return (
                      <TouchableOpacity 
                        key={order.id} 
                        style={styles.orderCard}
                        activeOpacity={0.8}
                        onPress={() => {
                          if (isOrderClosed) {
                            showAlert(t('common.hint'), t('c2c.orderClosed'));
                            return;
                          }
                          openOrderChat(order);
                        }}
                      >
                        <View style={styles.orderHeader}>
                          <View style={styles.userInfo}>
                            <View style={styles.avatar}>
                              <FontAwesome6 name="arrow-right-arrow-left" size={14} color="#F59E0B" />
                            </View>
                            <View>
                              <ThemedText variant="smallMedium" style={styles.userName}>
                                {order.amount} GPU · ¥{order.total_price}
                              </ThemedText>
                              <ThemedText variant="caption" style={styles.orderTime}>
                                {new Date(order.created_at).toLocaleDateString()} · {isOrderSeller ? t('c2c.seller') : t('c2c.buyer')}
                              </ThemedText>
                            </View>
                          </View>
                          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                            <ThemedText variant="captionMedium" style={{ color: statusInfo.color }}>
                              {statusInfo.label}
                            </ThemedText>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  }) : (
                    orderFilter !== 'ongoing' && (
                      <View style={styles.emptyContainer}>
                        <View style={styles.emptyIcon}>
                          <FontAwesome6 name="receipt" size={32} color="#4B5563" />
                        </View>
                        <ThemedText variant="small" style={styles.emptyText}>
                          {t('c2c.noOrders')}
                        </ThemedText>
                      </View>
                    )
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 聊天弹窗 */}
      <Modal
        visible={showChatModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChatModal(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.chatModal}>
            {/* 聊天头部 */}
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setShowChatModal(false)}>
                <FontAwesome6 name="arrow-left" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <ThemedText variant="smallMedium" style={styles.chatHeaderTitle}>
                  订单聊天
                </ThemedText>
                {selectedC2COrder && (
                  <ThemedText variant="caption" style={styles.chatHeaderSubtitle}>
                    {selectedC2COrder.amount} GPU · ¥{selectedC2COrder.total_price}
                  </ThemedText>
                )}
              </View>
              {selectedC2COrder && (
                <View style={[styles.statusBadgeSmall, { 
                  backgroundColor: STATUS_CONFIG[selectedC2COrder.status]?.bgColor || 'rgba(34,197,94,0.15)' 
                }]}>
                  <ThemedText variant="caption" style={{ 
                    color: STATUS_CONFIG[selectedC2COrder.status]?.color || '#22C55E' 
                  }}>
                    {STATUS_CONFIG[selectedC2COrder.status]?.label || '已完成'}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* 订单详情区域 - 可展开/收起 */}
            {selectedC2COrder && (
              <View style={styles.orderDetailsCollapsible}>
                {/* 收起状态 - 只显示基本信息 */}
                <TouchableOpacity 
                  style={styles.orderDetailHeader}
                  onPress={() => setIsOrderDetailExpanded(!isOrderDetailExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderDetailSummary}>
                    <ThemedText variant="smallMedium" style={styles.detailValueHighlight}>
                      {selectedC2COrder.amount} GPU · ¥{selectedC2COrder.total_price}
                    </ThemedText>
                    <ThemedText variant="caption" style={[styles.detailValue, { color: isSeller ? '#F59E0B' : '#3B82F6', marginLeft: 8 }]}>
                      {isSeller ? '卖家' : '买家'}
                    </ThemedText>
                  </View>
                  <FontAwesome6 
                    name={isOrderDetailExpanded ? "chevron-up" : "chevron-down"} 
                    size={14} 
                    color="#6B7280" 
                  />
                </TouchableOpacity>
                
                {/* 展开状态 - 显示完整详情 */}
                {isOrderDetailExpanded && (
                  <View style={styles.orderDetailsExpanded}>
                    <View style={styles.orderDetailRow}>
                      <ThemedText variant="caption" style={styles.detailLabel}>数量</ThemedText>
                      <ThemedText variant="smallMedium" style={styles.detailValue}>{selectedC2COrder.amount} GPU</ThemedText>
                    </View>
                    <View style={styles.orderDetailRow}>
                      <ThemedText variant="caption" style={styles.detailLabel}>单价</ThemedText>
                      <ThemedText variant="smallMedium" style={styles.detailValue}>¥{selectedC2COrder.price}</ThemedText>
                    </View>
                    <View style={styles.orderDetailRow}>
                      <ThemedText variant="caption" style={styles.detailLabel}>总价</ThemedText>
                      <ThemedText variant="title" style={styles.detailValueHighlight}>¥{selectedC2COrder.total_price}</ThemedText>
                    </View>
                    <View style={styles.orderDetailRow}>
                      <ThemedText variant="caption" style={styles.detailLabel}>身份</ThemedText>
                      <ThemedText variant="smallMedium" style={[styles.detailValue, { color: isSeller ? '#F59E0B' : '#3B82F6' }]}>
                        {isSeller ? '卖家' : '买家'}
                      </ThemedText>
                    </View>
                    
                    {/* 显示买卖双方手机号 */}
                    {isSeller && buyerPhone && (
                      <View style={styles.orderDetailRow}>
                        <ThemedText variant="caption" style={styles.detailLabel}>买家手机号</ThemedText>
                        <ThemedText variant="smallMedium" style={styles.detailValue}>{buyerPhone}</ThemedText>
                      </View>
                    )}
                    {!isSeller && sellerPaymentInfo.some(info => info.phone) && (
                      <View style={styles.orderDetailRow}>
                        <ThemedText variant="caption" style={styles.detailLabel}>卖家手机号</ThemedText>
                        <ThemedText variant="smallMedium" style={styles.detailValue}>
                          {sellerPaymentInfo.find(info => info.phone)?.phone}
                        </ThemedText>
                      </View>
                    )}
                    
                    {/* 买家视角 - 卖家收款信息（可展开/收起） */}
                    {!isSeller && sellerPaymentInfo.length > 0 && (
                      <View style={styles.paymentInfoSection}>
                        <TouchableOpacity 
                          style={styles.paymentMethodHeader}
                          onPress={() => setIsPaymentMethodExpanded(!isPaymentMethodExpanded)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.paymentMethodHeaderLeft}>
                            <FontAwesome6 name="credit-card" size={14} color="#F59E0B" />
                            <ThemedText variant="smallMedium" style={styles.paymentMethodTitle}>收款方式</ThemedText>
                            {selectedPaymentType && (
                              <View style={styles.selectedPaymentBadge}>
                                <ThemedText variant="tiny" style={styles.selectedPaymentText}>
                                  {selectedPaymentType === 'alipay' ? '支付宝' :
                                   selectedPaymentType === 'wechat' ? '微信' : 'USDT'}
                                </ThemedText>
                              </View>
                            )}
                          </View>
                          <FontAwesome6 
                            name={isPaymentMethodExpanded ? "chevron-up" : "chevron-down"} 
                            size={12} 
                            color="#6B7280" 
                          />
                        </TouchableOpacity>
                        
                        {isPaymentMethodExpanded && (
                          <View style={styles.paymentMethodContent}>
                            {/* 支付方式选择器 */}
                            <View style={styles.paymentTypeSelector}>
                              {sellerPaymentInfo.map((info) => (
                                <TouchableOpacity
                                  key={info.payment_type}
                                  style={[
                                    styles.paymentTypeBtn,
                                    selectedPaymentType === info.payment_type && styles.paymentTypeBtnActive
                                  ]}
                                  onPress={() => setSelectedPaymentType(info.payment_type)}
                                >
                                  <FontAwesome6 
                                    name={
                                      info.payment_type === 'alipay' ? 'alipay' :
                                      info.payment_type === 'wechat' ? 'weixin' :
                                      info.payment_type === 'usdt_bsc' ? 'bitcoin-sign' : 'wallet'
                                    } 
                                    size={16} 
                                    color={selectedPaymentType === info.payment_type ? '#F59E0B' : '#6B7280'}
                                  />
                                  <ThemedText variant="caption" style={[
                                    styles.paymentTypeBtnText,
                                    selectedPaymentType === info.payment_type && styles.paymentTypeBtnTextActive
                                  ]}>
                                    {info.payment_type === 'alipay' ? '支付宝' :
                                     info.payment_type === 'wechat' ? '微信' : 'USDT'}
                                  </ThemedText>
                                </TouchableOpacity>
                              ))}
                            </View>
                            
                            {/* 选中的支付方式详情 */}
                            {(() => {
                              const selectedInfo = sellerPaymentInfo.find(info => info.payment_type === selectedPaymentType);
                              if (!selectedInfo) return null;
                              return (
                                <View style={styles.paymentInfoCompact}>
                                  <View style={styles.paymentInfoRow}>
                                    <ThemedText variant="caption" style={styles.paymentInfoLabel}>账号</ThemedText>
                                    <ThemedText variant="smallMedium" style={styles.paymentAccountText}>
                                      {selectedInfo.account_info}
                                    </ThemedText>
                                  </View>
                                  {selectedInfo.account_name && (
                                    <View style={styles.paymentInfoRow}>
                                      <ThemedText variant="caption" style={styles.paymentInfoLabel}>户名</ThemedText>
                                      <ThemedText variant="small" style={styles.paymentInfoValue}>{selectedInfo.account_name}</ThemedText>
                                    </View>
                                  )}
                                  {selectedInfo.phone && (
                                    <View style={styles.paymentInfoRow}>
                                      <ThemedText variant="caption" style={styles.paymentInfoLabel}>手机</ThemedText>
                                      <ThemedText variant="small" style={styles.paymentInfoValue}>{selectedInfo.phone}</ThemedText>
                                    </View>
                                  )}
                                  {selectedInfo.qrcode_url && (
                                    <TouchableOpacity 
                                      style={styles.viewQrcodeBtn}
                                      onPress={() => {
                                        setSelectedC2COrder({...selectedC2COrder, payment_proof: selectedInfo.qrcode_url} as any);
                                        setShowImagePreview(true);
                                      }}
                                    >
                                      <FontAwesome6 name="qrcode" size={14} color="#F59E0B" />
                                      <ThemedText variant="caption" style={{ color: '#F59E0B', marginLeft: 4 }}>查看收款码</ThemedText>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })()}
                          </View>
                        )}
                      </View>
                    )}
                    
                    {/* 查看付款凭证 - 买卖双方在paid状态都可查看 */}
                    {selectedC2COrder.status === 'paid' && selectedC2COrder.payment_proof && (
                      <View style={styles.paymentProofViewSection}>
                        <ThemedText variant="caption" style={styles.detailLabel}>
                          付款凭证
                        </ThemedText>
                        <TouchableOpacity onPress={() => setShowImagePreview(true)}>
                          <Image 
                            source={{ uri: selectedC2COrder.payment_proof }} 
                            style={styles.paymentProofViewImage}
                            resizeMode="contain"
                          />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 订单操作按钮 - 仅在未完成状态显示 */}
            {selectedC2COrder && selectedC2COrder.status !== 'completed' && selectedC2COrder.status !== 'cancelled' && (
              <View style={styles.chatActions}>
                {/* 买家操作 */}
                {!isSeller && selectedC2COrder.status === 'pending_payment' && (
                  <>
                    {/* 付款凭证上传区域 */}
                    <View style={styles.paymentProofSection}>
                      <ThemedText variant="caption" style={styles.paymentProofLabel}>
                        付款凭证
                      </ThemedText>
                      {paymentProofUri ? (
                        <View style={styles.paymentProofPreview}>
                          <Image source={{ uri: paymentProofUri }} style={styles.paymentProofImage} />
                          <TouchableOpacity 
                            style={styles.removeProofBtn}
                            onPress={() => setPaymentProofUri(null)}
                          >
                            <FontAwesome6 name="circle-xmark" size={20} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity 
                          style={styles.uploadProofBtn}
                          onPress={handlePickPaymentProof}
                        >
                          <FontAwesome6 name="image" size={24} color="#6B7280" />
                          <ThemedText variant="caption" style={styles.uploadProofText}>
                            点击上传付款凭证
                          </ThemedText>
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    <TouchableOpacity 
                      style={[styles.chatActionBtn, styles.confirmPaymentBtn]}
                      onPress={() => handleConfirmPayment(selectedC2COrder.id)}
                      disabled={uploadingProof || submitting}
                    >
                      {uploadingProof || submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <FontAwesome6 name="circle-check" size={16} color="#FFFFFF" />
                          <ThemedText variant="captionMedium" style={styles.chatActionTextWhite}>确认付款</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.chatActionBtn}
                      onPress={() => handleCancelOrder(selectedC2COrder.id)}
                    >
                      <FontAwesome6 name="circle-xmark" size={16} color="#EF4444" />
                      <ThemedText variant="caption" style={styles.chatActionTextRed}>取消订单</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
                {/* 卖家操作 */}
                {isSeller && selectedC2COrder.status === 'paid' && (
                  <>
                    <TouchableOpacity 
                      style={[styles.chatActionBtn, styles.releaseBtn]}
                      onPress={() => handleRelease(selectedC2COrder.id)}
                    >
                      <FontAwesome6 name="paper-plane" size={16} color="#FFFFFF" />
                      <ThemedText variant="captionMedium" style={styles.chatActionTextWhite}>放币</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.chatActionBtn}
                      onPress={() => handleAppeal(selectedC2COrder.id)}
                    >
                      <FontAwesome6 name="triangle-exclamation" size={16} color="#F59E0B" />
                      <ThemedText variant="caption" style={styles.chatActionTextYellow}>申诉</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
                {/* 买家在paid状态 - 等待卖家放币，可申诉 */}
                {!isSeller && selectedC2COrder.status === 'paid' && (
                  <>
                    <View style={styles.waitingNotice}>
                      <FontAwesome6 name="clock" size={14} color="#F59E0B" />
                      <ThemedText variant="caption" style={styles.waitingText}>
                        已确认付款，等待卖家放币
                      </ThemedText>
                    </View>
                    <TouchableOpacity 
                      style={styles.chatActionBtn}
                      onPress={() => handleAppeal(selectedC2COrder.id)}
                    >
                      <FontAwesome6 name="triangle-exclamation" size={16} color="#F59E0B" />
                      <ThemedText variant="caption" style={styles.chatActionTextYellow}>申诉</ThemedText>
                    </TouchableOpacity>
                  </>
                )}
                {/* 申诉中状态 - 卖家可取消申诉 */}
                {isSeller && selectedC2COrder.status === 'appealing' && (
                  <TouchableOpacity 
                    style={styles.chatActionBtn}
                    onPress={() => handleCancelAppeal(selectedC2COrder.id)}
                  >
                    <FontAwesome6 name="rotate-left" size={16} color="#3B82F6" />
                    <ThemedText variant="caption" style={styles.chatActionTextBlue}>取消申诉</ThemedText>
                  </TouchableOpacity>
                )}
                {/* 申诉中状态 - 非卖家显示提示 */}
                {!isSeller && selectedC2COrder.status === 'appealing' && (
                  <View style={styles.appealingNotice}>
                    <FontAwesome6 name="circle-info" size={14} color="#F59E0B" />
                    <ThemedText variant="caption" style={styles.appealingText}>
                      订单正在申诉中，请等待客服处理
                    </ThemedText>
                  </View>
                )}
              </View>
            )}

            {/* 交易完成提示 */}
            {selectedC2COrder && (selectedC2COrder.status === 'completed' || selectedC2COrder.status === 'cancelled') && (
              <View style={styles.orderClosedNotice}>
                <FontAwesome6 
                  name={selectedC2COrder.status === 'completed' ? 'circle-check' : 'circle-xmark'} 
                  size={16} 
                  color={selectedC2COrder.status === 'completed' ? '#22C55E' : '#EF4444'} 
                />
                <ThemedText variant="caption" style={styles.orderClosedText}>
                  交易已{selectedC2COrder.status === 'completed' ? '完成' : '取消'}，可查看历史记录
                </ThemedText>
              </View>
            )}

            {/* 消息列表 */}
            <ScrollView 
              ref={scrollViewRef}
              style={styles.messageList}
              contentContainerStyle={styles.messageListContent}
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {loadingMessages ? (
                <ActivityIndicator size="large" color="#F59E0B" style={{ marginTop: 20 }} />
              ) : (
                messages.map(renderChatMessage)
              )}
              {messages.length === 0 && !loadingMessages && (
                <View style={styles.emptyMessages}>
                  <ThemedText variant="caption" style={styles.emptyText}>
                    暂无聊天记录
                  </ThemedText>
                </View>
              )}
            </ScrollView>

            {/* 输入框 - 交易结束后禁用 */}
            {selectedC2COrder && selectedC2COrder.status !== 'completed' && selectedC2COrder.status !== 'cancelled' ? (
              <View style={styles.inputBar}>
                <TextInput
                  style={styles.messageInput}
                  value={inputMessage}
                  onChangeText={setInputMessage}
                  placeholder="输入消息..."
                  placeholderTextColor="#6B7280"
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  style={[styles.sendBtn, !inputMessage.trim() && styles.sendBtnDisabled]}
                  onPress={handleSendMessage}
                  disabled={!inputMessage.trim()}
                >
                  <FontAwesome6 name="paper-plane" size={18} color={inputMessage.trim() ? "#000000" : "#6B7280"} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.inputBarDisabled}>
                <ThemedText variant="caption" style={styles.inputDisabledText}>
                  交易已结束，无法发送消息
                </ThemedText>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 发布求购弹窗 */}
      <Modal
        visible={showBuyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBuyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <View style={styles.modalHeader}>
              <ThemedText variant="title" style={styles.modalTitle}>发布求购</ThemedText>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowBuyModal(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <ThemedText variant="caption" style={styles.formLabel}>购买数量 (GPU)</ThemedText>
              <TextInput
                style={styles.formInput}
                value={buyAmount}
                onChangeText={setBuyAmount}
                placeholder="输入数量"
                placeholderTextColor="#6B7280"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText variant="caption" style={styles.formLabel}>单价 (CNY)</ThemedText>
              <View style={styles.inputWithSuffix}>
                <TextInput
                  style={styles.formInputFlex}
                  value={buyPrice}
                  onChangeText={setBuyPrice}
                  placeholder="输入单价"
                  placeholderTextColor="#6B7280"
                  keyboardType="numeric"
                />
                <ThemedText variant="small" style={styles.inputSuffix}>CNY/GPU</ThemedText>
              </View>
            </View>

            <View style={styles.totalInfo}>
              <ThemedText variant="caption" style={styles.totalLabel}>总金额</ThemedText>
              <ThemedText variant="title" style={styles.totalValue}>
                ¥{((parseFloat(buyAmount) || 0) * (parseFloat(buyPrice) || 0)).toFixed(2)}
              </ThemedText>
            </View>

            <TouchableOpacity 
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleCreateBuyOrder}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <ThemedText variant="smallMedium" style={styles.submitBtnText}>发布买单</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 出售确认弹窗 */}
      <Modal
        visible={showSellModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSellModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.formModal}>
            <View style={styles.modalHeader}>
              <ThemedText variant="title" style={styles.modalTitle}>确认出售</ThemedText>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowSellModal(false)}>
                <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <>
                <View style={styles.confirmInfo}>
                  <View style={styles.confirmRow}>
                    <ThemedText variant="caption" style={styles.confirmLabel}>买单数量</ThemedText>
                    <ThemedText variant="smallMedium" style={styles.confirmValue}>
                      {selectedOrder.amount} GPU
                    </ThemedText>
                  </View>
                  <View style={styles.confirmRow}>
                    <ThemedText variant="caption" style={styles.confirmLabel}>单价</ThemedText>
                    <ThemedText variant="smallMedium" style={styles.confirmValue}>
                      ¥{selectedOrder.price}
                    </ThemedText>
                  </View>
                  
                  {/* 出售数量输入 */}
                  <View style={styles.confirmInputRow}>
                    <ThemedText variant="caption" style={styles.confirmLabel}>出售数量</ThemedText>
                    <TextInput
                      style={styles.amountInput}
                      value={sellAmount}
                      onChangeText={setSellAmount}
                      placeholder={`最多 ${selectedOrder.amount}`}
                      placeholderTextColor="#6B7280"
                      keyboardType="numeric"
                    />
                  </View>
                  
                  {/* 计算总金额 */}
                  <View style={styles.confirmRow}>
                    <ThemedText variant="caption" style={styles.confirmLabel}>预计总金额</ThemedText>
                    <ThemedText variant="title" style={styles.confirmValueHighlight}>
                      ¥{sellAmount ? (parseFloat(sellAmount) * parseFloat(String(selectedOrder.price))).toFixed(2) : selectedOrder.total_price}
                    </ThemedText>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                  onPress={handleSell}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#000000" />
                  ) : (
                    <ThemedText variant="smallMedium" style={styles.submitBtnText}>确认出售</ThemedText>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* 图片预览弹窗 */}
      <Modal
        visible={showImagePreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImagePreview(false)}
      >
        <View style={styles.imagePreviewOverlay}>
          <TouchableOpacity 
            style={styles.imagePreviewClose}
            onPress={() => setShowImagePreview(false)}
          >
            <FontAwesome6 name="xmark" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedC2COrder?.payment_proof && (
            <Image 
              source={{ uri: selectedC2COrder.payment_proof }}
              style={styles.imagePreviewContent}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </Screen>
  );
}
