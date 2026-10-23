import { IconSymbol } from '@/components/ui/icon-symbol';
import { DataService } from '@/services/api';
import { useNotifications } from '@/services/queries';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  ActivityIndicator, 
  FlatList, 
  RefreshControl, 
  Text, 
  TouchableOpacity, 
  View 
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  getLocalAlerts,
  markLocalAlertRead,
  deleteLocalAlert,
  clearLocalAlerts,
} from '@/services/localAlerts';

export default function NotificationsScreen() {
  const router = useRouter();
  const { data: notifData, isLoading: fetching, isRefetching: refreshing, refetch } = useNotifications(50);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const apiItems = notifData?.items ?? [];

  // Merge the backend feed with the device-side float alerts so "your float
  // went down" shows up as a proper in-app notification too.
  const normalize = useCallback(
    (api: any[], local: any[]) => [
      ...local.map((a: any) => ({
        id: a.id,
        subject: a.subject || 'Alert',
        message: a.message || '',
        isRead: !!a.isRead,
        sentAt: a.createdAt || a.sentAt || new Date().toISOString(),
        local: true,
      })),
      ...api.map((n: any) => ({ ...n, local: false })),
    ].sort(
      (a, b) =>
        new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime(),
    ),
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const local = await getLocalAlerts();
      if (active) setNotifications(normalize(apiItems, local));
    })();
    return () => { active = false; };
  }, [apiItems, normalize]);

  const onRefresh = async () => {
    setLoading(true);
    const [{ items }, local] = await Promise.all([
      refetch().then((r: any) => ({ items: r?.data?.items ?? [] })),
      getLocalAlerts(),
    ]);
    setNotifications(normalize(items, local));
    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    if ((notifications.find((n) => n.id === id))?.local) {
      await markLocalAlertRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
      return;
    }
    try {
      await DataService.markNotificationRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) {
      console.error("Failed to mark notification as read", e);
    }
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
        await Promise.allSettled([
          DataService.markAllNotificationsRead(),
          clearLocalAlerts(),
        ]);
        await refetch();
        const local = await getLocalAlerts();
        setNotifications(normalize(notifData?.items ?? [], local));
        Toast.show({ type: 'success', text1: 'Done', text2: 'All notifications marked as read' });
    } catch (e) {
        console.error("Mark all read failed", e);
    } finally {
        setLoading(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
        if ((notifications.find((n) => n.id === id))?.local) {
          await deleteLocalAlert(id);
        } else {
          await DataService.deleteNotification(id);
        }
        setNotifications(notifications.filter(n => n.id !== id));
        Toast.show({ type: 'success', text1: 'Removed', text2: 'Notification deleted' });
    } catch (e) {
        console.error("Delete failed", e);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isUnread = !item.isRead;
    const subject: string = item.subject || 'Notification';
    const isSuccess = /success|completed|approved|received/i.test(subject);
    const isWarning = /fail|declin|reject|overdue|due|insufficient|reduc|drop/i.test(subject);
    const when = item.sentAt || item.createdAt;

    return (
      <TouchableOpacity
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.7}
        className={`p-5 mb-4 rounded-[28px] border ${isUnread ? 'bg-white border-leaf/10 shadow-lg shadow-forest/5' : 'bg-gray-50/50 border-gray-50'} flex-row`}
      >
        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4
            ${isSuccess ? 'bg-mint/10' : isWarning ? 'bg-gold/10' : 'bg-leaf/10'}`}>
            <IconSymbol
                name={isSuccess ? 'checkmark.circle.fill' : isWarning ? 'exclamationmark.triangle.fill' : 'bell.fill'}
                size={22}
                color={isSuccess ? '#2ECC8A' : isWarning ? '#F5C842' : '#1A6B47'}
            />
        </View>
        <View className="flex-1">
            <View className="flex-row justify-between items-start mb-2">
                <View className="flex-1 mr-2">
                    <Text className={`text-base font-black tracking-tight ${isUnread ? 'text-textDark' : 'text-textMid opacity-70'}`}>{subject}</Text>
                </View>
                {isUnread && <View className="w-2 h-2 bg-leaf rounded-full mt-1.5" />}
                <TouchableOpacity onPress={() => deleteNotification(item.id)} className="ml-2 mt-0.5 opacity-40">
                    <IconSymbol name="trash.fill" size={14} color="#8FA99D" />
                </TouchableOpacity>
            </View>
            <Text className={`text-xs leading-5 mb-3 ${isUnread ? 'text-textMid' : 'text-textLight opacity-80'}`}>{item.message}</Text>
            <View className="flex-row items-center">
                 <IconSymbol name="clock.fill" size={10} color="#8FA99D" />
                 <Text className="text-[10px] text-textLight font-medium ml-1">
                    {when ? new Date(when).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                 </Text>
            </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Cinematic Header */}
      <View className="bg-forest pt-12 pb-8 overflow-hidden">
          <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-mint/5 rounded-full" />
          
          <View className="px-6 flex-row items-center justify-between">
              <View className="flex-row items-center">
                  <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                      <IconSymbol name="chevron.left" size={20} color="white" />
                  </TouchableOpacity>
                  <Text className="text-white text-xl font-black tracking-tight">System Alerts</Text>
              </View>
              <TouchableOpacity onPress={markAllRead} disabled={loading} className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                  <Text className="text-white text-[10px] font-black uppercase tracking-widest">Mark all read</Text>
              </TouchableOpacity>
          </View>
      </View>

      {(fetching || loading) && !refreshing ? (
          <View className="flex-1 justify-center items-center">
              <ActivityIndicator color="#1A6B47" size="large" />
          </View>
      ) : (
          <FlatList
            data={notifications}
            renderItem={renderItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1A6B47" />
            }
            ListEmptyComponent={() => (
                <View className="items-center mt-24">
                    <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6">
                        <IconSymbol name="bell.slash" size={40} color="#D1D5DB" />
                    </View>
                    <Text className="text-textDark font-black text-lg mb-1">Silence is Golden</Text>
                    <Text className="text-textLight text-xs text-center px-12">You&apos;re all caught up! New alerts will appear here as they arrive.</Text>
                </View>
            )}
          />
      )}
    </View>
  );
}
