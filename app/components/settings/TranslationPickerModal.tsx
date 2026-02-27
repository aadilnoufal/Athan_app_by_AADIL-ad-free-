import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { goldTint } from '../../../utils/colorHelpers';

interface TranslationEdition {
  identifier: string;
  name: string;
  language: string;
  [key: string]: any;
}

interface TranslationPickerModalProps {
  visible: boolean;
  colors: any;
  isDark: boolean;
  t: (key: string) => string;
  editionSearchQuery: string;
  setEditionSearchQuery: (query: string) => void;
  filteredTranslations: TranslationEdition[];
  quranTranslationEdition: string;
  handleTranslationEditionChange: (identifier: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet–style modal for selecting a Quran translation edition.
 * Includes a search bar and a scrollable list of editions grouped by language.
 */
export const TranslationPickerModal: React.FC<TranslationPickerModalProps> = ({
  visible,
  colors: C,
  isDark,
  t,
  editionSearchQuery,
  setEditionSearchQuery,
  filteredTranslations,
  quranTranslationEdition,
  handleTranslationEditionChange,
  onClose,
}) => {
  const gt = (alpha: number) => goldTint(alpha, C);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 30 }}>
          {/* Modal header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: gt(0.15) }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectTranslation')}</Text>
            <TouchableOpacity onPress={() => { onClose(); setEditionSearchQuery(''); }}>
              <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
            </TouchableOpacity>
          </View>
          {/* Search input */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', borderWidth: 0.5, borderColor: gt(0.15) }}>
            <MaterialCommunityIcons name="magnify" size={18} color={C.text.tertiary} />
            <TextInput
              style={{ flex: 1, marginLeft: 8, fontSize: 14, color: C.text.primary, paddingVertical: 0 }}
              placeholder={t('searchTranslations')}
              placeholderTextColor={C.text.tertiary}
              value={editionSearchQuery}
              onChangeText={setEditionSearchQuery}
              autoCorrect={false}
            />
          </View>
          {/* Edition list */}
          <FlatList
            data={filteredTranslations}
            keyExtractor={(item) => item.identifier}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleTranslationEditionChange(item.identifier)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: gt(0.08) }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.language} · {item.identifier}</Text>
                </View>
                {quranTranslationEdition === item.identifier && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 20 }}>
                <Text style={{ color: C.text.secondary, fontSize: 14 }}>{t('noTranslationsFound')}</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};
