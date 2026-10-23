import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLoanProducts, useMyLoans } from '@/services/queries';
import { useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { 
  RefreshControl, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  View, 
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

// Helper for currency formatting
const fmt = (n: number) => 
  new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(n || 0);

export default function LoansScreen() {
  const router = useRouter();

  // Both reads are cached and shared. Loan products are catalogue data behind a
  // one-hour freshness window, and focus revalidation is handled centrally by
  // useQueryFocusSync, so returning to this tab normally paints from cache with
  // no requests at all. Pull-to-refresh is the explicit escape hatch.
  const { data: loans = [], isLoading, isRefetching, refetch } = useMyLoans();
  const { data: loanProducts = [], refetch: refetchProducts } = useLoanProducts();

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([refetch(), refetchProducts()]);
    } catch (error: any) {
      if (error.response?.status !== 403) {
        Toast.show({
            type: 'error',
            text1: 'Sync Error',
            text2: 'Unable to load credit details'
        });
      }
    }
  }, [refetch, refetchProducts]);
  
  const ProductCard = ({ item }: { item: any }) => (
    <TouchableOpacity 
        onPress={() => router.push({ pathname: '/apply-loan', params: { productId: item.id } } as any)}
        activeOpacity={0.8}
        className="mr-4 p-6 rounded-[32px] w-[260px] bg-white border border-gray-100 shadow-sm"
    >
        <View className="mb-6 bg-mint/10 self-start p-4 rounded-3xl">
            <IconSymbol name="briefcase.fill" size={24} color="#1A6B47" />
        </View>
        <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-1.5">{item.category || 'FINANCING'}</Text>
        <Text className="font-bold text-textDark text-lg mb-2 leading-tight">{item.name}</Text>
        <Text className="text-textMid text-xs mb-6 leading-relaxed" numberOfLines={2}>
            {item.description || `Access up to UGX ${fmt(item.maxAmount)} with flexible terms.`}
        </Text>
        
        <View className="flex-row items-center justify-between border-t border-gray-50 pt-4">
            <View className="flex-row items-center">
                <Text className="font-black text-leaf text-base">{item.interestRate}%</Text>
                <Text className="text-textLight text-[10px] ml-1 uppercase font-bold">interest</Text>
            </View>
            <View className="bg-gold/10 px-3 py-1 rounded-full">
                <Text className="text-gold text-[9px] font-black uppercase">Apply Now</Text>
            </View>
        </View>
    </TouchableOpacity>
  );

  if (isLoading && loans.length === 0) {
      return (
        <View className="flex-1 bg-warmWhite items-center justify-center">
            <ActivityIndicator size="large" color="#1A6B47" />
        </View>
      );
  }

  const activeLoans = loans.filter((l: any) => l.status === 'DISBURSED' || l.status === 'ACTIVE');
  const totalOutstanding = activeLoans.reduce((sum: number, l: any) => sum + (l.outstandingBalance || 0), 0);

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />

      {/* Hero Header */}
      <View className="bg-forest pt-12 pb-10 overflow-hidden">
          {/* Decorative Circles */}
          <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-gold/5 rounded-full" />
          <View className="absolute bottom-[-50px] left-[-30px] w-48 h-48 bg-mint/5 rounded-full" />

          <View className="px-6 flex-row justify-between items-center mb-8">
              <View>
                  <Text className="text-white/60 text-[10px] font-black uppercase tracking-[2px] mb-1">Credit Facilities</Text>
                  <Text className="text-white text-3xl font-black tracking-tight">Access Credit</Text>
              </View>
              <TouchableOpacity className="bg-white/10 p-3 rounded-2xl border border-white/20">
                  <IconSymbol name="info.circle" size={20} color="white" />
              </TouchableOpacity>
          </View>

          <View className="px-6">
              <View className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[32px] p-6">
                   <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2">Outstanding Balance</Text>
                   <View className="flex-row items-baseline mb-4">
                       <Text className="text-white text-3xl font-black">UGX {fmt(totalOutstanding)}</Text>
                       <View className={`${activeLoans.length > 0 ? 'bg-gold/20 border-gold/30' : 'bg-mint/20 border-mint/30'} border px-2 py-0.5 rounded-full ml-3`}>
                           <Text className={`${activeLoans.length > 0 ? 'text-gold' : 'text-mint'} text-[9px] font-black uppercase`}>
                               {activeLoans.length > 0 ? `${activeLoans.length} Active` : 'Clear'}
                           </Text>
                       </View>
                   </View>
                   
                   <View className="flex-row items-center space-x-2">
                       <View className="w-1.5 h-1.5 bg-mint rounded-full" />
                       <Text className="text-white/60 text-[10px] font-bold">
                           {activeLoans.length > 0 ? 'Repayments are active' : 'You are eligible for a new loan'}
                       </Text>
                   </View>
              </View>
          </View>
      </View>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#1A6B47" />}
      >
        
        <View className="mt-8 px-6">
            <View className="flex-row justify-between items-center mb-5 px-1">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest">Active Credit Facilities</Text>
                <TouchableOpacity><Text className="text-leaf text-xs font-bold">History</Text></TouchableOpacity>
            </View>

            {activeLoans.length > 0 ? (
                activeLoans.map((loan: any, idx: number) => {
                    const progress = loan.amountGranted > 0 ? (1 - (loan.outstandingBalance / loan.amountGranted)) : 0;
                    return (
                    <TouchableOpacity key={idx} activeOpacity={0.9} className="bg-white rounded-[36px] shadow-sm border border-gray-100 overflow-hidden mb-4">
                        <View className="p-7">
                            <View className="flex-row justify-between items-start mb-8">
                                <View>
                                    <Text className="text-textDark font-black text-xl mb-1">{loan.loanProduct?.name || 'Loan'}</Text>
                                    <View className="flex-row items-center space-x-2">
                                        <View className="w-2 h-2 bg-leaf rounded-full" />
                                        <Text className="text-textLight text-[10px] font-bold uppercase">
                                            Disbursed {new Date(loan.disbursedAt || loan.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </Text>
                                    </View>
                                </View>
                                <View className="bg-leaf px-4 py-1.5 rounded-full">
                                    <Text className="text-white text-[10px] font-black uppercase tracking-wider">Active</Text>
                                </View>
                            </View>

                            <View className="flex-row justify-between items-end mb-8">
                                <View>
                                    <Text className="text-textLight text-[10px] font-black uppercase tracking-[2px] mb-2">Principal Owed</Text>
                                    <Text className="text-textDark text-3xl font-black tracking-tight">UGX {fmt(loan.outstandingBalance)}</Text>
                                </View>
                            </View>

                            <View className="space-y-3 mb-8">
                                 <View className="flex-row justify-between items-center px-1">
                                     <Text className="text-textMid text-[10px] font-bold">Repayment Progress</Text>
                                     <Text className="text-leaf text-[10px] font-black">{(progress * 100).toFixed(0)}% PAID</Text>
                                 </View>
                                 <View className="h-2.5 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                     <View 
                                        className="h-full bg-gradient-to-r from-leaf to-mint rounded-full" 
                                        style={{ width: `${Math.min(progress * 100, 100)}%` }} 
                                     />
                                 </View>
                            </View>

                            <View className="flex-row bg-gray-50 rounded-[24px] p-4 items-center">
                                 <View className="w-10 h-10 bg-white rounded-xl items-center justify-center mr-4">
                                     <Text className="text-lg">📅</Text>
                                 </View>
                                 <View className="flex-1">
                                     <Text className="text-textLight text-[9px] font-black uppercase tracking-widest">Next Due Date</Text>
                                     <Text className="text-textDark font-bold text-sm">
                                         {loan.nextPaymentDate || loan.installments?.[0]?.dueDate || 'TBD'}
                                     </Text>
                                 </View>
                                 <View className="items-end">
                                     <Text className="text-textLight text-[9px] font-black uppercase tracking-widest text-right">Amount</Text>
                                     <Text className="text-leaf font-bold text-sm">UGX {fmt(loan.installments?.[0]?.amount || 0)}</Text>
                                 </View>
                            </View>
                        </View>
                        
                        <View className="flex-row border-t border-gray-100">
                            <TouchableOpacity 
                                onPress={() => router.push({ pathname: '/loan-schedule', params: { loanId: loan.id } } as any)}
                                className="flex-1 bg-forest/5 py-4 items-center border-r border-gray-100"
                            >
                                <Text className="text-forest text-xs font-black uppercase tracking-widest">📅 Schedule</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push({ pathname: '/loan-repay', params: { loanId: loan.id, loanName: loan.loanProduct?.name, outstanding: loan.outstandingBalance } } as any)}
                                className="flex-1 bg-leaf py-4 items-center"
                            >
                                <Text className="text-white text-xs font-black uppercase tracking-widest">💰 Pay Now</Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                    );
                })
            ) : (
                <View className="bg-white p-12 rounded-[36px] items-center justify-center border border-gray-100 shadow-sm border-dashed mb-8">
                    <Text className="text-5xl mb-4">🛡️</Text>
                    <Text className="text-textDark font-bold text-lg mb-1">No Active Loans</Text>
                    <Text className="text-textLight text-xs text-center max-w-[200px]">Unlock growth by applying for one of our premium loan products.</Text>
                </View>
            )}

            <View className="flex-row justify-between items-center mb-6 px-1">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest">Global Loan Products</Text>
            </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-8">
            {loanProducts.length > 0 ? (
                loanProducts.map((item, i) => <ProductCard key={i} item={item} />)
            ) : (
                <View className="w-[width-40] bg-white p-8 rounded-3xl border border-gray-100 items-center">
                    <ActivityIndicator color="#1A6B47" />
                </View>
            )}
        </ScrollView>

        <View className="px-6">
            <TouchableOpacity 
                onPress={() => router.push('/apply-loan' as any)}
                activeOpacity={0.8}
                className="bg-leaf p-6 rounded-[28px] flex-row items-center justify-center shadow-xl shadow-leaf/20"
            >
                <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4 backdrop-blur-md">
                    <IconSymbol name="plus" size={20} color="white" />
                </View>
                <Text className="text-white font-black text-base uppercase tracking-widest">Apply for New Loan</Text>
            </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}
