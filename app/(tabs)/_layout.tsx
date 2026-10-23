import { FloatingTabBar } from '@/components/FloatingTabBar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useQueryFocusSync } from '@/hooks/useQueryFocusSync';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  useQueryFocusSync();

  return (
    <Tabs
      tabBar={(props) => (
        <FloatingTabBar {...props} centerRoute="/deposit" centerIcon="plus" />
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
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="building.columns.fill" color={color} />,
        }}
      />
       <Tabs.Screen
        name="loans"
        options={{
          title: 'Loans',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="banknote.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconSymbol size={22} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
