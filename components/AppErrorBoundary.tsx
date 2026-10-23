import { IconSymbol } from '@/components/ui/icon-symbol';
import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = { children: React.ReactNode };

type State = {
  error: Error | null;
  recoveryKey: number;
};

/**
 * Catches any render / lifecycle error thrown by a screen so the app does
 * NOT hard-crash (blank screen on Android release builds) and instead shows a
 * friendly recovery screen with the actual error message + a reload button.
 *
 * The `setGlobalHandler` guard in services/errorGuard.ts covers the rest
 * (errors outside a component). Both together mean a bad screen render must
 * be pretty exotic before a user ever sees a crash.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, recoveryKey: 0 };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('[ErrorBoundary] Screen crashed:', error, info);
  }

  private reset = () => {
    this.setState((s) => ({ error: null, recoveryKey: s.recoveryKey + 1 }));
  };

  render() {
    if (!this.state.error) {
      return (
        <React.Fragment key={this.state.recoveryKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    const message =
      this.state.error?.message || 'Something went wrong while drawing this screen.';

    return (
      <View className="flex-1 bg-warmWhite items-center justify-center px-10">
        <View className="w-24 h-24 bg-forest/10 rounded-full items-center justify-center mb-6">
          <IconSymbol name="exclamationmark.triangle.fill" size={40} color="#1A6B47" />
        </View>
        <Text className="text-textDark font-black text-xl text-center mb-2">
          This screen hit a snag
        </Text>
        <Text className="text-textLight text-xs text-center leading-5 mb-8">
          Catch your breath — the app is still running. Tap below to try this screen
          again, or sign out if it keeps happening.
        </Text>

        <ScrollView
          className="max-h-24 mb-8 w-full"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-textLight text-[10px] font-mono text-center">
            {message}
          </Text>
        </ScrollView>

        <View className="w-full">
          <TouchableOpacity
            onPress={this.reset}
            className="bg-forest py-4 rounded-2xl items-center"
          >
            {this.state.recoveryKey > 1 ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-black text-xs uppercase tracking-widest">
                Reload Screen
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}