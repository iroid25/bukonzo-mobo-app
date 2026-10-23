import { IconSymbol } from '@/components/ui/icon-symbol';
import { transactionDirection, transactionLabel } from '@/services/api';
import { useProfile } from '@/services/queries';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import React, { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const methodLabel = (key?: string) => {
  const k = String(key || '').toUpperCase();
  if (k === 'TELLER' || k === 'AGENT') return 'Teller';
  if (k === 'MOBILE_MONEY') return 'Mobile Money';
  return 'Self';
};

const statusConfig = (status?: string) => {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED' || s === 'APPROVED')
    return { label: 'Successful', bg: '#E3F4EA', color: '#17693E', icon: 'checkmark' };
  if (s === 'PENDING')
    return { label: 'Pending', bg: '#FBF0DC', color: '#8A5A00', icon: 'clock' };
  return { label: 'Failed', bg: '#FDECEC', color: '#9B1C1C', icon: 'xmark' };
};

export default function TransactionDetailScreen() {
  const { id, type: paramType } = useLocalSearchParams<{ id?: string; type?: string }>();
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();

  const txn = useMemo(() => {
    const all = profile?.transactions ?? [];
    return all.find((t: any) => String(t.id) === String(id)) ?? null;
  }, [profile, id]);

  const isWithdrawal = useMemo(() => {
    if (txn) return String(txn.rawType || '').toUpperCase() === 'WITHDRAWAL';
    return paramType === 'withdrawal';
  }, [paramType, txn]);

  const typeLabel = useMemo(() => {
    if (txn) return transactionLabel(txn.rawType, txn.description);
    return isWithdrawal ? 'Withdrawal' : 'Deposit';
  }, [txn, isWithdrawal]);

  const dir = txn ? transactionDirection(txn.rawType) : 'NEUTRAL';
  const isIn = dir === 'IN';
  const m = methodLabel(txn?.source?.key);
  const status = statusConfig(txn?.status);
  const handler = txn?.handlerName || txn?.counterpartyName || null;

  const account = useMemo(() => {
    const accounts = profile?.accounts ?? [];
    return accounts.find((a: any) => String(a.id) === String(txn?.accountId)) ?? accounts[0] ?? null;
  }, [profile, txn]);

  const balanceAfter = useMemo(() => {
    if (!account) return null;
    if (txn?.balanceAfter != null) return txn.balanceAfter;
    const bal = Number(account.balance) || 0;
    return isIn ? bal : bal;
  }, [account, txn, isIn]);

  const buildReceiptHtml = () => {
    const title = `${typeLabel} Receipt`;
    const amountPrefix = isIn ? '+' : '−';
    const statusColor = status.color === '#17693E' ? '#17693E' : status.color === '#8A5A00' ? '#8A5A00' : '#9B1C1C';
    return `
      <html><head><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: -apple-system, sans-serif; color:#13261E; background:#F3F6F4; padding:32px; }
        .card { background:#fff; border-radius:16px; padding:32px; box-shadow:0 2px 12px rgba(0,0,0,0.06); }
        .header { background:#0F4D3A; color:#fff; text-align:center; padding:24px; border-radius:12px; margin-bottom:24px; }
        .header h1 { font-size:18px; font-weight:700; }
        .header p { font-size:12px; opacity:0.7; margin-top:4px; }
        .amount { text-align:center; margin:24px 0; }
        .amount .value { font-size:36px; font-weight:800; color:${isIn ? '#17693E' : '#13261E'}; }
        .amount .currency { font-size:16px; font-weight:700; color:#4A5F56; }
        .badge { display:inline-block; background:${status.bg}; color:${statusColor}; padding:6px 16px; border-radius:999px; font-size:12px; font-weight:700; }
        .badge-wrap { text-align:center; margin-bottom:8px; }
        .row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid #E6ECE8; }
        .row:last-child { border-bottom:none; }
        .label { font-size:13px; color:#4A5F56; }
        .val { font-size:14px; font-weight:700; }
        .footer { text-align:center; margin-top:32px; font-size:11px; color:#4A5F56; }
        .footer .logo { font-size:16px; font-weight:800; color:#0F4D3A; margin-bottom:4px; }
      </style></head><body>
        <div class="card">
          <div class="header">
            <h1>BUKONZO TEACHERS SACCO</h1>
            <p>${title} Receipt</p>
          </div>
          <div class="amount">
            <div class="value">${amountPrefix} UGX ${fmt(txn?.amount || 0)}</div>
          </div>
          <div class="badge-wrap"><span class="badge">${status.label}</span></div>
          <div style="margin-top:24px">
            <div class="row"><span class="label">Type</span><span class="val">${typeLabel}</span></div>
            <div class="row"><span class="label">Account</span><span class="val">${account?.title || 'Savings Account'}</span></div>
            <div class="row"><span class="label">Account no.</span><span class="val">${account?.accNo || '—'}</span></div>
            <div class="row"><span class="label">Method</span><span class="val">${m}</span></div>
            ${handler ? `<div class="row"><span class="label">Processed by</span><span class="val">${handler}</span></div>` : ''}
            ${txn?.reference ? `<div class="row"><span class="label">Reference</span><span class="val">${txn.reference}</span></div>` : ''}
            <div class="row"><span class="label">Date</span><span class="val">${txn?.date || '—'}</span></div>
            ${balanceAfter != null ? `<div class="row"><span class="label">Balance after</span><span class="val" style="color:#0F4D3A">UGX ${fmt(balanceAfter)}</span></div>` : ''}
          </div>
          <div class="footer">
            <div class="logo">BUKONZO TEACHERS SACCO</div>
            <p>This is a computer-generated receipt and does not require a signature.</p>
            <p>Generated ${new Date().toLocaleString()}</p>
          </div>
        </div>
      </body></html>`;
  };

  const handleDownloadReceipt = async () => {
    try {
      const html = buildReceiptHtml();
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Receipt' });
      } else {
        Alert.alert('Receipt saved', 'Receipt has been saved to your device.');
      }
    } catch (e: any) {
      Alert.alert('Error', 'Could not generate receipt. Please try again.');
    }
  };

  const handleShare = async () => {
    const text = `${typeLabel} of UGX ${fmt(txn?.amount || 0)} ${isIn ? 'to' : 'from'} BUKONZO SACCO\nDate: ${txn?.date || '—'}\nStatus: ${status.label}\nRef: ${txn?.reference || '—'}`;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync('', { dialogTitle: 'Share Transaction' });
      } else {
        Alert.alert('Share', text);
      }
    } catch {
      Alert.alert('Share', text);
    }
  };

  if (isLoading || !txn) {
    return (
      <View className="flex-1 bg-warmWhite items-center justify-center">
        <ActivityIndicator size="large" color="#1A6B47" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Green header — in-flow so it always renders; card below overlaps it */}
        <View className="bg-forest pt-12 pb-16 overflow-hidden">
          <View className="absolute top-[-40px] left-[-40px] w-64 h-64 bg-mint/5 rounded-full" />
          <View className="px-6 flex-row items-center justify-between">
            <TouchableOpacity onPress={() => router.back()} className="w-11 h-11 bg-white/15 rounded-[14px] items-center justify-center border border-white/20">
              <IconSymbol name="chevron.left" size={20} color="white" />
            </TouchableOpacity>
            <Text className="text-white text-[17px] font-bold">{typeLabel} Details</Text>
            <View className="w-11 h-11" />
          </View>
        </View>

        {/* Summary Card — floats over the green header */}
        <View style={{ marginTop: -56, marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 24, padding: 24, alignItems: 'center', elevation: 8, shadowColor: '#0F4D3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: status.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <IconSymbol name={isIn ? 'arrow.down' : 'arrow.up'} size={24} color={isIn ? '#1B7F4B' : '#8A5A00'} />
          </View>
          <Text style={{ fontSize: 13, color: '#4A5F56', marginBottom: 8 }}>
            {isIn ? 'Deposit received' : isWithdrawal ? 'Withdrawal sent' : dir === 'OUT' ? `${typeLabel} debited` : typeLabel}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#4A5F56', marginRight: 4 }}>{isIn ? '' : '−'}UGX</Text>
            <Text style={{ fontSize: 34, fontWeight: '800', color: isIn ? '#17693E' : '#13261E', letterSpacing: -0.5 }}>{fmt(txn.amount)}</Text>
          </View>
          <View style={{ backgroundColor: status.bg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
            <IconSymbol name={status.icon as any} size={12} color={status.color} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: status.color, marginLeft: 4 }}>{status.label}</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#4A5F56' }}>{txn.date}</Text>
        </View>

        {/* Details Card */}
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#13261E', marginBottom: 8 }}>Details</Text>
          <DetailRow label={isIn ? 'Deposited to' : isWithdrawal ? 'Withdrawn from' : 'Account'} value={account?.title || 'Savings Account'} />
          <DetailRow label="Account no." value={account?.accNo || '—'} />
          <DetailRow label="Payment method" value={m} />
          {handler && <DetailRow label="Processed by" value={handler} />}
          {txn.reference && <DetailRow label="Transaction ID" value={txn.reference} copyable />}
          <DetailRow label="Fee" value={`UGX ${fmt(txn.fee || 0)}`} />
          {balanceAfter != null && <DetailRow label="Balance after" value={`UGX ${fmt(balanceAfter)}`} emphasis />}
        </View>

        {/* Status Timeline */}
        <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#13261E', marginBottom: 14 }}>Status</Text>
          <TimelineStep label={isIn ? 'Deposit initiated' : 'Request approved'} time={txn.date} done />
          <TimelineStep label={isIn ? 'Credited to account' : isWithdrawal ? 'Funds disbursed' : 'Processed'} time={txn.date} done={status.label === 'Successful'} isLast />
        </View>

        {/* Action Bar */}
        <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginTop: 20, paddingBottom: 24 }}>
          <TouchableOpacity
            onPress={handleShare}
            activeOpacity={0.8}
            style={{ flex: 1, height: 52, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#0F4D3A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <IconSymbol name="square.and.arrow.up" size={16} color="#0F4D3A" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F4D3A', marginLeft: 8 }}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDownloadReceipt}
            activeOpacity={0.8}
            style={{ flex: 2, height: 52, borderRadius: 16, backgroundColor: '#0F4D3A', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
          >
            <IconSymbol name="arrow.down.circle.fill" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginLeft: 8 }}>Download Receipt</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, emphasis, copyable }: { label: string; value: string; emphasis?: boolean; copyable?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#E6ECE8' }}>
      <Text style={{ fontSize: 13, color: '#4A5F56', flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: emphasis ? '#0F4D3A' : '#13261E', textAlign: 'right' }} numberOfLines={1}>{value}</Text>
        {copyable && (
          <TouchableOpacity style={{ marginLeft: 8, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <IconSymbol name="doc.on.doc" size={14} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TimelineStep({ label, time, done, isLast }: { label: string; time?: string; done: boolean; isLast?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      <View style={{ alignItems: 'center', marginRight: 12 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: done ? '#1B7F4B' : '#E6ECE8' }} />
        {!isLast && <View style={{ width: 2, height: 24, backgroundColor: done ? '#1B7F4B' : '#E6ECE8', marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: done ? '#13261E' : '#9CA3AF' }}>{label}</Text>
        {time && <Text style={{ fontSize: 12, color: '#4A5F56', marginTop: 2 }}>{time}</Text>}
      </View>
    </View>
  );
}
