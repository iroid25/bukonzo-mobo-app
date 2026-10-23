import { IconSymbol } from '@/components/ui/icon-symbol';
import { transactionDirection, transactionLabel } from '@/services/api';
import { useProfile } from '@/services/queries';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const isRealized = (status?: string) =>
  ['COMPLETED', 'APPROVED'].includes(String(status || '').toUpperCase());

const FILTERS = ['All', 'Deposits', 'Withdrawals', 'Loans', 'Fees'] as const;
type Filter = typeof FILTERS[number];
type Tab = 'transactions' | 'fees' | 'statement';

function matchesFilter(t: any, filter: Filter): boolean {
  if (filter === 'All') return true;
  const rt = String(t.rawType || '').toUpperCase();
  if (filter === 'Deposits') return rt === 'DEPOSIT';
  if (filter === 'Withdrawals') return rt === 'WITHDRAWAL';
  if (filter === 'Loans') return rt.includes('LOAN');
  if (filter === 'Fees') return rt.includes('FEE') || rt.includes('CHARGE');
  return true;
}

export default function AccountDetailsScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;
  const router = useRouter();
  const { data, isLoading, isRefetching, refetch } = useProfile();
  const [activeFilter, setActiveFilter] = useState<Filter>('All');
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [exporting, setExporting] = useState(false);

  const account = useMemo(() => {
    const accounts = data?.accounts ?? [];
    return (
      accounts.find((a: any) => String(a.id) === String(id) || String(a.accNo) === String(id) || String(a.accountNumber) === String(id)) ??
      accounts[0] ?? null
    );
  }, [data, id]);

  const allTxns = useMemo(() => {
    const list = (data?.transactions ?? []).filter((t: any) => isRealized(t.status));
    if (!account) return list;
    return list.filter(
      (t: any) => String(t.accountId) === String(account.id) || String(t.accountNumber) === String(account.accNo),
    );
  }, [data, account]);

  // Tab-specific lists
  const tabTxns = useMemo(() => {
    if (activeTab === 'fees') return allTxns.filter((t: any) => {
      const rt = String(t.rawType || '').toUpperCase();
      return rt.includes('FEE') || rt.includes('CHARGE');
    });
    if (activeTab === 'statement') return allTxns;
    return allTxns.filter((t: any) => matchesFilter(t, activeFilter));
  }, [allTxns, activeTab, activeFilter]);

  const inTotal = allTxns.reduce((sum: number, t: any) => sum + (transactionDirection(t.rawType) === 'IN' ? t.amount : 0), 0);
  const outTotal = allTxns.reduce((sum: number, t: any) => sum + (transactionDirection(t.rawType) === 'OUT' ? t.amount : 0), 0);
  const netChange = inTotal - outTotal;

  // Running balance for statement: walk backward from current balance
  const stmtRows = useMemo(() => {
    if (!account) return [];
    const bal = Number(account.balance) || 0;
    const rows: any[] = [];
    let running = bal;
    // txns come newest-first from the API
    for (const t of tabTxns) {
      const dir = transactionDirection(t.rawType);
      const amt = t.amount || 0;
      rows.push({ ...t, balanceAfter: running, direction: dir });
      // walking backward: subtract IN, add OUT
      if (dir === 'IN') running -= amt;
      else if (dir === 'OUT') running += amt;
    }
    return rows;
  }, [tabTxns, account]);

  // Fee totals
  const feeTotal = tabTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of tabTxns) {
      const key = t.date || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [tabTxns]);

  useEffect(() => {
    if (!isLoading && !account) {
      Toast.show({ type: 'error', text1: 'Not Found', text2: 'Account not detected.' });
      router.back();
    }
  }, [isLoading, account, router]);

  const onRefresh = useCallback(async () => {
    try { await refetch(); } catch (e: any) {
      Toast.show({ type: 'error', text1: 'Sync Error', text2: e.message || 'Unable to update' });
    }
  }, [refetch]);

  const handleExportPdf = async () => {
    if (stmtRows.length === 0) {
      Toast.show({ type: 'info', text1: 'No transactions', text2: 'Nothing to export.' });
      return;
    }
    setExporting(true);
    try {
      const rowsHtml = stmtRows.map((t, i) => {
        const isIn = t.direction === 'IN';
        return `
          <tr style="background:${i % 2 === 0 ? '#fff' : '#F3F6F4'}">
            <td style="padding:8px 12px;font-size:12px">${t.date}</td>
            <td style="padding:8px 12px;font-size:12px;font-weight:600">${transactionLabel(t.rawType, t.description)}</td>
            <td style="padding:8px 12px;font-size:12px">${t.reference || '—'}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;color:${isIn ? '#17693E' : '#13261E'}">${isIn ? '+' : '−'} ${fmt(t.amount)}</td>
            <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:600">${fmt(t.balanceAfter)}</td>
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
            <div><h1>BUKONZO TEACHERS SACCO</h1><p>Account Statement</p></div>
            <div style="text-align:right"><p style="font-size:14px;font-weight:800">STATEMENT</p><p>Generated ${new Date().toLocaleDateString()}</p></div>
          </div>
          <div class="meta">
            <div class="meta-item"><div class="label">Member</div><div class="value">${data?.name || '—'}</div></div>
            <div class="meta-item"><div class="label">Account</div><div class="value">${account?.title || 'Savings Account'}</div></div>
            <div class="meta-item"><div class="label">Account no.</div><div class="value">${account?.accNo || '—'}</div></div>
          </div>
          <div class="summary">
            <div class="item"><div class="lbl">Money in</div><div class="val" style="color:#17693E">+ ${fmt(inTotal)}</div></div>
            <div class="item"><div class="lbl">Money out</div><div class="val">− ${fmt(outTotal)}</div></div>
            <div class="item"><div class="lbl">Closing balance</div><div class="val" style="color:#0F4D3A">UGX ${fmt(account?.balance || 0)}</div></div>
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

  if (isLoading && !account) {
    return <View className="flex-1 items-center justify-center bg-warmWhite"><ActivityIndicator color="#1A6B47" /></View>;
  }

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor="#1A6B47" />}
      >
        {/* Green header — in-flow so it always renders; card below overlaps it */}
        <View className="bg-forest pt-12 pb-16 overflow-hidden">
          <View className="absolute top-[-40px] left-[-40px] w-64 h-64 bg-mint/5 rounded-full" />
          <View className="px-6 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} className="w-11 h-11 bg-white/15 rounded-[14px] items-center justify-center border border-white/20">
              <IconSymbol name="chevron.left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-[17px] font-bold">{account?.accountType || 'Account'}</Text>
            <TouchableOpacity onPress={handleExportPdf} className="w-11 h-11 bg-white/15 rounded-[14px] items-center justify-center border border-white/20">
              <IconSymbol name={exporting ? 'arrow.clockwise' : 'arrow.down'} size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Card — floats over the green header */}
        <View style={{ marginTop: -56, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 24, padding: 20, elevation: 8, shadowColor: '#0F4D3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }}>
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-[13px] font-semibold text-[#4A5F56]">Available balance</Text>
            <Text className="text-[13px] font-semibold text-[#4A5F56]">{account?.accNo || '—'}</Text>
          </View>
          <View className="flex-row items-baseline mb-3">
            <Text className="text-[16px] font-bold text-[#4A5F56] mr-1">UGX</Text>
            <Text className="text-[32px] font-extrabold text-[#13261E]" style={{ letterSpacing: -0.5 }}>{fmt(account?.balance || 0)}</Text>
          </View>
          <View className="self-start px-2.5 py-1.5 rounded-full flex-row items-center" style={{ backgroundColor: netChange >= 0 ? '#E3F4EA' : '#FBF0DC' }}>
            <IconSymbol name={netChange >= 0 ? 'arrow.up' : 'arrow.down'} size={12} color={netChange >= 0 ? '#17693E' : '#8A5A00'} />
            <Text className="text-[12px] font-bold ml-1" style={{ color: netChange >= 0 ? '#17693E' : '#8A5A00' }}>
              {netChange >= 0 ? 'Up' : 'Down'} UGX {fmt(Math.abs(netChange))} total
            </Text>
          </View>
          <View className="border-t border-[#E6ECE8] mt-4 pt-4 flex-row justify-between">
            <View className="flex-1">
              <Text className="text-[12px] text-[#4A5F56] mb-0.5">Money in</Text>
              <Text className="text-[15px] font-extrabold text-[#17693E]">+ {fmt(inTotal)}</Text>
            </View>
            <View className="flex-1 items-end">
              <Text className="text-[12px] text-[#4A5F56] mb-0.5">Money out</Text>
              <Text className="text-[15px] font-extrabold text-[#13261E]">− {fmt(outTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}>
          {(['transactions', 'fees', 'statement'] as Tab[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab)}
                className="mr-2 px-5 h-11 rounded-full items-center justify-center border"
                style={{ backgroundColor: active ? '#0F4D3A' : '#FFFFFF', borderColor: active ? '#0F4D3A' : '#E6ECE8' }}
              >
                <Text className="text-[13px]" style={{ color: active ? '#FFFFFF' : '#4A5F56', fontWeight: active ? '700' : '600' }}>
                  {tab === 'transactions' ? 'Transactions' : tab === 'fees' ? 'Fees' : 'Statement'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Filter chips - only on Transactions tab */}
        {activeTab === 'transactions' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12 }}>
            {FILTERS.map((f) => {
              const active = activeFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  activeOpacity={0.7}
                  onPress={() => setActiveFilter(f)}
                  className="mr-2 px-4 h-9 rounded-full items-center justify-center border"
                  style={{ backgroundColor: active ? '#1B7F4B' : '#FFFFFF', borderColor: active ? '#1B7F4B' : '#E6ECE8' }}
                >
                  <Text className="text-[12px]" style={{ color: active ? '#FFFFFF' : '#4A5F56', fontWeight: active ? '700' : '600' }}>{f}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Fees tab summary */}
        {activeTab === 'fees' && (
          <View className="px-4 mt-4">
            <View className="bg-white rounded-[20px] border border-[#E6ECE8] p-5">
              <Text className="text-[13px] text-[#4A5F56] mb-1">Total fees charged</Text>
              <Text className="text-[24px] font-extrabold text-[#13261E]">UGX {fmt(feeTotal)}</Text>
            </View>
          </View>
        )}

        {/* Statement tab: table with running balance */}
        {activeTab === 'statement' && (
          <View className="px-4 mt-4">
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E6ECE8', overflow: 'hidden', minWidth: 580 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', backgroundColor: '#E3F4EA', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#E6ECE8' }}>
                  <Text style={{ width: 90, fontSize: 12, fontWeight: '700', color: '#0F4D3A' }}>DATE</Text>
                  <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#0F4D3A' }}>TRANSACTION</Text>
                  <Text style={{ width: 100, fontSize: 12, fontWeight: '700', color: '#0F4D3A', textAlign: 'right' }}>AMOUNT</Text>
                  <Text style={{ width: 100, fontSize: 12, fontWeight: '700', color: '#0F4D3A', textAlign: 'right' }}>BALANCE</Text>
                </View>
                {/* Rows */}
                {stmtRows.length === 0 && (
                  <View className="p-10 items-center"><Text className="text-[13px] text-[#9CA3AF]">No transactions</Text></View>
                )}
                {stmtRows.map((t, i) => {
                  const isIn = t.direction === 'IN';
                  return (
                    <View key={t.id || i} style={{ flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F6F4', backgroundColor: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                      <Text style={{ width: 90, fontSize: 12, color: '#4A5F56' }}>{t.date}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#13261E' }}>{transactionLabel(t.rawType, t.description)}</Text>
                        {t.handlerName && <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{t.handlerName}</Text>}
                      </View>
                      <Text style={{ width: 100, fontSize: 13, fontWeight: '700', textAlign: 'right', color: isIn ? '#17693E' : '#13261E' }}>
                        {isIn ? '+' : '−'} {fmt(t.amount)}
                      </Text>
                      <Text style={{ width: 100, fontSize: 13, fontWeight: '600', textAlign: 'right', color: '#13261E' }}>
                        {fmt(t.balanceAfter)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <Text className="text-[11px] text-[#9CA3AF] mt-2 px-1">Scroll sideways to see all columns. Balance is calculated from the current balance backwards.</Text>
          </View>
        )}

        {/* Transactions & Fees: grouped list */}
        {activeTab !== 'statement' && (
          <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
            {grouped.length === 0 && (
              <View className="bg-white p-12 rounded-[20px] items-center justify-center border border-[#E6ECE8] mt-4">
                <View className="w-16 h-16 bg-[#F3F6F4] rounded-full items-center justify-center mb-4"><Text className="text-2xl">📭</Text></View>
                <Text className="text-[14px] font-bold text-[#13261E] mb-1">No transactions</Text>
                <Text className="text-[12px] text-[#4A5F56] text-center">Nothing matches this filter.</Text>
              </View>
            )}
            {grouped.map(([dateLabel, rows]) => (
              <View key={dateLabel} className="mt-4">
                <Text className="text-[13px] font-bold text-[#4A5F56] mb-2 px-1">{dateLabel}</Text>
                <View className="bg-white rounded-[20px] border border-[#E6ECE8] overflow-hidden">
                  {rows.map((t: any, idx: number) => {
                    const dir = transactionDirection(t.rawType);
                    const isIn = dir === 'IN';
                    const iconBg = isIn ? '#E3F4EA' : '#FBF0DC';
                    const iconColor = isIn ? '#1B7F4B' : '#8A5A00';
                    const method = String(t.source?.key || '').toUpperCase() === 'TELLER' || String(t.source?.key || '').toUpperCase() === 'AGENT'
                      ? 'Teller' : String(t.source?.key || '').toUpperCase() === 'MOBILE_MONEY' ? 'Mobile Money' : 'Self';
                    return (
                      <TouchableOpacity
                        key={t.id || idx}
                        activeOpacity={0.7}
                        onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: t.id, type: isIn ? 'deposit' : 'withdrawal' } } as any)}
                        className="flex-row items-center px-4 py-3"
                        style={{ borderBottomWidth: idx === rows.length - 1 ? 0 : 1, borderBottomColor: '#F3F6F4' }}
                      >
                        <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: iconBg }}>
                          <IconSymbol name={isIn ? 'arrow.down' : 'arrow.up'} size={18} color={iconColor} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[14px] font-bold text-[#13261E]">{transactionLabel(t.rawType, t.description)}</Text>
                          <Text className="text-[12px] text-[#4A5F56] mt-0.5">{method}{t.handlerName ? ` · ${t.handlerName}` : ''}</Text>
                        </View>
                        <View className="items-end">
                          <Text className="text-[14px] font-bold" style={{ color: isIn ? '#17693E' : '#13261E' }}>
                            {isIn ? '+' : '−'} {fmt(t.amount)}
                          </Text>
                          <Text className="text-[12px] text-[#4A5F56] mt-0.5">{t.date}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Export button - pinned at bottom of statement tab */}
        {activeTab === 'statement' && (
          <View className="px-4 mt-6">
            <TouchableOpacity
              onPress={handleExportPdf}
              disabled={exporting}
              activeOpacity={0.8}
              className="h-[52px] rounded-[16px] flex-row items-center justify-center"
              style={{ backgroundColor: exporting ? '#9CA3AF' : '#0F4D3A' }}
            >
              <IconSymbol name="doc.text" size={18} color="#FFFFFF" />
              <Text className="text-white text-[15px] font-bold ml-2">{exporting ? 'Preparing PDF…' : 'Export PDF Statement'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
