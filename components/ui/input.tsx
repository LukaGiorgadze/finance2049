import React, { useCallback, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, TextInputProps, Platform, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  labelAccessory?: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  onClear?: () => void;
  showClearButton?: boolean;
  containerStyle?: ViewStyle;
  rightAccessory?: React.ReactNode;
}

export const Input = React.forwardRef<TextInput, InputProps>(function Input({
  label,
  labelAccessory,
  icon,
  onClear,
  showClearButton = true,
  value,
  containerStyle,
  rightAccessory,
  ...textInputProps
}: InputProps, forwardedRef) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const inputRef = useRef<TextInput>(null);

  const setInputRef = useCallback((node: TextInput | null) => {
    inputRef.current = node;

    if (typeof forwardedRef === 'function') {
      forwardedRef(node);
      return;
    }

    if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {(label || labelAccessory) && (
        <View style={styles.labelRow}>
          {label && <Text style={[styles.label, { color: colors.icon }]}>{label}</Text>}
          {labelAccessory}
        </View>
      )}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleContainerPress}
        style={[
          styles.container,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
          }
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={colors.icon}
            style={styles.icon}
          />
        )}
        <TextInput
          ref={setInputRef}
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.icon}
          value={value}
          {...textInputProps}
        />
        {showClearButton && value && value.length > 0 && (
          <TouchableOpacity onPress={onClear}>
            <Ionicons name="close-circle" size={20} color={colors.icon} />
          </TouchableOpacity>
        )}
        {rightAccessory}
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 0,
  },
});
