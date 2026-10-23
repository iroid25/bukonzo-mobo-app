import React, { useMemo } from 'react';
import { 
    View, 
    Text, 
    ScrollView, 
    TouchableOpacity, 
    ActivityIndicator, 
    RefreshControl,
    Dimensions
} from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { isAgentProcessedTxn, transactionLabel } from '@/services/api';
import { useTransactions } from '@/services/queries';
import { useAuth } from '@/context/AuthContext';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const THEME = {
    forest: '#1A6B47',
    leaf: '#2ECC8A',
    mint: '#2ECC8A',
    warmWhite: '#FBFBFB',
    textDark: '#111816',
    textMid: '#4B6558',
    textLight: '#8BA898',
};

const fmt = (n: number) => new Intl.NumberFormat('en-UG').format(Math.round(n || 0));

export default function CommissionTracingScreen() {
    const { feeSettings, user: agent } = useAuth();
    const router = useRouter();
    const { data: txnData, isLoading: loading, isRefetching: refreshing, refetch } = useTransactions();

    const transactions = useMemo(() => {
        if (!txnData) return [];
        const raw = (txnData.data?.data || txnData.data?.transactions || (Array.isArray(txnData.data) ? txnData.data : []));
        return Array.isArray(raw) ? raw.filter((t: any) => isAgentProcessedTxn(t, agent)) : [];
    }, [txnData, agent]);

    const onRefresh = async () => {
        await refetch();
    };

    const calculateItemCommission = (amt: number, type: string) => {
        const key = type === 'DEPOSIT' ? 'AGENT_DEPOSIT_FEES' : 'AGENT_WITHDRAWAL_FEES';
        const setting = feeSettings.find(s => s.key === key);
        
        if (setting && Array.isArray(setting.value)) {
            const tier = setting.value.find((t: any) => amt >= Number(t.min || 0) && amt <= Number(t.max || 999999999));
            if (tier) return Number(tier.commission || tier.fee || 0);
        }
        return Math.round(amt * 0.005); // Fallback
    };

    const commissionItems = useMemo(() => {
        return transactions.map(tx => ({
            ...tx,
            commission: calculateItemCommission(tx.amount, tx.type)
        })).filter(item => item.commission > 0);
    }, [transactions, feeSettings]);

    const totalCommission = commissionItems.reduce((acc, curr) => acc + curr.commission, 0);

    return (
        <View className="flex-1 bg-warmWhite">
            <StatusBar style="light" />
            
            {/* Header */}
            <View className="bg-forest pt-12 pb-8 px-6 rounded-b-[40px] shadow-xl">
                <View className="flex-row items-center justify-between mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                        <IconSymbol name="chevron.left" size={20} color="white" />
                    </TouchableOpacity>
                    <View className="flex-1">
                        <Text className="text-white text-xl font-black">Commission Ledger</Text>
                        <Text className="text-white/50 text-[10px] font-black uppercase tracking-[2px]">Trust & Transparency</Text>
                    </View>
                </View>

                <View className="bg-white/10 rounded-3xl p-6 border border-white/20">
                    <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Total Earning Traced</Text>
                    <View className="flex-row items-baseline">
                        <Text className="text-white text-3xl font-black">UGX {fmt(totalCommission)}</Text>
                        <View className="ml-3 bg-mint/20 px-2 py-0.5 rounded-lg">
                            <Text className="text-mint text-[8px] font-black uppercase">LIVE</Text>
                        </View>
                    </View>
                </View>
            </View>

            <ScrollView 
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={THEME.forest} />}
            >
                <Text className="text-textLight text-[10px] font-black uppercase tracking-[4px] mb-6 mt-4">Source Tracing</Text>

                {loading && !refreshing ? (
                    <ActivityIndicator size="large" color={THEME.forest} className="mt-10" />
                ) : commissionItems.length === 0 ? (
                    <View className="items-center mt-20 opacity-50">
                        <IconSymbol name="tray" size={40} color={THEME.textLight} />
                        <Text className="text-textMid font-black text-xs uppercase mt-4">No commissions found</Text>
                    </View>
                ) : (
                    commissionItems.map((item, idx) => (
                        <Animated.View 
                            key={item.id} 
                            entering={FadeInDown.delay(idx * 50).duration(500)}
                            className="bg-white rounded-[32px] p-5 mb-4 border border-gray-100 flex-row items-center shadow-sm"
                        >
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${item.type === 'DEPOSIT' ? 'bg-forest/5' : 'bg-amber-500/5'}`}>
                                <IconSymbol 
                                    name={item.type === 'DEPOSIT' ? "arrow.down.left.circle.fill" : "arrow.up.right.circle.fill"} 
                                    size={20} 
                                    color={item.type === 'DEPOSIT' ? THEME.forest : '#D97706'} 
                                />
                            </View>
                            <View className="flex-1">
                                <Text className="text-textDark font-black text-sm">{transactionLabel(item.rawType || item.type, item.description)}</Text>
                                <Text className="text-textLight text-[10px] font-bold mt-0.5">Ref: {item.id.slice(-6)} • {item.date}</Text>
                                <Text className="text-textMid text-[10px] mt-1">Amt: UGX {fmt(item.amount)}</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-forest font-black text-base">+ {fmt(item.commission)}</Text>
                                <Text className="text-textLight text-[8px] font-black uppercase tracking-widest mt-0.5">Commission</Text>
                            </View>
                        </Animated.View>
                    ))
                )}
            </ScrollView>
        </View>
    );
}
