import { IconSymbol } from '@/components/ui/icon-symbol';
import { DataService } from '@/services/api';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const THEME = {
  forest: '#1A6B47',
  leaf: '#2ECC8A',
  mint: '#2ECC8A',
  warmWhite: '#FBFBFB',
  ink: '#0B0F0E',
  text1: '#111816',
  text2: '#4B6558',
  text3: '#8BA898',
  gold: '#F5C842',
  amber: '#F59E0B',
  danger: '#F05069',
  blue: '#4EA8F5',
  border: 'rgba(0,0,0,0.05)',
  card: '#FFFFFF',
};

const fmt = (n: number) => n.toLocaleString();

export default function FloatManagementScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadFloatHistory();
  }, []);

  const loadFloatHistory = async () => {
    try {
      const historyRes = await DataService.getFloatTransactions();
      const historyData = historyRes.data?.data?.transactions
        || historyRes.data?.transactions
        || historyRes.data?.data
        || historyRes.data?.history
        || (Array.isArray(historyRes.data) ? historyRes.data : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (e) {
      console.error("Failed to load float history", e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFloatHistory();
    setRefreshing(false);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Header Section */}
      <View className="bg-forest pt-12 pb-8 px-6 rounded-b-[40px] shadow-xl">
          <View className="flex-row items-center">
              <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                  <IconSymbol name="chevron.left" size={20} color="white" />
              </TouchableOpacity>
              <View>
                <Text className="text-white text-xl font-black tracking-tight">Float Inventory</Text>
                <Text className="text-white/50 text-[10px] font-black uppercase tracking-[4px] mt-0.5">Terminal Node</Text>
              </View>
          </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 100, paddingTop: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.forest} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(800)}>
          
          {/* Protocol Card */}
          <View className="p-6 rounded-[32px] mb-8 bg-forest/5 border border-forest/5 relative overflow-hidden">
              <View className="absolute top-0 right-0 w-24 h-24 bg-forest/5 rounded-bl-full" />
              <View className="flex-row items-center mb-4">
                  <View className="w-10 h-10 bg-forest/10 rounded-xl items-center justify-center mr-3">
                      <IconSymbol name="info.circle.fill" size={18} color={THEME.forest} />
                  </View>
                  <Text className="text-forest text-sm font-black uppercase tracking-[2px]">How Float Works</Text>
              </View>
              <Text className="text-text2 text-[11px] leading-5 font-medium">
                  Float top-ups are handled in person: visit your branch and pay in cash to your accountant. They&apos;ll allocate it directly to your float account, and it&apos;ll show up here immediately.
              </Text>
          </View>

          <View className="flex-row justify-between items-center mb-6 px-1">
              <Text className="text-textLight text-[10px] font-black uppercase tracking-[4px]">Top-Up History</Text>
              <IconSymbol name="clock.arrow.2.circlepath" size={14} color="#94A3B8" />
          </View>

          {history.length === 0 ? (
            <View className="p-12 items-center rounded-[32px] border border-dashed border-gray-200 bg-white">
                <IconSymbol name="tray" size={32} color="#CBD5E1" />
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mt-4">History Vault Empty</Text>
            </View>
          ) : (
            <View className="space-y-4">
                {history.map((req: any) => (
                    <View key={req.id} className="p-5 rounded-[28px] bg-white border border-gray-100 flex-row items-center shadow-sm">
                        <View style={{ backgroundColor: req.status === 'APPROVED' ? 'rgba(46,204,138,0.05)' : 'rgba(245,158,11,0.05)' }} className="w-12 h-12 rounded-2xl items-center justify-center mr-4">
                            <IconSymbol 
                                name={req.status === 'APPROVED' ? 'checkmark.shield.fill' : 'clock.fill'} 
                                size={20} 
                                color={req.status === 'APPROVED' ? THEME.forest : THEME.amber} 
                            />
                        </View>
                        <View className="flex-1">
                            <Text className="text-textDark font-black text-base">{Number(req.amount).toLocaleString()} <Text className="text-textLight text-[10px]">UGX</Text></Text>
                            <Text className="text-textLight text-[10px] font-bold mt-1 uppercase tracking-widest">{req.date || new Date(req.createdAt).toLocaleDateString()}</Text>
                        </View>
                        <View className={`px-4 py-1.5 rounded-full ${req.status === 'APPROVED' ? 'bg-forest/10 border border-forest/10' : 'bg-gray-50 border border-gray-100'}`}>
                            <Text className={`text-[8px] font-black uppercase tracking-widest ${req.status === 'APPROVED' ? 'text-forest' : 'text-textMid'}`}>
                                {req.status}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
