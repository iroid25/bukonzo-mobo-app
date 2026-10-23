import { IconSymbol } from '@/components/ui/icon-symbol';
import { TransactionDetailSheet } from '@/components/TransactionDetailSheet';
import { attachRunningBalances, isRealizedTransaction, sumTransactionFlows, transactionDirection, transactionLabel } from '@/services/api';
import { useProfile, useTransactions } from '@/services/queries';
import { Stack, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, Text, TouchableOpacity, View, ActivityIndicator, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

const fmtAmount = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const DATE_FILTERS = ['All Time', 'This Month', 'Last Month', 'Last 90 Days'] as const;
type DateFilter = typeof DATE_FILTERS[number];

const matchesDateFilter = (t: any, f: DateFilter) => {
  if (f === 'All Time') return true;
  const d = t.dateISO ? new Date(t.dateISO) : null;
  if (!d) return false;
  const now = new Date();
  if (f === 'This Month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (f === 'Last Month') {
    const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    return d.getFullYear() === y && d.getMonth() === m;
  }
  if (f === 'Last 90 Days') return now.getTime() - d.getTime() <= 90 * 86_400_000;
  return true;
};

// "Today" / "Yesterday" / "12 August" / "12 August 2024"
const dayLabel = (iso?: string | null) => {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
};

const timeLabel = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

export default function TransactionsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Time');
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useProfile();
  const memberId = (profile as any)?.memberId;
  const accounts = ((profile as any)?.accounts || []).map((a: any) => ({ id: a.id, balance: a.balance }));
  const { data: txnResp, isLoading: txnLoading, isRefetching, refetch: refetchTx } = useTransactions(memberId);

  const loading = profileLoading || txnLoading;

  const transactions: any[] = useMemo(() => {
    if (!txnResp) return [];
    const rows = (txnResp?.data?.data || txnResp?.data?.transactions || (Array.isArray(txnResp?.data) ? txnResp.data : [])) || [];
    // Derive balance-before / balance-after from current account balances.
    attachRunningBalances(rows, accounts);
    return rows;
  }, [txnResp, accounts]);

  const onRefresh = async () => {
    try {
      await Promise.all([refetchProfile(), refetchTx()]);
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Sync Error', text2: error.message || 'Unable to update ledger' });
    }
  };

  const filteredData = useMemo(() => {
    // Only settled transactions - hide PENDING / FAILED / REVERSED attempts.
    let settled = transactions.filter(t => isRealizedTransaction(t.status) && matchesDateFilter(t, dateFilter));
    if (filter === 'Deposits') settled = settled.filter(t => t.rawType === 'DEPOSIT');
    else if (filter === 'Withdraws') settled = settled.filter(t => t.rawType === 'WITHDRAWAL');
    else if (filter === 'Loans') settled = settled.filter(t => ['LOAN_DISBURSEMENT', 'LOAN_REPAYMENT', 'LOAN_FEE'].includes(t.rawType));
    return settled;
  }, [transactions, filter, dateFilter]);

  // Group into day sections (backend already returns newest-first).
  const sections = useMemo(() => {
    const groups: { title: string; data: any[] }[] = [];
    for (const t of filteredData) {
      const title = dayLabel(t.dateISO);
      const last = groups[groups.length - 1];
      if (last && last.title === title) last.data.push(t);
      else groups.push({ title, data: [t] });
    }
    return groups;
  }, [filteredData]);

  const { totalIn, totalOut } = sumTransactionFlows(filteredData);

  const handleExportPdf = async () => {
    if (filteredData.length === 0) {
      Toast.show({ type: 'info', text1: 'Nothing to export', text2: 'No transactions in this range.' });
      return;
    }
    setExporting(true);
    try {
      const rows = filteredData; // newest-first; balanceBefore/After already attached
      const rowsHtml = rows.map((t: any, i: number) => {
        const dir = transactionDirection(t.rawType);
        const sign = dir === 'IN' ? '+' : dir === 'OUT' ? '−' : '';
        return `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#F3F6F4'}">
            <td style="padding:8px 12px;font-size:12px">${t.dateISO ? new Date(t.dateISO).toLocaleDateString() : '—'}</td>
            <td style="padding:8px 12px;font-size:12px;font-weight:600">${transactionLabel(t.rawType, t.description)}</td>
            <td style="padding:8px 12px;font-size:12px">${t.reference || t.description || '—'}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;color:${dir === 'IN' ? '#17693E' : '#13261E'}">${sign} ${fmtAmount(t.amount)}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600">${t.balanceAfter != null ? fmtAmount(t.balanceAfter) : '—'}</td>
          </tr>`;
      }).join('');

      const html = `
        <html><head><style>
          * { margin:0; padding:0; box-sizing:border-box; }
          body { font-family: -apple-system, sans-serif; color:#13261E; padding:24px; }
          .header { background:#0F4D3A; color:#fff; padding:20px; border-radius:8px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; }
          .header h1 { font-size:16px; font-weight:800; }
          .header p { font-size:10px; opacity:0.7; }
          .meta { display:flex; gap:24px; margin-bottom:16px; flex-wrap:wrap; }
          .meta-item .label { font-size:10px; color:#4A5F56; }
          .meta-item .value { font-size:13px; font-weight:700; }
          .summary { background:#E3F4EA; border-radius:8px; padding:12px 16px; margin-bottom:16px; display:flex; gap:24px; }
          .summary .item .lbl { font-size:10px; color:#4A5F56; }
          .summary .item .val { font-size:14px; font-weight:800; }
          table { width:100%; border-collapse:collapse; }
          thead th { background:#0F4D3A; color:#fff; padding:10px 12px; font-size:11px; font-weight:700; text-align:left; }
          thead th:last-child, thead th:nth-last-child(2) { text-align:right; }
          tbody td { border-bottom:1px solid #E6ECE8; }
          .footer { margin-top:24px; font-size:10px; color:#4A5F56; text-align:center; }
        </style></head><body>
          <div class="header">
            <div><h1>BUKONZO TEACHERS SACCO</h1><p>Statement — ${dateFilter}</p></div>
            <div style="text-align:right"><p style="font-size:14px;font-weight:800">STATEMENT</p><p>Generated ${new Date().toLocaleDateString()}</p></div>
          </div>
          <div class="meta">
            <div class="meta-item"><div class="label">Member</div><div class="value">${(profile as any)?.name || '—'}</div></div>
            <div class="meta-item"><div class="label">Transactions</div><div class="value">${rows.length}</div></div>
          </div>
          <div class="summary">
            <div class="item"><div class="lbl">Money in</div><div class="val" style="color:#17693E">+ ${fmtAmount(totalIn)}</div></div>
            <div class="item"><div class="lbl">Money out</div><div class="val">− ${fmtAmount(totalOut)}</div></div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Transaction</th><th>Reference</th><th>Amount (UGX)</th><th>Balance (UGX)</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="footer">This is a system-generated statement from BUKONZO TEACHERS SACCO.</div>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Statement' });
      }
      Toast.show({ type: 'success', text1: 'Statement ready', text2: 'PDF has been generated.' });
    } catch {
      Toast.show({ type: 'error', text1: 'Export failed', text2: 'Could not generate PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const dir = transactionDirection(item.rawType);
    const isPositive = dir === 'IN';
    const isNeutral = dir === 'NEUTRAL';
    const subtitle = item.description
      ? item.description
      : item.source?.label
        ? `${item.source.label}${item.source.handledBy ? ` · ${item.source.handledBy}` : ''}`
        : String(item.rawType || 'Transaction').replace(/_/g, ' ');

    return (
      <TouchableOpacity
        onPress={() => setSelected(item)}
        className="bg-white px-2 py-3.5 flex-row items-center border-b border-gray-100"
        activeOpacity={0.6}
      >
        <View className={`w-10 h-10 rounded-full items-center justify-center mr-3.5 ${
          isNeutral ? 'bg-gray-100' : isPositive ? 'bg-mint/10' : 'bg-gold/10'
        }`}>
          <IconSymbol
            name={isNeutral ? 'arrow.right' : isPositive ? 'arrow.down.left.circle.fill' : 'arrow.up.right.circle.fill'}
            size={19}
            color={isNeutral ? '#9CA3AF' : isPositive ? '#2ECC8A' : '#F5C842'}
          />
        </View>
        <View className="flex-1 mr-3">
          <Text className="text-textDark font-bold text-[14.5px] tracking-tight" numberOfLines={1}>
            {transactionLabel(item.rawType, item.description)}
          </Text>
          <Text className="text-textLight text-xs mt-0.5" numberOfLines={1}>{subtitle}</Text>
        </View>
        <View className="items-end">
          <Text className={`font-black text-[14.5px] ${isPositive ? 'text-leaf' : isNeutral ? 'text-textMid' : 'text-textDark'}`}>
            {isNeutral ? '' : isPositive ? '+' : '-'}{fmtAmount(item.amount)}
          </Text>
          <Text className="text-[11px] text-textLight mt-0.5">{timeLabel(item.dateISO)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="bg-forest pt-12 pb-6 overflow-hidden">
        <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-mint/5 rounded-full" />
        <View className="px-5 flex-row items-center justify-between mb-6">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-white/10 rounded-xl items-center justify-center mr-3 border border-white/15">
              <IconSymbol name="chevron.left" size={18} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-lg font-black tracking-tight">Financial Ledger</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} className="w-9 h-9 bg-white/10 rounded-xl items-center justify-center border border-white/15 mr-2">
            <IconSymbol name="arrow.clockwise" size={16} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleExportPdf}
            disabled={exporting}
            className="w-9 h-9 rounded-xl items-center justify-center border border-white/15"
            style={{ backgroundColor: exporting ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.10)' }}
          >
            <IconSymbol name={exporting ? 'arrow.clockwise' : 'square.and.arrow.down'} size={16} color="white" />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View className="px-5 flex-row" style={{ gap: 12 }}>
          <View className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/10">
            <View className="flex-row items-center mb-1.5">
              <IconSymbol name="arrow.down.left" size={11} color="#2ECC8A" />
              <Text className="text-white/40 text-[8px] font-black uppercase tracking-widest ml-1.5">In · Recent</Text>
            </View>
            <Text className="text-white font-black text-base tracking-tight" numberOfLines={1}>{totalIn.toLocaleString()} <Text className="text-[9px] text-mint">UGX</Text></Text>
          </View>
          <View className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/10">
            <View className="flex-row items-center mb-1.5">
              <IconSymbol name="arrow.up.right" size={11} color="#F5C842" />
              <Text className="text-white/40 text-[8px] font-black uppercase tracking-widest ml-1.5">Out · Recent</Text>
            </View>
            <Text className="text-white font-black text-base tracking-tight" numberOfLines={1}>{totalOut.toLocaleString()} <Text className="text-[9px] text-gold">UGX</Text></Text>
          </View>
        </View>

        {/* Filter — fixed segmented control, always fits the screen */}
        <View className="mx-5 mt-5 flex-row bg-white/10 rounded-2xl p-1">
          {['All', 'Deposits', 'Withdraws', 'Loans'].map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
              className={`flex-1 py-2 rounded-xl items-center ${filter === f ? 'bg-mint' : ''}`}
            >
              <Text numberOfLines={1} className={`text-[11px] font-black tracking-tight ${filter === f ? 'text-forest' : 'text-white/70'}`}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date range filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12 }} style={{ flexGrow: 0 }}>
          {DATE_FILTERS.map((df) => {
            const active = dateFilter === df;
            return (
              <TouchableOpacity
                key={df}
                onPress={() => setDateFilter(df)}
                activeOpacity={0.7}
                className="mr-2 h-8 px-3.5 rounded-full items-center justify-center border"
                style={{ backgroundColor: active ? '#0F4D3A' : 'rgba(255,255,255,0.08)', borderColor: active ? '#0F4D3A' : 'rgba(255,255,255,0.2)' }}
              >
                <Text className="text-[11px]" style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.75)', fontWeight: active ? '700' : '600' }}>{df}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-1 -mt-4 bg-white rounded-t-[32px] overflow-hidden">
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section }) => (
            <View className="bg-white pt-5 pb-2 px-2">
              <Text className="text-forest text-[11px] font-black uppercase tracking-[3px]">{section.title}</Text>
            </View>
          )}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 140 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#1A6B47" />}
          ListEmptyComponent={() => !loading ? (
            <View className="items-center justify-center py-24 opacity-20">
              <IconSymbol name="tray.circle.fill" size={60} color="#0D3D2B" />
              <Text className="text-forest mt-6 font-black uppercase tracking-[4px] text-xs">No Movement detected</Text>
            </View>
          ) : <ActivityIndicator color="#1A6B47" className="mt-12" />}
        />
      </View>

      <TransactionDetailSheet txn={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
