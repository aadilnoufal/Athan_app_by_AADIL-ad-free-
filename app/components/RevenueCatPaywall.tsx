import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePurchase } from '../contexts/RevenueCatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { goldTint } from '../../utils/colorHelpers';

interface RevenueCatPaywallProps {
  onClose?: () => void;
}

const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({ onClose }) => {
  const { colors, isDark } = useTheme();
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
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;
  const surface = colors.surface.primary;
  const bg = colors.background.primary;

  // ── Non-mobile fallback ───────────────────────────
  if (!isMobile) {
    return (
      <View style={[s.centered, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name="heart-outline" size={48} color={gt(0.5)} />
        <Text style={[s.title, { color: textPrimary }]}>{t('supportTitle')}</Text>
        <Text style={[s.body, { color: textSecondary }]}>{t('supportNotMobile')}</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.closeBar, { backgroundColor: surface, borderColor: gt(0.15) }]}>
            <Text style={[s.closeBtnText, { color: textPrimary }]}>{t('supportClose')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Loading state ──────────────────────────────────
  if (loading) {
    return (
      <View style={[s.centered, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={gold} />
        <Text style={[s.body, { color: textSecondary, marginTop: 12 }]}>{t('supportLoading')}</Text>
      </View>
    );
  }

  // ── No packages available ──────────────────────────
  if (packages.length === 0 && products.length === 0) {
    return (
      <View style={[s.centered, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name="heart-outline" size={48} color={gt(0.5)} />
        <Text style={[s.title, { color: textPrimary }]}>{t('supportTitle')}</Text>
        <Text style={[s.body, { color: textSecondary }]}>{t('supportNoProducts')}</Text>
        <TouchableOpacity
          style={[s.secondaryBtn, { borderColor: gt(0.2) }]}
          onPress={() => { fetchOfferings(); fetchProducts(); }}
        >
          <Text style={[s.secondaryBtnText, { color: gold }]}>{t('supportRetry')}</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.closeBar, { backgroundColor: surface, borderColor: gt(0.15) }]}>
            <Text style={[s.closeBtnText, { color: textPrimary }]}>{t('supportClose')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Main paywall ───────────────────────────────────
  return (
    <SafeAreaView style={[s.safeArea, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      {/* ── Prominent dismiss bar at the top ── */}
      {onClose && (
        <TouchableOpacity
          onPress={onClose}
          style={[s.dismissRow, { borderBottomColor: gt(0.1) }]}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="close" size={22} color={textSecondary} />
          <Text style={[s.dismissText, { color: textSecondary }]}>{t('supportNoThanks')}</Text>
        </TouchableOpacity>
      )}

      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Heart icon */}
        <View style={[s.iconCircle, { backgroundColor: gt(0.08) }]}>
          <MaterialCommunityIcons name="hand-heart-outline" size={40} color={gold} />
        </View>

        <Text style={[s.title, { color: textPrimary }]}>{t('supportTitle')}</Text>
        <Text style={[s.subtitle, { color: textSecondary }]}>{t('supportSubtitle')}</Text>

        {/* Core promise */}
        <View style={[s.promiseCard, { backgroundColor: surface, borderColor: gt(0.1) }]}>
          <MaterialCommunityIcons name="infinity" size={18} color={gold} style={{ marginRight: 8 }} />
          <Text style={[s.promiseText, { color: textSecondary }]}>{t('supportFreeForever')}</Text>
        </View>

        {hasActiveEntitlements && (
          <View style={[s.successCard, { backgroundColor: gt(0.08), borderColor: gt(0.2) }]}>
            <MaterialCommunityIcons name="check-circle" size={20} color={gold} />
            <Text style={[s.successText, { color: textPrimary }]}>{t('supportThankYou')}</Text>
          </View>
        )}

        {/* Purchase options — subtler cards */}
        {packages.map((pkg) => (
          <TouchableOpacity
            key={pkg.identifier}
            style={[s.productCard, { backgroundColor: surface, borderColor: gt(0.15) }, isPurchasing && s.disabledCard]}
            disabled={isPurchasing}
            onPress={() => purchase(pkg)}
            activeOpacity={0.7}
          >
            <View style={s.productInfo}>
              <Text style={[s.productTitle, { color: textPrimary }]}>
                {pkg.product.title || pkg.identifier}
              </Text>
              {!!pkg.product.description && (
                <Text style={[s.productDesc, { color: textSecondary }]} numberOfLines={2}>
                  {pkg.product.description}
                </Text>
              )}
            </View>
            <View style={[s.priceChip, { backgroundColor: gt(0.1), borderColor: gt(0.2) }]}>
              <Text style={[s.priceText, { color: gold }]}>{pkg.product.priceString}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {products.map((p) => (
          <TouchableOpacity
            key={p.identifier}
            style={[s.productCard, { backgroundColor: surface, borderColor: gt(0.15) }, isPurchasing && s.disabledCard]}
            disabled={isPurchasing}
            onPress={() => purchaseProductById(p.identifier)}
            activeOpacity={0.7}
          >
            <View style={s.productInfo}>
              <Text style={[s.productTitle, { color: textPrimary }]}>
                {p.title || p.identifier}
              </Text>
              {!!p.description && (
                <Text style={[s.productDesc, { color: textSecondary }]} numberOfLines={2}>
                  {p.description}
                </Text>
              )}
            </View>
            <View style={[s.priceChip, { backgroundColor: gt(0.1), borderColor: gt(0.2) }]}>
              <Text style={[s.priceText, { color: gold }]}>{p.priceString}</Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Footer text */}
        <Text style={[s.footerText, { color: textSecondary }]}>
          {t('supportSecure').replace('{store}', isIOS ? 'Apple' : 'Google Play')}
        </Text>

        {/* Restore + policy */}
        <TouchableOpacity onPress={restorePurchases} style={s.linkBtn} activeOpacity={0.6}>
          <Text style={[s.linkText, { color: gold }]}>{t('supportRestore')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => Linking.openURL('https://sites.google.com/view/privacy-policy-athan-app?usp=sharing')}
          style={s.linkBtn}
          activeOpacity={0.6}
        >
          <Text style={[s.linkText, { color: textSecondary }]}>{t('supportPolicy')}</Text>
        </TouchableOpacity>

        {/* Bottom close */}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={[s.closeBar, { backgroundColor: surface, borderColor: gt(0.15) }]}>
            <Text style={[s.closeBtnText, { color: textPrimary }]}>{t('supportClose')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Purchasing overlay */}
      {isPurchasing && (
        <View style={s.overlay} pointerEvents="auto">
          <View style={[s.overlayCard, { backgroundColor: surface, borderColor: gt(0.2) }]}>
            <ActivityIndicator size="large" color={gold} />
            <Text style={[s.overlayText, { color: textPrimary }]}>{t('supportProcessing')}</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

// ── Styles ────────────────────────────────────────────
const s = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
    alignItems: 'center',
  },

  // Top dismiss row
  dismissRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    gap: 8,
  },
  dismissText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Heart icon circle
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
  },

  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },

  // "Free forever" promise card
  promiseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  promiseText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Success card
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 8,
    width: '100%',
  },
  successText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // Product cards
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    width: '100%',
  },
  disabledCard: { opacity: 0.5 },
  productInfo: { flex: 1, marginRight: 12 },
  productTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  priceChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Footer
  footerText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 8,
  },

  // Link buttons
  linkBtn: {
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Secondary action button
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Close bar (bottom)
  closeBar: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    width: '100%',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // Purchasing overlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  overlayCard: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    minWidth: 200,
  },
  overlayText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
});

export default RevenueCatPaywall;
