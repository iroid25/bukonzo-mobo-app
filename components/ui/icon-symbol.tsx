// This file is a wrapper around Ionicons to ensure consistent icon usage
import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { StyleProp, TextStyle } from 'react-native';

// Map SF Symbol names to Ionicons names for backward compatibility if needed, 
// or just use Ionicons names directly.
const ICON_MAPPING: Record<string, keyof typeof Ionicons.glyphMap> = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'bell.fill': 'notifications',
  'person.fill': 'person',
  'gear': 'settings-sharp',
  'arrow.right': 'arrow-forward',
  'arrow.left': 'arrow-back',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'creditcard': 'card',
  'creditcard.fill': 'card',
  'banknote': 'cash',
  'banknote.fill': 'cash',
  'doc.text': 'document-text',
  'doc.text.fill': 'document-text',
  'lock.fill': 'lock-closed',
  'envelope.fill': 'mail',
  'eye.fill': 'eye',
  'eye.slash.fill': 'eye-off',
  'checkmark.circle.fill': 'checkmark-circle',
  'exclamationmark.triangle.fill': 'warning',
  'info.circle.fill': 'information-circle',
  'arrow.down.left': 'arrow-down-circle', // Simulating deposit
  'arrow.up.right': 'arrow-up-circle', // Simulating withdraw
  'arrow.down.left.circle.fill': 'arrow-down-circle', // Deposit icon (filled)
  'arrow.up.right.circle.fill': 'arrow-up-circle', // Withdraw icon (filled)
  'printer.fill': 'print',
  'square.and.arrow.up': 'share-outline',
  'building.columns.fill': 'business',
  'building.2.fill': 'business',
  'chart.bar.fill': 'bar-chart',
  'wallet.pass.fill': 'wallet',
  'calendar': 'calendar',
  'tablecells.fill': 'grid',
  'map.fill': 'map',
  'rectangle.portrait.and.arrow.right': 'log-out',
  'briefcase.fill': 'briefcase',
  'arrow.clockwise': 'refresh',
  'line.3.horizontal.decrease': 'filter',
  'pencil': 'pencil',
  'chart.pie.fill': 'pie-chart',
  'fingerprint': 'finger-print',
  'shield.fill': 'shield-checkmark',
  'chevron-back': 'chevron-back',
  'phone': 'call',
  'checkmark': 'checkmark',
  'faceid': 'scan',
  'person.text.rectangle.fill': 'id-card',
  'building.2': 'business',
  'xmark': 'close',
  'qrcode': 'qr-code',
  'wallet': 'wallet',
  'lock-closed': 'lock-closed',
  'tray': 'file-tray',
  'checkmark.shield.fill': 'shield-checkmark',
  'phone.fill': 'call',
  'moon.fill': 'moon',
  'shield.lefthalf.filled': 'shield-half',
  'square.and.arrow.down': 'download-outline',
  'arrow.up': 'arrow-up',
  'arrow.down': 'arrow-down',
};

export type IconSymbolName = keyof typeof ICON_MAPPING | keyof typeof Ionicons.glyphMap;

interface IconSymbolProps {
  name: IconSymbolName;
  size?: number;
  color: string;
  style?: StyleProp<TextStyle>;
  onPress?: () => void;
}

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  onPress,
}: IconSymbolProps) {
  // Use mapping if available, otherwise assume it's a valid Ionicons name
  const iconName = ICON_MAPPING[name as string] 
    ? ICON_MAPPING[name as string] 
    : (name as keyof typeof Ionicons.glyphMap);

  return <Ionicons name={iconName} size={size} color={color} style={style} onPress={onPress} />;
}
