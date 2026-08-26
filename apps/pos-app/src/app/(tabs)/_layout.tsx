import { View, type ColorValue } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { useTheme } from '@hillexpress/ui';
import { useAuth } from '../../lib/auth';

/**
 * A persistent bottom tab bar — the single change that most makes this feel
 * like an app the operator has already used. Orders is the landing tab because
 * that is where a store spends its shift; the old home screen of navigation
 * rows is gone, its store toggle moved onto Orders and its counters onto Store.
 *
 * Icons are drawn from Views rather than an icon font: `@expo/vector-icons` is
 * not a dependency here, and the admin panel already replaced its emoji with a
 * drawn set, so this keeps the surfaces consistent.
 */

const Icon = ({ children }: { children: React.ReactNode }) => (
  <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
    {children}
  </View>
);

/** Receipt: three ruled lines, the shortest last. */
function OrdersIcon({ color }: { color: ColorValue }) {
  return (
    <Icon>
      <View style={{ gap: 3, width: 18 }}>
        {[18, 18, 11].map((w, i) => (
          <View
            key={i}
            style={{ width: w, height: 2.5, borderRadius: 2, backgroundColor: color }}
          />
        ))}
      </View>
    </Icon>
  );
}

/** Catalogue: a 2×2 grid of shelf squares. */
function CatalogueIcon({ color }: { color: ColorValue }) {
  return (
    <Icon>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 18, gap: 3 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{ width: 7.5, height: 7.5, borderRadius: 2, backgroundColor: color }}
          />
        ))}
      </View>
    </Icon>
  );
}

/** Store: an awning over a shopfront. */
function StoreIcon({ color }: { color: ColorValue }) {
  return (
    <Icon>
      <View style={{ width: 20, alignItems: 'center' }}>
        <View style={{ width: 20, height: 5, borderRadius: 2, backgroundColor: color }} />
        <View
          style={{
            width: 15,
            height: 11,
            marginTop: 2,
            borderWidth: 2.5,
            borderColor: color,
            borderRadius: 2,
          }}
        />
      </View>
    </Icon>
  );
}

export default function TabsLayout() {
  const { colors } = useTheme();
  const { status } = useAuth();

  // Guarded once here rather than in every tab — a signed-out operator must
  // never see a tab bar behind the sign-in screen.
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/(auth)/sign-in" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.moss,
        tabBarInactiveTintColor: colors.ink3,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          // 24px icon + label + breathing room. At 62 the labels clipped on a
          // device with no bottom safe-area inset.
          height: 74,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: 'PlusJakartaSans-SemiBold',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Orders', tabBarIcon: ({ color }) => <OrdersIcon color={color} /> }}
      />
      <Tabs.Screen
        name="catalogue"
        options={{ title: 'Catalogue', tabBarIcon: ({ color }) => <CatalogueIcon color={color} /> }}
      />
      <Tabs.Screen
        name="store"
        options={{ title: 'Store', tabBarIcon: ({ color }) => <StoreIcon color={color} /> }}
      />
    </Tabs>
  );
}
