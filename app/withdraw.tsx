import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaymentStatusSheet } from '@/components/PaymentStatusSheet';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import { DataService, isPlausibleUgandaMsisdn } from '@/services/api';
import { invalidateWallet, useTellerWithdraw } from '@/services/queries';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  ScrollView, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View,
  KeyboardAvoidingView,
  Platform,
  Alert
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

export default function WithdrawScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    assisted?: string; 
    memberId?: string; 
    accountId?: string; 
    accountName?: string; 
    accountNo?: string; 
    memberName?: string;
    memberImage?: string;
  }>();

  const isAssisted = params.assisted === 'true';
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberAccounts, setMemberAccounts] = useState<any[]>([]);
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(params.accountId || '');
  const [description, setDescription] = useState(isAssisted ? `Agent withdrawal for ${params.memberName}` : 'Savings Withdrawal');
  const [submitting, setSubmitting] = useState(false);
  const [successBalance, setSuccessBalance] = useState<number | null>(null);
  const [floatData, setFloatData] = useState<any>(null);
  const [accountLimit, setAccountLimit] = useState<number | null>(null);
  // Member self-service withdrawals settle over Relworx - poll that verify
  // endpoint, not the MTN MoMo one.
  const payout = usePaymentPolling({ poll: DataService.pollRelworxStatus });
  const tellerWithdraw = useTellerWithdraw();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isAssisted) {
          setMemberPhoto(params.memberImage || null);
          const [bal, memberAccountsRes] = await Promise.all([
            DataService.fetchFloatBalance(),
            params.memberId ? DataService.getMemberAccounts(String(params.memberId)).catch(() => null) : Promise.resolve(null),
          ]);

          if (cancelled) return;
          setFloatData(bal);

          const accountsRaw = memberAccountsRes?.data || [];
          const accountsAll = Array.isArray(accountsRaw) ? accountsRaw : [];
          // Only actual bankable accounts can be sources for a withdrawal —
          // exclude share capital accounts.
          const accounts = accountsAll.filter((a: any) => !a.isShareAccount);
          const matched =
            accounts.find((a: any) => String(a.id) === String(params.accountId)) ||
            accounts[0] ||
            null;

          setMemberAccounts(accounts);
          if (matched?.id) setSelectedAccountId(String(matched.id));
          if (matched) {
            setAccountLimit(Number(matched.balance) || 0);
          } else {
            setAccountLimit(null);
          }
        } else {
          const response = await DataService.getUserProfile();
          if (cancelled) return;
          setUserData(response.data);
          // Pre-fill with the member's system phone number so funds go to their
          // registered number and they can't accidentally send to the wrong one.
          if (!phoneNumber && response.data?.phone) {
            setPhoneNumber(response.data.phone);
          }
          const accounts = response.data.accounts || [];
          const selected =
            accounts.find((a: any) => String(a.id) === String(params.accountId)) ||
            accounts[0] ||
            null;
          if (selected?.id) setSelectedAccountId(String(selected.id));
          setAccountLimit(Number(selected?.balance ?? 0) || null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Fetch error', error);
      } finally {
        if (!cancelled && isAssisted) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAssisted, params.accountId, params.memberId]);

  const sanitizeAmount = (raw: string) => {
    const digits = raw.replace(/[^\d.]/g, '');
    if (!digits) return '';
    const next = Number(digits);
    if (Number.isNaN(next)) return '';
    if (accountLimit !== null && next > accountLimit) return String(accountLimit);
    return digits;
  };

  const handleWithdraw = async () => {
    // If assisted, validation is slightly different as we don't have userData balance in state usually,
    // unless we fetch it. For now, assume backend validates or agent checks.
    if (!amount || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid withdrawal amount' });
      return;
    }

    if (!isAssisted && (!phoneNumber || !isPlausibleUgandaMsisdn(phoneNumber))) {
      Toast.show({ type: 'error', text1: 'Check Phone Number', text2: 'Enter the mobile money number to receive the funds' });
      return;
    }

    if (accountLimit !== null && Number(amount) > accountLimit) {
      Toast.show({
        type: 'error',
        text1: 'Amount Exceeds Balance',
        text2: 'Withdrawal amount cannot exceed the account balance.',
      });
      return;
    }

    // An agent can never hand out more cash than the float holds. The payout
    // is net of the ~0.5% mobile-money convenience fee, so check cash-out.
    if (isAssisted && floatData !== null && floatData !== undefined) {
      const fee = Number(amount) * 0.005;
      const cashOut = Number(amount) + fee;
      if (Number(amount) <= 0) return;
      if (floatData <= 0 || cashOut > floatData) {
        Toast.show({
          type: 'error',
          text1: 'Insufficient Float',
          text2: `Your float can only cover UGX ${fmt(floatData)}. Enter an amount below that.`,
        });
        return;
      }
    }

    Alert.alert(
        "Confirm Withdrawal",
        isAssisted
          ? `Are you sure you want to withdraw UGX ${fmt(Number(amount))} from ${params.memberName}'s account?`
          : `Withdraw UGX ${fmt(Number(amount))} to ${phoneNumber}? It will be debited from your savings.`,
        [
            { text: "Cancel", style: "cancel" },
            {
                text: "Confirm",
                onPress: async () => {
                    setSubmitting(true);
                    try {
                        if (isAssisted) {
                            await tellerWithdraw.mutateAsync({
                                accountId: selectedAccountId,
                                amount: Number(amount),
                                description: description,
                                reference: `AGENT-W-${Date.now()}`,
                                memberId: params.memberId
                            });
                            Toast.show({ type: 'success', text1: 'Withdrawal Verified', text2: 'Cash disbursement registered in ledger' });
                            router.back();
                        } else {
                            const init = await DataService.withdrawFunds(Number(amount), phoneNumber, description);
                            if (!init.referenceId) {
                                Toast.show({ type: 'error', text1: 'Withdrawal Failed', text2: init.message || 'Could not start the payout. Try again.' });
                                return;
                            }
                            // Hand off to the status sheet - it polls Relworx until
                            // the payout lands (or fails).
                            payout.start(init.referenceId);
                        }
                    } catch (e: any) {
                        Toast.show({ type: 'error', text1: 'Withdrawal Failed', text2: e.response?.data?.error || e.message || 'System error' });
                    } finally {
                        setSubmitting(false);
                    }
                }
            }
        ]
    );
  };

  // Once a payout confirms, pull a fresh balance for the success sheet + so the
  // dashboard is current when the member lands back on it.
  useEffect(() => {
    if (payout.phase !== 'success' || isAssisted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await DataService.getUserProfile();
        if (cancelled) return;
        const acc = res.data?.accounts?.find((a: any) => a.id === selectedAccountId);
        setUserData(res.data);
        setSuccessBalance(Number(acc?.balance ?? res.data?.totalBalance ?? 0) || null);
      } catch {
        // non-fatal
      }
    })();
    return () => { cancelled = true; };
  }, [payout.phase, isAssisted, selectedAccountId]);

  const handlePayoutClosed = (outcome: string) => {
    payout.reset();
    setSuccessBalance(null);
    if (outcome === 'success') {
      invalidateWallet();
      router.back();
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-warmWhite items-center justify-center">
        <ActivityIndicator size="large" color="#1A6B47" />
      </View>
    );
  }

  const savingsAccounts = userData?.accounts?.filter((a: any) => a.type !== 'SHARES' && a.type !== 'EQUITY') || [];
  const activeAccount = userData?.accounts?.find((a: any) => a.id === selectedAccountId);
  const sourceBalance = accountLimit ?? (Number(activeAccount?.balance || 0) || 0);
  const activeAssistedAccount = memberAccounts.find((a: any) => String(a.id) === String(selectedAccountId));

  return (
    <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-warmWhite"
    >
      <StatusBar style="light" />

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Cinematic Header — sits BEHIND the balance card below */}
        <View className="bg-forest pt-12 pb-16 overflow-hidden">
            <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-gold/5 rounded-full" />
            
            <View className="px-6 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                    <IconSymbol name="chevron.left" size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-black tracking-tight">
                  {isAssisted ? 'Agent Assisted Withdrawal' : 'Withdraw Funds'}
                </Text>
            </View>
        </View>

        {/* Body content */}
        <View style={{ padding: 24 }}>
        {/* Balance / member card — floats over the green header */}
        <View style={{ marginTop: -56, marginBottom: 32, backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 8, shadowColor: '#0F4D3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }} className={`flex-row items-center border ${isAssisted ? 'border-gold/30' : 'border-[#E6ECE8]'}`}>
            <View className="w-12 h-12 bg-gold/10 rounded-2xl items-center justify-center mr-4">
                <Text className="text-2xl">{isAssisted ? '🏢' : '🏧'}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-[#4A5F56] text-[10px] font-bold uppercase tracking-widest mb-1">{isAssisted ? 'Terminal Entry' : 'Available For Withdrawal'}</Text>
                <View className="flex-row items-center mb-1">
                        {isAssisted && memberPhoto ? (
                            <>
                                <Image source={{ uri: memberPhoto }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 6 }} cachePolicy="memory-disk" transition={200} />
                                <Text className="text-[#13261E] font-bold text-sm">{params.memberName}</Text>
                            </>
                        ) : (
                            <Text className="text-[#13261E] font-bold text-sm">{isAssisted ? `Member: ${params.memberName}` : `UGX ${fmt(activeAccount?.balance)}`}</Text>
                        )}
                    </View>
            </View>
            <View className="bg-gold/10 border border-gold/20 px-3 py-1 rounded-full">
                 <Text className="text-amber-600 text-[9px] font-black uppercase">{isAssisted ? 'ASSISTED' : 'Max'}</Text>
            </View>
        </View>
        {isAssisted ? (
            <View className="mb-8 bg-gold/5 border border-gold/10 p-6 rounded-[28px]">
                <Text className="text-amber-600 text-[10px] font-black uppercase tracking-widest mb-2">Source Account Registry</Text>
                <Text className="text-textDark font-black text-lg">{activeAssistedAccount?.title || activeAssistedAccount?.name || params.accountName || 'Member Account'}</Text>
                <Text className="text-textLight text-xs font-bold mt-1">UUID Node: {activeAssistedAccount?.accNo || activeAssistedAccount?.accountNo || params.accountNo || 'N/A'}</Text>
                <Text className="text-textLight text-xs font-bold mt-1">Source balance verified</Text>
            </View>
        ) : (
            <View className="mb-8">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-5 px-1">Select Source Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                    {savingsAccounts.map((acc: any) => (
                        <TouchableOpacity 
                            key={acc.id}
                            onPress={() => setSelectedAccountId(acc.id)}
                            activeOpacity={0.8}
                            className={`mr-4 p-5 rounded-[28px] w-[200px] border-2 ${selectedAccountId === acc.id ? 'border-leaf bg-white shadow-lg shadow-forest/10' : 'border-gray-50 bg-gray-50/50'}`}
                        >
                             <View className="flex-row justify-between items-start mb-4">
                                 <View className={`w-10 h-10 ${selectedAccountId === acc.id ? 'bg-mint/10' : 'bg-white'} rounded-xl items-center justify-center`}>
                                     <Text className="text-xl">💳</Text>
                                 </View>
                                 {selectedAccountId === acc.id && (
                                     <View className="bg-leaf w-5 h-5 rounded-full items-center justify-center">
                                         <IconSymbol name="checkmark" size={10} color="white" />
                                     </View>
                                 )}
                             </View>
                             <Text className="text-textDark font-bold text-sm mb-1">{acc.title}</Text>
                             <Text className="text-textLight text-[10px] font-bold">Balance: {fmt(acc.balance)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {isAssisted && (
            <View className="mb-8">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-5 px-1">Select Source Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6">
                    {memberAccounts.length > 0 ? memberAccounts.map((acc: any) => {
                        const isSelected = String(selectedAccountId) === String(acc.id);
                        const accTitle = acc.title || acc.name || acc.accountType || acc.type || 'Member Account';
                        const accNo = acc.accNo || acc.accountNo || acc.number || acc.accountNumber || '';
                        return (
                            <TouchableOpacity 
                                key={acc.id}
                                onPress={() => {
                                  setSelectedAccountId(String(acc.id));
                                  setAccountLimit(Number(acc.balance) || 0);
                                }}
                                activeOpacity={0.8}
                                className={`mr-4 p-5 rounded-[28px] w-[200px] border-2 ${isSelected ? 'border-gold bg-white shadow-lg shadow-forest/10' : 'border-gray-50 bg-gray-50/50'}`}
                            >
                                 <View className="flex-row justify-between items-start mb-4">
                                     <View className={`w-10 h-10 ${isSelected ? 'bg-gold/10' : 'bg-white'} rounded-xl items-center justify-center`}>
                                         <Text className="text-xl">💳</Text>
                                     </View>
                                     {isSelected && (
                                         <View className="bg-leaf w-5 h-5 rounded-full items-center justify-center">
                                             <IconSymbol name="checkmark" size={10} color="white" />
                                         </View>
                                     )}
                                 </View>
                                 <Text className="text-textDark font-bold text-sm mb-1">{accTitle}</Text>
                                 <Text className="text-textLight text-[10px] font-bold">•••• {String(accNo).slice(-4) || 'N/A'}</Text>
                            </TouchableOpacity>
                        );
                    }) : (
                        <View className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                            <Text className="text-textLight text-xs font-bold">No member accounts found</Text>
                        </View>
                    )}
                </ScrollView>
            </View>
        )}

        <View className="space-y-6">
            <View>
                <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-3 px-1">Amount to Withdraw</Text>
                <View className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm flex-row items-center">
                    <Text className="text-textDark text-2xl font-black mr-3">UGX</Text>
                    <TextInput 
                        className="flex-1 text-textDark text-2xl font-black p-0"
                        placeholder="0.00"
                        keyboardType="numeric"
                        value={amount}
                        onChangeText={(text) => setAmount(sanitizeAmount(text))}
                    />
                </View>
                {isAssisted ? (
                  <Text className="text-textLight text-[10px] font-medium mt-3 px-3">
                    Enter an amount within the approved source limit.
                  </Text>
                ) : null}
                {!isAssisted ? (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 4 }}
                    className="mt-3 -mx-6 px-6"
                >
                    {['10000', '50000', '100000', '250000', '500000', '1000000'].map(val => (
                        <TouchableOpacity 
                            key={val}
                            onPress={() => setAmount(accountLimit !== null ? String(Math.min(Number(val), accountLimit)) : val)}
                            className={`mr-2 px-5 py-2.5 rounded-xl border ${amount === val ? 'bg-leaf/5 border-leaf' : 'bg-gray-50 border-gray-100'}`}
                        >
                            <Text className={`text-[10px] font-black ${amount === val ? 'text-leaf' : 'text-textMid'}`}>+{fmt(Number(val))}</Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity 
                        onPress={() => setAmount(String(accountLimit ?? activeAccount?.balance ?? 0))}
                        className="bg-leaf/5 px-5 py-2.5 rounded-xl border border-leaf/20"
                    >
                        <Text className="text-leaf text-[10px] font-black">WITHDRAW ALL</Text>
                    </TouchableOpacity>
                </ScrollView>
                ) : null}
            </View>

            {!isAssisted && (
                <View>
                    <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-3 px-1">Send To Mobile Money Number</Text>
                    <View className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm flex-row items-center">
                        <Text className="text-textDark text-lg font-bold mr-3">📱</Text>
                        <TextInput
                            className="flex-1 text-textDark text-lg font-bold p-0"
                            placeholder="07XX XXX XXX"
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            editable={false}
                            onChangeText={setPhoneNumber}
                        />
                    </View>
                    <Text className="text-textLight text-[10px] font-medium mt-3 px-3">The money is sent straight to this number. No PIN prompt — it arrives as a mobile money credit.</Text>
                </View>
            )}

            <View className="bg-gold/5 border border-gold/10 rounded-[28px] p-6 flex-row items-start">
                <Text className="text-xl mr-4">💡</Text>
                <View className="flex-1">
                    <Text className="text-textDark font-bold text-sm mb-1">Fee Disclosure</Text>
                    <Text className="text-textMid text-[10px] font-medium leading-[16px]">A standard mobile money convenience fee of 0.5% will be deducted by the service provider upon Disbursement.</Text>
                </View>
            </View>
        </View>

        <TouchableOpacity
            onPress={handleWithdraw}
            disabled={submitting || payout.phase === 'waiting'}
            activeOpacity={0.8}
            className="mt-12 bg-forest p-6 rounded-[28px] flex-row items-center justify-center shadow-xl shadow-forest/20"
        >
            {submitting ? (
                <ActivityIndicator color="white" />
            ) : (
                <>
                    <View className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mr-4">
                        <IconSymbol name="arrow.down" size={20} color="white" />
                    </View>
                    <Text className="text-white font-black text-base uppercase tracking-widest">Confirm Withdrawal</Text>
                </>
            )}
        </TouchableOpacity>

        <View className="mt-8 items-center">
            <View className="flex-row items-center space-x-2 opacity-40">
                <IconSymbol name="lock.fill" size={12} color="#4B6558" />
                <Text className="text-textMid text-[10px] font-bold uppercase tracking-widest">Authorized Security Context</Text>
            </View>
        </View>
        </View>

      </ScrollView>

      <PaymentStatusSheet
        phase={payout.phase}
        reason={payout.reason}
        amount={Number(amount) || 0}
        phoneNumber={phoneNumber}
        kind="withdrawal"
        newBalance={successBalance}
        onClose={handlePayoutClosed}
      />
    </KeyboardAvoidingView>
  );
}
