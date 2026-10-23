import { IconSymbol } from '@/components/ui/icon-symbol';
import { DataService } from '@/services/api';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { 
  ActivityIndicator, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

export default function VerifyOTPScreen() {
  const router = useRouter();
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleVerify = async () => {
    if (!otp || otp.length < 4) {
      Toast.show({ type: 'error', text1: 'Invalid Code', text2: 'Please enter the code sent to your email' });
      return;
    }
    setIsLoading(true);
    try {
      await DataService.verifyOtp(identifier || '', otp);
      Toast.show({ type: 'success', text1: 'Verified', text2: 'Security clearance confirmed.' });
      router.push({ pathname: '/reset-password', params: { identifier, otp } } as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Verification Failed', text2: error.message || 'Invalid code' });
    } finally { setIsLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Cinematic Header */}
      <View className="bg-forest pt-12 pb-10 overflow-hidden">
          <View className="absolute top-[-20px] left-[-20px] w-48 h-48 bg-mint/5 rounded-full" />
          <View className="px-6 flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                  <IconSymbol name="chevron.left" size={20} color="white" />
              </TouchableOpacity>
              <Text className="text-white text-xl font-black tracking-tight">Security Check</Text>
          </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <Animated.View entering={FadeInDown.duration(800)}>
              <View className="w-20 h-20 bg-gold/10 rounded-3xl items-center justify-center mb-8">
                  <Text className="text-4xl">📧</Text>
              </View>
              <Text className="text-textDark font-black text-3xl mb-3 tracking-tight">Verify Code</Text>
              <Text className="text-textLight text-sm font-medium leading-relaxed mb-10">We&apos;ve sent a unique security code to your registered email. Please enter it below to proceed.</Text>

              <View className="mb-8">
                  <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-3 px-1">One-Time Security Code</Text>
                  <View className="bg-white border border-gray-100 rounded-[24px] p-6 shadow-sm">
                      <TextInput 
                          className="text-textDark font-black text-4xl text-center tracking-[8px] p-0"
                          placeholder="0000"
                          placeholderTextColor="#F1F5F9"
                          keyboardType="numeric"
                          maxLength={6}
                          value={otp}
                          onChangeText={setOtp}
                      />
                  </View>
              </View>

              <TouchableOpacity 
                  onPress={handleVerify}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  className="bg-leaf h-16 rounded-[24px] items-center justify-center flex-row shadow-xl shadow-leaf/20"
              >
                  {isLoading ? <ActivityIndicator color="white" /> : (
                      <>
                          <Text className="text-white font-black text-base uppercase tracking-widest mr-4">Verify Identity</Text>
                          <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"><IconSymbol name="checkmark" size={16} color="white" /></View>
                      </>
                  )}
              </TouchableOpacity>

              <View className="mt-12 items-center">
                  <TouchableOpacity onPress={() => router.back()}>
                      <Text className="text-leaf text-xs font-black uppercase tracking-widest">Resend Security Code</Text>
                  </TouchableOpacity>
              </View>
          </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
