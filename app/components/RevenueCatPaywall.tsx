import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Linking, useWindowDimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePurchase } from '../contexts/RevenueCatContext';

interface RevenueCatPaywallProps {
  onClose?: () => void;
}

const RevenueCatPaywall: React.FC<RevenueCatPaywallProps> = ({ onClose }) => {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = Math.min(width, height) <= 360 || height <= 700;
  const { loading, packages, products, isPurchasing, customerInfo, purchase, purchaseProductById, fetchOfferings, restorePurchases, fetchProducts } = usePurchase();

  // Check if user has active entitlements
  const hasActiveEntitlements = customerInfo?.entitlements.active && Object.keys(customerInfo.entitlements.active).length > 0;
  const isIOS = Platform.OS === 'ios';
  const isAndroid = Platform.OS === 'android';
  const isMobile = isIOS || isAndroid;

  // Show fallback for non-mobile platforms (web, etc.)
  if (!isMobile) {
    return (
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🤝</Text>
          <Text style={styles.title}>Support Our App</Text>
          <Text style={styles.subtitle}>Free forever. Optional support helps us grow.</Text>
        </View>
        <Text style={styles.info}>In-app purchases are only available on mobile devices.</Text>
        <Text style={styles.disclaimer}>
          The app will remain free forever. Support is optional and helps cover the yearly developer fees and future improvements.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://sites.google.com/view/privacy-policy-athan-app?usp=sharing')}
          style={styles.policyWrapper}
          activeOpacity={0.7}
        >
          <Text style={styles.policyLink}>Terms & Privacy Policy</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Not now</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loadingText}>Loading purchase options...</Text>
      </View>
    );
  }

  if (packages.length === 0 && products.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Support Our App</Text>
        <Text style={styles.info}>
          No purchase options available at the moment.{'\n'}
          Please make sure you have configured offerings in your RevenueCat dashboard.
        </Text>
        <TouchableOpacity 
          style={styles.packageButton} 
          onPress={() => { fetchOfferings(); fetchProducts(); }}
        >
          <Text style={styles.packageTitle}>Retry Loading</Text>
        </TouchableOpacity>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🤲</Text>
        <Text style={styles.title}>Support Our Prayer App</Text>
        <Text style={styles.subtitle}>Free forever. Optional support keeps it thriving.</Text>
      </View>
      <Text style={styles.disclaimer}>
        The app will remain free forever. Support is completely optional and helps cover the yearly developer account fees and further app improvements.
      </Text>

      {hasActiveEntitlements && (
        <Text style={styles.successBadge}>
          ✅ Thank you for your support! You are awesome! 🙏
        </Text>
      )}

      {/* Subscription/packaged products from current offering */}
    {packages.map((packageItem) => (
        <TouchableOpacity
          key={packageItem.identifier}
      style={[styles.packageButton, isSmallPhone && styles.packageButtonSmall, isPurchasing && styles.packageButtonDisabled]}
      disabled={isPurchasing}
          onPress={() => purchase(packageItem)}
          activeOpacity={0.9}
        >
          <Text style={[styles.packageTitle, isSmallPhone && styles.packageTitleSmall]}>
            {packageItem.product.title || packageItem.identifier}
          </Text>
          <Text style={[styles.packagePrice, isSmallPhone && styles.packagePriceSmall]}>
            {packageItem.product.priceString}
          </Text>
          {!!packageItem.product.description && (
            <Text style={[styles.packageDescription, isSmallPhone && styles.packageDescriptionSmall]}>
              {packageItem.product.description}
            </Text>
          )}
        </TouchableOpacity>
      ))}

      {/* One-time support products fetched by ID */}
    {products.map((p) => (
        <TouchableOpacity
          key={p.identifier}
      style={[styles.packageButton, isSmallPhone && styles.packageButtonSmall, isPurchasing && styles.packageButtonDisabled]}
      disabled={isPurchasing}
          onPress={() => purchaseProductById(p.identifier)}
          activeOpacity={0.9}
        >
          <Text style={[styles.packageTitle, isSmallPhone && styles.packageTitleSmall]}>
            {p.title || p.identifier}
          </Text>
          <Text style={[styles.packagePrice, isSmallPhone && styles.packagePriceSmall]}>
            {p.priceString}
          </Text>
          {!!p.description && (
            <Text style={[styles.packageDescription, isSmallPhone && styles.packageDescriptionSmall]}>
              {p.description}
            </Text>
          )}
        </TouchableOpacity>
      ))}

      <Text style={styles.footer}>
        Purchases are handled securely by {isIOS ? 'Apple' : 'Google Play'}. Thank you for your support! 🙏
      </Text>

      <TouchableOpacity
  onPress={restorePurchases}
        style={styles.restoreButton}
        activeOpacity={0.8}
      >
        <Text style={styles.restoreText}>Restore Purchases</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => Linking.openURL('https://sites.google.com/view/privacy-policy-athan-app?usp=sharing')}
        style={styles.policyWrapper}
        activeOpacity={0.7}
      >
        <Text style={styles.policyLink}>Terms & Privacy Policy</Text>
      </TouchableOpacity>

      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeText}>Not now</Text>
        </TouchableOpacity>
      )}

      </ScrollView>
      {isPurchasing && (
        <View style={styles.overlay} pointerEvents="auto">
          <View style={styles.overlayCard}>
            <ActivityIndicator size="large" color="#FFD700" />
            <Text style={styles.overlayText}>Preparing purchase…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: 16,
    flex: 1,
  justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  hero: {
    alignItems: 'center',
  marginBottom: 12,
  },
  heroEmoji: {
  fontSize: 36,
  marginBottom: 6,
  },
  title: {
  fontSize: 22,
    fontWeight: 'bold',
  marginBottom: 10,
    color: '#FFD700',
    textAlign: 'center',
  },
  subtitle: {
  fontSize: 14,
  marginBottom: 16,
    color: '#cfcfcf',
    textAlign: 'center',
  },
  loadingText: {
  marginTop: 12,
    color: '#ccc',
    textAlign: 'center',
  },
  info: {
  fontSize: 12,
    color: '#999',
    textAlign: 'center',
  marginBottom: 14,
  lineHeight: 18,
  },
  disclaimer: {
  fontSize: 12,
    color: '#b9b9b9',
    textAlign: 'center',
  marginBottom: 14,
  lineHeight: 16,
  },
  packageButton: {
    backgroundColor: 'rgba(18,18,18,0.95)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  packageButtonSmall: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  packageTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 2,
  },
  packageTitleSmall: {
    fontSize: 13,
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  packagePriceSmall: {
    fontSize: 16,
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 11,
    color: '#dddddd',
    lineHeight: 14,
  },
  packageDescriptionSmall: {
    fontSize: 11,
    lineHeight: 14,
  },
  footer: {
  marginTop: 16,
  fontSize: 11,
    color: '#aaaaaa',
    textAlign: 'center',
  lineHeight: 14,
  },
  restoreButton: {
  marginTop: 10,
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4da3ff',
  },
  restoreText: {
    color: '#4da3ff',
  fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  policyWrapper: {
  marginTop: 10,
  },
  packageButtonDisabled: {
    opacity: 0.5,
  },
  policyLink: {
  fontSize: 12,
    color: '#4da3ff',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  closeButton: {
  marginTop: 12,
  padding: 10,
  },
  closeText: {
    color: '#FFD700',
  fontSize: 14,
    fontWeight: '500',
  },
  successBadge: {
  backgroundColor: 'rgba(42,127,42,0.9)',
  color: '#fff',
  padding: 10,
  borderRadius: 6,
  marginBottom: 12,
  textAlign: 'center',
  fontSize: 12,
  fontWeight: 'bold',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  overlayCard: {
    backgroundColor: 'rgba(18,18,18,0.98)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignItems: 'center',
    minWidth: 200,
  },
  overlayText: {
    marginTop: 10,
    color: '#eaeaea',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default RevenueCatPaywall;
