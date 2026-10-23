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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { identifier, otp } = useLocalSearchParams<{ identifier: string, otp: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async () => {
    if (!password || password.length < 6) {
      Toast.show({ type: 'error', text1: 'Weak Password', text2: 'Password must be at least 6 characters' });
      return;
    }
    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: 'Mismatch', text2: 'Passwords do not match' });
      return;
    }

    setIsLoading(true);
    try {
      await DataService.resetPassword(identifier || '', otp || '', password);
      Toast.show({ type: 'success', text1: 'Password Secured', text2: 'Your new access key is active.' });
      router.replace('/login');
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Reset Failed', text2: error.message || 'Error' });
    } finally { setIsLoading(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Cinematic Header */}
      <View className="bg-forest pt-12 pb-10 overflow-hidden">
          <View className="absolute top-[-20px] left-[-20px] w-48 h-48 bg-gold/5 rounded-full" />
          <View className="px-6 flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                  <IconSymbol name="chevron.left" size={20} color="white" />
              </TouchableOpacity>
              <Text className="text-white text-xl font-black tracking-tight">Final Restoration</Text>
          </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
          <Animated.View entering={FadeInDown.duration(800)}>
              <View className="w-20 h-20 bg-leaf/10 rounded-3xl items-center justify-center mb-8">
                  <Text className="text-4xl">💎</Text>
              </View>
              <Text className="text-textDark font-black text-3xl mb-3 tracking-tight">New Password</Text>
              <Text className="text-textLight text-sm font-medium leading-relaxed mb-10">Verification confirmed. Please establish a powerful new security key for your SACCO account.</Text>

              <View className="space-y-6 mb-10">
                  <View>
                      <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-3 px-1">New Security Key</Text>
                      <View className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-sm flex-row items-center">
                          <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-4">
                              <IconSymbol name="lock.fill" size={18} color="#1A6B47" />
                          </View>
                          <TextInput 
                              className="flex-1 text-textDark font-bold text-base p-0"
                              placeholder="••••••••"
                              placeholderTextColor="#8FA99D"
                              secureTextEntry={!showPassword}
                              value={password}
                              onChangeText={setPassword}
                          />
                          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="pl-4">
                              <IconSymbol name={showPassword ? "eye.slash.fill" : "eye.fill"} size={18} color="#8FA99D" />
                          </TouchableOpacity>
                      </View>
                  </View>

                  <View>
                      <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-3 px-1">Confirm Security Key</Text>
                      <View className="bg-white border border-gray-100 rounded-[24px] p-5 shadow-sm flex-row items-center">
                          <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-4">
                              <IconSymbol name="lock.fill" size={18} color="#1A6B47" />
                          </View>
                          <TextInput 
                              className="flex-1 text-textDark font-bold text-base p-0"
                              placeholder="••••••••"
                              placeholderTextColor="#8FA99D"
                              secureTextEntry={!showPassword}
                              value={confirmPassword}
                              onChangeText={setConfirmPassword}
                          />
                      </View>
                  </View>
              </View>

              <TouchableOpacity 
                  onPress={handleReset}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  className="bg-forest h-16 rounded-[24px] items-center justify-center flex-row shadow-xl shadow-forest/20"
              >
                  {isLoading ? <ActivityIndicator color="white" /> : (
                      <>
                          <Text className="text-white font-black text-base uppercase tracking-widest mr-4">Confirm New Key</Text>
                          <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"><IconSymbol name="checkmark.shield.fill" size={16} color="white" /></View>
                      </>
                  )}
              </TouchableOpacity>

              <View className="mt-12 items-center">
                  <View className="flex-row items-center space-x-2 opacity-30">
                      <IconSymbol name="shield.fill" size={12} color="#4A6558" />
                      <Text className="text-[10px] text-textMid font-black ml-2 uppercase tracking-[3px]">Authorized Security Protocol</Text>
                  </View>
              </View>
          </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
