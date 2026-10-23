import { IconSymbol } from '@/components/ui/icon-symbol';
import { useProfile } from '@/services/queries';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { 
  RefreshControl, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  View, 
  ActivityIndicator,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

// Helper for currency formatting
const fmt = (n: number) => 
  new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(n || 0);

export default function AccountsScreen() {
  const router = useRouter();
  const { data: userData, isLoading: loading, isRefetching: refreshing, refetch } = useProfile();

  const onRefresh = useCallback(async () => {
    try {
      await refetch();
    } catch (error: any) {
       if (error.response?.status !== 403) {
           Toast.show({
               type: 'error',
               text1: 'Sync Error',
               text2: 'Unable to refresh global accounts'
           });
       }
    }
  }, [refetch]);
  
  const AccountItem = ({ title, balance, accNo, type }: any) => {
    const getIcon = () => {
        if (type === 'SHARES') return '🏢';
        if (type === 'SAVINGS') return '💰';
        return '📅';
    };

    return (
        <TouchableOpacity 
            onPress={() => router.push(`/account/${accNo}` as any)} 
            activeOpacity={0.7}
            className="bg-white p-5 rounded-[28px] mb-4 flex-row items-center border border-gray-100 shadow-sm"
        >
            <View className="w-14 h-14 bg-gray-50 rounded-2xl items-center justify-center mr-4">
                <Text className="text-2xl">{getIcon()}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-1">{type || 'SAVINGS'}</Text>
                <Text className="font-bold text-textDark text-base mb-0.5">{title}</Text>
                <Text className="text-leaf text-[10px] font-bold opacity-70">•••• {accNo?.slice(-4) || 'XXXX'}</Text>
            </View>
            <View className="items-end">
                <Text className="font-black text-textDark text-lg">UGX {fmt(balance)}</Text>
                <View className="flex-row items-center mt-1">
                    <Text className="text-textLight text-[10px] mr-1">View details</Text>
                    <IconSymbol name="chevron.right" size={10} color="#9CA3AF" />
                </View>
            </View>
        </TouchableOpacity>
    );
  };

  if (loading && !userData) {
      return (
        <View className="flex-1 bg-warmWhite items-center justify-center">
            <ActivityIndicator size="large" color="#1A6B47" />
        </View>
      );
  }

  const u = userData;

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Hero Header */}
      <View className="bg-forest pt-12 pb-10 overflow-hidden">
          {/* Decorative Circles */}
          <View className="absolute top-[-40px] left-[-40px] w-64 h-64 bg-mint/5 rounded-full" />
          <View className="absolute bottom-[-20px] right-[-20px] w-32 h-32 bg-gold/10 rounded-full" />

          <View className="px-6 flex-row justify-between items-center mb-8">
              <View>
                  <Text className="text-white/60 text-[10px] font-black uppercase tracking-[2px] mb-1">Global Assets</Text>
                  <Text className="text-white text-3xl font-black tracking-tight">Accounts</Text>
              </View>
              <TouchableOpacity className="bg-white/10 p-3 rounded-2xl border border-white/20">
                  <IconSymbol name="plus" size={20} color="white" />
              </TouchableOpacity>
          </View>

          <View className="px-6">
              <View className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-6">
                   <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2">Total Combined Balance</Text>
                   <View className="flex-row items-baseline">
                       <Text className="text-white text-3xl font-black">UGX {fmt(u?.totalBalance)}</Text>
                       <Text className="text-mint text-xs font-bold ml-2">Active</Text>
                   </View>
                   
                   <View className="h-[1px] bg-white/10 my-4" />
                   
                   <View className="flex-row justify-between items-center">
                       <View className="flex-row -space-x-3">
                           {u?.accounts?.slice(0, 3).map((a: any, i: number) => (
                               <View key={i} className="w-8 h-8 rounded-full bg-leaf border-2 border-forest items-center justify-center">
                                   <Text className="text-[10px]">{i === 0 ? '💰' : i === 1 ? '🏦' : '📈'}</Text>
                               </View>
                           ))}
                       </View>
                       <Text className="text-white/50 text-[10px] font-bold">Updated {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                   </View>
              </View>
          </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B47" />}
      >
        
        <View className="flex-row justify-between items-center mb-5 px-1">
            <Text className="text-textMid text-xs font-black uppercase tracking-widest">Savings & Personal Funds</Text>
            <TouchableOpacity><Text className="text-leaf text-xs font-bold">Analytics</Text></TouchableOpacity>
        </View>

        {(() => {
            const savingsAccounts = u?.accounts?.filter((a:any) => a.type !== 'SHARES') || [];
            return savingsAccounts.length > 0 ? (
                savingsAccounts.map((acc:any) => (
                    <AccountItem 
                        key={acc.id}
                        title={acc.title} 
                        balance={acc.balance} 
                        accNo={acc.accNo} 
                        type={acc.type}
                    />
                ))
            ) : (
                <View className="bg-white p-8 rounded-[32px] items-center justify-center border border-gray-100 shadow-sm mb-4">
                    <Text className="text-4xl mb-3">📁</Text>
                    <Text className="text-textLight font-bold">No active savings accounts</Text>
                </View>
            );
        })()}

        <View className="flex-row justify-between items-center mb-5 mt-6 px-1">
            <Text className="text-textMid text-xs font-black uppercase tracking-widest">Investment & Equity</Text>
        </View>

        {(() => {
            const shareAccounts = u?.accounts?.filter((a:any) => a.type === 'SHARES') || [];
            return shareAccounts.length > 0 ? (
                shareAccounts.map((acc:any) => (
                    <AccountItem 
                        key={acc.id}
                        title={acc.title} 
                        balance={acc.balance} 
                        accNo={acc.accNo} 
                        type="EQUITY"
                    />
                ))
            ) : (
                <View className="bg-white p-8 rounded-[32px] items-center justify-center border border-gray-100 shadow-sm mb-4">
                    <Text className="text-4xl mb-3">📈</Text>
                    <Text className="text-textLight font-bold">No registered shares</Text>
                </View>
            );
        })()}

        {/* Invest Banner - Premium Style */}
        <TouchableOpacity activeOpacity={0.9} className="mt-8 rounded-[32px] overflow-hidden shadow-2xl shadow-forest/20">
            <View className="bg-forest p-8 relative">
                 {/* Background Accent */}
                 <View className="absolute top-0 right-0 w-32 h-32 bg-mint/10 rounded-bl-full" />
                 
                 <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-4">
                        <Text className="text-gold text-[10px] font-black uppercase tracking-[2px] mb-2">Exclusive Offer</Text>
                        <Text className="text-white text-2xl font-black mb-2 tracking-tight">Fixed Deposits</Text>
                        <Text className="text-white/60 text-xs font-medium leading-relaxed mb-6">Earn a premium 12% annual interest on your long-term savings.</Text>
                        
                        <View className="flex-row items-center space-x-2">
                             <View className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                                 <Text className="text-white font-black text-[10px]">OPEN ACCOUNT</Text>
                             </View>
                        </View>
                    </View>
                    <View className="bg-white/10 w-20 h-20 rounded-3xl items-center justify-center border border-white/20">
                         <Text className="text-4xl">💎</Text>
                    </View>
                 </View>
            </View>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
