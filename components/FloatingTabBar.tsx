import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Palette pulled from the reference mock: deep forest bar, bright lime accent.
const BAR_BG = '#0D3D2B';
const ACTIVE = '#C6F24E';
const INACTIVE = 'rgba(255,255,255,0.55)';

interface FloatingTabBarProps extends BottomTabBarProps {
  /** Route pushed when the raised centre button is tapped. */
  centerRoute: string;
  /** Icon shown inside the centre button. */
  centerIcon?: IconSymbolName;
}

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  centerRoute,
  centerIcon = 'paperplane.fill',
}: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Drop the routes expo-router hides via `href: null` (they get a tabBarButton).
  const routes = state.routes.filter(
    (route) => descriptors[route.key].options.tabBarButton === undefined
  );

  const mid = Math.ceil(routes.length / 2);
  const left = routes.slice(0, mid);
  const right = routes.slice(mid);

  const renderTab = (route: (typeof routes)[number]) => {
    const { options } = descriptors[route.key];
    const index = state.routes.indexOf(route);
    const focused = state.index === index;
    const color = focused ? ACTIVE : INACTIVE;
    const label =
      typeof options.tabBarLabel === 'string'
        ? options.tabBarLabel
        : options.title ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name as never);
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tab}
        android_ripple={{ color: 'rgba(255,255,255,0.12)', borderless: true, radius: 32 }}
      >
        {options.tabBarIcon?.({ focused, color, size: 22 })}
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { paddingBottom: insets.bottom > 0 ? insets.bottom : 14 }]}
    >
      <View style={styles.bar}>
        {left.map(renderTab)}

        <View style={styles.centerSlot}>
          <Pressable
            onPress={() => router.push(centerRoute as never)}
            style={styles.fab}
            android_ripple={{ color: 'rgba(13,61,43,0.2)', borderless: true, radius: 30 }}
          >
            <IconSymbol name={centerIcon} size={24} color={BAR_BG} />
          </Pressable>
        </View>

        {right.map(renderTab)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BAR_BG,
    borderRadius: 30,
    height: 62,
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#0D3D2B',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  centerSlot: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -30,
    backgroundColor: ACTIVE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: BAR_BG,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: { elevation: 14 },
    }),
  },
});
