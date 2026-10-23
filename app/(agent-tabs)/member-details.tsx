import { DataService } from '@/services/api';
import { invalidateWallet } from '@/services/queries';
import { useAuth } from '@/context/AuthContext';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image as CachedImage } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { 
    ActivityIndicator, 
    ScrollView, 
    Text, 
    TextInput,
    TouchableOpacity, 
    View,
    Dimensions,
    Modal,
    Share,
    Image,
    Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import { generateReceiptPDF } from '../../utils/receipt';
import { maybeRecordFloatAlert } from '@/services/localAlerts';

const THEME = {
    forest: '#1A6B47',
    leaf: '#2ECC8A',
    mint: '#2ECC8A',
    warmWhite: '#FBFBFB',
    ink: '#0B0F0E',
    text1: '#111816',
    text2: '#4B6558',
    text3: '#8BA898',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const fmtShort = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
};

const getMemberName = (m: any) => {
    if (!m) return 'Unknown Member';
    return m.name 
        || m.member?.name 
        || m.user?.name
        || [m.firstName, m.lastName].filter(Boolean).join(' ')
        || [m.surname, m.otherNames].filter(Boolean).join(' ')
        || [m.member?.surname, m.member?.otherNames].filter(Boolean).join(' ')
        || 'Unknown Member';
};

const getAccountName = (acc: any) => {
    if (!acc) return 'Savings';
    const rawType = acc.accountType || acc.type;
    if (typeof rawType === 'object' && rawType !== null) {
        return rawType.name || rawType.accountType || 'Savings';
    }
    if (typeof rawType === 'string') return rawType;
    return 'Savings';
};

// Crawl an API float response for the balance number wherever it happens to
// live (the backend nests it several different ways).
const findFloatValue = (obj: any): number | null => {
    if (!obj) return null;
    const keys = ['balance', 'float_balance', 'floatBalance', 'amount', 'available_balance', 'current_balance'];
    for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null) return Number(obj[k]) || 0;
    }
    for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
            const v = findFloatValue(obj[k]);
            if (v !== null) return v;
        }
    }
    return null;
};

export default function MemberDetailsScreen() {
    const { user: agent, floatBalance, refreshFloat, agentFees } = useAuth();
    const params = useLocalSearchParams();
    const memberId = typeof params.memberId === 'string' ? params.memberId : '';
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [member, setMember] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<any>(null);
    const [amount, setAmount] = useState('');
    const mode: 'deposit' | 'withdraw' =
      typeof params.mode === 'string' && params.mode === 'withdraw' ? 'withdraw' : 'deposit';
    const [submitting, setSubmitting] = useState(false);
    const [receipt, setReceipt] = useState<any>(null);
    const [showReceipt, setShowReceipt] = useState(false);

    useEffect(() => {
        loadMemberInfo();
        refreshFloat();
    }, [memberId]);


    const loadMemberInfo = async () => {
        if (!memberId) return;
        setLoading(true);
        try {
            let resolvedMember: any = null;
            let resolvedAccounts: any[] = [];

            // Step 1: Find the member via search/lookup
            const searchQuery = params.searchQuery ? String(params.searchQuery) : memberId;
            try {
                const lookupRes = await DataService.searchMembers(searchQuery);
                const results = lookupRes.data?.data || lookupRes.data || [];
                const members = Array.isArray(results) ? results : [];
                
                resolvedMember = members.find((m: any) => 
                    m.id === memberId || m.userId === memberId || 
                    m.member?.id === memberId || m.memberNumber === memberId
                ) || members[0];
                
                if (resolvedMember?.member) {
                    resolvedAccounts = resolvedMember.accounts || [];
                    resolvedMember = resolvedMember.member;
                }
                if (resolvedMember?.accounts) {
                    resolvedAccounts = resolvedMember.accounts;
                }
            } catch (e) {
                console.log("[DEBUG] Lookup failed, trying userId fallback");
            }

            // Step 2: userId fallback
            if (!resolvedMember?.id) {
                try {
                    const userRes = await DataService.getMemberByUserId(String(memberId));
                    const userData = userRes.data?.data?.[0] || userRes.data?.[0];
                    if (userData) {
                        resolvedMember = userData.member || userData;
                        resolvedAccounts = userData.accounts || [];
                    }
                } catch (e) { console.log("[DEBUG] userId fallback also failed"); }
            }

            // Step 3: Fetch member's actual accounts with balances.
            // If we cannot confirm the member's own accounts, leave the list empty
            // instead of falling back to generic registry data. getMemberAccounts()
            // now routes through GET /api/v1/members/{id} (the correct endpoint that
            // returns the member's own accounts[] + shareAccounts[]). The old
            // GET /api/v1/accounts?memberId was a balance-sheet listing that IGNORED
            // memberId and returned the whole chart of accounts (assets/equity).
            if (resolvedMember?.id) {
                try {
                    const acctRes = await DataService.getMemberAccounts(resolvedMember.id);
                    const accts = acctRes.data || [];
                    if (Array.isArray(accts) && accts.length > 0) {
                        resolvedAccounts = accts;
                    } else {
                        resolvedAccounts = [];
                    }
                } catch (e) {
                    console.warn("Actual account fetch failed:", e);
                    resolvedAccounts = [];
                }
            }


            // Step 4: Removed fallback to account types to ensure only specific member accounts are shown.
            if (resolvedAccounts.length === 0) {
                console.log("[DEBUG] No actual accounts found for member.");
            }


            // Final Cleanup & Deduplication
            if (resolvedMember) {
                resolvedMember.name = getMemberName(resolvedMember);
            }
            
            // Uniq accounts by id
            const seenIds = new Set();
            const uniqAccounts = resolvedAccounts.filter(a => {
                if (seenIds.has(a.id)) return false;
                seenIds.add(a.id);
                return true;
            });

            setMember(resolvedMember || null);
            setAccounts(uniqAccounts);
            if (uniqAccounts.length > 0) {
                setSelectedAccount(uniqAccounts[0]);
            }

        } catch (e) {
            console.error("Failed to load member info", e);
            Toast.show({ type: 'error', text1: 'Error', text2: 'Could not resolve member identity' });
        } finally {
            setLoading(false);
        }
    };

    // Quick amount handler  
    const onQuickAmount = (val: number) => {
        setAmount(val.toString());
    };

    const handleTransaction = async () => {
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0) {
            Toast.show({ type: 'error', text1: 'Invalid', text2: 'Enter a valid amount' });
            return;
        }
        if (!selectedAccount) {
            Toast.show({ type: 'error', text1: 'No Account', text2: 'Select an account first' });
            return;
        }

        // Snapshot the float BEFORE the transaction so we can warn the agent if
        // it drops once the backend posts the cash movement.
        const floatBefore = floatBalance;

        const feeDetails = calculateFeeDetails(numAmount);
        const totalDeductionFromMember = mode === 'deposit' 
            ? numAmount // They give X
            : numAmount + feeDetails.charge; // They give X + fee

        const balanceIncrementForMember = mode === 'deposit'
            ? numAmount - feeDetails.charge // They get X - fee
            : - (numAmount + feeDetails.charge); // They lose X + fee

        const currentBalanceAfter = (selectedAccount.balance || 0) + balanceIncrementForMember;

        if (mode === 'deposit' && floatBalance > 0 && numAmount > floatBalance) {
            Toast.show({ type: 'error', text1: 'Insufficient Float', text2: `You only have UGX ${fmt(floatBalance)} float. This deposit needs UGX ${fmt(numAmount)}.` });
            return;
        }

        if (mode === 'deposit' && floatBalance <= 0) {
            Toast.show({ type: 'error', text1: 'Float Unverified', text2: 'Your float balance could not be confirmed. Reconcile at the branch before transacting.' });
            return;
        }

        if (mode === 'withdraw' && (numAmount + feeDetails.charge) > (selectedAccount.balance || 0)) {
            Toast.show({ type: 'error', text1: 'Amount Exceeds Balance', text2: 'Withdrawal amount cannot exceed the account balance.' });
            return;
        }

        // The agent also hands this cash out of their own float - same ceiling.
        const cashOut = mode === 'withdraw' ? numAmount + feeDetails.charge : numAmount;
        if (mode === 'withdraw' && floatBalance > 0 && cashOut > floatBalance) {
            Toast.show({ type: 'error', text1: 'Insufficient Float', text2: `Your float is only UGX ${fmt(floatBalance)}. You need UGX ${fmt(cashOut)} to pay this out.` });
            return;
        }

        setSubmitting(true);
        try {
            const txId = `TX-${Date.now().toString().slice(-6)}`;
            if (mode === 'deposit') {
                await DataService.tellerDeposit({
                    accountId: selectedAccount.id,
                    amount: numAmount,
                    channel: 'CASH',
                    description: `Agent deposit for ${member?.name}`,
                    reference: txId,
                    memberId: member?.id
                });
                
                setReceipt({
                    id: txId,
                    type: 'DEPOSIT',
                    amount: numAmount,
                    memberName: member?.name,
                    accountName: selectedAccount?.accountType || selectedAccount?.type || 'Savings Account',
                    date: new Date().toLocaleString(),
                    balanceAfter: currentBalanceAfter,
                    agentName: agent?.name
                });
            } else {
                await DataService.tellerWithdraw({
                    accountId: selectedAccount.id,
                    amount: numAmount,
                    channel: 'CASH',
                    description: `Agent withdrawal for ${member?.name}`,
                    reference: txId,
                    memberId: member?.id
                });
                
                setReceipt({
                    id: txId,
                    type: 'WITHDRAWAL',
                    amount: numAmount,
                    memberName: member?.name,
                    accountName: selectedAccount?.accountType || selectedAccount?.type || 'Savings Account',
                    date: new Date().toLocaleString(),
                    balanceAfter: currentBalanceAfter,
                    agentName: agent?.name
                });
            }
            
            // Track the float drop so the agent gets an in-app alert, then sync
            // the global float state used by the tab bar / dashboard.
            try {
                const floatRes = await DataService.getFloatBalance();
                const floatAfter = findFloatValue(floatRes.data);
                if (floatAfter !== null && floatAfter !== floatBefore) {
                    await maybeRecordFloatAlert(floatBefore, floatAfter);
                }
            } catch (e) {
                console.warn('Float tracking skipped', e);
            }
            refreshFloat();

            // Mark the whole wallet set stale so the next focus of the
            // dashboard / transactions tabs pulls fresh balances immediately.
            invalidateWallet();

            setAmount('');
            setShowReceipt(true);
        } catch (e: any) {
            Toast.show({ type: 'error', text1: 'Failed', text2: e.response?.data?.error || 'Transaction could not be processed' });
        } finally {
            setSubmitting(false);
        }
    };

    const calculateFeeDetails = (amt: number) => {
        if (!amt) return { charge: 0, agentShare: 0, saccoShare: 0 };
        const key = mode === 'deposit' ? 'depositFees' : 'withdrawalFees';
        const tiers = agentFees?.[key] || [];
        
        if (Array.isArray(tiers) && tiers.length > 0) {
            // Find tier based on amount
            const tier = tiers.find((t: any) => amt >= Number(t.min || 0) && amt <= Number(t.max || 999999999));
            if (tier) return { charge: Number(tier.charge || 0), agentShare: Number(tier.agentShare || 0), saccoShare: Number(tier.saccoShare || 0) };
        }
        
        // Fallback to 1% charge, 50/50 split if no tier found
        const fallbackCharge = Math.round(amt * 0.01);
        return { charge: fallbackCharge, agentShare: Math.round(fallbackCharge * 0.5), saccoShare: Math.round(fallbackCharge * 0.5) };
    };

    const feeDetails = calculateFeeDetails(parseFloat(amount) || 0);

    const balanceAfter = selectedAccount
        ? (selectedAccount.balance || 0) + (mode === 'deposit'
            ? ((parseFloat(amount) || 0) - feeDetails.charge)
            : -((parseFloat(amount) || 0) + feeDetails.charge))
        : 0;

    // Loading state
    if (loading) return (
        <View className="flex-1 bg-warmWhite items-center justify-center">
            <ActivityIndicator size="large" color="#1A6B47" />
            <Text className="text-textLight text-xs mt-4">Loading member...</Text>
        </View>
    );

    // No member found
    if (!member) return (
        <View className="flex-1 bg-warmWhite items-center justify-center p-10">
            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                <IconSymbol name="exclamationmark.triangle.fill" size={32} color="#EF4444" />
            </View>
            <Text className="text-textDark font-black text-xl mb-2">Member Not Found</Text>
            <Text className="text-textLight text-xs text-center mb-8">Could not resolve identity from the registry.</Text>
            <TouchableOpacity onPress={() => router.back()} className="bg-leaf px-8 py-4 rounded-2xl">
                <Text className="text-white font-black text-xs uppercase tracking-widest">Return to Directory</Text>
            </TouchableOpacity>
        </View>
    );

    const initials = member.name.split(' ').map((w: string) => w.charAt(0)).join('').substring(0, 2).toUpperCase();
    const getAvatarColor = () => {
        const colors = ['#2ECC8A', '#4EA8F5', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4'];
        return colors[member.name.charCodeAt(0) % colors.length];
    };

    const quickAmounts = [50000, 100000, 200000, 500000, 1000000, 2000000];
    const actionLabel = mode === 'deposit' ? 'Deposit' : 'Withdraw';
    const actionTitle = mode === 'deposit' ? 'Deposit Cash' : 'Withdraw Cash';

    return (
        <View className="flex-1 bg-warmWhite">
            <StatusBar style="light" />

            {/* Header */}
            <View className="bg-forest pt-12 pb-6 px-6">
                <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                        <IconSymbol name="chevron.left" size={20} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                            {actionLabel}
                        </Text>
                        <Text className="text-white text-xl font-black tracking-tight">{actionTitle}</Text>
                    </View>
                </View>

                {/* Member Card */}
                <View className="bg-white/10 border border-white/15 rounded-2xl p-4 flex-row items-center">
                    <View className="w-12 h-12 rounded-xl items-center justify-center mr-4 overflow-hidden" style={{ backgroundColor: getAvatarColor() }}>
                        {member.image || member.user?.image ? (
                            <CachedImage source={{ uri: member.image || member.user?.image }} style={{ width: '100%', height: '100%' }} cachePolicy="memory-disk" transition={200} />
                        ) : (
                            <Text className="text-white font-black text-lg">{initials}</Text>
                        )}
                    </View>
                    <View className="flex-1">
                        <View className="flex-row items-center mb-0.5">
                            <Text className="text-white font-black text-xl tracking-tight mr-2">{member.name}</Text>
                            <View className="bg-mint/20 px-2 py-0.5 rounded-md border border-mint/30">
                                <Text className="text-mint text-[7px] font-black uppercase tracking-widest">Trusted</Text>
                            </View>
                        </View>
                        <Text className="text-white/50 text-[10px] font-bold">
                            {member.memberNumber || member.phone || member.phoneNumber || 'N/A'} {member.zone ? `· ${member.zone}` : ''}
                        </Text>
                    </View>

                    <TouchableOpacity onPress={() => router.back()}>
                        <Text className="text-mint text-xs font-bold">Change ›</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                
                {/* Mode Toggle */}
                <View className="mx-6 mt-5 mb-4 bg-white rounded-2xl p-4 border border-gray-100">
                    <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-1">Action Locked</Text>
                    <Text className="text-textDark text-sm font-bold">
                        {mode === 'deposit' ? 'Deposit mode is active for this member.' : 'Withdraw mode is active for this member.'}
                    </Text>
                </View>

                {/* Account Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-5 mb-5">
                    {accounts.length > 0 ? accounts.map((acc: any) => {
                        const isSelected = selectedAccount?.id === acc.id;
                        const accType = getAccountName(acc);
                        return (

                            <TouchableOpacity
                                key={acc.id}
                                onPress={() => setSelectedAccount(acc)}
                                className={`mr-3 px-5 py-3 rounded-2xl border-2 flex-row items-center ${isSelected ? 'bg-forest border-forest' : 'bg-white border-gray-200'}`}
                            >
                                <Text className="mr-2">🏦</Text>
                                <View>
                                    <View className="flex-row items-center">
                                        <Text className={`text-xs font-black ${isSelected ? 'text-white' : 'text-textDark'}`}>{accType}</Text>
                                        {isSelected && (
                                            <View className="w-4 h-4 bg-mint rounded-full items-center justify-center ml-2">
                                                <IconSymbol name="checkmark" size={8} color="white" />
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>


                        );
                    }) : (
                        <View className="bg-gray-50 px-6 py-4 rounded-2xl border border-gray-100">
                            <Text className="text-textLight text-xs font-bold">No accounts found</Text>
                        </View>
                    )}
                </ScrollView>

                {/* Amount Display */}
                <View className="items-center mb-5">
                    <Text className="text-textLight text-xs font-medium mb-3">
                        How much to {mode}?
                    </Text>
                    <View className="w-full bg-white border border-gray-100 rounded-[28px] p-5 shadow-sm flex-row items-center">
                        <Text className="text-textDark text-2xl font-black mr-3">UGX</Text>
                        <TextInput
                            className="flex-1 text-textDark text-2xl font-black p-0"
                            placeholder="0"
                            keyboardType="numeric"
                            value={amount}
                            onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
                        />
                    </View>
                    <View className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-xl mt-4 flex-row items-center">
                        <View className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
                        <Text className="text-emerald-800 text-[10px] font-black uppercase tracking-widest">
                            Available Float: UGX {fmt(floatBalance)}
                        </Text>
                    </View>
                </View>

                {/* Quick Amount Chips */}
                <View className="flex-row flex-wrap justify-center px-6 mb-5">
                    {quickAmounts.map(val => (
                        <TouchableOpacity 
                            key={val} 
                            onPress={() => onQuickAmount(val)}
                            className={`px-5 py-2.5 rounded-full border m-1.5 ${amount === val.toString() ? 'bg-forest border-forest' : 'bg-white border-gray-200'}`}
                        >
                            <Text className={`text-xs font-black ${amount === val.toString() ? 'text-white' : 'text-textDark'}`}>
                                {fmtShort(val)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Summary Table */}
                <View className="mx-6 mb-5 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <View className="flex-row border-b border-gray-50">
                        <View className="flex-1 py-3 px-4 border-r border-gray-50">
                            <Text className="text-textLight text-[9px] font-black uppercase tracking-widest mb-1">
                                {mode === 'deposit' ? 'Net to Account' : 'Total Deduction'}
                            </Text>
                            <Text className="text-textDark text-sm font-bold">
                                {amount ? `UGX ${fmt(mode === 'deposit' ? parseFloat(amount) - feeDetails.charge : parseFloat(amount) + feeDetails.charge)}` : '—'}
                            </Text>
                        </View>

                        <View className="flex-1 py-3 px-4 border-r border-gray-50">
                            <Text className="text-textLight text-[9px] font-black uppercase tracking-widest mb-1">Fee</Text>
                            <Text className="text-textDark text-sm font-bold">
                                {amount ? `UGX ${fmt(feeDetails.charge)}` : '—'}
                            </Text>
                        </View>
                        <View className="flex-1 py-3 px-4">
                            <Text className="text-forest text-[9px] font-black uppercase tracking-widest mb-1">Your Comm.</Text>
                            <Text className="text-forest text-sm font-bold">
                                {amount ? `UGX ${fmt(feeDetails.agentShare)}` : '—'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View className="px-6 mb-4">
                    <Text className="text-textLight text-[10px] font-medium text-center">
                        Use the phone keyboard to enter the amount, then choose a quick amount if needed.
                    </Text>
                </View>
            </ScrollView>

            {/* Confirm Button */}
            <View className="px-6 pb-8 pt-3 bg-warmWhite">
                <TouchableOpacity 
                    onPress={handleTransaction}
                    disabled={submitting || !amount || !selectedAccount}
                    className={`py-5 rounded-[24px] flex-row items-center justify-center ${submitting || !amount ? 'bg-gray-200' : mode === 'deposit' ? 'bg-forest' : 'bg-amber-600'}`}
                >
                    {submitting ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text className="text-lg mr-2">›</Text>
                            <Text className="text-white font-black text-sm uppercase tracking-widest">
                                Confirm {mode === 'deposit' ? 'Deposit' : 'Withdrawal'}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Receipt Modal */}
            <Modal visible={showReceipt} transparent animationType="slide">
                <View className="flex-1 bg-warmWhite">
                    <View style={{ paddingTop: Platform.OS === 'ios' ? 50 : 30 }} className="flex-1">
                        <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-100">
                            <TouchableOpacity onPress={() => setShowReceipt(false)}>
                                <IconSymbol name="xmark" size={24} color={THEME.text1} />
                            </TouchableOpacity>
                            <Text className="text-text1 font-black uppercase text-[10px] tracking-[4px]">Transaction Receipt</Text>
                            <View className="w-6" />
                        </View>

                        <ScrollView className="flex-1 px-6 pt-10">
                            <View className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden mb-10">
                                {/* Receipt Header */}
                                <View className={`p-8 items-center ${receipt?.type === 'DEPOSIT' ? 'bg-forest' : 'bg-amber-600'}`}>
                                    <View className="w-20 h-20 bg-white rounded-[24px] items-center justify-center mb-4 p-2 shadow-sm">
                                        <Image 
                                            source={require('../../assets/images/sacco-logo.jpg')}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="contain"
                                        />
                                    </View>
                                    <Text className="text-white text-xl font-black">Success</Text>
                                    <View className="mt-2 px-4 py-1.5 bg-white/20 rounded-full">
                                        <Text className="text-white text-[9px] font-black uppercase tracking-widest">
                                            {receipt?.type || 'TRANSACTION'} TO {receipt?.memberName?.split(' ')[0].toUpperCase()}
                                        </Text>
                                    </View>

                                </View>

                                {/* Receipt Body */}
                                <View className="p-8">
                                    <View className="items-center mb-8">
                                        <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-1">Amount Transacted</Text>
                                        <Text className="text-textDark text-4xl font-black">UGX {fmt(receipt?.amount || 0)}</Text>
                                    </View>

                                    <View className="space-y-5 py-6 border-t border-b border-dashed border-gray-200 mb-8">
                                        <View className="flex-row justify-between">
                                            <Text className="text-textLight text-xs font-bold">Member Name</Text>
                                            <Text className="text-textDark text-xs font-black">{receipt?.memberName}</Text>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className="text-textLight text-xs font-bold">Base Amount</Text>
                                            <Text className="text-textDark text-xs font-black">UGX {fmt(receipt?.amount || 0)}</Text>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className="text-textLight text-xs font-bold">Transaction Fee</Text>
                                            <Text className="text-textDark text-xs font-black">UGX {fmt(feeDetails.charge || 0)}</Text>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className="text-textLight text-xs font-bold">Transaction ID</Text>
                                            <Text className="text-textDark text-xs font-black font-mono">{receipt?.id}</Text>
                                        </View>
                                        <View className="flex-row justify-between pt-2">
                                            <Text className="text-forest text-[11px] font-black uppercase">Closing Balance</Text>
                                            <Text className="text-forest text-base font-black">UGX {fmt(receipt?.balanceAfter || 0)}</Text>
                                        </View>
                                    </View>

                                    <View className="items-center pb-4">
                                        <Text className="text-gray-400 text-[8px] font-black uppercase tracking-[4px]">Bukonzo United Teachers SACCO</Text>
                                        <Text className="text-forest text-[7px] font-black uppercase tracking-[2px] mt-1">Unity is Strength</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="flex-row gap-x-3 mb-4">
                                <TouchableOpacity 
                                    onPress={() => {
                                        if (receipt) {
                                            generateReceiptPDF({
                                                ...receipt,
                                                id: receipt.id || 'N/A',
                                                type: receipt.type || 'TXN',
                                                amount: receipt.amount || 0,
                                                memberName: receipt.memberName || 'Member',
                                                accountName: receipt.accountName || 'Savings',
                                                date: receipt.date || new Date().toLocaleString(),
                                                balanceAfter: receipt.balanceAfter || 0,
                                                reference: receipt.id,
                                                agentName: agent?.name
                                            });
                                        }
                                    }}
                                    className="flex-1 bg-gray-100 h-16 rounded-[24px] items-center justify-center flex-row"
                                >
                                    <IconSymbol name="printer.fill" size={18} color={THEME.forest} style={{ marginRight: 10 }} />
                                    <Text className="text-forest font-black text-xs uppercase tracking-widest">Print PDF</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => {
                                        if (receipt) {
                                            Share.share({
                                                message: `Receipt for ${receipt?.memberName}\nAmt: UGX ${fmt(receipt?.amount || 0)}\nRef: ${receipt?.id}`,
                                            });
                                        }
                                    }}
                                    className={`flex-1 h-16 rounded-[24px] items-center justify-center flex-row ${receipt?.type === 'DEPOSIT' ? 'bg-forest' : 'bg-amber-600'}`}
                                >
                                    <IconSymbol name="square.and.arrow.up" size={18} color="white" style={{ marginRight: 10 }} />
                                    <Text className="text-white font-black text-xs uppercase tracking-widest">Share</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity 
                                onPress={() => setShowReceipt(false)}
                                className="h-16 rounded-[24px] items-center justify-center bg-gray-100"
                            >
                                <Text className="text-textMid font-black text-sm uppercase tracking-widest">Done</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
