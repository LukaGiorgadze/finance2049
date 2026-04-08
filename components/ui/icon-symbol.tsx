// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'briefcase.fill': 'work',
  'arrow.left.arrow.right': 'swap-horiz',
  'gearshape.fill': 'settings',
  'moon.stars.fill': 'nights-stay',
  'sun.max.fill': 'wb-sunny',
  'icloud.and.arrow.up.fill': 'cloud-upload',
  'icloud.and.arrow.down.fill': 'cloud-download',
  'externaldrive.fill': 'storage',
  'lock.shield.fill': 'security',
  'questionmark.circle.fill': 'help',
  'info.circle.fill': 'info',
  xmark: 'close',
  'xmark.circle.fill': 'cancel',
  'checkmark.circle.fill': 'check-circle',
  'dollarsign.circle.fill': 'attach-money',
  'bell.badge.fill': 'notifications',
  'chart.bar.fill': 'bar-chart',
  'chart.pie.fill': 'pie-chart',
  'chart.line.uptrend.xyaxis': 'trending-up',
  'trash.fill': 'delete',
  'arrow.triangle.2.circlepath': 'cached',
  'person.2.fill': 'groups',
  'envelope.fill': 'email',
  globe: 'public',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const materialIconName = MAPPING[name] ?? 'help-outline';

  return <MaterialIcons color={color} size={size} name={materialIconName} style={style} />;
}
