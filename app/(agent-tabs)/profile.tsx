import { IconSymbol } from '@/components/ui/icon-symbol';
import { AGENT, cardShadow } from '@/constants/agentTheme';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AgentProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const displayName = (() => {
    if (!user) return 'Agent';
    if (typeof user.name === 'string' && user.name.trim()) return user.name;
    if (typeof user.name === 'object' && user.name !== null) {
      const obj = user.name as any;
      return obj.name || [obj.firstName, obj.lastName].filter(Boolean).join(' ') || 'Agent';
    }
    return 'Agent';
  })();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of this agent session?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/login');
          },
        },
      ],
    );
  };

  const ProfileItem = ({
    icon,
    label,
    value,
    color = AGENT.forest,
    border = true,
  }: {
    icon: any;
    label: string;
    value: string;
    color?: string;
    border?: boolean;
  }) => (
    <TouchableOpacity
      style={{
        borderBottomWidth: border ? 1 : 0,
        borderBottomColor: AGENT.line,
      }}
      className="flex-row items-center justify-between py-5"
      activeOpacity={0.85}
    >
      <View className="flex-row items-center flex-1 mr-4">
        <View
          style={{ backgroundColor: AGENT.limeSoft }}
          className="w-10 h-10 rounded-xl items-center justify-center mr-4"
        >
          <IconSymbol name={icon} size={18} color={color} />
        </View>
        <Text style={{ color: AGENT.muted }} className="text-sm font-bold tracking-tight">
          {label}
        </Text>
      </View>
      <View className="flex-row items-center">
        <Text
          style={{ color: AGENT.ink }}
          className="text-sm font-black mr-2 tracking-tight"
          numberOfLines={1}
        >
          {value}
        </Text>
        <IconSymbol name="chevron.right" size={12} color={AGENT.faint} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: AGENT.canvas }}>
      <StatusBar style="dark" />

      <SafeAreaView className="flex-1" edges={['top']}>
        <View
          style={{
            backgroundColor: AGENT.forest,
            borderBottomColor: 'rgba(255,255,255,0.08)',
          }}
          className="pt-8 pb-10 overflow-hidden border-b"
        >
          <View className="absolute top-[-50px] right-[-40px] w-64 h-64 bg-white/5 rounded-full" />
          <View className="absolute bottom-[-60px] left-[-60px] w-56 h-56 bg-[#C6F24E]/10 rounded-full" />

          <View className="px-6 items-center">
            <View
              style={{
                backgroundColor: AGENT.card,
                borderColor: 'rgba(198,242,78,0.25)',
                ...cardShadow,
              }}
              className="w-32 h-32 rounded-[56px] border-4 p-1.5 mb-6 relative"
            >
              <View
                style={{ backgroundColor: AGENT.limeSoft }}
                className="w-full h-full rounded-[48px] items-center justify-center overflow-hidden"
              >
                <Text style={{ color: AGENT.forest }} className="text-5xl font-black">
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View
                style={{ backgroundColor: AGENT.lime, borderColor: AGENT.card }}
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full border-4 items-center justify-center"
              >
                <IconSymbol name="checkmark.shield.fill" size={14} color={AGENT.forest} />
              </View>
            </View>

            <Text style={{ color: '#FFFFFF' }} className="text-3xl font-black tracking-tight text-center">
              {displayName}
            </Text>

            <View className="flex-row items-center mt-3">
              <View className="px-4 py-1.5 rounded-full border mr-2" style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.10)' }}>
                <Text style={{ color: '#FFFFFF' }} className="text-[9px] font-black uppercase tracking-widest">
                  Agent Profile
                </Text>
              </View>
              <View className="px-4 py-1.5 rounded-full border" style={{ backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.10)' }}>
                <Text style={{ color: '#FFFFFF' }} className="text-[9px] font-black uppercase tracking-widest">
                  Field Access
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/complete-profile')}
              activeOpacity={0.9}
              style={{
                backgroundColor: AGENT.lime,
                borderColor: AGENT.card,
                ...cardShadow,
              }}
              className="mt-5 px-5 h-12 rounded-full border items-center justify-center flex-row"
            >
              <IconSymbol name="pencil" size={14} color={AGENT.forest} />
              <Text style={{ color: AGENT.forest }} className="text-[10px] font-black uppercase tracking-[3px] ml-2">
                Edit Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, paddingBottom: 110 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row gap-x-3 mb-10">
            <View
              style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
              className="flex-1 p-5 rounded-[32px] border items-center"
            >
              <Text style={{ color: AGENT.forest }} className="text-xl font-black">
                A+
              </Text>
              <Text style={{ color: AGENT.faint }} className="text-[8px] font-black uppercase tracking-widest mt-2">
                Trust Rank
              </Text>
            </View>
            <View
              style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
              className="flex-1 p-5 rounded-[32px] border items-center"
            >
              <Text style={{ color: AGENT.limeDeep }} className="text-xl font-black">
                98%
              </Text>
              <Text style={{ color: AGENT.faint }} className="text-[8px] font-black uppercase tracking-widest mt-2">
                Reliability
              </Text>
            </View>
            <View
              style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
              className="flex-1 p-5 rounded-[32px] border items-center"
            >
              <Text style={{ color: AGENT.positive }} className="text-xl font-black">
                LIVE
              </Text>
              <Text style={{ color: AGENT.faint }} className="text-[8px] font-black uppercase tracking-widest mt-2">
                Connectivity
              </Text>
            </View>
          </View>

          <Text style={{ color: AGENT.faint }} className="text-[10px] font-black uppercase tracking-[4px] mb-4 px-1">
            Registry Identity
          </Text>
          <View
            style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
            className="rounded-[36px] px-7 border mb-10"
          >
            <ProfileItem
              icon="person.fill"
              label="Terminal ID"
              value={user?.id?.slice(-8).toUpperCase() || 'AGT-0047-Z10'}
            />
            <ProfileItem
              icon="phone.fill"
              label="Secure Line"
              value={user?.email || 'Agent Line'}
            />
            <ProfileItem
              icon="calendar"
              label="Registry Date"
              value="Jan 12, 2024"
              border={false}
            />
          </View>

          <Text style={{ color: AGENT.faint }} className="text-[10px] font-black uppercase tracking-[4px] mb-4 px-1">
            Console Protocol
          </Text>
          <View
            style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
            className="rounded-[36px] px-7 border mb-10"
          >
            <ProfileItem icon="bell.fill" label="Notifications" value="Syncing" color={AGENT.limeDeep} />
            <ProfileItem icon="faceid" label="Biometric Node" value="Enabled" color={AGENT.limeDeep} />
            <ProfileItem icon="moon.fill" label="Interface Theme" value="AGENT LIME" color={AGENT.forest} border={false} />
          </View>

          <Text style={{ color: AGENT.faint }} className="text-[10px] font-black uppercase tracking-[4px] mb-4 px-1">
            Security Modules
          </Text>
          <View
            style={{ backgroundColor: AGENT.card, borderColor: AGENT.line, ...cardShadow }}
            className="rounded-[36px] px-7 border mb-10"
          >
            <ProfileItem icon="lock.fill" label="Access PIN" value="Update" color={AGENT.limeDeep} />
            <ProfileItem icon="shield.lefthalf.filled" label="System Logs" value="View" color={AGENT.positive} border={false} />
          </View>

<TouchableOpacity
          onPress={handleLogout}
          style={{
            backgroundColor: 'rgba(240,80,105,0.06)',
            borderColor: 'rgba(240,80,105,0.18)',
          }}
          className="h-16 rounded-[24px] border items-center justify-center mb-10"
        >
          <Text style={{ color: AGENT.danger }} className="text-xs font-black uppercase tracking-[3px]">
            Sign Out
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
