import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type BottomSheetModalRef = React.ElementRef<typeof BottomSheetModal>;

type AppBottomSheetModalProps = Omit<
  BottomSheetModalProps,
  | 'backdropComponent'
  | 'backgroundStyle'
  | 'children'
  | 'handleIndicatorStyle'
  | 'index'
  | 'onDismiss'
  | 'snapPoints'
> & {
  visible: boolean;
  onDismiss: () => void;
  children: React.ReactNode;
  snapPoints?: (string | number)[];
  index?: number;
  backgroundColor?: string;
  backgroundStyle?: StyleProp<ViewStyle>;
  handleIndicatorColor?: string;
  handleIndicatorStyle?: StyleProp<ViewStyle>;
  backdropColor?: string;
  backdropOpacity?: number;
};

export function AppBottomSheetModal({
  visible,
  onDismiss,
  children,
  snapPoints,
  index = 0,
  backgroundColor,
  backgroundStyle,
  handleIndicatorColor,
  handleIndicatorStyle,
  backdropColor,
  backdropOpacity = 0.45,
  enablePanDownToClose = true,
  stackBehavior = 'push',
  ...modalProps
}: AppBottomSheetModalProps) {
  const sheetRef = useRef<BottomSheetModalRef>(null);
  const isPresentedRef = useRef(false);

  const handleDismiss = useCallback(() => {
    isPresentedRef.current = false;
    onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (visible) {
      isPresentedRef.current = true;
      sheetRef.current?.present();
    } else if (isPresentedRef.current) {
      sheetRef.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={backdropOpacity}
        pressBehavior="close"
        style={[props.style, backdropColor ? { backgroundColor: backdropColor } : undefined]}
      />
    ),
    [backdropColor, backdropOpacity],
  );

  const mergedBackgroundStyle = useMemo(
    () => [backgroundColor ? { backgroundColor } : undefined, backgroundStyle],
    [backgroundColor, backgroundStyle],
  );

  const mergedHandleIndicatorStyle = useMemo(
    () => [
      handleIndicatorColor ? { backgroundColor: handleIndicatorColor } : undefined,
      handleIndicatorStyle,
    ],
    [handleIndicatorColor, handleIndicatorStyle],
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      index={index}
      snapPoints={snapPoints}
      onDismiss={handleDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={mergedBackgroundStyle}
      handleIndicatorStyle={mergedHandleIndicatorStyle}
      enablePanDownToClose={enablePanDownToClose}
      stackBehavior={stackBehavior}
      {...modalProps}
    >
      {children}
    </BottomSheetModal>
  );
}
