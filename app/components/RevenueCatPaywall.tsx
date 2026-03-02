import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePurchase } from '../contexts/RevenueCatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { goldTint } from '../../utils/colorHelpers';

interface RevenueCatPaywallProps {
  onClose?: () => void;
}

const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const { t } = useLanguage();
  const gt = (alpha: number) => goldTint(alpha, colors);
  const {
    loading,
    packages,
    products,
    isPurchasing,
    customerInfo,
    purchase,
    purchaseProductById,
    fetchOfferings,
    restorePurchases,
    fetchProducts,
  } = usePurchase();

  const hasActiveEntitlements =
    customerInfo?.entitlements.active &&
    Object.keys(customerInfo.entitlements.active).length > 0;
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isMobile = isIOS || isAndroid;

  const gold = colors.accent.gold;
  const txt = colors.text.primary;
  const txt2 = colors.text.secondary;
  const surface = colors.surface.primary;
  const bg = colors.background.primary;

  // ── Shared card wrapper ────────────────────────────
  const CardWrap = ({ children }: { children: React.ReactNode }) => (
    <View style={s.backdrop}>
      <View style={[s.card, { backgroundColor: bg, borderColor: gt(0.12) }]}>
        {children}
      </View>
    </View>
  );

  // ── Non-mobile fallback ────────────────────────────
  if (!isMobile) {
    return (
      <CardWrap>
        <Text style={[s.title, { color: txt }]}>{t('supportTitle')}</Text>
        <Text style={[s.sub, { color: txt2 }]}>{t('supportNotMobile')}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.noThanks, { borderColor: gt(0.15) }]}>
            <Text style={[s.noThanksText, { color: txt2 }]}>{t('supportClose')}</Text>
          </TouchableOpacity>
        )}
      </CardWrap>
    );
  }

  // ── Loading ────────────────────────────────────────
  if (loading) {
    return (
      <CardWrap>
        <ActivityIndicator size="small" color={gold} />
        <Text style={[s.sub, { color: txt2, marginTop: 8 }]}>{t('supportLoading')}</Text>
      </CardWrap>
    );
  }

  // ── No products ────────────────────────────────────
  if (packages.length === 0 && products.length === 0) {
    return (
      <CardWrap>
        <Text style={[s.title, { color: txt }]}>{t('supportTitle')}</Text>
        <Text style={[s.sub, { color: txt2 }]}>{t('supportNoProducts')}</Text>
        <TouchableOpacity
          style={[s.retryBtn, { borderColor: gt(0.2) }]}
          onPress={() => { fetchOfferings(); fetchProducts(); }}
        >
          <Text style={[s.retryText, { color: gold }]}>{t('supportRetry')}</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.noThanks, { borderColor: gt(0.15) }]}>
            <Text style={[s.noThanksText, { color: txt2 }]}>{t('supportClose')}</Text>
          </TouchableOpacity>
        )}
      </CardWrap>
    );
  }

  // ── Main paywall (compact card) ────────────────────
  return (
    <View style={s.backdrop}>
      <View style={[s.card, { backgroundColor: bg, borderColor: gt(0.12) }]}>
        {/* Close X — top right */}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={s.closeX} activeOpacity={0.6} hitSlop={12}>
            <MaterialCommunityIcons name="close" size={20} color={txt2} />
          </TouchableOpacity>
        )}

        {/* Icon + title */}
        <MaterialCommunityIcons name="hand-heart-outline" size={30} color={gold} style={{ marginBottom: 6 }} />
        <Text style={[s.title, { color: txt }]}>{t('supportTitle')}</Text>
        <Text style={[s.sub, { color: txt2 }]}>{t('supportFreeForever')}</Text>

        {hasActiveEntitlements && (
          <View style={[s.successRow, { backgroundColor: gt(0.08) }]}>
            <MaterialCommunityIcons name="check-circle" size={16} color={gold} />
            <Text style={[s.successText, { color: txt }]}>{t('supportThankYou')}</Text>
          </View>
        )}

        {/* Product rows */}
        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.identifier}
            style={[s.row, { backgroundColor: surface, borderColor: gt(0.12) }, isPurchasing && s.disabled]}
            disabled={isPurchasing}
            onPress={() => purchase(pkg)}
            activeOpacity={0.7}
          >
            <Text style={[s.rowTitle, { color: txt }]} numberOfLines={1}>
              {pkg.product.title || pkg.identifier}
            </Text>
            <Text style={[s.rowPrice, { color: gold }]}>{pkg.product.priceString}</Text>
          </TouchableOpacity>
        ))}

        {products.map((p) => (
          <TouchableOpacity
            key={p.identifier}
            style={[s.row, { backgroundColor: surface, borderColor: gt(0.12) }, isPurchasing && s.disabled]}
            disabled={isPurchasing}
            onPress={() => purchaseProductById(p.identifier)}
            activeOpacity={0.7}
          >
            <Text style={[s.rowTitle, { color: txt }]} numberOfLines={1}>
              {p.title || p.identifier}
            </Text>
            <Text style={[s.rowPrice, { color: gold }]}>{p.priceString}</Text>
          </TouchableOpacity>
        ))}

        {/* Inline links: Restore · Privacy */}
        <View style={s.linksRow}>
          <TouchableOpacity onPress={restorePurchases} activeOpacity={0.6}>
            <Text style={[s.link, { color: gold }]}>{t('supportRestore')}</Text>
          </TouchableOpacity>
          <Text style={[s.dot, { color: txt2 }]}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://sites.google.com/view/privacy-policy-athan-app?usp=sharing')}
            activeOpacity={0.6}
          >
            <Text style={[s.link, { color: txt2 }]}>{t('supportPolicy')}</Text>
          </TouchableOpacity>
        </View>

        {/* No thanks */}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.noThanks, { borderColor: gt(0.15) }]} activeOpacity={0.6}>
            <Text style={[s.noThanksText, { color: txt2 }]}>{t('supportNoThanks')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Purchasing overlay */}
      {isPurchasing && (
        <View style={s.overlay} pointerEvents="auto">
          <View style={[s.overlayCard, { backgroundColor: surface }]}>
            <ActivityIndicator size="small" color={gold} />
            <Text style={[s.overlayText, { color: txt }]}>{t('supportProcessing')}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  closeX: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    padding: 4,
  },

  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },

  // Success badge
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  successText: { fontSize: 12, fontWeight: '600' },

  // Product rows (compact single-line)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    width: '100%',
  },
  disabled: { opacity: 0.5 },
  rowTitle: { fontSize: 13, fontWeight: '500', flex: 1, marginRight: 8 },
  rowPrice: { fontSize: 13, fontWeight: '700' },

  // Inline links
  linksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  link: { fontSize: 12, fontWeight: '500' },
  dot: { fontSize: 14 },

  // No thanks button
  noThanks: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  noThanksText: { fontSize: 14, fontWeight: '600' },

  // Retry button
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  retryText: { fontSize: 13, fontWeight: '600' },

  // Purchasing overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    zIndex: 10,
  },
  overlayCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
  },
});

export default RevenueCatPaywall;
