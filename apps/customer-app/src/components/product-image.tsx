import { useState } from 'react';
import { View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { AppText, useTheme } from '@hillexpress/ui';
import { categoryTint, productEmoji } from '../lib/emoji';

interface ProductImageProps {
  name: string;
  categoryName?: string;
  imageUrl?: string | null;
  blurhash?: string | null;
  height: number;
  /** Emoji size when falling back. */
  emojiSize?: number;
  radius?: number;
  style?: ViewStyle;
}

/**
 * One image element for every product surface.
 *
 *  - Real photo when we have one — faded in from its blurhash, so it never
 *    pops in and the layout never shifts.
 *  - Tinted category emoji when we don't, or when the photo fails to load.
 *    A deliberate placeholder always beats a broken-image icon.
 */
export function ProductImage({
  name,
  categoryName = '',
  imageUrl,
  blurhash,
  height,
  emojiSize,
  radius = 12,
  style,
}: ProductImageProps) {
  const { colors, mode } = useTheme();
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(imageUrl) && !failed;

  return (
    <View
      style={[
        {
          height,
          borderRadius: radius,
          // Photos sit on white (how pack shots are lit) so a set of stock
          // images with clashing backdrops still reads as one shelf; the
          // category tint is reserved for the emoji placeholder.
          backgroundColor: showPhoto
            ? mode === 'dark'
              ? colors.surface2
              : '#FFFFFF'
            : categoryTint(categoryName, mode),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: imageUrl! }}
          // contain, not cover: pack shots must not be cropped through the label
          contentFit="contain"
          transition={220}
          placeholder={blurhash ? { blurhash } : undefined}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          style={{ width: '92%', height: '92%' }}
        />
      ) : (
        <AppText
          token="displayL"
          style={{ fontSize: emojiSize ?? height * 0.45, lineHeight: (emojiSize ?? height * 0.45) * 1.25 }}
        >
          {productEmoji(name, categoryName)}
        </AppText>
      )}
    </View>
  );
}
