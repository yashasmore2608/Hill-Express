import { useFonts } from 'expo-font';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

/**
 * Loads the five static weights the type scale maps onto (shared/theme/type.ts
 * weightToFamily). Static faces, not the variable TTF — RN Android binds
 * weights to font FILES, and fake-bolding a variable font is how apps end up
 * with three subtly different Bolds.
 *
 * Locale-aware by design: when Hindi ships, this hook registers Mukta under
 * the same family names for hi locales — zero screen changes.
 *
 * Every app root gates its splash on this: no flash of system font, ever.
 */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    'PlusJakartaSans-Regular': PlusJakartaSans_400Regular,
    'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
    'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
    'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
    'PlusJakartaSans-ExtraBold': PlusJakartaSans_800ExtraBold,
  });
  return loaded;
}
