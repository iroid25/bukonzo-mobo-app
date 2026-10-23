import { IconSymbol } from '@/components/ui/icon-symbol';
import { DataService } from '@/services/api';
import { useRouter } from 'expo-router';
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRequestOTP = async () => {
    if (!email) {
      Toast.show({ type: 'error', text1: 'Required', text2: 'Please enter your Member ID or Email' });
      return;
    }
    setIsLoading(true);
    try {
      await DataService.forgotPassword(email);
      Toast.show({ type: 'success', text1: 'Security Code Sent', text2: 'Please check your email for the OTP' });
      router.push({ pathname: '/verify-otp', params: { identifier: email } } as any);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Request Failed', text2: error.message || 'Error' });
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
              <Text className="text-white text-xl font-black tracking-tight">Access Recovery</Text>
          </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <Animated.View entering={FadeInDown.duration(800)}>
              <View className="w-20 h-20 bg-mint/10 rounded-3xl items-center justify-center mb-8">
                  <Text className="text-4xl">🔐</Text>
              </View>
              <Text className="text-textDark font-black text-3xl mb-3 tracking-tight">Forgot Password?</Text>
              <Text className="text-textLight text-sm font-medium leading-relaxed mb-10">Don’t worry! It happens. Please enter the Member ID or Email associated with your account.</Text>

              <View className="mb-8">
                  <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-3 px-1">Identifier</Text>
                  <View className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-sm flex-row items-center">
                      <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-4">
                          <IconSymbol name="person.fill" size={18} color="#1A6B47" />
                      </View>
                      <TextInput 
                          className="flex-1 text-textDark font-bold text-base p-0"
                          placeholder="Member ID or Email"
                          placeholderTextColor="#8FA99D"
                          value={email}
                          onChangeText={setEmail}
                          autoCapitalize="none"
                      />
                  </View>
              </View>

              <TouchableOpacity 
                  onPress={handleRequestOTP}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  className="bg-leaf h-16 rounded-[24px] items-center justify-center flex-row shadow-xl shadow-leaf/20"
              >
                  {isLoading ? <ActivityIndicator color="white" /> : (
                      <>
                          <Text className="text-white font-black text-base uppercase tracking-widest mr-4">Send Security Code</Text>
                          <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"><IconSymbol name="paperplane.fill" size={16} color="white" /></View>
                      </>
                  )}
              </TouchableOpacity>

              <View className="mt-12 items-center">
                  <View className="flex-row items-center space-x-2 opacity-30">
                      <IconSymbol name="lock.fill" size={12} color="#4A6558" />
                      <Text className="text-[10px] text-textMid font-black ml-2 uppercase tracking-[3px]">Secure Vault Connection</Text>
                  </View>
              </View>
          </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
