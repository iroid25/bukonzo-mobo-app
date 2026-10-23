import { isAgentProcessedTxn } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { useTransactions } from '@/services/queries';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    RefreshControl, 
    Text, 
    TouchableOpacity, 
    View, 
    ScrollView, 
    Dimensions, 
    ActivityIndicator,
    TextInput,
    Modal,
    Share,
    SafeAreaView
} from 'react-native';
import Toast from 'react-native-toast-message';
import { generateReceiptPDF } from '@/utils/receipt';
import { exportLedgerXls, LedgerRow } from '@/services/ledgerExport';

const { width } = Dimensions.get('window');

const THEME = {
  forest: '#1a4a2e',
  forestMid: '#1f5a38',
  forestLight: '#256b42',
  gold: '#c9922a',
  goldLight: '#e0aa45',
  warmWhite: '#faf8f3',
  ink: '#0f1f16',
  muted: '#6b7c71',
  border: '#d6e8dc',
  card: '#ffffff',
  surface: '#f4f7f5',
  red: '#c0392b',
  redSoft: '#fdf0ef',
  greenSoft: '#edf7f1',
  greenText: '#1a7a45',
};

const fmt = (n: number) => 
  'UGX ' + new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(n || 0);

// Member on the other end of a ledger row (mapTransaction exposes the account
// owner's name as ownerName, plus memberNumber / ownerImage).
const clientNameFor = (t: any) =>
  (t?.member?.name ||
    t?.ownerName ||
    t?.clientName ||
    t?.memberName ||
    (typeof t?.description === 'string' && t.description.replace(/^(Deposit|Withdrawal) for /i, '')) ||
    'Member') as string;

const nameInitials = (name: string) =>
  String(name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();

export default function AgentTransactionsScreen() {
  const { user: agent } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTxn, setSelectedTxn] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  // Shared, cached transaction feed (same key as the agent dashboard, so the
  // two screens never issue duplicate requests and tab switches are instant).
  const { data: txnData, refetch: refetchTx } = useTransactions();

  useEffect(() => {
    if (!txnData || !agent) return;
    let active = true;
    const rows = (
      txnData?.data?.data ||
      txnData?.data?.transactions ||
      (Array.isArray(txnData?.data) ? txnData.data : [])
    ).filter((t: any) => isAgentProcessedTxn(t, agent));
    if (active) {
      setTransactions(rows);
      setLoading(false);
    }
    return () => { active = false; };
  }, [txnData, agent]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetchTx(); } finally { setRefreshing(false); }
  }, [refetchTx]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    return transactions.filter(t => {
      // Category filter
      if (filter !== 'all') {
        const typeMatch = t.type?.toLowerCase() === filter.toLowerCase();
        const directionMatch = filter === 'credit' ? (t.type === 'DEPOSIT') : filter === 'debit' ? (t.type === 'WITHDRAWAL') : false;
        if (!typeMatch && !directionMatch) return false;
      }
      
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const docMatch = [t.description, t.id, t.reference, t.member].join(' ').toLowerCase().includes(q);
        if (!docMatch) return false;
      }
      
      return true;
    });
  }, [transactions, filter, searchQuery]);

  // Derived Totals
  const totals = useMemo(() => {
    const credits = filteredData.filter(t => t.type === 'DEPOSIT').reduce((s, t) => s + Number(t.amount || 0), 0);
    const debits = filteredData.filter(t => t.type === 'WITHDRAWAL').reduce((s, t) => s + Number(t.amount || 0), 0);
    return { count: filteredData.length, credits, debits };
  }, [filteredData]);

  // Group by Date for Sectioning
  const groupedData = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    filteredData.forEach(t => {
      const date = t.date || new Date(t.createdAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(date => ({
      title: date,
      data: groups[date]
    }));
  }, [filteredData]);

  // Build the current filtered set into a styled Excel workbook and share it.
  const exportLedger = async () => {
    if (filteredData.length === 0) {
      Toast.show({ type: 'error', text1: 'Nothing to Export', text2: 'No rows match the current filters.' });
      return;
    }
    const rows: LedgerRow[] = filteredData.map((it: any) => {
      const when = it.dateISO ? new Date(it.dateISO) : it.createdAt ? new Date(it.createdAt) : null;
      return {
        date: when ? when.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : (it.date || '—'),
        time: when ? when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
        type: (it.rawType || it.type || 'TRANSACTION').toUpperCase(),
        member: clientNameFor(it),
        reference: it.reference || it.id || '—',
        amount: Number(it.amount || 0),
        status: it.status || 'COMPLETED',
        isCredit: it.type === 'DEPOSIT',
      };
    });
    const res = await exportLedgerXls({
      title: 'Agent Transaction Ledger',
      subtitle: `${totals.count} sessions · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      fileName: `agent-ledger-${new Date().toISOString().slice(0, 10)}`,
      exportedBy: agent?.name,
      rows,
      summary: [
        { label: 'Credits', value: fmt(totals.credits) },
        { label: 'Debits', value: fmt(totals.debits) },
        { label: 'Net', value: fmt(totals.credits - totals.debits) },
      ],
    });
    if (!res.ok) {
      Toast.show({ type: 'error', text1: 'Export Failed', text2: res.message });
    }
  };

  const renderTxnRow = (item: any) => {
    const isDeposit = item.type === 'DEPOSIT';
    const amountColor = isDeposit ? 'text-[#1a7a45]' : 'text-[#c0392b]';
    const bg = isDeposit ? '#edf7f1' : '#fdf0ef';
    const image = item?.ownerImage || item?.memberImage || null;
    const client = clientNameFor(item);

    return (
      <TouchableOpacity 
        key={item.id}
        onPress={() => { setSelectedTxn(item); setShowDetail(true); }}
        className="bg-white px-4 py-4 flex-row items-center border-b border-[#d6e8dc]"
      >
        <View style={{ backgroundColor: bg }} className="w-11 h-11 rounded-full items-center justify-center mr-3 overflow-hidden">
          {image ? (
            <Image source={{ uri: image }} style={{ width: 44, height: 44 }} cachePolicy="memory-disk" transition={200} />
          ) : (
            <Text className={`text-[12px] font-black ${isDeposit ? 'text-[#1a7a45]' : 'text-[#c0392b]'}`}>{nameInitials(client)}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-[#0f1f16] font-bold text-[14px]" numberOfLines={1}>
            {client}
          </Text>
          <View className="flex-row items-center mt-1">
            <Text className="text-[#6b7c71] text-[11px] font-mono mr-2">{item.memberNumber || item.date}</Text>
            <View className={`px-2 py-0.5 rounded-full ${item.status === 'SUCCESS' || item.status === 'APPROVED' ? 'bg-[#edf7f1]' : 'bg-[#fff8ec]'}`}>
              <Text style={{ color: item.status === 'SUCCESS' || item.status === 'APPROVED' ? '#1a7a45' : '#b8860b' }} className="text-[9px] font-black uppercase">
                {item.status || 'PROCESSED'}
              </Text>
            </View>
          </View>
        </View>
        <View className="items-end">
          <Text className={`font-bold text-[15px] ${amountColor}`}>
            {isDeposit ? '+' : '-'}{fmt(Number(item.amount))}
          </Text>
          <Text className="text-[#6b7c71] text-[10px] font-mono mt-0.5">#{item.id?.slice(-6).toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-[#f4f7f5]">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* HEADER SECTION (FOREST) */}
      <View className="bg-[#1a4a2e] pt-14 pb-6 px-5">
        <View className="flex-row items-center justify-between mb-5">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-white/10 rounded-full items-center justify-center">
            <IconSymbol name="chevron.left" size={20} color="white" />
          </TouchableOpacity>
          <View className="flex-1 mx-4">
            <Text className="text-white text-lg font-bold tracking-tight">Transaction Ledger</Text>
            <Text className="text-white/50 text-[11px] font-medium">Bukonzo SACCO Terminal Node</Text>
          </View>
          <TouchableOpacity onPress={exportLedger} className="w-9 h-9 bg-white/10 rounded-full items-center justify-center">
            <IconSymbol name="square.and.arrow.up" size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Summary Strip */}
        <View className="flex-row bg-white/10 rounded-xl overflow-hidden border border-white/5">
          <View className="flex-1 items-center py-3 border-r border-white/10">
            <Text className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Total Txns</Text>
            <Text className="text-white font-bold text-sm">{totals.count}</Text>
          </View>
          <View className="flex-1 items-center py-3 border-r border-white/10">
            <Text className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Credits</Text>
            <Text className="text-[#6de9a0] font-bold text-sm">{fmt(totals.credits)}</Text>
          </View>
          <View className="flex-1 items-center py-3">
            <Text className="text-white/50 text-[9px] font-black uppercase tracking-widest mb-1">Debits</Text>
            <Text className="text-[#ffa07a] font-bold text-sm">{fmt(totals.debits)}</Text>
          </View>
        </View>
      </View>

      {/* FILTER BAR (STICKY-ish) */}
      <View className="bg-white px-4 pt-4 border-b border-[#d6e8dc]">
        <View className="bg-[#f4f7f5] border border-[#d6e8dc] rounded-xl px-4 h-12 flex-row items-center mb-4">
          <IconSymbol name="magnifyingglass" size={16} color="#6b7c71" />
          <TextInput 
            className="flex-1 ml-3 text-[#0f1f16] font-medium text-[14px]"
            placeholder="Search by ref, member, desc..."
            placeholderTextColor="#6b7c71"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {[
            { id: 'all', label: 'All Activity' },
            { id: 'credit', label: 'Credits' },
            { id: 'debit', label: 'Debits' },
            { id: 'loan', label: 'Loans' },
            { id: 'dividend', label: 'Dividends' }
          ].map(f => (
            <TouchableOpacity 
              key={f.id} 
              onPress={() => setFilter(f.id)}
              className={`mr-2 px-4 py-2 rounded-full border ${filter === f.id ? 'bg-[#1a4a2e] border-[#1a4a2e]' : 'bg-white border-[#d6e8dc]'}`}
            >
              <Text className={`text-[11px] font-bold capitalize ${filter === f.id ? 'text-white' : 'text-[#6b7c71]'}`}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* RESULT BAR */}
      <View className="px-4 py-3 flex-row items-center justify-between">
        <Text className="text-[#6b7c71] text-[11px]">
          Showing <Text className="text-[#0f1f16] font-black">{filteredData.length}</Text> sessions
        </Text>
        <TouchableOpacity onPress={exportLedger} className="flex-row items-center bg-[#f4f7f5] border border-[#d6e8dc] px-3 py-1.5 rounded-lg">
          <IconSymbol name="doc.text" size={12} color="#1a4a2e" />
          <Text className="text-[#1a4a2e] text-[10px] font-black uppercase tracking-widest ml-1.5">Export Ledger</Text>
        </TouchableOpacity>
      </View>

      {/* LEDGER BODY */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1a4a2e" />
        </View>
      ) : (
        <ScrollView 
            className="flex-1"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1a4a2e" />}
        >
          {groupedData.length === 0 ? (
            <View className="items-center justify-center pt-20 px-10">
              <Text className="text-4xl mb-4">🔍</Text>
              <Text className="text-[#0f1f16] font-bold text-center">No transactions found</Text>
              <Text className="text-[#6b7c71] text-xs text-center mt-2">Adjust your filters or query to find transmissions.</Text>
            </View>
          ) : (
            groupedData.map(group => (
              <View key={group.title}>
                <View className="flex-row items-center px-4 py-3 bg-[#f4f7f5]">
                  <Text className="text-[#6b7c71] text-[10px] font-black uppercase tracking-[2px]">{group.title}</Text>
                  <View className="flex-1 h-[1px] bg-[#d6e8dc] mx-3" />
                  <Text className="text-[#6b7c71] text-[10px] font-bold">
                    NET: {fmt(group.data.reduce((s,t) => s + (t.type === 'DEPOSIT' ? Number(t.amount) : -Number(t.amount)), 0))}
                  </Text>
                </View>
                {group.data.map(renderTxnRow)}
              </View>
            ))
          )}
          <View className="h-20" />
        </ScrollView>
      )}

      {/* DETAIL SHEET (MODAL) */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
            <TouchableOpacity className="flex-1" onPress={() => setShowDetail(false)} />
            <View className="bg-white rounded-t-[32px] px-6 pb-12 pt-4">
                <View className="w-10 h-1.5 bg-[#d6e8dc] rounded-full self-center mb-8" />
                
                <View className="items-center mb-8">
                    <View style={{ backgroundColor: selectedTxn?.type === 'DEPOSIT' ? '#edf7f1' : '#fdf0ef' }} className="w-16 h-16 rounded-2xl items-center justify-center mb-4">
                        <Text className="text-3xl">{selectedTxn?.type === 'DEPOSIT' ? '💰' : '💸'}</Text>
                    </View>
                    <Text className={`text-3xl font-black ${selectedTxn?.type === 'DEPOSIT' ? 'text-[#1a7a45]' : 'text-[#c0392b]'}`}>
                        {selectedTxn?.type === 'DEPOSIT' ? '+' : '-'}{fmt(Number(selectedTxn?.amount || 0))}
                    </Text>
                    <Text className="text-[#0f1f16] font-bold text-base mt-1">{selectedTxn?.description || 'Transaction Detail'}</Text>
                    <View className={`mt-3 px-3 py-1 rounded-full ${selectedTxn?.status === 'SUCCESS' || selectedTxn?.status === 'APPROVED' ? 'bg-[#edf7f1]' : 'bg-[#fff8ec]'}`}>
                        <Text style={{ color: selectedTxn?.status === 'SUCCESS' || selectedTxn?.status === 'APPROVED' ? '#1a7a45' : '#b8860b' }} className="text-[10px] font-black uppercase">
                            {selectedTxn?.status || 'PROCESSED'}
                        </Text>
                    </View>
                </View>

                <View className="space-y-4 border-t border-[#d6e8dc] pt-6 mb-8">
                    <View className="flex-row justify-between">
                        <Text className="text-[#6b7c71] text-xs font-medium">Transaction ID</Text>
                        <Text className="text-[#0f1f16] text-xs font-mono font-bold">{selectedTxn?.id}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-[#6b7c71] text-xs font-medium">Reference</Text>
                        <Text className="text-[#0f1f16] text-xs font-mono font-bold">{selectedTxn?.reference || 'N/A'}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-[#6b7c71] text-xs font-medium">Date & Time</Text>
                        <Text className="text-[#0f1f16] text-xs font-bold">{selectedTxn?.date}</Text>
                    </View>
                    <View className="flex-row justify-between">
                        <Text className="text-[#6b7c71] text-xs font-medium">Payment Type</Text>
                        <Text className="text-[#0f1f16] text-xs font-bold">{selectedTxn?.type}</Text>
                    </View>
                </View>

                <View className="flex-row gap-x-3">
                    <TouchableOpacity 
                        onPress={() => {
                            if (selectedTxn) {
                                generateReceiptPDF({
                                    id: selectedTxn.id || 'N/A',
                                    type: selectedTxn.type || 'TXN',
                                    amount: Number(selectedTxn.amount || 0),
                                    memberName: selectedTxn.member || 'Member',
                                    accountName: 'Agent Account',
                                    date: selectedTxn.date || new Date().toLocaleString(),
                                    balanceAfter: Number(selectedTxn.balance || 0),
                                    reference: selectedTxn.reference,
                                    agentName: agent?.name
                                });
                            }
                        }}
                        className="flex-1 bg-[#f4f7f5] border border-[#d6e8dc] h-14 rounded-2xl items-center justify-center flex-row"
                    >
                        <IconSymbol name="printer.fill" size={16} color="#1a4a2e" style={{ marginRight: 8 }} />
                        <Text className="text-[#1a4a2e] font-black text-xs uppercase tracking-widest">Print PDF</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => Share.share({ message: `Receipt for ${selectedTxn?.member}\nAmt: ${fmt(Number(selectedTxn?.amount || 0))}` })}
                        className="flex-1 bg-[#1a4a2e] h-14 rounded-2xl items-center justify-center flex-row"
                    >
                        <IconSymbol name="square.and.arrow.up" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text className="text-white font-black text-xs uppercase tracking-widest">Share</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

    </View>
  );
}
