import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaymentStatusSheet } from '@/components/PaymentStatusSheet';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import { DataService, isPlausibleUgandaMsisdn } from '@/services/api';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

export default function LoanRepayScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ loanId: string; loanName: string; outstanding: string }>();
    const [amount, setAmount] = useState('');
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [method, setMethod] = useState<'momo' | 'savings'>('momo');
    const [phoneNumber, setPhoneNumber] = useState('');
    const momo = usePaymentPolling();

    const outstandingBal = parseFloat(params.outstanding || '0');

    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await DataService.getUserProfile();
            const accs = res.data?.accounts || [];
            setAccounts(accs.filter((a: any) => a.type === 'SAVINGS' || a.type === 'SHARES'));
            if (accs.length > 0) setSelectedAccount(accs[0].id);
        } catch (e) {
            console.error('Failed to load accounts', e);
        } finally {
            setLoading(false);
        }
    };

    const handleRepay = async () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid repayment amount' });
            return;
        }
        if (outstandingBal > 0 && numAmount > outstandingBal + 0.01) {
            Toast.show({ type: 'error', text1: 'Amount Too High', text2: `Repayment cannot exceed the outstanding UGX ${fmt(outstandingBal)}` });
            return;
        }

        if (method === 'momo') {
            if (!phoneNumber || !isPlausibleUgandaMsisdn(phoneNumber)) {
                Toast.show({ type: 'error', text1: 'Check Phone Number', text2: 'Enter a valid MTN Mobile Money number' });
                return;
            }
            setSubmitting(true);
            try {
                const init = await DataService.repayLoanMomo({
                    loanId: params.loanId!,
                    amount: numAmount,
                    phoneNumber,
                });
                if (!init.referenceId) {
                    Toast.show({ type: 'error', text1: 'Payment Failed', text2: init.message || 'Could not reach MTN. Try again.' });
                    return;
                }
                momo.start(init.referenceId);
            } catch (e: any) {
                Toast.show({
                    type: 'error',
                    text1: 'Payment Failed',
                    text2: e.response?.data?.error || 'Unable to process repayment. Please try again.',
                });
            } finally {
                setSubmitting(false);
            }
            return;
        }

        // Pay from an existing savings/share balance.
        if (!selectedAccount) {
            Toast.show({ type: 'error', text1: 'No Account', text2: 'Please select an account to pay from' });
            return;
        }
        setSubmitting(true);
        try {
            await DataService.repayLoan({
                loanId: params.loanId!,
                amount: numAmount,
                accountId: selectedAccount
            });
            Toast.show({ type: 'success', text1: 'Payment Successful! 🎉', text2: `UGX ${fmt(numAmount)} repaid successfully` });
            router.back();
        } catch (e: any) {
            Toast.show({
                type: 'error',
                text1: 'Payment Failed',
                text2: e.response?.data?.error || 'Unable to process repayment. Please try again.'
            });
        } finally {
            setSubmitting(false);
        }
    };

    const handleMomoClosed = (outcome: string) => {
        momo.reset();
        if (outcome === 'success') router.back();
    };

    const outstanding = parseFloat(params.outstanding || '0');
    const quickAmounts = [
        Math.round(outstanding * 0.25),
        Math.round(outstanding * 0.5),
        outstanding
    ].filter(a => a > 0);

    return (
        <View className="flex-1 bg-warmWhite">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-forest pt-12 pb-8 px-6">
                <View className="flex-row items-center mb-6">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                        <IconSymbol name="chevron.left" size={20} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white text-xl font-black tracking-tight">Loan Repayment</Text>
                        <Text className="text-white/50 text-[10px] font-black uppercase tracking-widest">{params.loanName || 'Loan'}</Text>
                    </View>
                </View>

                <View className="bg-white/10 border border-white/20 rounded-[28px] p-6">
                    <Text className="text-white/70 text-xs font-bold uppercase tracking-widest mb-2">Outstanding Balance</Text>
                    <Text className="text-white text-3xl font-black">UGX {fmt(outstanding)}</Text>
                </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                <ScrollView className="flex-1 px-6 pt-8" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    
                    {/* Amount Input */}
                    <View className="mb-8">
                        <Text className="text-textMid text-[10px] font-black uppercase tracking-widest mb-3">Repayment Amount</Text>
                        <View className="bg-white rounded-[28px] border border-gray-100 p-6 shadow-sm">
                            <View className="flex-row items-baseline">
                                <Text className="text-textMid text-lg font-bold mr-2">UGX</Text>
                                <TextInput
                                    className="flex-1 text-3xl font-black text-textDark"
                                    placeholder="0"
                                    placeholderTextColor="#D1D5DB"
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>

                        {/* Quick Amount Chips */}
                        <View className="flex-row mt-4 space-x-3">
                            {quickAmounts.map((qa, i) => (
                                <TouchableOpacity 
                                    key={i} 
                                    onPress={() => setAmount(qa.toString())}
                                    className={`flex-1 py-3 rounded-2xl border items-center ${amount === qa.toString() ? 'bg-leaf border-leaf' : 'bg-white border-gray-100'}`}
                                >
                                    <Text className={`text-[10px] font-black uppercase ${amount === qa.toString() ? 'text-white' : 'text-textMid'}`}>
                                        {i === 2 ? 'Full' : `${(i + 1) * 25}%`}
                                    </Text>
                                    <Text className={`text-xs font-bold mt-0.5 ${amount === qa.toString() ? 'text-white' : 'text-textDark'}`}>
                                        {fmt(qa)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Payment Method */}
                    <View className="mb-6">
                        <Text className="text-textMid text-[10px] font-black uppercase tracking-widest mb-3">Payment Method</Text>
                        <View className="flex-row bg-gray-50 rounded-[20px] p-1.5 border border-gray-100">
                            <TouchableOpacity
                                onPress={() => setMethod('momo')}
                                className={`flex-1 py-3 rounded-2xl items-center ${method === 'momo' ? 'bg-leaf' : ''}`}
                            >
                                <Text className={`text-[11px] font-black uppercase tracking-widest ${method === 'momo' ? 'text-white' : 'text-textMid'}`}>📱 Mobile Money</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMethod('savings')}
                                className={`flex-1 py-3 rounded-2xl items-center ${method === 'savings' ? 'bg-leaf' : ''}`}
                            >
                                <Text className={`text-[11px] font-black uppercase tracking-widest ${method === 'savings' ? 'text-white' : 'text-textMid'}`}>💰 From Savings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* MoMo phone number */}
                    {method === 'momo' && (
                        <View className="mb-8">
                            <Text className="text-textMid text-[10px] font-black uppercase tracking-widest mb-3">Mobile Money Number</Text>
                            <View className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm flex-row items-center">
                                <Text className="text-textDark text-lg font-bold mr-3">📱</Text>
                                <TextInput
                                    className="flex-1 text-textDark text-lg font-bold p-0"
                                    placeholder="07XX XXX XXX"
                                    placeholderTextColor="#D1D5DB"
                                    keyboardType="phone-pad"
                                    value={phoneNumber}
                                    onChangeText={setPhoneNumber}
                                />
                            </View>
                            <Text className="text-textLight text-[10px] font-medium mt-3 px-3">You&apos;ll get a prompt on this phone to approve the payment with your PIN.</Text>
                        </View>
                    )}

                    {/* Account Selection */}
                    {method === 'savings' && (
                    <View className="mb-8">
                        <Text className="text-textMid text-[10px] font-black uppercase tracking-widest mb-3">Pay From Account</Text>
                        {loading ? (
                            <ActivityIndicator color="#1A6B47" />
                        ) : (
                            accounts.map(acc => (
                                <TouchableOpacity 
                                    key={acc.id}
                                    onPress={() => setSelectedAccount(acc.id)}
                                    className={`flex-row items-center p-5 rounded-[24px] border mb-3 ${selectedAccount === acc.id ? 'bg-leaf/5 border-leaf' : 'bg-white border-gray-100'}`}
                                >
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${selectedAccount === acc.id ? 'bg-leaf/10' : 'bg-gray-50'}`}>
                                        <IconSymbol name="banknote.fill" size={20} color={selectedAccount === acc.id ? '#1A6B47' : '#9CA3AF'} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-textDark font-bold text-sm">{acc.title}</Text>
                                        <Text className="text-textLight text-xs">{acc.accNo}</Text>
                                    </View>
                                    <Text className="text-leaf font-black text-sm">UGX {fmt(acc.balance)}</Text>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                        onPress={handleRepay}
                        disabled={submitting || momo.phase === 'waiting' || !amount || (method === 'savings' && !selectedAccount)}
                        className={`py-5 rounded-[28px] items-center shadow-xl ${submitting || !amount ? 'bg-gray-300' : 'bg-leaf shadow-leaf/20'}`}
                    >
                        {submitting ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-black text-base uppercase tracking-widest">💰 Confirm Repayment</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <PaymentStatusSheet
                phase={momo.phase}
                reason={momo.reason}
                amount={parseFloat(amount) || 0}
                phoneNumber={phoneNumber}
                kind="repayment"
                onClose={handleMomoClosed}
            />
        </View>
    );
}
