import { IconSymbol } from "@/components/ui/icon-symbol";
import { getHomeRouteForUser, useAuth } from "@/context/AuthContext";
import { Stack, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Elite Security",
    subtitle: "SAFEGUARDING YOUR FUTURE",
    description:
      "Experience banking-grade security with encrypted transactions and real-time vault monitoring for your savings.",
    lottie: "https://assets2.lottiefiles.com/packages/lf20_96as4imv.json", // Security/Shield
  },
  {
    id: "2",
    title: "Smart Liquidity",
    subtitle: "BANKING WITHOUT BOUNDARIES",
    description:
      "Withdraw and deposit instantly across mobile money networks with zero friction and total transparency.",
    lottie: "https://assets9.lottiefiles.com/packages/lf20_yoz76sc6.json", // Wallet/Money
  },
  {
    id: "3",
    title: "Teacher Empowerment",
    subtitle: "ELEVATING THE PILLAR",
    description:
      "A financial ecosystem built exclusively for Ugandan teachers, designed to turn every salary into a digital legacy.",
    lottie: "https://assets5.lottiefiles.com/packages/lf20_tf7e7fuz.json", // People/Growth
  },
];

export default function SplashScreen() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [stage, setStage] = useState<"splash" | "onboarding">("splash");
  const [currentIndex, setCurrentIndex] = useState(0);
  const progress = useSharedValue(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 2500 });

    if (!authLoading) {
      if (user) {
        router.replace(getHomeRouteForUser(user));
        return;
      }

      const timer = setTimeout(() => {
        setStage("onboarding");
      }, 2800);

      return () => clearTimeout(timer);
    }

  }, [authLoading, user]);

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace("/login");
    }
  };

  const progressStyle = useAnimatedStyle(() => {
    return { width: `${progress.value * 100}%` };
  });

  const renderSlide = ({ item }: { item: (typeof SLIDES)[0] }) => (
    <View
      style={{ width }}
      className="flex-1 items-center justify-center px-10"
    >
      <Animated.View
        entering={FadeInDown.duration(1000).springify()}
        className="items-center justify-center mb-10"
        style={{ width: width * 0.8, height: width * 0.8 }}
      >
        <LottieView
          autoPlay
          loop
          style={{ width: "100%", height: "100%" }}
          source={{ uri: item.lottie }}
          renderMode="SOFTWARE"
        />
      </Animated.View>
      <View className="items-center">
        <Animated.Text
          entering={FadeInUp.delay(200).duration(800)}
          className="text-saccoGreen font-black text-[10px] uppercase tracking-[6px] mb-4"
        >
          {item.subtitle}
        </Animated.Text>
        <Animated.Text
          entering={FadeInUp.delay(400).duration(800)}
          className="text-slate-900 text-4xl font-black text-center mb-6 tracking-[-1px]"
        >
          {item.title}
        </Animated.Text>
        <Animated.Text
          entering={FadeIn.delay(600).duration(1000)}
          className="text-slate-500 text-center text-lg leading-7 px-4 font-medium"
        >
          {item.description}
        </Animated.Text>
      </View>
    </View>
  );

  if (stage === "onboarding") {
    return (
      <View className="flex-1 bg-white">
        <Stack.Screen options={{ headerShown: false }} />

        {/* Skip Button */}
        <TouchableOpacity
          onPress={() => router.replace("/login")}
          className="absolute top-14 right-8 z-20 px-5 py-2.5 bg-slate-50 rounded-full border border-slate-100"
        >
          <Text className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">
            Skip Introduction
          </Text>
        </TouchableOpacity>

        <View className="absolute top-[-50] right-[-50] w-[200] h-[200] bg-saccoGreen/5 rounded-full blur-[60px]" />
        <View className="absolute bottom-[-50] left-[-50] w-[200] h-[200] bg-saccoGreen/5 rounded-full blur-[60px]" />

        <FlatList
          ref={flatListRef}
          data={SLIDES}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={(e) =>
            setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width))
          }
          keyExtractor={(item) => item.id}
        />

        <View className="absolute bottom-20 left-0 right-0 px-10 flex-row items-center justify-between">
          <View className="flex-row space-x-2">
            {SLIDES.map((_, i) => (
              <View
                key={i}
                className={`h-1.5 rounded-full ${currentIndex === i ? "w-8 bg-saccoGreen" : "w-2 bg-slate-100"}`}
              />
            ))}
          </View>

          <TouchableOpacity
            onPress={handleNext}
            activeOpacity={0.8}
            className="bg-saccoGreen w-14 h-14 rounded-full items-center justify-center shadow-lg shadow-green-500/30"
          >
            <IconSymbol
              name={
                currentIndex === SLIDES.length - 1 ? "checkmark" : "arrow.right"
              }
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F8FAFC] items-center justify-between">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="absolute top-1/4 left-[-100] w-[350] h-[350] bg-saccoGreen/5 rounded-full blur-[80px]" />
      <View className="absolute bottom-1/4 right-[-100] w-[400] h-[400] bg-saccoGreen/5 rounded-full blur-[100px]" />

      <View className="flex-1 items-center justify-between w-full py-20">
        <View className="flex-1 items-center justify-center w-full px-8">
          <Animated.View
            entering={FadeInDown.duration(1200).springify()}
            className="items-center justify-center mb-12"
            style={{ width: width * 0.7, height: width * 0.7 }}
          >
            <Image
              source={require("../assets/images/sacco-logo.jpg")}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
            />
          </Animated.View>
          <View className="items-center">
            <Animated.Text
              entering={FadeInDown.delay(300).duration(800)}
              className="text-6xl font-black text-slate-900 text-3xl tracking-[-3px] text-center mb-1"
            >
              BUKONZO
            </Animated.Text>
            <Animated.Text
              entering={FadeInDown.delay(500).duration(800)}
              className="text-lg font-bold text-saccoGreen tracking-[8px] text-center mb-10 pl-2"
            >
              TEACHERS SACCO
            </Animated.Text>
            <Animated.Text
              entering={FadeIn.delay(1200)}
              className="text-slate-500 text-center font-medium italic text-base px-6 leading-7"
            >
              &ldquo;The Digital Cornerstone{"\n"}of Ugandan Teacher Empowerment&rdquo;
            </Animated.Text>
          </View>
        </View>
        <View className="w-full px-14 items-center">
          <View className="w-full h-[3px] bg-slate-100 rounded-full overflow-hidden mb-12 shadow shadow-green-500/5">
            <Animated.View
              className="h-full bg-saccoGreen rounded-full shadow-lg shadow-green-400"
              style={progressStyle}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
