import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/context/AuthContext";
import { Stack, useRouter } from "expo-router";
import React from "react";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const { width } = Dimensions.get("window");

export default function MemberCardScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <View className="flex-1 bg-forest">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Dynamic Background Accents */}
      <View className="absolute top-[-50px] right-[-50px] w-[300px] h-[300px] bg-mint/10 rounded-full" />
      <View className="absolute bottom-[-100px] left-[-100px] w-[400px] h-[400px] bg-leaf/20 rounded-full" />

      <SafeAreaView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center border border-white/20"
          >
            <IconSymbol name="xmark" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-white font-black text-lg tracking-tight">
            Digital Member ID
          </Text>
          <View className="w-10" />
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 24,
            alignItems: "center",
            justifyContent: "center",
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* The ID Card - High Fidelity Premium Design */}
          <Animated.View
            entering={FadeInDown.duration(800).springify().damping(15)}
            className="w-full aspect-[1/1.58] bg-warmWhite rounded-[48px] overflow-hidden border border-white/50 shadow-2xl relative"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 20 },
              shadowOpacity: 0.2,
              shadowRadius: 40,
            }}
          >
            {/* Visual Textures */}
            <View className="absolute top-0 right-0 p-8 opacity-5">
              <IconSymbol name="leaf.fill" size={200} color="#1A6B47" />
            </View>

            {/* Card Header Branding */}
            <View className="p-10 pb-4 flex-row justify-between items-center">
              <View>
                <View className="flex-row items-center mb-1">
                  <Text className="text-forest text-2xl font-black tracking-tighter">
                    BUKOZO
                  </Text>
                  <View className="w-1.5 h-1.5 bg-mint rounded-full ml-1 mt-1" />
                </View>
                <Text className="text-leaf text-[8px] font-black tracking-[4px] uppercase">
                  Teachers SACCO Official
                </Text>
              </View>
              <View className="w-12 h-12 bg-forest rounded-2xl items-center justify-center">
                <IconSymbol name="shield.fill" size={24} color="#F5C842" />
              </View>
            </View>

            {/* Profile Photo - Glassy Container */}
            <View className="items-center mt-6">
              <Animated.View
                entering={FadeInUp.delay(300).duration(800)}
                className="w-44 h-44 rounded-[40px] border-8 border-white shadow-xl overflow-hidden relative"
              >
                <Image
                  source={{
                    uri:
                      user?.image ||
                      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
                  }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
                <View className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-forest/40 to-transparent" />
              </Animated.View>
            </View>

            {/* Member Details */}
            <View className="items-center mt-8 px-10">
              <Animated.Text
                entering={FadeIn.delay(500)}
                className="text-forest text-3xl font-black text-center mb-1 tracking-tight"
              >
                {user?.name || "MEMBER NAME"}
              </Animated.Text>
              <Animated.View
                entering={FadeIn.delay(600)}
                className="bg-leaf/10 px-4 py-1.5 rounded-full mb-8"
              >
                <Text className="text-leaf font-black text-[10px] tracking-[2px] uppercase">
                  {(user as any)?.role || "GOLD MEMBER"}
                </Text>
              </Animated.View>

              {/* Meta Info Grid */}
              <View className="w-full flex-row justify-between mb-8 border-t border-b border-gray-100 py-6">
                <View>
                  <Text className="text-textLight text-[8px] font-black uppercase tracking-[2px] mb-1">
                    Member ID
                  </Text>
                  <Text className="text-forest font-black text-sm">
                    #BKZ-{user?.id?.slice(-6).toUpperCase() || "739420"}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-textLight text-[8px] font-black uppercase tracking-[2px] mb-1">
                    Active Since
                  </Text>
                  <Text className="text-forest font-black text-sm">2023</Text>
                </View>
              </View>

              {/* QR Authority */}
              <Animated.View
                entering={FadeIn.delay(800)}
                className="p-5 bg-white rounded-3xl border border-gray-50 shadow-sm"
              >
                <IconSymbol name="qrcode" size={70} color="#0D3D2B" />
              </Animated.View>
            </View>

            {/* Card Edge Finish */}
            <View className="absolute bottom-0 left-0 right-0 h-3 bg-mint" />
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(1000)}
            className="text-white/40 text-[9px] text-center mt-10 font-black tracking-[4px] uppercase opacity-60"
          >
            Digital Authority Key • Bukonzo SACCO
          </Animated.Text>

          <TouchableOpacity
            onPress={() => router.back()}
            className="mt-12 w-full bg-white/10 py-5 rounded-[24px] border border-white/20 items-center shadow-xl"
          >
            <Text className="text-white font-black uppercase tracking-widest text-xs">
              Dismiss Identification
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
