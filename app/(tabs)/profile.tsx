import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { invalidateWallet, useProfile } from '@/services/queries';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', {
    style: 'decimal',
    minimumFractionDigits: 0,
  }).format(n || 0);

const appVersion = Constants.expoConfig?.version ?? '1.0.0';

const asString = (v: any, fallback = ''): string => {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return (
      v.name ||
      [v.firstName, v.lastName].filter(Boolean).join(' ') ||
      fallback
    );
  }
  return String(v);
};

const SUPPORT_URL =
  'https://www.bukonzounitedteacherscooperativesociety.com/support';
const PRIVACY_URL =
  'https://www.bukonzounitedteacherscooperativesociety.com/privacy';

const formatDate = (iso?: string | null) => {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Not set';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function ProfileScreen() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { setMode, isDark } = useTheme();

  const { data: profileData, isLoading: loading, isRefetching: refreshing } = useProfile();
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  // Focus revalidation lives in useQueryFocusSync and respects the profile
  // query's 5-minute freshness window, so re-entering this tab within that
  // window paints from cache instead of issuing a 4-request round-trip.
  const onRefresh = useCallback(async () => {
    await invalidateWallet();
  }, []);

  useEffect(() => {
    const checkBiometric = async () => {
      try {
        const LocalAuthentication = await import(
          'expo-local-authentication'
        );
        const SecureStore = await import('expo-secure-store');
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setBiometricAvailable(compatible && enrolled);

        const enabled = await SecureStore.getItemAsync('biometric-enabled');
        setBiometricEnabled(enabled === 'true');
      } catch (e) {
        console.warn('Biometric availability check failed', e);
      }
    };

    checkBiometric();
  }, []);

  const getMembershipDuration = () => {
    if (!profileData?.joinedDate) return 'N/A';
    const joined = new Date(profileData.joinedDate);
    const now = new Date();
    const diffMs = now.getTime() - joined.getTime();
    const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365.25);

    if (diffYears < 1) {
      const diffMonths = Math.floor(diffYears * 12);
      return `${diffMonths} mo${diffMonths !== 1 ? 's' : ''}`;
    }

    const years = Math.floor(diffYears);
    return `${years} yr${years !== 1 ? 's' : ''}`;
  };

  const handleBiometricToggle = async (value: boolean) => {
    if (value && !biometricAvailable) {
      Toast.show({
        type: 'error',
        text1: 'Not Available',
        text2: 'Biometric setup required on device',
      });
      return;
    }

    try {
      const SecureStore = await import('expo-secure-store');
      if (!value) {
        await SecureStore.deleteItemAsync('biometric-credentials');
        await SecureStore.deleteItemAsync('biometric-enabled');
        setBiometricEnabled(false);
      } else {
        await SecureStore.setItemAsync('biometric-enabled', 'true');
        setBiometricEnabled(true);
        Toast.show({
          type: 'success',
          text1: 'Enabled',
          text2: 'Sign in again to save credentials.',
        });
      }
    } catch (e) {
      console.warn('Biometric toggle failed', e);
      Toast.show({
        type: 'error',
        text1: 'Failed',
        text2: 'Could not update biometric setting',
      });
    }
  };

  const handleLogout = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const InfoRow = ({
    icon,
    label,
    value,
    tag,
    isMono,
    isVerified,
    last,
  }: any) => (
    <View
      className={`flex-row items-center py-4 px-5 border-b border-gray-50 bg-white ${
        last ? 'border-b-0' : ''
      }`}
    >
      <View className="w-9 h-9 bg-gray-50 rounded-xl items-center justify-center mr-4">
        <Text className="text-base">{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-textLight text-[10px] font-medium uppercase tracking-wider mb-0.5">
          {label}
        </Text>
        <Text
          className={`text-textDark font-bold text-sm ${
            isMono ? 'tracking-wider' : ''
          }`}
          numberOfLines={1}
        >
          {asString(value) || 'Not provided'}
        </Text>
      </View>
      {tag ? (
        <View
          className={`px-2 py-0.5 rounded-full ${
            isVerified ? 'bg-green-50' : 'bg-gold-soft'
          }`}
        >
          <Text
            className={`text-[9px] font-black uppercase ${
              isVerified ? 'text-leaf' : 'text-gold'
            }`}
          >
            {tag}
          </Text>
        </View>
      ) : (
        <IconSymbol name="chevron.right" size={12} color="#D1D5DB" />
      )}
    </View>
  );

  const SectionCard = ({ title, children }: any) => (
    <View className="mt-5 mx-5 bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
      <View className="flex-row justify-between items-center px-5 py-4 border-b border-gray-50">
        <Text className="text-textMid text-xs font-black uppercase tracking-widest">
          {title}
        </Text>
      </View>
      <View>{children}</View>
    </View>
  );

  if (loading && !profileData) {
    return (
      <SafeAreaView className="flex-1 bg-warmWhite items-center justify-center">
        <ActivityIndicator size="large" color="#1A6B47" />
      </SafeAreaView>
    );
  }

  const u = profileData;

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />

      <View className="bg-forest pt-12 pb-8 overflow-hidden">
        <View className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-mint/10 rounded-full" />
        <View className="absolute bottom-[-30px] left-[-30px] w-32 h-32 bg-gold/5 rounded-full" />

        <View className="flex-row justify-between items-center px-6 mb-6">
          <Text className="text-white/90 text-sm font-bold tracking-tight">
            My Profile
          </Text>
          <View className="bg-white/10 border border-white/20 rounded-full px-4 py-1.5 flex-row items-center space-x-2 opacity-70">
            <IconSymbol name="lock.fill" size={12} color="white" />
            <Text className="text-white text-xs font-bold">SACCO Managed</Text>
          </View>
        </View>

        <View className="items-center px-6">
          <View className="relative mb-4">
            <View className="w-24 h-24 rounded-full bg-gradient-to-br from-mint to-gold p-1 shadow-2xl">
              <View className="w-full h-full rounded-full bg-leaf border-4 border-forest items-center justify-center overflow-hidden">
                {u?.image ? (
                  <Image source={{ uri: u.image }} className="w-full h-full" cachePolicy="memory-disk" transition={200} />
                ) : (
                  <Text className="text-mint text-3xl font-black">
                    {asString(u?.name).substring(0, 2).toUpperCase() || 'SN'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <Text className="text-white text-2xl font-black tracking-tight mb-1">
            {asString(u?.name, 'Sacco Member')}
          </Text>
          <Text className="text-white/50 text-[10px] font-bold tracking-[2px] mb-4 uppercase">
            MEMBER NO. ·{' '}
            {u?.memberNumber ||
              (u?.memberId ? asString(u.memberId).substring(0, 8).toUpperCase() : '') ||
              '—'}
          </Text>

          <View className="flex-row space-x-2">
            {(() => {
              const status = asString(u?.membershipStatus, '').toUpperCase();
              const isActive = status === 'ACTIVE';
              if (!status) return null;
              return (
                <View
                  className={`${
                    isActive
                      ? 'bg-mint/20 border-mint/30'
                      : 'bg-gold/15 border-gold/30'
                  } border px-3 py-1 rounded-full flex-row items-center space-x-1.5`}
                >
                  <View
                    className={`w-1.5 h-1.5 ${
                      isActive ? 'bg-mint' : 'bg-gold'
                    } rounded-full`}
                  />
                  <Text
                    className={`${
                      isActive ? 'text-mint' : 'text-gold'
                    } text-[10px] font-black uppercase tracking-wider`}
                  >
                    {isActive ? 'Active' : status}
                  </Text>
                </View>
              );
            })()}
          </View>
        </View>
      </View>

      <View className="flex-row bg-white border-b border-gray-100 shadow-sm">
        <View className="flex-1 items-center py-5 border-r border-gray-50">
          <Text className="text-textDark font-black text-lg">
            {getMembershipDuration()}
          </Text>
          <Text className="text-textLight text-[9px] font-bold uppercase tracking-widest mt-0.5">
            Membership
          </Text>
        </View>
        <View className="flex-1 items-center py-5 border-r border-gray-50">
          <Text className="text-textDark font-black text-lg" numberOfLines={1}>
            {asString(u?.branchName, '—')}
          </Text>
          <Text className="text-textLight text-[9px] font-bold uppercase tracking-widest mt-0.5">
            Branch
          </Text>
        </View>
        <View className="flex-1 items-center py-5">
          <Text className="text-textDark font-black text-lg">
            {u?.loanStats?.repaidCount || 0}
          </Text>
          <Text className="text-textLight text-[9px] font-bold uppercase tracking-widest mt-0.5">
            Loans Repaid
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1A6B47"
          />
        }
      >
        <SectionCard title="Personal Information">
          <InfoRow icon="👤" label="Full Name" value={u?.name} />
          <InfoRow
            icon="📱"
            label="Phone Number"
            value={u?.phone || 'Not set'}
            isMono
            tag={u?.phone ? 'On file' : undefined}
            isVerified
          />
          <InfoRow
            icon="✉️"
            label="Email Address"
            value={u?.email || 'Not set'}
            tag={u?.email ? 'On file' : undefined}
            isVerified
          />
          <InfoRow icon="🎂" label="Date of Birth" value={formatDate(u?.dateOfBirth)} />
          <InfoRow
            icon="📍"
            label="Residential Address"
            value={u?.address || 'Not set'}
            last
          />
        </SectionCard>

        <SectionCard title="Account & KYC">
          <InfoRow
            icon="🪪"
            label="National ID"
            value={u?.nin || 'Not set'}
            isMono
            tag={u?.nin ? 'On file' : undefined}
            isVerified
          />
          <InfoRow icon="🏢" label="Branch" value={u?.branchName || 'Not set'} last />
        </SectionCard>

        <SectionCard title="Preferences">
          <View className="flex-row items-center py-4 px-5">
            <View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">🌙</Text>
            </View>
            <View className="flex-1">
              <Text className="text-textDark font-bold text-sm">Dark Appearance</Text>
              <Text className="text-textLight text-[10px] mt-0.5">
                Switch to dark theme
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(v) => setMode(v ? 'dark' : 'light')}
              trackColor={{ true: '#1A6B47' }}
            />
          </View>
        </SectionCard>

        <SectionCard title="Security">
          <TouchableOpacity
            onPress={() => router.push('/forgot-password')}
            className="flex-row items-center py-4 px-5 border-b border-gray-50"
          >
            <View className="w-9 h-9 bg-green-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">🔒</Text>
            </View>
            <View className="flex-1">
              <Text className="text-textDark font-bold text-sm">Reset Password</Text>
              <Text className="text-textLight text-[10px] mt-0.5">
                Get an OTP to set a new password
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={12} color="#D1D5DB" />
          </TouchableOpacity>
          <View className="flex-row items-center py-4 px-5">
            <View className="w-9 h-9 bg-blue-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">🫶</Text>
            </View>
            <View className="flex-1">
              <Text className="text-textDark font-bold text-sm">Biometric Login</Text>
              <Text className="text-textLight text-[10px] mt-0.5">
                Fingerprint & Face ID
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              disabled={!biometricAvailable}
              trackColor={{ true: '#1A6B47' }}
            />
          </View>
        </SectionCard>

        <SectionCard title="Support & Legal">
          <TouchableOpacity
            onPress={() => Linking.openURL(SUPPORT_URL)}
            className="flex-row items-center py-4 px-5 border-b border-gray-50"
          >
            <View className="w-9 h-9 bg-green-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">💬</Text>
            </View>
            <Text className="flex-1 text-textDark font-bold text-sm">
              Help &amp; Support
            </Text>
            <IconSymbol name="chevron.right" size={12} color="#D1D5DB" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Linking.openURL(PRIVACY_URL)}
            className="flex-row items-center py-4 px-5 border-b border-gray-50"
          >
            <View className="w-9 h-9 bg-gray-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">🔐</Text>
            </View>
            <Text className="flex-1 text-textDark font-bold text-sm">
              Privacy Policy
            </Text>
            <IconSymbol name="chevron.right" size={12} color="#D1D5DB" />
          </TouchableOpacity>
          <View className="flex-row items-center py-4 px-5">
            <View className="w-9 h-9 bg-gray-50 rounded-xl items-center justify-center mr-4">
              <Text className="text-base">ℹ️</Text>
            </View>
            <View className="flex-1">
              <Text className="text-textDark font-bold text-sm">App Version</Text>
              <Text className="text-textLight text-[10px] mt-0.5">v{appVersion}</Text>
            </View>
          </View>
        </SectionCard>

        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.7}
          className="mt-8 mx-5 bg-white border border-red-50 py-4 rounded-[20px] flex-row items-center justify-center shadow-sm"
        >
          <Text className="text-2xl mr-3">🚪</Text>
          <Text className="text-red-500 font-extrabold text-base tracking-tight">
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<void>;
}) {
  return (
    <View className="flex-1 bg-warmWhite items-center justify-center px-10">
      <View className="w-24 h-24 bg-forest/10 rounded-full items-center justify-center mb-6">
        <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#1A6B47" />
      </View>
      <Text className="text-textDark font-black text-xl text-center mb-2">
        Profile screen hit a snag
      </Text>
      <Text className="text-textLight text-xs text-center leading-5 mb-8">
        Tap below to try this screen again. If it keeps happening, the app can
        still keep running while we investigate the profile tab.
      </Text>
      <Text
        className="text-textLight text-[10px] font-mono text-center mb-8"
        numberOfLines={8}
      >
        {error.message}
      </Text>
      <TouchableOpacity
        onPress={() => void retry()}
        className="bg-forest py-4 rounded-2xl items-center w-full"
      >
        <Text className="text-white font-black text-xs uppercase tracking-widest">
          Reload Screen
        </Text>
      </TouchableOpacity>
    </View>
  );
}
