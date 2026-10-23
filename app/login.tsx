import { IconSymbol } from "@/components/ui/icon-symbol";
import { getHomeRouteForUser, useAuth } from "@/context/AuthContext";
import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useState } from "react";
import {
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";

const BIOMETRIC_CREDS_KEY = "biometric-credentials";
const BIOMETRIC_ENABLED_KEY = "biometric-enabled";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);
        const enabled = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
        const creds = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
        if (enabled === "true" && creds) {
          setBiometricEnabled(true);
          setHasSavedCredentials(true);
        }
      } catch (e) {
        console.warn("Biometric check failed:", e);
      }
    };
    checkBiometric();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !biometricAvailable) {
      Toast.show({
        type: "error",
        text1: "Not Available",
        text2: "Biometric not set up on this device",
      });
      return;
    }
    setBiometricEnabled(value);
    if (!value) {
      await SecureStore.deleteItemAsync(BIOMETRIC_CREDS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      setHasSavedCredentials(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Toast.show({
        type: "error",
        text1: "Required",
        text2: "Please enter credentials",
      });
      return;
    }
    setIsLoading(true);
    try {
      await signIn(email, password);
      if (biometricEnabled && biometricAvailable) {
        const creds = JSON.stringify({ identifier: email, password });
        await SecureStore.setItemAsync(BIOMETRIC_CREDS_KEY, creds);
        await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
      }
      Toast.show({
        type: "success",
        text1: "Welcome Home",
        text2: "Authorization successful",
      });
    } catch (error: any) {
      Toast.show({
        type: "error",
        text1: "Auth Failed",
        text2: error.message || "Check credentials",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Login to BUKONZO SACCO",
        cancelLabel: "Use Password",
      });
      if (result.success) {
        const credsStr = await SecureStore.getItemAsync(BIOMETRIC_CREDS_KEY);
        if (!credsStr) return;
        const { identifier, password: savedPass } = JSON.parse(credsStr);
        setIsLoading(true);
        try {
          const authedUser = await signIn(identifier, savedPass);
          router.replace(getHomeRouteForUser(authedUser));
        } catch (error) {
          Toast.show({
            type: "error",
            text1: "Sync Failed",
            text2: "Please use password login",
          });
        } finally {
          setIsLoading(false);
        }
      }
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      {/* Decorative brand glow, matches the splash screen */}
      <View className="absolute top-[-100] left-[-100] w-[350] h-[350] bg-saccoGreen/5 rounded-full" />
      <View className="absolute bottom-[-80] right-[-100] w-[350] h-[350] bg-saccoGreen/5 rounded-full" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            entering={FadeInDown.duration(700)}
            className="items-center pt-16 pb-8 px-8"
          >
            <View
              className="w-24 h-24 rounded-full bg-white items-center justify-center mb-5 border border-gray-100"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              <Image
                source={require("../assets/images/sacco-logo.jpg")}
                style={{ width: 68, height: 68, borderRadius: 34 }}
                resizeMode="cover"
              />
            </View>
            <Text className="text-slate-900 text-3xl font-black tracking-[-1px] text-center">
              BUKONZO
            </Text>
            <Text className="text-saccoGreen text-xs font-bold tracking-[6px] text-center mb-4">
              TEACHERS SACCO
            </Text>
            <Text className="text-slate-400 text-[11px] font-bold uppercase tracking-[3px]">
              Member Login
            </Text>
          </Animated.View>

          {/* Form Container */}
          <Animated.View
            entering={FadeInUp.delay(150).duration(700)}
            className="flex-1 px-8 pb-12"
          >
            <View>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                Member Identity
              </Text>
              <View
                className="bg-white border border-gray-100 rounded-[20px] p-4 flex-row items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="w-10 h-10 bg-saccoLightGreen rounded-xl items-center justify-center mr-3">
                  <IconSymbol name="person.fill" size={18} color="#00C853" />
                </View>
                <TextInput
                  className="flex-1 text-slate-900 font-bold text-base p-0"
                  placeholder="Member ID or Email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View className="mt-5">
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                Security Key
              </Text>
              <View
                className="bg-white border border-gray-100 rounded-[20px] p-4 flex-row items-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="w-10 h-10 bg-saccoLightGreen rounded-xl items-center justify-center mr-3">
                  <IconSymbol name="lock.fill" size={18} color="#00C853" />
                </View>
                <TextInput
                  className="flex-1 text-slate-900 font-bold text-base p-0"
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="pl-3"
                >
                  <IconSymbol
                    name={showPassword ? "eye.slash.fill" : "eye.fill"}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push("/forgot-password")}
              className="self-end mt-3"
            >
              <Text className="text-saccoGreen text-xs font-black uppercase tracking-widest">
                Forgot Password?
              </Text>
            </TouchableOpacity>

            {/* Biometric Integration */}
            {biometricAvailable && (
              <View
                className="bg-white border border-gray-100 rounded-[20px] p-4 flex-row items-center justify-between mt-6"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.04,
                  shadowRadius: 6,
                  elevation: 2,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 bg-saccoLightGreen rounded-xl items-center justify-center mr-3">
                    <IconSymbol name="fingerprint" size={20} color="#00C853" />
                  </View>
                  <View>
                    <Text className="text-slate-900 font-bold text-sm">
                      Face / Touch ID
                    </Text>
                    <Text className="text-slate-400 text-[10px] font-medium">
                      Seamless Access
                    </Text>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleBiometricToggle}
                  trackColor={{ false: "#E5E7EB", true: "#00C853" }}
                  thumbColor={"#FFF"}
                />
              </View>
            )}

            {/* Primary Actions */}
            <View className="pt-8">
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                className="bg-saccoGreen h-16 rounded-[20px] items-center justify-center flex-row"
                style={{
                  shadowColor: "#00C853",
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Text className="text-white font-black text-base uppercase tracking-widest mr-3">
                      Authorize Login
                    </Text>
                    <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center">
                      <IconSymbol name="arrow.right" size={16} color="white" />
                    </View>
                  </>
                )}
              </TouchableOpacity>

              {hasSavedCredentials && biometricAvailable && (
                <TouchableOpacity
                  onPress={handleBiometricLogin}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  className="border-2 border-saccoLightGreen h-16 rounded-[20px] items-center justify-center flex-row mt-4"
                >
                  <IconSymbol name="fingerprint" size={20} color="#00C853" />
                  <Text className="text-saccoGreen font-black text-xs uppercase tracking-widest ml-3">
                    Quick Biometric Login
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer Branding */}
            <View className="pt-10 items-center">
              <Text className="text-slate-400 text-xs font-medium mb-1">
                New to the SACCO family?
              </Text>
              <TouchableOpacity>
                <Text className="text-saccoGreen font-black text-sm uppercase tracking-widest">
                  Join as a Member
                </Text>
              </TouchableOpacity>
            </View>

            <View className="pt-8 flex-row justify-center items-center opacity-40">
              <IconSymbol name="shield.fill" size={12} color="#6B7280" />
              <Text className="text-[10px] text-slate-500 font-black ml-2 uppercase tracking-[3px]">
                Secure Vault Connection
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
