import { IconSymbol } from '@/components/ui/icon-symbol';
import { transactionDirection, transactionLabel } from '@/services/api';
import { invalidateWallet, useProfile, useDashboardSummary, useNotifications } from '@/services/queries';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState, useRef } from 'react';
import { 
  RefreshControl, 
  ScrollView, 
  Text, 
  TouchableOpacity, 
  View, 
  Animated, 
  Dimensions,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const fmt = (n: number) => 
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const sumAccountBalances = (accounts: any[] | undefined | null) =>
  (accounts || []).reduce((total, account) => total + (Number(account?.balance) || 0), 0);

const txnTitle = (rawType?: string, description?: string) => {
  if (!rawType) return description || 'Transaction';
  return transactionLabel(rawType, description);
};

export default function HomeScreen() {
  const router = useRouter();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [notifVisible, setNotifVisible] = useState(false);
  const notifAnim = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;

  const { data: userData, isLoading: loading, isRefetching } = useProfile();
  const { data: summary } = useDashboardSummary();
  const { data: notifData } = useNotifications(10);
  const notifications = (notifData?.items ?? []) as any[];
  const unreadCount = notifData?.unreadCount ?? 0;

  const onRefresh = useCallback(async () => { await invalidateWallet(); }, []);

  const toggleNotif = (visible: boolean) => {
    if (visible) {
      setNotifVisible(true);
      Animated.spring(notifAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
    } else {
      Animated.timing(notifAnim, { toValue: -SCREEN_HEIGHT, duration: 300, useNativeDriver: true })
        .start(() => setNotifVisible(false));
    }
  };

  if (loading && !userData) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite items-center justify-center">
        <Text className="text-forest font-bold">Loading Dashboard...</Text>
      </SafeAreaView>
    );
  }

  const liveTotalBalance = Number(
    summary?.totalBalance ?? summary?.balance ?? summary?.currentBalance ??
    userData?.totalBalance ?? sumAccountBalances(userData?.accounts)
  ) || 0;

  const primaryAccount = userData?.accounts?.find((a: any) => a.type === 'SAVINGS') || userData?.accounts?.[0];
  const primaryAccountNo = primaryAccount?.accNo || primaryAccount?.accountNo || '—';
  const sharesAccount = userData?.accounts?.find((a: any) => a.type === 'SHARES');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const recentTxns = (userData?.transactions || []).slice(0, 5);

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Background Header */}
      <View className="absolute top-0 left-0 right-0 h-[260px] bg-forest" style={{ borderBottomLeftRadius: 40, borderBottomRightRadius: 40 }} />
      <View className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] bg-mint/10 rounded-full" />

      <SafeAreaView className="flex-1">
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#2ECC8A" />}>
          
          {/* Header */}
          <View className="px-5 pt-4 pb-6 flex-row justify-between items-center">
            <View>
              <Text className="text-white/70 text-[13px] font-medium">{greeting}</Text>
              <Text className="text-white text-[17px] font-bold tracking-tight">{userData?.name || 'Member'}</Text>
            </View>
            <View className="flex-row items-center space-x-3">
              <TouchableOpacity onPress={() => toggleNotif(true)} className="w-11 h-11 bg-white/15 border border-white/20 rounded-[14px] items-center justify-center relative">
                <IconSymbol name="bell.fill" size={20} color="white" />
                {unreadCount > 0 && (
                  <View className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-gold rounded-full border-2 border-forest items-center justify-center">
                    <Text className="text-forest text-[10px] font-black">{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push('/profile' as any)} className="w-11 h-11 bg-gradient-to-br from-mint to-gold rounded-full items-center justify-center border-2 border-white/20">
                {userData?.image ? (
                  <Image source={{ uri: userData.image }} className="w-full h-full rounded-full" cachePolicy="memory-disk" transition={200} />
                ) : (
                  <Text className="text-forest font-black text-sm">{userData?.name?.substring(0,2).toUpperCase() || 'M'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Balance Card - overlaps header */}
          <View className="px-4">
            <View style={{ backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 8, shadowColor: '#0F4D3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }}>
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-[13px] font-semibold text-[#4A5F56]">Savings balance</Text>
                <TouchableOpacity onPress={() => setBalanceVisible(!balanceVisible)} className="bg-[#F3F6F4] px-3 py-1.5 rounded-full flex-row items-center">
                  <IconSymbol name={balanceVisible ? "eye.fill" : "eye.slash.fill"} size={14} color="#4A5F56" />
                  <Text className="text-[#4A5F56] text-[12px] font-semibold ml-1">{balanceVisible ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              <View className="mb-3 min-h-[44px] justify-center">
                {balanceVisible ? (
                  <View className="flex-row items-baseline">
                    <Text className="text-[#4A5F56] text-[16px] font-bold mr-1">UGX</Text>
                    <Text className="text-[#13261E] text-[32px] font-extrabold tracking-tighter" numberOfLines={1} adjustsFontSizeToFit>{fmt(liveTotalBalance)}</Text>
                  </View>
                ) : (
                  <Text className="text-[#9CA3AF] text-[28px] tracking-[8px]">● ● ● ● ● ●</Text>
                )}
              </View>

              <View className="flex-row justify-between items-center border-t border-[#E6ECE8] pt-3">
                <Text className="text-[#4A5F56] text-[13px] font-semibold">Acc. {primaryAccountNo}</Text>
                <View className="bg-[#E3F4EA] px-3 py-1 rounded-full">
                  <Text className="text-[#17693E] text-[11px] font-bold">Active</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="px-4 mt-4 flex-row justify-between">
            {[
              { label: 'Deposit', icon: 'arrow.down', bg: '#E3F4EA', color: '#1B7F4B', route: '/deposit' },
              { label: 'Withdraw', icon: 'arrow.up', bg: '#FBF0DC', color: '#8A5A00', route: '/withdraw' },
              { label: 'Loans', icon: 'banknote', bg: '#E3F4EA', color: '#1B7F4B', route: '/apply-loan' },
              { label: 'Statement', icon: 'doc.text', bg: '#E3F4EA', color: '#1B7F4B', route: '/transactions' },
            ].map((item, index) => (
              <TouchableOpacity key={index} onPress={() => router.push(item.route as any)} activeOpacity={0.7} className="items-center" style={{ width: '22%' }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                  <IconSymbol name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text className="text-[#4A5F56] text-[12px] font-semibold text-center">{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Cards */}
          <View className="px-4 mt-5 flex-row space-x-3">
            <View className="flex-1 bg-white rounded-[20px] p-4 border border-[#E6ECE8]">
              <Text className="text-[13px] font-semibold text-[#4A5F56] mb-1">Shares</Text>
              <Text className="text-[16px] font-extrabold text-[#13261E]">UGX {fmt(sharesAccount?.balance || 0)}</Text>
            </View>
            <View className="flex-1 bg-white rounded-[20px] p-4 border border-[#E6ECE8]">
              <Text className="text-[13px] font-semibold text-[#4A5F56] mb-1">Loan balance</Text>
              <Text className="text-[16px] font-extrabold text-[#13261E]">UGX {fmt(userData?.activeLoan?.outstanding || 0)}</Text>
              {userData?.activeLoan?.nextPaymentDate && (
                <Text className="text-[12px] text-[#8A5A00] mt-1">Next due {userData.activeLoan.nextPaymentDate}</Text>
              )}
            </View>
          </View>

          {/* Recent Transactions */}
          <View className="px-4 mt-6">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[#13261E] text-[16px] font-bold">Recent transactions</Text>
              <TouchableOpacity onPress={() => router.push('/transactions')} className="min-h-[44px] justify-center">
                <Text className="text-forest text-[14px] font-bold">See all</Text>
              </TouchableOpacity>
            </View>

            <View className="bg-white rounded-[20px] border border-[#E6ECE8] overflow-hidden">
              {recentTxns.length === 0 && (
                <View className="p-10 items-center">
                  <Text className="text-[#9CA3AF] text-[13px]">No transactions yet</Text>
                </View>
              )}
              {recentTxns.map((t: any, i: number) => {
                const dir = transactionDirection(t.rawType);
                const isIn = dir === 'IN';
                const isLoan = /LOAN/.test(t.rawType || '');
                const iconBg = isIn ? '#E3F4EA' : '#FBF0DC';
                const iconColor = isIn ? '#1B7F4B' : '#8A5A00';
                const title = txnTitle(t.rawType, t.description);

                return (
                  <TouchableOpacity
                    key={t.id || i}
                    activeOpacity={0.7}
                    onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id, type: isIn ? 'deposit' : 'withdrawal' } } as any)}
                    className="flex-row items-center px-4 py-3 border-b border-[#F3F6F4]"
                    style={{ borderBottomWidth: i === recentTxns.length - 1 ? 0 : 1 }}
                  >
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: iconBg }}>
                      <IconSymbol name={isLoan ? 'banknote' : isIn ? 'arrow.down' : 'arrow.up'} size={18} color={iconColor} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-[14px] font-bold text-[#13261E]">{title}</Text>
                      <Text className="text-[12px] text-[#4A5F56] mt-0.5">{t.date}</Text>
                    </View>
                    <Text className="text-[14px] font-bold" style={{ color: isIn ? '#17693E' : '#13261E' }}>
                      {isIn ? '+' : '−'} {fmt(t.amount)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Notification Panel */}
      <Modal visible={notifVisible} transparent animationType="none" onRequestClose={() => toggleNotif(false)}>
        <View className="flex-1 bg-black/40">
          <TouchableOpacity activeOpacity={1} className="flex-1" onPress={() => toggleNotif(false)} />
          <Animated.View style={{ transform: [{ translateY: notifAnim }] }} className="absolute top-0 left-0 right-0 bg-warmWhite rounded-b-[40px] shadow-2xl overflow-hidden">
            <View className="bg-forest pt-14 pb-6 px-6 flex-row justify-between items-center">
              <View>
                <Text className="text-white text-xl font-black">Notifications</Text>
                <Text className="text-gold text-[10px] font-black uppercase mt-0.5">{unreadCount} New Updates</Text>
              </View>
              <TouchableOpacity onPress={() => toggleNotif(false)} className="w-10 h-10 bg-white/10 rounded-full items-center justify-center">
                <IconSymbol name="xmark" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <View className="p-4 max-h-[500px]">
              <ScrollView showsVerticalScrollIndicator={false}>
                {notifications.slice(0, 10).map((n, i) => {
                  const subject = n.subject || 'Notification';
                  const emoji = /success|completed|received/i.test(subject) ? '💰' : /fail|declin|reject|due|overdue/i.test(subject) ? '📅' : '🎉';
                  const when = n.sentAt || n.createdAt;
                  return (
                    <TouchableOpacity key={n.id || i} className="flex-row items-start p-4 border-b border-gray-100">
                      <View className="w-10 h-10 rounded-xl items-center justify-center mr-4 bg-leaf/10">
                        <Text className="text-xl">{emoji}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-textDark font-bold text-sm">{subject}</Text>
                        <Text className="text-textMid text-xs mt-1 leading-4">{n.message}</Text>
                        <Text className="text-textLight text-[10px] mt-2">{when ? new Date(when).toLocaleDateString() : ''}</Text>
                      </View>
                      {!n.isRead && <View className="w-2 h-2 bg-mint rounded-full mt-2" />}
                    </TouchableOpacity>
                  );
                })}
                {notifications.length === 0 && (
                  <View className="items-center py-20 opacity-30">
                    <IconSymbol name="bell.slash" size={30} color="gray" />
                    <Text className="text-[10px] font-black uppercase mt-4">Silence is Golden</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => router.push('/notifications' as any)} className="p-4 items-center">
                  <Text className="text-leaf font-bold text-sm">View all notifications</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
