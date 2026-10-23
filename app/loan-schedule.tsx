import { IconSymbol } from '@/components/ui/icon-symbol';
import { DataService } from '@/services/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

export default function LoanScheduleScreen() {
    const router = useRouter();
    const { loanId } = useLocalSearchParams<{ loanId: string }>();
    const [schedule, setSchedule] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (loanId) loadSchedule();
    }, [loanId]);

    const loadSchedule = async () => {
        try {
            const res = await DataService.getLoanSchedule(loanId!);
            const data = res.data?.data || res.data || [];
            setSchedule(Array.isArray(data.installments || data) ? (data.installments || data) : []);
        } catch (e) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not load repayment schedule' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-warmWhite">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-forest pt-12 pb-8 px-6">
                <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                        <IconSymbol name="chevron.left" size={20} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white text-xl font-black tracking-tight">Repayment Schedule</Text>
                        <Text className="text-white/50 text-[10px] font-black uppercase tracking-widest">{schedule.length} Installments</Text>
                    </View>
                </View>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#1A6B47" />
                </View>
            ) : (
                <FlatList
                    data={schedule}
                    keyExtractor={(item, i) => item.id || String(i)}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    ListEmptyComponent={() => (
                        <View className="items-center mt-24">
                            <Text className="text-5xl mb-4">📋</Text>
                            <Text className="text-textDark font-black text-lg mb-1">No Schedule Found</Text>
                            <Text className="text-textLight text-xs text-center px-12">The repayment schedule for this loan is not yet available.</Text>
                        </View>
                    )}
                    renderItem={({ item, index }) => {
                        const isPaid = item.status === 'PAID' || item.isPaid;
                        const isOverdue = !isPaid && new Date(item.dueDate) < new Date();
                        return (
                            <View className={`flex-row items-center p-5 mb-3 rounded-[24px] border ${isPaid ? 'bg-mint/5 border-mint/10' : isOverdue ? 'bg-red-50 border-red-100' : 'bg-white border-gray-100'}`}>
                                <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isPaid ? 'bg-mint/20' : isOverdue ? 'bg-red-100' : 'bg-gray-50'}`}>
                                    <Text className="font-black text-sm" style={{ color: isPaid ? '#2ECC8A' : isOverdue ? '#EF4444' : '#666' }}>
                                        {index + 1}
                                    </Text>
                                </View>
                                <View className="flex-1">
                                    <Text className="text-textDark font-bold text-sm">
                                        {new Date(item.dueDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                                    </Text>
                                    <Text className="text-textLight text-[10px] font-bold uppercase mt-1">
                                        {isPaid ? '✅ Paid' : isOverdue ? '⚠️ Overdue' : '⏳ Upcoming'}
                                    </Text>
                                </View>
                                <Text className={`font-black text-base ${isPaid ? 'text-mint' : isOverdue ? 'text-red-500' : 'text-textDark'}`}>
                                    UGX {fmt(item.amount || item.installmentAmount)}
                                </Text>
                            </View>
                        );
                    }}
                />
            )}
        </View>
    );
}
