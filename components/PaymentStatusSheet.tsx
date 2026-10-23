import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import { ActivityIndicator, Modal, Text, TouchableOpacity, View } from 'react-native';
import type { PaymentPhase } from '@/hooks/usePaymentPolling';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

export type PaymentKind = 'deposit' | 'repayment' | 'withdrawal';

type Props = {
  phase: PaymentPhase;
  reason: string | null;
  amount: number;
  phoneNumber: string;
  kind: PaymentKind;
  // Optional: balance after the transaction posted, shown on the success screen
  // once the parent has re-fetched the profile.
  newBalance?: number | null;
  // Fired when the user dismisses the sheet after a terminal state.
  onClose: (outcome: PaymentPhase) => void;
};

const LABEL: Record<PaymentKind, string> = {
  deposit: 'Deposit',
  repayment: 'Loan Repayment',
  withdrawal: 'Withdrawal',
};

export function PaymentStatusSheet({ phase, reason, amount, phoneNumber, kind, newBalance, onClose }: Props) {
  const visible = phase !== 'idle';
  const isTerminal = phase === 'success' || phase === 'failed' || phase === 'timeout';
  // A withdrawal is a disbursement - money is pushed to the phone, there's no
  // PIN approval step, so the waiting copy is different.
  const isPush = kind === 'withdrawal';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => isTerminal && onClose(phase)}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-warmWhite rounded-t-[36px] px-6 pt-8 pb-10">
          <View className="items-center mb-6">
            <View className="w-12 h-1.5 bg-gray-200 rounded-full mb-6" />

            {phase === 'waiting' && (
              <>
                <View className="w-20 h-20 bg-mint/10 rounded-full items-center justify-center mb-5">
                  <ActivityIndicator size="large" color="#1A6B47" />
                </View>
                <Text className="text-textDark font-black text-xl mb-2">
                  {isPush ? 'Sending to your phone' : 'Approve on your phone'}
                </Text>
                <Text className="text-textMid text-sm text-center leading-5 max-w-[280px]">
                  {isPush ? (
                    <>
                      We&apos;re sending <Text className="font-bold">UGX {fmt(amount)}</Text> to{' '}
                      <Text className="font-bold">{phoneNumber}</Text>. This usually lands within a
                      minute — keep this screen open while we confirm.
                    </>
                  ) : (
                    <>
                      We sent a prompt to <Text className="font-bold">{phoneNumber}</Text>. Enter your
                      Mobile Money PIN to confirm the {LABEL[kind].toLowerCase()} of{' '}
                      <Text className="font-bold">UGX {fmt(amount)}</Text>.
                    </>
                  )}
                </Text>
              </>
            )}

            {phase === 'success' && (
              <>
                <View className="w-20 h-20 bg-leaf/10 rounded-full items-center justify-center mb-5">
                  <IconSymbol name="checkmark.circle.fill" size={48} color="#1A6B47" />
                </View>
                <Text className="text-textDark font-black text-xl mb-2">{LABEL[kind]} Successful 🎉</Text>
                <Text className="text-textMid text-sm text-center leading-5 max-w-[280px]">
                  {isPush
                    ? `UGX ${fmt(amount)} has been sent to ${phoneNumber} and debited from your savings.`
                    : `UGX ${fmt(amount)} has been confirmed and posted to your account.`}
                </Text>
                {typeof newBalance === 'number' && newBalance > 0 && (
                  <View className="mt-4 bg-leaf/10 px-4 py-2 rounded-2xl">
                    <Text className="text-leaf text-xs font-black uppercase tracking-widest text-center">
                      New Balance
                    </Text>
                    <Text className="text-forest font-black text-lg text-center">UGX {fmt(newBalance)}</Text>
                  </View>
                )}
              </>
            )}

            {phase === 'failed' && (
              <>
                <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-5">
                  <IconSymbol name="exclamationmark.triangle.fill" size={44} color="#EF4444" />
                </View>
                <Text className="text-textDark font-black text-xl mb-2">{LABEL[kind]} Failed</Text>
                <Text className="text-textMid text-sm text-center leading-5 max-w-[280px]">
                  {reason ||
                    (isPush
                      ? 'The payout could not be completed. No money has left your account.'
                      : 'The request was declined or timed out on your phone. No money was moved.')}
                </Text>
              </>
            )}

            {phase === 'timeout' && (
              <>
                <View className="w-20 h-20 bg-gold/10 rounded-full items-center justify-center mb-5">
                  <IconSymbol name="arrow.clockwise" size={40} color="#B7791F" />
                </View>
                <Text className="text-textDark font-black text-xl mb-2">Still Processing</Text>
                <Text className="text-textMid text-sm text-center leading-5 max-w-[280px]">
                  {reason ||
                    "We haven't had confirmation back yet. If it went through it will reflect shortly — check your transactions in a few minutes."}
                </Text>
              </>
            )}
          </View>

          {isTerminal ? (
            <TouchableOpacity
              onPress={() => onClose(phase)}
              activeOpacity={0.8}
              className={`p-5 rounded-[24px] items-center ${phase === 'success' ? 'bg-leaf' : 'bg-forest'}`}
            >
              <Text className="text-white font-black text-sm uppercase tracking-widest">Done</Text>
            </TouchableOpacity>
          ) : (
            <View className="flex-row items-center justify-center space-x-2 opacity-50">
              <IconSymbol name="lock.fill" size={12} color="#4B6558" />
              <Text className="text-textMid text-[10px] font-bold uppercase tracking-widest">
                Waiting for confirmation…
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
