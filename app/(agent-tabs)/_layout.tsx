import { FloatingTabBar } from '@/components/FloatingTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useQueryFocusSync } from '@/hooks/useQueryFocusSync';
import { Tabs } from 'expo-router';
import React from 'react';

export default function AgentLayout() {
  useQueryFocusSync();

  return (
      <Tabs
      tabBar={(props) => (
        <FloatingTabBar {...props} centerRoute="/(agent-tabs)/member-search" centerIcon="plus" />
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#C6F24E',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transaction',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="swap-horizontal" color={color} />,
        }}
      />
      <Tabs.Screen
        name="commissions"
        options={{
          title: 'Commission',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.fill" color={color} />,
        }}
      />

      {/* Hidden Screens */}
      <Tabs.Screen name="float" options={{ href: null }} />
      <Tabs.Screen name="member-search" options={{ href: null }} />
      <Tabs.Screen name="member-details" options={{ href: null }} />
    </Tabs>
  );
}
