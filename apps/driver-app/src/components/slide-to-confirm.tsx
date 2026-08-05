import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { springs } from '@hillexpress/shared';
import { AppText, useTheme } from '@hillexpress/ui';

const THUMB = 56; // driver touch target — gloves, one hand, on a bike
const PAD = 4;

interface SlideToConfirmProps {
  label: string;
  disabled?: boolean;
  onConfirm: () => void;
}

/**
 * The driver's primary action is a SLIDE, not a tap — a pocket or a bump
 * cannot trigger it, and it works with a thumb that is not precisely
 * placed. Gesture runs on the UI thread (worklet); JS is only called once,
 * at completion.
 */
export function SlideToConfirm({ label, disabled, onConfirm }: SlideToConfirmProps) {
  const { colors, mode } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useSharedValue(0);
  const max = Math.max(0, trackWidth - THUMB - PAD * 2);

  const fire = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm();
    x.value = withSpring(0, springs.glide);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled && max > 0)
    .onUpdate((e) => {
      'worklet';
      x.value = Math.min(Math.max(0, e.translationX), max);
    })
    .onEnd(() => {
      'worklet';
      if (x.value >= max * 0.85) {
        x.value = withSpring(max, springs.snap);
        runOnJS(fire)();
      } else {
        x.value = withSpring(0, springs.glide);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + THUMB + PAD }));
  const fg = mode === 'dark' ? '#06120D' : '#FFFFFF';

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={{
        height: THUMB + PAD * 2,
        borderRadius: 999,
        backgroundColor: colors.surface3,
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: 999,
            backgroundColor: colors.mossSoft,
          },
          fillStyle,
        ]}
      />
      <AppText token="labelM" color="ink2" style={{ textAlign: 'center' }}>
        {label} →
      </AppText>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: PAD,
              top: PAD,
              width: THUMB,
              height: THUMB,
              borderRadius: 999,
              backgroundColor: colors.moss,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumbStyle,
          ]}
        >
          <AppText token="titleM" style={{ color: fg }}>
            →
          </AppText>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
