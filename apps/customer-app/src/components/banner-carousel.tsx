import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import type { BannerDto } from '@hillexpress/shared';
import { AppText, Skeleton, useTheme } from '@hillexpress/ui';
import { assetUrl } from '../lib/api';

const GUTTER = 20;
const GAP = 12;
const AUTO_MS = 4500;

/**
 * Home promo carousel.
 *
 *  - Paged horizontal scroll with snap, like every quick-commerce app.
 *  - Auto-advances, but PAUSES the moment a finger touches it and stays
 *    paused for one full interval after release — nothing is more annoying
 *    than a banner sliding away mid-read.
 *  - Dots are a width animation on the active one, not opacity: it reads as
 *    position rather than emphasis.
 *  - A banner with no image still renders (solid brand colour + text), so a
 *    missing asset never leaves a hole in the layout.
 */
export function BannerCarousel({
  banners,
  isPending,
}: {
  banners: BannerDto[] | undefined;
  isPending: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const width = Dimensions.get('window').width - GUTTER * 2;
  const stride = width + GAP;
  const count = banners?.length ?? 0;

  useEffect(() => {
    if (paused || count <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % count;
        scrollRef.current?.scrollTo({ x: next * stride, animated: true });
        return next;
      });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [paused, count, stride]);

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / stride));
  };

  const open = (b: BannerDto) => {
    if (b.linkType === 'CATEGORY' && b.linkValue) {
      router.push({ pathname: '/category/[id]', params: { id: b.linkValue } });
    } else if (b.linkType === 'PRODUCT' && b.linkValue) {
      router.push({ pathname: '/product/[id]', params: { id: b.linkValue } });
    } else if (b.linkType === 'SEARCH' && b.linkValue) {
      router.push({ pathname: '/category/[id]', params: { id: 'all', q: b.linkValue } });
    }
  };

  if (isPending) {
    return (
      <View style={{ paddingHorizontal: GUTTER }}>
        <Skeleton height={150} radius={18} />
      </View>
    );
  }
  if (!banners || banners.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(240)} style={{ gap: 10 }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled={false}
        snapToInterval={stride}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: GAP }}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={(e) => {
          onScrollEnd(e);
          // resume only after a full interval of no interaction
          setTimeout(() => setPaused(false), AUTO_MS);
        }}
        onScrollEndDrag={onScrollEnd}
      >
        {banners.map((b) => {
          const tappable = b.linkType !== 'NONE' && Boolean(b.linkValue);
          return (
            <Pressable
              key={b.id}
              disabled={!tappable}
              onPress={() => open(b)}
              accessibilityRole={tappable ? 'button' : 'image'}
              accessibilityLabel={`${b.title}${b.subtitle ? `. ${b.subtitle}` : ''}`}
              style={({ pressed }) => ({
                width,
                height: 150,
                borderRadius: 18,
                overflow: 'hidden',
                backgroundColor: b.bgColor,
                justifyContent: 'flex-end',
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              {assetUrl(b.imageUrl) ? (
                <Image
                  source={{ uri: assetUrl(b.imageUrl)! }}
                  contentFit="cover"
                  transition={220}
                  cachePolicy="memory-disk"
                  style={{ position: 'absolute', inset: 0 }}
                />
              ) : null}

              {/* Scrim only under the text — keeps art visible while the
                  copy stays legible on any image. */}
              <View
                style={{
                  padding: 18,
                  backgroundColor: b.imageUrl ? '#00000066' : 'transparent',
                  gap: 3,
                }}
              >
                <AppText token="titleL" style={{ color: '#FFFFFF' }} numberOfLines={1}>
                  {b.title}
                </AppText>
                {b.subtitle ? (
                  <AppText token="bodyM" style={{ color: '#FFFFFFD9' }} numberOfLines={2}>
                    {b.subtitle}
                  </AppText>
                ) : null}
                {b.ctaLabel && tappable ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 8,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                    }}
                  >
                    <AppText token="labelM" style={{ color: '#0A1611' }}>
                      {b.ctaLabel}
                    </AppText>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {banners.length > 1 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
          {banners.map((b, i) => (
            <View
              key={b.id}
              style={{
                height: 6,
                width: i === index ? 18 : 6,
                borderRadius: 999,
                backgroundColor: i === index ? colors.moss : colors.line2,
              }}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
