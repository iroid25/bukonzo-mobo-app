import { Sparkline } from '@/components/agent/Sparkline';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { AGENT, RADIUS, cardShadow } from '@/constants/agentTheme';
import { useAuth } from '@/context/AuthContext';
import { DataService, isAgentProcessedTxn, transactionDirection, transactionLabel } from '@/services/api';
import { Image } from 'expo-image';
import { getLocalAlerts, LocalAlert } from '@/services/localAlerts';
import { invalidateWallet, useTransactions } from '@/services/queries';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width: SCREEN_W } = Dimensions.get('window');
const H_PADDING = 20;
const CONTENT_W = SCREEN_W - H_PADDING * 2;

const ACTIONS: { key: string; label: string; icon: IconSymbolName; mode?: 'deposit' | 'withdraw' }[] = [
    { key: 'search', label: 'Member\nSearch', icon: 'search' },
    { key: 'deposit', label: 'Deposit', icon: 'wallet', mode: 'deposit' },
    { key: 'withdraw', label: 'Withdraw', icon: 'cash', mode: 'withdraw' },
    { key: 'float', label: 'Buy\nFloat', icon: 'document-text' },
];

const fmt = (n: number) => Math.round(n).toLocaleString();

const isWithdrawal = (type?: string) =>
  type === 'WITHDRAWAL' || type === 'WITHDRAW' || type === 'AGENT_WITHDRAWAL';

/** Best-guess display name for the member on the other end of a ledger row. */
const clientName = (t: any) =>
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

const isWithdrawTxn = (t: any) => isWithdrawal(t?.type);

export default function AgentDashboard() {
  const { user, floatBalance, refreshFloat, agentFees, refreshAgentFees, refreshFeeSettings } = useAuth();
  const router = useRouter();

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'activity' | 'commissions'>('activity');
  const [floatAlerts, setFloatAlerts] = useState<LocalAlert[]>([]);

  // TanStack Query: cached transaction feed for the agent ledger. We filter to
  // this agent's own processed rows below (isAgentProcessedTxn). The cache
  // makes switching to this tab instantaneous after the first load.
  const {
    data: txnData,
    refetch: refetchTx,
  } = useTransactions();

  const applyAgentFilter = useCallback(() => {
    if (user && txnData) {
      const rows = (
        txnData?.data?.data ||
        txnData?.data?.transactions ||
        (Array.isArray(txnData?.data) ? txnData.data : [])
      ).filter((t: any) => isAgentProcessedTxn(t, user));
      setHistory(rows);
    }
  }, [user, txnData]);

  useEffect(() => {
    applyAgentFilter();
  }, [applyAgentFilter]);

  const calculateCommission = (amt: number, type: string) => {
    if (!amt) return 0;
    const key = type === 'DEPOSIT' ? 'depositFees' : 'withdrawalFees';
    const tiers = agentFees?.[key] || [];

    if (Array.isArray(tiers) && tiers.length > 0) {
      const tier = tiers.find(
        (t: any) => amt >= Number(t.min || 0) && amt <= Number(t.max || 999999999)
      );
      if (tier) return Number(tier.agentShare || 0);
    }

    // Fallback to 0.5%
    return Math.round(amt * 0.005);
  };

  const totalComm = history.reduce(
    (acc: number, curr: any) => acc + calculateCommission(Number(curr.amount || 0), curr.type),
    0
  );

  const txnDate = (t: any) => new Date(t.createdAt || t.date || Date.now());

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  const todayCount = history.filter((t) => isToday(txnDate(t))).length;

  /** Commission earned per day over the last 7 days, oldest first. */
  const commissionTrend = (() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    return days.map((day) => {
      const next = new Date(day);
      next.setDate(next.getDate() + 1);
      return history
        .filter((t) => {
          const d = txnDate(t);
          return d >= day && d < next;
        })
        .reduce((acc, t) => acc + calculateCommission(Number(t.amount || 0), t.type), 0);
    });
  })();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Float and agent fee config are independent small reads; run them
      // concurrently instead of awaiting one after the other, which serialised
      // four round-trips into one.
      //
      // The local alert journal is a SecureStore read, not network.
      await Promise.allSettled([
        refreshFloat(),
        refreshAgentFees(),
        refreshFeeSettings(),
        getLocalAlerts().then((alerts) =>
          setFloatAlerts(alerts.filter((a) => a.origin === 'float' && !a.isRead)),
        ),
      ]);
    } finally {
      setLoading(false);
    }
  }, [refreshFloat, refreshAgentFees, refreshFeeSettings]);

  // The transaction history is the useTransactions() query above; focus
  // revalidation for it is handled centrally by useQueryFocusSync, which only
  // refetches once the 60s window lapses. The two effects that used to live
  // here (a mount effect plus a useFocusEffect with an empty dep array) both
  // fired on first render, so every tab entry paid for this twice.

  // Pull-to-refresh is an explicit request for fresh data, so it forces a hard
  // refresh of both the local reads and the cached queries, ignoring staleTime.
  const onPullToRefresh = useCallback(async () => {
    await Promise.all([fetchData(), refetchTx(), invalidateWallet()]);
  }, [fetchData, refetchTx]);

  const isLowFloat = floatBalance < 100000;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const firstName = (user?.name || 'Agent').split(' ')[0];
  const initials = (user?.name || 'AG').substring(0, 2).toUpperCase();

  return (
    <View className="flex-1" style={{ backgroundColor: AGENT.canvas }}>
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: H_PADDING, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={onPullToRefresh} tintColor={AGENT.forest} />
          }
        >
          {/* ── Greeting ────────────────────────────────────────────── */}
          <View className="flex-row items-center justify-between pt-4 pb-5">
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push('/(agent-tabs)/profile')}
              className="flex-row items-center flex-1"
            >
              {user?.image ? (
                <Image
                  source={{ uri: user.image }}
                  style={{ width: 46, height: 46, borderRadius: 23 }}
                  cachePolicy="memory-disk"
                  transition={200}
                />
              ) : (
                <View
                  style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: AGENT.lime }}
                  className="items-center justify-center"
                >
                  <Text style={{ color: AGENT.forest }} className="text-sm font-black">
                    {initials}
                  </Text>
                </View>
              )}

              <View className="ml-3 flex-1">
                <Text style={{ color: AGENT.faint }} className="text-[11px] font-semibold">
                  {user?.name || 'Field Agent'}
                </Text>
                <Text style={{ color: AGENT.ink }} className="text-[17px] font-black tracking-tight">
                  {greeting}, {firstName} 👋
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
              className="w-11 h-11 rounded-full items-center justify-center border"
            >
              <IconSymbol name="bell.fill" size={18} color={AGENT.forest} />
              <View
                style={{ backgroundColor: AGENT.danger, borderColor: AGENT.card }}
                className="absolute top-2.5 right-3 w-2 h-2 rounded-full border"
              />
            </TouchableOpacity>
          </View>

          {/* ── Field status strip ──────────────────────────────────── */}
          <View
            style={{
              backgroundColor: AGENT.card,
              borderColor: AGENT.line,
              borderRadius: RADIUS.card,
              ...cardShadow,
            }}
            className="flex-row border px-4 py-3.5 mb-4"
          >
            <StatCell
              label="Field Status"
              value={isLowFloat ? 'Low Float' : 'Active'}
              dot={isLowFloat ? AGENT.warning : AGENT.positive}
            />
            <Divider />
            <StatCell label="Txns Today" value={String(todayCount)} />
            <Divider />
            <StatCell label="Field Cash" value={`Ugx ${fmt(floatBalance)}`} />
          </View>

          {/* ── Float-drop in-app alert banner ─────────────────────── */}
          {floatAlerts.length > 0 && (
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={{
                backgroundColor: '#FFF6E5',
                borderColor: 'rgba(245,165,36,0.35)',
                borderRadius: RADIUS.card,
                ...cardShadow,
              }}
              className="border px-4 py-4 mb-4 flex-row items-center"
            >
              <View
                style={{ backgroundColor: 'rgba(245,165,36,0.15)' }}
                className="w-11 h-11 rounded-full items-center justify-center mr-4"
              >
                <IconSymbol name="exclamationmark.triangle.fill" size={20} color={AGENT.warning} />
              </View>
              <View className="flex-1">
                <Text style={{ color: AGENT.ink }} className="text-[13px] font-black tracking-tight">
                  Float reduced
                </Text>
                <Text
                  style={{ color: AGENT.muted }}
                  className="text-[10px] font-semibold mt-0.5"
                  numberOfLines={1}
                >
                  {floatAlerts[0]?.message || 'Tap to review your in-app alerts.'}
                </Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={AGENT.warning} />
            </TouchableOpacity>
          )}

          {/* ── Earned commissions ──────────────────────────────────── */}
          <View
            style={{
              backgroundColor: AGENT.card,
              borderColor: AGENT.line,
              borderRadius: RADIUS.card,
              ...cardShadow,
            }}
            className="border p-5 mb-6"
          >
            <View className="flex-row items-center justify-between">
              <Text style={{ color: AGENT.ink }} className="text-[15px] font-black tracking-tight">
                Earned Commissions
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/(agent-tabs)/commissions')}
                className="flex-row items-center"
              >
                <Text style={{ color: AGENT.muted }} className="text-[11px] font-bold">
                  Trend
                </Text>
                <IconSymbol name="chevron.right" size={12} color={AGENT.muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: AGENT.faint }} className="text-[11px] font-semibold mt-3">
              Current Commissions:
            </Text>
            <Text style={{ color: AGENT.ink }} className="text-[30px] font-black tracking-tighter">
              Ugx {fmt(totalComm)}
            </Text>

            <View className="mt-3 mb-4">
              <Sparkline values={commissionTrend} width={CONTENT_W - 40} height={58} />
            </View>

            <View style={{ backgroundColor: AGENT.line }} className="h-px mb-3.5" />

            <View className="flex-row justify-between">
              <View>
                <Text
                  style={{ color: AGENT.faint }}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  This Week
                </Text>
                <Text style={{ color: AGENT.ink }} className="text-[12px] font-bold mt-0.5">
                  Ugx {fmt(commissionTrend.reduce((a, b) => a + b, 0))}
                </Text>
              </View>
              <View className="items-end">
                <Text
                  style={{ color: AGENT.faint }}
                  className="text-[10px] font-bold uppercase tracking-wider"
                >
                  Rate Card
                </Text>
                <Text style={{ color: AGENT.ink }} className="text-[12px] font-bold mt-0.5">
                  {agentFees ? 'Tiered rates' : '0.5% default'}
                </Text>
              </View>
            </View>
          </View>

          {/* ── Quick actions ───────────────────────────────────────── */}
          <View className="flex-row justify-between mb-7">
            {ACTIONS.map((action) => (
                <TouchableOpacity
                  key={action.key}
                  activeOpacity={0.85}
                  onPress={() =>
                    action.mode
                      ? router.push({
                          pathname: '/(agent-tabs)/member-search',
                          params: { mode: action.mode },
                        } as never)
                      : action.key === 'search'
                        ? router.push('/(agent-tabs)/member-search' as never)
                        : router.push('/(agent-tabs)/float' as never)
                }
                className="items-center"
                style={{ width: CONTENT_W / 4 }}
              >
                <View
                  style={{ backgroundColor: AGENT.lime, ...cardShadow }}
                  className="w-[58px] h-[58px] rounded-full items-center justify-center"
                >
                  <IconSymbol name={action.icon} size={23} color={AGENT.forest} />
                </View>
                <Text
                  style={{ color: AGENT.muted }}
                  className="text-[9px] font-black uppercase tracking-wider text-center mt-2 leading-3"
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Activity / commissions toggle ───────────────────────── */}
          <View className="flex-row mb-4">
            <SegTab
              label="Recent Activity"
              active={tab === 'activity'}
              onPress={() => setTab('activity')}
            />
            <SegTab
              label="Transactions & Commissions"
              active={tab === 'commissions'}
              onPress={() => setTab('commissions')}
            />
          </View>

          {history.length === 0 ? (
            <View
              style={{ borderColor: AGENT.line, borderRadius: RADIUS.card }}
              className="border border-dashed items-center py-10"
            >
              <IconSymbol name="tray" size={22} color={AGENT.faint} />
              <Text
                style={{ color: AGENT.faint }}
                className="text-[10px] font-black uppercase tracking-widest mt-2.5"
              >
                No activity yet
              </Text>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              {history.slice(0, 6).map((txn: any, i: number) => {
                const out = txn.rawType ? transactionDirection(txn.rawType) === 'OUT' : isWithdrawTxn(txn);
                const amount = Number(txn.amount || 0);
                const comm = calculateCommission(amount, txn.type);
                const name = clientName(txn) || (out ? 'Field Withdrawal' : 'Member Deposit');
                const image = txn?.ownerImage || txn?.memberImage || null;
                const memberNo = txn?.memberNumber || txn?.member?.memberNumber || null;

                return (
                  <View
                    key={txn.id ?? i}
                    style={{
                      backgroundColor: AGENT.card,
                      borderColor: AGENT.line,
                      borderRadius: RADIUS.tile,
                      ...cardShadow,
                    }}
                    className="flex-row items-center border px-4 py-3.5"
                  >
                    <View
                      style={{ backgroundColor: AGENT.limeSoft }}
                      className="w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden"
                    >
                      {image ? (
                        <Image source={{ uri: image }} style={{ width: 40, height: 40 }} cachePolicy="memory-disk" transition={200} />
                      ) : (
                        <Text style={{ color: AGENT.forest }} className="text-[12px] font-black">
                          {nameInitials(name)}
                        </Text>
                      )}
                      <View
                        style={{ backgroundColor: out ? AGENT.warning : AGENT.positive }}
                        className="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 items-center justify-center"
                      >
                        <IconSymbol
                          name={out ? 'arrow.up.right' : 'arrow.down.left'}
                          size={8}
                          color="#FFFFFF"
                        />
                      </View>
                    </View>

                    <View className="flex-1">
                      <Text
                        style={{ color: AGENT.ink }}
                        className="text-[13px] font-black tracking-tight"
                        numberOfLines={1}
                      >
                        {name}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <Text
                          style={{ color: AGENT.faint }}
                          className="text-[10px] font-semibold"
                        >
                          {memberNo || txnDate(txn).toLocaleDateString('en-UG', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </Text>
                        <Text
                          style={{ color: AGENT.faint }}
                          className="text-[10px] font-semibold ml-2"
                        >
                          {transactionLabel(txn.rawType, txn.description)}
                        </Text>
                      </View>
                    </View>

                    <View className="items-end ml-2">
                      <Text
                        style={{ color: AGENT.ink }}
                        className="text-[13px] font-black tracking-tight"
                      >
                        {out ? '-' : ''}Ugx {fmt(amount)}
                      </Text>
                      {tab === 'commissions' ? (
                        <Text
                          style={{ color: AGENT.limeDeep }}
                          className="text-[10px] font-black mt-0.5"
                        >
                          + Ugx {fmt(comm)} Comm.
                        </Text>
                      ) : (
                        <Text
                          style={{ color: AGENT.faint }}
                          className="text-[9px] font-bold uppercase tracking-wider mt-0.5"
                        >
                          {txn.status || 'Success'}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity
                onPress={() => router.push('/(agent-tabs)/transactions')}
                style={{ borderColor: AGENT.line, borderRadius: RADIUS.tile }}
                className="border border-dashed items-center py-3.5 mt-1"
              >
                <Text
                  style={{ color: AGENT.muted }}
                  className="text-[10px] font-black uppercase tracking-widest"
                >
                  View all history ({history.length})
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ── Small presentational pieces ───────────────────────────────────── */

function StatCell({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <View className="flex-1 px-1">
      <Text style={{ color: AGENT.faint }} className="text-[9px] font-bold uppercase tracking-wider">
        {label}
      </Text>
      <View className="flex-row items-center mt-1">
        <Text
          style={{ color: AGENT.ink }}
          className="text-[12px] font-black tracking-tight"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {dot && <View style={{ backgroundColor: dot }} className="w-1.5 h-1.5 rounded-full ml-1.5" />}
      </View>
    </View>
  );
}

function Divider() {
  return <View style={{ backgroundColor: AGENT.line }} className="w-px self-stretch" />;
}

function SegTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} className="flex-1 items-center pb-2">
      <Text
        style={{ color: active ? AGENT.ink : AGENT.faint }}
        className="text-[10px] font-black uppercase tracking-wider text-center"
      >
        {label}
      </Text>
      <View
        style={{ backgroundColor: active ? AGENT.lime : 'transparent' }}
        className="h-[3px] w-10 rounded-full mt-1.5"
      />
    </TouchableOpacity>
  );
}
