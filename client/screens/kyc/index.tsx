import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeRouter } from '@/hooks/useSafeRouter';
import { useAuth } from '@/contexts/AuthContext';
import { Screen } from '@/components/Screen';
import { ThemedText } from '@/components/ThemedText';
import { FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '@/services/api';

interface LivenessAction {
  action: string;
  label: string;
}

interface LivenessActionsResponse {
  actions: LivenessAction[];
  expiresInSeconds: number;
}

type KYCStep = 'intro' | 'liveness' | 'analyzing' | 'capture' | 'submitting' | 'result';

interface KYCStatus {
  status: 'none' | 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  submitted_at?: string;
}

export default function KYCScreen() {
  const router = useSafeRouter();
  const { user, refreshUser } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [step, setStep] = useState<KYCStep>('intro');
  const [kycStatus, setKycStatus] = useState<KYCStatus>({ status: 'none' });
  const [loading, setLoading] = useState(true);
  
  // 活体检测状态
  const [livenessActions, setLivenessActions] = useState<LivenessAction[]>([]);
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [actionCompleted, setActionCompleted] = useState<boolean[]>([]);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  // 获取KYC状态
  useEffect(() => {
    fetchKYCStatus();
  }, []);

  // 检查用户是否已通过KYC
  useEffect(() => {
    if (user?.is_kyc_verified && kycStatus.status !== 'approved') {
      setKycStatus({ status: 'approved' });
      setStep('result');
    }
  }, [user?.is_kyc_verified]);

  const fetchKYCStatus = async () => {
    if (user?.is_kyc_verified) {
      setKycStatus({ status: 'approved' });
      setStep('result');
      setLoading(false);
      return;
    }
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      const response = await fetch(`${baseUrl}/api/v1/kyc/status`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success && data.data) {
        setKycStatus({
          status: data.data.status || 'none',
          reject_reason: data.data.reject_reason,
          submitted_at: data.data.submitted_at,
        });
        
        if (data.data.status === 'approved' || data.data.status === 'pending') {
          setStep('result');
        }
      }
    } catch (error) {
      console.error('Fetch KYC status error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 活体检测倒计时（模拟模式 - 不需要真实拍照）
  useEffect(() => {
    if (step !== 'liveness' || livenessActions.length === 0) return;
    
    const currentAction = livenessActions[currentActionIndex];
    if (!currentAction) return;
    
    let countdownValue = 3;
    setCountdown(countdownValue);
    
    const timer = setInterval(() => {
      countdownValue -= 1;
      setCountdown(countdownValue);
      
      if (countdownValue <= 0) {
        clearInterval(timer);
        
        // 拍摄当前帧
        captureFrame();
        
        // 标记当前动作完成
        setActionCompleted(prev => {
          const newCompleted = [...prev];
          newCompleted[currentActionIndex] = true;
          return newCompleted;
        });
        
        // 延迟后进入下一步
        setTimeout(() => {
          if (currentActionIndex < livenessActions.length - 1) {
            setCurrentActionIndex(currentActionIndex + 1);
          } else {
            // 所有动作完成，开始验证
            verifyLiveness();
          }
        }, 500);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [step, currentActionIndex, livenessActions]);

  // 拍摄一帧
  const captureFrame = async () => {
    if (!cameraRef.current) {
      console.log('[KYC] Camera ref is null');
      return;
    }
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: true,
      });
      
      if (photo.base64) {
        // 直接使用base64，不添加任何前缀（让后端处理）
        console.log(`[KYC] Frame captured, base64 length: ${photo.base64.length}`);
        setCapturedFrames(prev => [...prev, photo.base64]);
      } else if (photo.uri && photo.uri.startsWith('data:image')) {
        // Web端可能直接返回data URI
        console.log(`[KYC] Frame from data URI, length: ${photo.uri.length}`);
        setCapturedFrames(prev => [...prev, photo.uri]);
      }
    } catch (error) {
      console.error('[KYC] Capture frame error:', error);
    }
  };

  // 开始活体检测
  const startLiveness = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('权限 needed', '需要相机权限才能进行人脸识别');
        return;
      }
    }
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      // 获取随机动作
      const response = await fetch(`${baseUrl}/api/v1/kyc/liveness/actions`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      const data = await response.json();
      if (data.success && data.data?.actions) {
        setLivenessActions(data.data.actions);
        setCurrentActionIndex(0);
        setActionCompleted(new Array(data.data.actions.length).fill(false));
        setCapturedFrames([]);
        setStep('liveness');
      } else {
        Alert.alert('错误', '获取活体检测指令失败');
      }
    } catch (error) {
      console.error('Start liveness error:', error);
      Alert.alert('错误', '网络错误，请重试');
    }
  };

  // 验证活体检测
  const verifyLiveness = async () => {
    setStep('analyzing');
    
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();
      
      console.log(`[KYC] Verifying liveness with ${capturedFrames.length} frames, actions: ${livenessActions.map(a => a.action).join(',')}`);
      
      const response = await fetch(`${baseUrl}/api/v1/kyc/liveness/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          frames: capturedFrames,
          requiredActions: livenessActions.map(a => a.action),
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.data?.isLive) {
        // 活体检测通过，进入人脸采集
        setStep('capture');
      } else {
        const message = data.message || '活体检测未通过，请重试';
        if (Platform.OS === 'web') {
          window.alert(message);
        } else {
          Alert.alert('验证失败', message);
        }
        setCapturedFrames([]);
        setStep('intro');
      }
    } catch (error) {
      console.error('Verify liveness error:', error);
      if (Platform.OS === 'web') {
        window.alert('网络错误，请重试');
      } else {
        Alert.alert('错误', '网络错误，请重试');
      }
      setCapturedFrames([]);
      setStep('intro');
    }
  };

  // 拍照
  const takePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.5,
        base64: true,
      });
      
      setCapturedPhoto(photo.uri);
      
      if (photo.uri && photo.uri.startsWith('data:image')) {
        setCapturedBase64(photo.uri);
      } else if (photo.base64) {
        setCapturedBase64(`data:image/jpeg;base64,${photo.base64}`);
      } else {
        setCapturedBase64(null);
      }
    } catch (error) {
      console.error('Take photo error:', error);
      Alert.alert('错误', '拍照失败，请重试');
    }
  };

  // 重拍
  const retakePhoto = () => {
    setCapturedPhoto(null);
    setCapturedBase64(null);
  };

  // 提交审核
  const submitKYC = async () => {
    if (!capturedBase64) {
      Alert.alert('错误', '照片数据丢失，请重新拍摄');
      setCapturedPhoto(null);
      setStep('capture');
      return;
    }

    setStep('submitting');

    try {
      const token = await AsyncStorage.getItem('auth_token');
      const baseUrl = getBaseUrl();

      if (!token) {
        Alert.alert('错误', '请先登录');
        router.replace('/login');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const apiResponse = await fetch(`${baseUrl}/api/v1/kyc/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            face_image: capturedBase64,
            liveness_actions: livenessActions.map(a => a.action),
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await apiResponse.json();

        if (data.success) {
          refreshUser?.();
          
          const message = data.data?.auto_approved 
            ? '恭喜！您的KYC认证已通过！' 
            : '您的KYC申请已提交，请等待审核';
          
          if (Platform.OS === 'web') {
            window.alert(message);
            router.back();
          } else {
            Alert.alert('提交成功', message, [
              { text: '确定', onPress: () => router.back() }
            ]);
          }
        } else {
          const isFaceDuplicate = data.message && (
            data.message.includes('人脸') || 
            data.message.includes('认证') ||
            data.message.includes('账号')
          );
          
          if (data.message === '无效的 token' || data.message === '未授权访问') {
            if (Platform.OS === 'web') {
              window.alert('登录已过期，请重新登录');
              router.replace('/login');
            } else {
              Alert.alert('登录已过期', '请重新登录', [
                { text: '确定', onPress: () => router.replace('/login') }
              ]);
            }
          } else if (isFaceDuplicate) {
            if (Platform.OS === 'web') {
              window.alert(data.message);
              router.back();
            } else {
              Alert.alert('认证失败', data.message, [
                { text: '确定', onPress: () => router.back() }
              ]);
            }
          } else {
            if (Platform.OS === 'web') {
              window.alert(data.message || '提交失败，请稍后重试');
            } else {
              Alert.alert('提交失败', data.message || '请稍后重试');
            }
            setStep('capture');
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          if (Platform.OS === 'web') {
            window.alert('请求超时，服务器响应时间过长，请重试');
          } else {
            Alert.alert('请求超时', '服务器响应时间过长，请重试');
          }
        } else {
          console.error('Fetch error:', fetchError);
          if (Platform.OS === 'web') {
            window.alert('网络错误：' + (fetchError.message || '请检查网络连接'));
          } else {
            Alert.alert('网络错误', fetchError.message || '请检查网络连接');
          }
        }
        setStep('capture');
      }
    } catch (error) {
      console.error('Submit KYC error:', error);
      if (Platform.OS === 'web') {
        window.alert('网络错误，请重试');
      } else {
        Alert.alert('错误', '网络错误，请重试');
      }
      setStep('capture');
    }
  };

  // 动作图标映射
  const getActionIcon = (action: string): string => {
    const iconMap: Record<string, string> = {
      'blink': 'eye',
      'open_mouth': 'face-smile',
      'shake_head': 'arrows-left-right',
      'nod': 'arrows-up-down',
    };
    return iconMap[action] || 'user';
  };

  // 渲染介绍页
  const renderIntro = () => (
    <View style={styles.container}>
      <View style={styles.introContent}>
        <View style={styles.iconWrap}>
          <FontAwesome6 name="shield-halved" size={48} color="#F59E0B" />
        </View>
        
        <ThemedText variant="h2" style={styles.introTitle}>KYC身份认证</ThemedText>
        <Text style={styles.introDesc}>
          完成人脸识别认证，解锁更多功能权限
        </Text>

        <View style={styles.stepsList}>
          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <FontAwesome6 name="camera" size={20} color="#F59E0B" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>AI活体检测</Text>
              <Text style={styles.stepDesc}>按照提示完成随机动作</Text>
            </View>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <FontAwesome6 name="face-smile" size={20} color="#F59E0B" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>人脸采集</Text>
              <Text style={styles.stepDesc}>拍摄清晰人脸照片</Text>
            </View>
          </View>
          
          <View style={styles.stepItem}>
            <View style={styles.stepIcon}>
              <FontAwesome6 name="clock" size={20} color="#F59E0B" />
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepTitle}>等待审核</Text>
              <Text style={styles.stepDesc}>人工审核通过后生效</Text>
            </View>
          </View>
        </View>

        {kycStatus.status === 'rejected' && (
          <View style={styles.rejectNotice}>
            <FontAwesome6 name="triangle-exclamation" size={16} color="#EF4444" />
            <Text style={styles.rejectText}>
              上次认证被拒绝：{kycStatus.reject_reason || '审核未通过'}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.startButton} onPress={startLiveness}>
        <Text style={styles.startButtonText}>开始认证</Text>
      </TouchableOpacity>
    </View>
  );

  // 渲染活体检测
  const renderLiveness = () => {
    const currentAction = livenessActions[currentActionIndex];
    if (!currentAction) return null;
    
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
        />
        
        <View style={styles.overlay}>
          <View style={styles.faceGuide} />
        </View>

        <View style={styles.livenessHeader}>
          <TouchableOpacity onPress={() => setStep('intro')}>
            <FontAwesome6 name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.livenessTitle}>AI活体检测</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.actionPrompt}>
          <View style={styles.actionIcon}>
            <FontAwesome6 name={getActionIcon(currentAction.action) as any} size={32} color="#F59E0B" />
          </View>
          <Text style={styles.actionText}>{currentAction.label}</Text>
          
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
          
          <View style={styles.progressDots}>
            {livenessActions.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  actionCompleted[index] && styles.dotCompleted,
                  index === currentActionIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>
          
          <Text style={styles.hintText}>
            已采集 {capturedFrames.length} 帧
          </Text>
        </View>
      </View>
    );
  };

  // 渲染分析中
  const renderAnalyzing = () => (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F59E0B" />
      <Text style={styles.analyzingText}>AI正在分析...</Text>
      <Text style={styles.analyzingHint}>检测是否为真人操作</Text>
    </View>
  );

  // 渲染拍照
  const renderCapture = () => (
    <View style={styles.cameraContainer}>
      {capturedPhoto ? (
        <>
          <Image source={{ uri: capturedPhoto }} style={styles.camera} />
          
          <View style={styles.captureHeader}>
            <TouchableOpacity onPress={retakePhoto}>
              <FontAwesome6 name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.captureTitle}>确认照片</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.captureActions}>
            <TouchableOpacity style={styles.retakeButton} onPress={retakePhoto}>
              <FontAwesome6 name="rotate-left" size={20} color="#FFFFFF" />
              <Text style={styles.retakeText}>重拍</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.submitButton} 
              onPress={submitKYC}
            >
              <FontAwesome6 name="check" size={20} color="#000000" />
              <Text style={styles.submitText}>提交审核</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="front"
          />
          
          <View style={styles.overlay}>
            <View style={styles.faceGuide} />
          </View>

          <View style={styles.captureHeader}>
            <TouchableOpacity onPress={() => setStep('intro')}>
              <FontAwesome6 name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.captureTitle}>人脸采集</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.capturePrompt}>
            <Text style={styles.capturePromptText}>请保持人脸在框内，光线充足</Text>
          </View>

          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <View style={styles.captureButtonInner} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // 渲染提交中
  const renderSubmitting = () => (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F59E0B" />
      <Text style={styles.submittingText}>正在提交审核...</Text>
    </View>
  );

  // 渲染结果
  const renderResult = () => (
    <View style={styles.container}>
      <View style={styles.resultContent}>
        {kycStatus.status === 'approved' ? (
          <>
            <View style={[styles.resultIcon, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
              <FontAwesome6 name="shield-check" size={48} color="#22C55E" />
            </View>
            <ThemedText variant="h2" style={styles.resultTitle}>认证通过</ThemedText>
            <Text style={styles.resultDesc}>您的身份已通过验证</Text>
          </>
        ) : kycStatus.status === 'pending' ? (
          <>
            <View style={[styles.resultIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <FontAwesome6 name="clock" size={48} color="#F59E0B" />
            </View>
            <ThemedText variant="h2" style={styles.resultTitle}>审核中</ThemedText>
            <Text style={styles.resultDesc}>请耐心等待人工审核</Text>
            <Text style={styles.resultTime}>
              提交时间：{kycStatus.submitted_at ? new Date(kycStatus.submitted_at).toLocaleString('zh-CN') : '-'}
            </Text>
          </>
        ) : (
          <>
            <View style={[styles.resultIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <FontAwesome6 name="shield-xmark" size={48} color="#EF4444" />
            </View>
            <ThemedText variant="h2" style={styles.resultTitle}>认证被拒绝</ThemedText>
            <Text style={styles.resultDesc}>{kycStatus.reject_reason || '审核未通过'}</Text>
          </>
        )}
      </View>

      <TouchableOpacity 
        style={styles.startButton} 
        onPress={() => {
          if (kycStatus.status === 'rejected') {
            setStep('intro');
            setCapturedPhoto(null);
            setCapturedBase64(null);
          } else {
            router.back();
          }
        }}
      >
        <Text style={styles.startButtonText}>
          {kycStatus.status === 'rejected' ? '重新认证' : '返回'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <Screen backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen backgroundColor="#000000" statusBarStyle="light">
      {step === 'intro' && renderIntro()}
      {step === 'liveness' && renderLiveness()}
      {step === 'analyzing' && renderAnalyzing()}
      {step === 'capture' && renderCapture()}
      {step === 'submitting' && renderSubmitting()}
      {step === 'result' && renderResult()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  introContent: {
    width: '100%',
    alignItems: 'center',
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  introTitle: {
    color: '#FFFFFF',
    marginBottom: 8,
  },
  introDesc: {
    color: '#6B7280',
    fontSize: 14,
    marginBottom: 40,
  },
  stepsList: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 16,
    borderRadius: 16,
    gap: 16,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
  },
  stepTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  stepDesc: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  rejectNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.15)',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  rejectText: {
    color: '#EF4444',
    fontSize: 13,
    flex: 1,
  },
  startButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  startButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: 260,
    height: 320,
    borderRadius: 160,
    borderWidth: 3,
    borderColor: '#F59E0B',
    backgroundColor: 'transparent',
  },
  livenessHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  livenessTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  actionPrompt: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  actionIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245,158,11,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  countdownCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(245,158,11,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  countdownText: {
    color: '#000000',
    fontSize: 28,
    fontWeight: '700',
  },
  progressDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#374151',
  },
  dotActive: {
    backgroundColor: '#F59E0B',
  },
  dotCompleted: {
    backgroundColor: '#22C55E',
  },
  hintText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 12,
  },
  analyzingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  analyzingHint: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
  },
  captureHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  captureTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  capturePrompt: {
    position: 'absolute',
    bottom: 180,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  capturePromptText: {
    color: '#FFFFFF',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  captureButton: {
    position: 'absolute',
    bottom: 60,
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F59E0B',
  },
  captureActions: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  submitText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  submittingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  resultContent: {
    alignItems: 'center',
    marginBottom: 40,
  },
  resultIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    color: '#FFFFFF',
    marginBottom: 8,
  },
  resultDesc: {
    color: '#6B7280',
    fontSize: 14,
  },
  resultTime: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 16,
  },
});
