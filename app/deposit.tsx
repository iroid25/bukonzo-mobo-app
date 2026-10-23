import { IconSymbol } from '@/components/ui/icon-symbol';
import { PaymentStatusSheet } from '@/components/PaymentStatusSheet';
import { usePaymentPolling } from '@/hooks/usePaymentPolling';
import { DataService, isPlausibleUgandaMsisdn } from '@/services/api';
import { invalidateWallet, useTellerDeposit } from '@/services/queries';
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
  Platform
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

export default function DepositScreen() {
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
  const [floatData, setFloatData] = useState<any>(null);
  const [memberAccounts, setMemberAccounts] = useState<any[]>([]);
  const [memberPhoto, setMemberPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(params.accountId || '');
  const [description, setDescription] = useState(isAssisted ? `Agent deposit for ${params.memberName}` : 'Savings Deposit');
  const [submitting, setSubmitting] = useState(false);
  const [successBalance, setSuccessBalance] = useState<number | null>(null);
  const momo = usePaymentPolling();
  const tellerDeposit = useTellerDeposit();

  // When a MoMo deposit posts, pull a fresh profile so (a) the success sheet can
  // show the new balance and (b) the dashboard has current numbers + the
  // "Deposit Successful" notification the moment the member lands back on it.
  useEffect(() => {
    if (momo.phase !== 'success' || isAssisted) return;
    let cancelled = false;
    (async () => {
      try {
        const [profileRes] = await Promise.all([
          DataService.getUserProfile(),
          DataService.getNotifications({ limit: 10 }).catch(() => null),
        ]);
        if (cancelled) return;
        const acc = profileRes.data?.accounts?.find((a: any) => a.id === selectedAccountId);
        setUserData(profileRes.data);
        setSuccessBalance(Number(acc?.balance ?? profileRes.data?.totalBalance ?? 0) || null);
      } catch {
        // non-fatal - the sheet still shows the amount that was deposited
      }
    })();
    return () => { cancelled = true; };
  }, [momo.phase, isAssisted, selectedAccountId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!isAssisted) {
            const response = await DataService.getUserProfile();
            setUserData(response.data);
            if (response.data.accounts?.length > 0) {
              setSelectedAccountId(response.data.accounts[0].id);
            }
            // Pre-fill the mobile money field with the member's system phone
            // number so they don't have to type it for a self-service deposit.
            if (!phoneNumber && response.data?.phone) {
              setPhoneNumber(response.data.phone);
            }
        }
        
        // Always fetch float for agent if in assisted mode
        if (isAssisted) {
            setMemberPhoto(params.memberImage || null);
            const [floatRes, memberAccountsRes] = await Promise.all([
              DataService.getFloatBalance(),
              params.memberId ? DataService.getMemberAccounts(String(params.memberId)).catch(() => null) : Promise.resolve(null),
            ]);
            const rawFloat = floatRes.data?.data || floatRes.data;
            
            // Deep crawl for balance value (same logic as Agent Dashboard)
            const findValue = (obj: any, keys: string[]): any => {
                if (!obj) return null;
                for (const key of keys) {
                    if (obj[key] !== undefined) return obj[key];
                }
                for (const key in obj) {
                    if (typeof obj[key] === 'object') {
                        const result = findValue(obj[key], keys);
                        if (result !== null) return result;
                    }
                }
                return null;
            };
            const balanceValue = findValue(rawFloat, ['balance', 'float_balance', 'amount', 'available_balance', 'floatBalance']) || 0;
            setFloatData({ balance: Number(balanceValue) });

            const accountsRaw = memberAccountsRes?.data || [];
            const accounts = Array.isArray(accountsRaw) ? accountsRaw : [];
            const matched =
              accounts.find((a: any) => String(a.id) === String(params.accountId)) ||
              accounts[0] ||
              null;
            setMemberAccounts(accounts);
            if (matched?.id) {
              setSelectedAccountId(String(matched.id));
            } else if (params.accountId) {
              setSelectedAccountId(String(params.accountId));
            }
        }
      } catch (error) {
        console.error("Fetch error", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isAssisted]);

  const handleDeposit = async () => {
    if (!amount || Number(amount) <= 0) {
      Toast.show({ type: 'error', text1: 'Invalid Amount', text2: 'Please enter a valid deposit amount' });
      return;
    }

    // Float Validation for Agents (Cash Transactions)
    if (isAssisted && floatData) {
        const agentBalance = floatData.balance || 0;
        if (Number(amount) > agentBalance) {
            Toast.show({ 
                type: 'error', 
                text1: 'Insufficient Float', 
                text2: `You need UGX ${fmt(Number(amount) - agentBalance)} more float to complete this cash deposit.` 
            });
            return;
        }
    }
    
    setSubmitting(true);
    try {
      if (isAssisted) {
        await tellerDeposit.mutateAsync({
          accountId: selectedAccountId,
          amount: Number(amount),
          description: description,
          reference: `AGENT-${Date.now()}`,
          memberId: params.memberId
        });
        Toast.show({ type: 'success', text1: 'Deposit Verified ✅', text2: `UGX ${fmt(Number(amount))} recorded in terminal ledger` });
        router.back();
      } else {
        if (!phoneNumber || !isPlausibleUgandaMsisdn(phoneNumber)) {
          Toast.show({ type: 'error', text1: 'Check Phone Number', text2: 'Enter a valid MTN Mobile Money number' });
          setSubmitting(false);
          return;
        }
        const init = await DataService.depositFunds(Number(amount), phoneNumber, selectedAccountId || undefined, description);
        if (!init.referenceId) {
          Toast.show({ type: 'error', text1: 'Deposit Failed', text2: init.message || 'Could not reach MTN. Try again.' });
          setSubmitting(false);
          return;
        }
        // Hand off to the approval sheet - it polls MTN until the member
        // approves (or declines) on their phone.
        momo.start(init.referenceId);
      }
    } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Deposit Failed', text2: e.response?.data?.error || e.message || 'System error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMomoClosed = (outcome: string) => {
    momo.reset();
    setSuccessBalance(null);
    if (outcome === 'success') {
      invalidateWallet();
      router.back();
    }
    // failed / timeout: stay on the screen so the member can retry or leave.
  };

  if (loading) {
    return (
      <View className="flex-1 bg-warmWhite items-center justify-center">
        <ActivityIndicator size="large" color="#1A6B47" />
      </View>
    );
  }

  const savingsAccounts = userData?.accounts?.filter((a: any) => a.type !== 'SHARES') || [];
  const assistedAccounts = memberAccounts;
  const activeAssistedAccount = assistedAccounts.find((a: any) => String(a.id) === String(selectedAccountId));

  // Amount entry block — re-used above the float/target cards in assisted
  // mode (order change) and rendered as a slidable quick-amount selector.
  const amountEntry = (
    <View>
      <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-3 px-1">Amount to Deposit</Text>
      <View className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm flex-row items-center">
        <Text className="text-textDark text-2xl font-black mr-3">UGX</Text>
        <TextInput
          className="flex-1 text-textDark text-2xl font-black p-0"
          placeholder="0.00"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 4 }}
        className="mt-3 -mx-6 px-6"
      >
        {['20000', '50000', '100000', '200000', '500000', '1000000'].map(val => (
          <TouchableOpacity
            key={val}
            onPress={() => setAmount(val)}
            className={`mr-2 px-5 py-2.5 rounded-xl border ${amount === val ? 'bg-leaf/5 border-leaf' : 'bg-gray-50 border-gray-100'}`}
          >
            <Text className={`text-[10px] font-black ${amount === val ? 'text-leaf' : 'text-textMid'}`}>+{fmt(Number(val))}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

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
        {/* Cinematic Header — sits BEHIND the method card below */}
        <View className="bg-forest pt-12 pb-16 overflow-hidden">
            <View className="absolute top-[-20px] left-[-20px] w-48 h-48 bg-mint/5 rounded-full" />
            
            <View className="px-6 flex-row items-center">
                <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                    <IconSymbol name="chevron.left" size={20} color="white" />
                </TouchableOpacity>
                <Text className="text-white text-xl font-black tracking-tight">
                  {isAssisted ? 'Agent Assisted Deposit' : 'Deposit Funds'}
                </Text>
            </View>
        </View>

        {/* Body content */}
        <View style={{ padding: 24 }}>
        {/* Method / member card — floats over the green header */}
        <View style={{ marginTop: -56, marginBottom: 32, backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 8, shadowColor: '#0F4D3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }} className={`flex-row items-center border ${isAssisted ? 'border-mint/30' : 'border-[#E6ECE8]'}`}>
            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isAssisted ? 'bg-mint/10' : 'bg-mint/10'}`}>
                <Text className="text-2xl">{isAssisted ? '🏢' : '⚡'}</Text>
            </View>
            <View className="flex-1">
                <Text className="text-[#4A5F56] text-[10px] font-bold uppercase tracking-widest mb-1">{isAssisted ? 'Terminal Entry' : 'Instant Method'}</Text>
                    <View className="flex-row items-center mb-1">
                        {isAssisted && memberPhoto ? (
                            <>
                                <Image source={{ uri: memberPhoto }} style={{ width: 24, height: 24, borderRadius: 12, marginRight: 6 }} cachePolicy="memory-disk" transition={200} />
                                <Text className="text-[#13261E] font-bold text-sm">{params.memberName}</Text>
                            </>
                        ) : (
                            <Text className="text-[#13261E] font-bold text-sm">{isAssisted ? `Member: ${params.memberName}` : 'MTN Mobile Money'}</Text>
                        )}
                    </View>
            </View>
            <View className="bg-mint/10 border border-mint/20 px-3 py-1 rounded-full">
                 <Text className="text-forest text-[9px] font-black uppercase">{isAssisted ? 'ASSISTED' : 'Live'}</Text>
            </View>
        </View>
        {!isAssisted && (
            <View className="mb-8">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-5 px-1">Select Target Account</Text>
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
                                     <Text className="text-xl">💰</Text>
                                 </View>
                                 {selectedAccountId === acc.id && (
                                     <View className="bg-leaf w-5 h-5 rounded-full items-center justify-center">
                                         <IconSymbol name="checkmark" size={10} color="white" />
                                     </View>
                                 )}
                             </View>
                             <Text className="text-textDark font-bold text-sm mb-1">{acc.title}</Text>
                             <Text className="text-textLight text-[10px] font-bold">•••• {acc.accNo?.slice(-4)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>
        )}

        {isAssisted ? (
            <View className="mb-8">
                <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-5 px-1">Select Member Account</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-6 px-6 mb-6">
                    {assistedAccounts.length > 0 ? assistedAccounts.map((acc: any) => {
                        const isSelected = String(selectedAccountId) === String(acc.id);
                        const accTitle = acc.title || acc.name || acc.accountType || acc.type || 'Member Account';
                        const accNo = acc.accNo || acc.accountNo || acc.number || acc.accountNumber || '';
                        return (
                            <TouchableOpacity
                                key={acc.id}
                                onPress={() => setSelectedAccountId(String(acc.id))}
                                activeOpacity={0.8}
                                className={`mr-4 p-5 rounded-[28px] w-[200px] border-2 ${isSelected ? 'border-mint bg-white shadow-lg shadow-forest/10' : 'border-gray-50 bg-gray-50/50'}`}
                            >
                                <View className="flex-row justify-between items-start mb-4">
                                    <View className={`w-10 h-10 ${isSelected ? 'bg-mint/10' : 'bg-white'} rounded-xl items-center justify-center`}>
                                        <Text className="text-xl">ðŸ’°</Text>
                                    </View>
                                    {isSelected && (
                                        <View className="bg-leaf w-5 h-5 rounded-full items-center justify-center">
                                            <IconSymbol name="checkmark" size={10} color="white" />
                                        </View>
                                    )}
                                </View>
                                <Text className="text-textDark font-bold text-sm mb-1">{accTitle}</Text>
                                <Text className="text-textLight text-[10px] font-bold">â€¢â€¢â€¢â€¢ {String(accNo).slice(-4) || 'N/A'}</Text>
                            </TouchableOpacity>
                        );
                    }) : (
                        <View className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                            <Text className="text-textLight text-xs font-bold">No member accounts found</Text>
                        </View>
                    )}
                </ScrollView>

                {amountEntry}
            </View>
        ) : (
            <View className="space-y-6">
                {amountEntry}

                <View>
                    <Text className="text-textMid text-xs font-black uppercase tracking-widest mb-3 px-1">Mobile Money Phone Number</Text>
                    <View className="bg-white border border-gray-100 rounded-[28px] p-6 shadow-sm flex-row items-center">
                        <Text className="text-textDark text-lg font-bold mr-3">📱</Text>
                        <TextInput 
                            className="flex-1 text-textDark text-lg font-bold p-0"
                            placeholder="07XX XXX XXX"
                            keyboardType="phone-pad"
                            value={phoneNumber}
                            editable={false}
                        />
                    </View>
                    <Text className="text-textLight text-[10px] font-medium mt-3 px-3">We will send a push prompt to this number for authorized PIN entry.</Text>
                </View>
            </View>
        )}

        {isAssisted && (
            <View className="mb-8 mt-6">
                {/* Agent Float Balance Banner */}
                {floatData && (
                    <View className="mb-4 bg-forest/5 border border-forest/10 p-5 rounded-[24px] flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 bg-forest/10 rounded-xl items-center justify-center mr-3">
                                <Text className="text-lg">💰</Text>
                            </View>
                            <View>
                                <Text className="text-textLight text-[9px] font-black uppercase tracking-widest">Your Float Balance</Text>
                                <Text className="text-forest font-black text-xl">UGX {fmt(floatData.balance || 0)}</Text>
                            </View>
                        </View>
                        <View className={`px-3 py-1.5 rounded-full ${(floatData.balance || 0) > 500000 ? 'bg-mint/10' : 'bg-red-50'}`}>
                            <Text className={`text-[9px] font-black uppercase ${(floatData.balance || 0) > 500000 ? 'text-mint' : 'text-red-400'}`}>
                                {(floatData.balance || 0) > 500000 ? 'Healthy' : 'Low'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Target Account */}
                <View className="bg-mint/5 border border-mint/10 p-6 rounded-[28px]">
                    <Text className="text-leaf text-[10px] font-black uppercase tracking-widest mb-2">Target Account Registry</Text>
                    <Text className="text-textDark font-black text-lg">{activeAssistedAccount?.title || activeAssistedAccount?.name || params.accountName || 'Member Account'}</Text>
                <Text className="text-textLight text-xs font-bold mt-1">UUID Node: {activeAssistedAccount?.accNo || activeAssistedAccount?.accountNo || params.accountNo || 'N/A'}</Text>
                </View>
            </View>
        )}

        <TouchableOpacity
            onPress={handleDeposit}
            disabled={submitting || momo.phase === 'waiting'}
            activeOpacity={0.8}
            className="mt-12 bg-leaf p-6 rounded-[28px] flex-row items-center justify-center shadow-xl shadow-leaf/20"
        >
            {submitting ? (
                <ActivityIndicator color="white" />
            ) : (
                <>
                    <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-4">
                        <IconSymbol name="arrow.up" size={20} color="white" />
                    </View>
                    <Text className="text-white font-black text-base uppercase tracking-widest">Confirm Deposit</Text>
                </>
            )}
        </TouchableOpacity>

        <View className="mt-8 items-center">
            <View className="flex-row items-center space-x-2 opacity-40">
                <IconSymbol name="lock.fill" size={12} color="#4B6558" />
                <Text className="text-textMid text-[10px] font-bold uppercase tracking-widest">Secure 256-bit Encrypted</Text>
            </View>
        </View>
        </View>

      </ScrollView>

      <PaymentStatusSheet
        phase={momo.phase}
        reason={momo.reason}
        amount={Number(amount) || 0}
        phoneNumber={phoneNumber}
        kind="deposit"
        newBalance={successBalance}
        onClose={handleMomoClosed}
      />
    </KeyboardAvoidingView>
  );
}
