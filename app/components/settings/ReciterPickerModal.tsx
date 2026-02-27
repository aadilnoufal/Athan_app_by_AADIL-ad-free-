import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { goldTint } from '../../../utils/colorHelpers';

interface AudioEdition {
  identifier: string;
  name: string;
  englishName?: string;
  [key: string]: any;
}

interface ReciterPickerModalProps {
  visible: boolean;
  colors: any;
  t: (key: string) => string;
  audioEditions: AudioEdition[];
  quranReciter: string;
  handleReciterChange: (identifier: string) => void;
  onClose: () => void;
}

/**
 * Bottom-sheet–style modal for selecting a Quran audio reciter.
 */
export const ReciterPickerModal: React.FC<ReciterPickerModalProps> = ({
  visible,
  colors: C,
  t,
  audioEditions,
  quranReciter,
  handleReciterChange,
  onClose,
}) => {
  const gt = (alpha: number) => goldTint(alpha, C);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.background.primary, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 30 }}>
          {/* Modal header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: gt(0.15) }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: C.text.primary }}>{t('selectReciter')}</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={22} color={C.text.tertiary} />
            </TouchableOpacity>
          </View>
          {/* Reciter list */}
          <FlatList
            data={audioEditions}
            keyExtractor={(item) => item.identifier}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleReciterChange(item.identifier)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: gt(0.08) }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: C.text.primary }}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: C.text.secondary, marginTop: 2 }}>{item.englishName}</Text>
                </View>
                {quranReciter === item.identifier && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={C.accent.gold} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: 20 }}>
                <ActivityIndicator size="small" color={C.accent.gold} />
                <Text style={{ color: C.text.secondary, fontSize: 14, marginTop: 8 }}>{t('loading')}</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};
