import { IconSymbol } from '@/components/ui/icon-symbol';
import { transactionDirection, transactionLabel } from '@/services/api';
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const fmtDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
};

const prettyRole = (r?: string | null) =>
  r ? r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null;

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between items-start py-3 border-b border-gray-100">
      <Text className="text-textLight text-xs font-black uppercase tracking-widest mr-4 mt-0.5">{label}</Text>
      <Text className="text-textDark text-sm font-bold flex-1 text-right" selectable>{value}</Text>
    </View>
  );
}

export function TransactionDetailSheet({ txn, onClose }: { txn: any | null; onClose: () => void }) {
  const visible = !!txn;
  const dir = transactionDirection(txn?.rawType);
  const isIn = dir === 'IN';
  const isNeutral = dir === 'NEUTRAL';
  const typeLabel = transactionLabel(txn?.rawType, txn?.description);

  const hasBalances = typeof txn?.balanceBefore === 'number' && typeof txn?.balanceAfter === 'number';

  const acct = txn?.accountNumber
    ? `${txn?.accountName || 'Account'} ···· ${String(txn.accountNumber).slice(-4)}`
    : txn?.accountName || null;

  const method = txn?.source?.label
    ? `${txn.source.label}${txn.source.handledBy ? ` · ${txn.source.handledBy}` : ''}`
    : null;

  const handledBy = txn?.source?.key === 'MOBILE_MONEY'
    ? 'MTN Mobile Money'
    : txn?.counterpartyName
      ? `${txn.counterpartyName}${prettyRole(txn.counterpartyRole) ? ` (${prettyRole(txn.counterpartyRole)})` : ''}`
      : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="bg-warmWhite rounded-t-[32px] max-h-[86%]">
          {/* Grabber + close */}
          <View className="items-center pt-3 pb-1">
            <View className="w-12 h-1.5 bg-gray-200 rounded-full" />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
            {/* Amount hero */}
            <View className="items-center pt-4 pb-6">
              <View className={`w-14 h-14 rounded-full items-center justify-center mb-3 ${
                isNeutral ? 'bg-gray-100' : isIn ? 'bg-mint/10' : 'bg-gold/10'
              }`}>
                <IconSymbol
                  name={isNeutral ? 'arrow.right' : isIn ? 'arrow.down.left.circle.fill' : 'arrow.up.right.circle.fill'}
                  size={26}
                  color={isNeutral ? '#9CA3AF' : isIn ? '#2ECC8A' : '#F5C842'}
                />
              </View>
              <Text className={`font-black text-3xl tracking-tight ${isIn ? 'text-leaf' : 'text-textDark'}`}>
                {isNeutral ? '' : isIn ? '+' : '-'}UGX {fmt(txn?.amount || 0)}
              </Text>
              <Text className="text-textLight text-[11px] font-black uppercase tracking-widest mt-2">
                {typeLabel}
                {txn?.status && txn.status !== 'COMPLETED' ? ` · ${txn.status}` : ''}
              </Text>
            </View>

            {/* Balance before / after */}
            {hasBalances && (
              <View className="flex-row items-center bg-white rounded-3xl border border-gray-100 p-5 mb-5">
                <View className="flex-1 items-center">
                  <Text className="text-textLight text-[9px] font-black uppercase tracking-widest mb-1">Balance Before</Text>
                  <Text className="text-textMid font-black text-base">{fmt(txn.balanceBefore)}</Text>
                </View>
                <IconSymbol name="arrow.right" size={16} color="#9CA3AF" />
                <View className="flex-1 items-center">
                  <Text className="text-textLight text-[9px] font-black uppercase tracking-widest mb-1">Balance After</Text>
                  <Text className="text-forest font-black text-base">{fmt(txn.balanceAfter)}</Text>
                </View>
              </View>
            )}
            {!hasBalances && txn?.rawType === 'LOAN_REPAYMENT' && txn?.source?.key === 'MOBILE_MONEY' && (
              <View className="bg-mint/5 border border-mint/10 rounded-2xl p-4 mb-5">
                <Text className="text-textMid text-xs leading-5">
                  Paid directly from Mobile Money — your savings balance was not affected. The loan balance
                  was reduced by this amount.
                </Text>
              </View>
            )}

            {/* Details */}
            <View className="bg-white rounded-3xl border border-gray-100 px-5 py-1 mb-5">
              <Row label="Date & Time" value={fmtDateTime(txn?.dateISO)} />
              <Row label="Method" value={method} />
              <Row label="Account" value={acct} />
              <Row label="Branch" value={txn?.branchName} />
              <Row label="Account Holder" value={txn?.ownerName} />
              <Row label="Handled By" value={handledBy} />
              <Row label="Fee" value={txn?.fee > 0 ? `UGX ${fmt(txn.fee)}` : null} />
              <Row label="Reference" value={txn?.reference} />
              <Row label="Provider Ref" value={txn?.providerRef && txn.providerRef !== txn?.reference ? txn.providerRef : null} />
              <Row label="Note" value={txn?.note && txn.note !== txn?.description ? txn.note : null} />
            </View>

            <TouchableOpacity onPress={onClose} className="bg-forest p-5 rounded-3xl items-center">
              <Text className="text-white font-black text-sm uppercase tracking-widest">Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
