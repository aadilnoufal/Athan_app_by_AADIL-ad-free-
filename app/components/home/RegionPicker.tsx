/**
 * RegionPicker — Modal for selecting a prayer time region.
 * Extracted from index.tsx to reduce the Home screen file size.
 */
import React, { Dispatch, SetStateAction } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SepiaColors } from '../../../constants/sepiaColors';
import type { HomeStyles } from './homeTypes';
import type { RegionItem } from './homeTypes';

export interface RegionPickerProps {
    styles: HomeStyles;
    /** Translation function */
    t: (key: string, params?: any) => string;
    /** Whether the picker modal is visible */
    showRegionPicker: boolean;
    /** Setter for showRegionPicker */
    setShowRegionPicker: Dispatch<SetStateAction<boolean>>;
    /** Toggle function (with debounce lock) */
    toggleModal: (setter: Dispatch<SetStateAction<boolean>>) => void;
    /** Available regions list */
    availableRegions: RegionItem[];
    /** Currently selected region ID */
    regionId: string;
    /** Callback to change region */
    changeRegion: (newRegionId: string) => Promise<void>;
}

export const RegionPicker = ({
    styles,
    t,
    showRegionPicker,
    setShowRegionPicker,
    toggleModal,
    availableRegions,
    regionId,
    changeRegion,
}: RegionPickerProps) => (
    <Modal
        transparent={true}
        visible={showRegionPicker}
        animationType="fade"
        onRequestClose={() => toggleModal(setShowRegionPicker)}
    >
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{t('selectRegion')}</Text>
                    <TouchableOpacity onPress={() => toggleModal(setShowRegionPicker)}>
                        <MaterialCommunityIcons name="close" size={24} color={SepiaColors.text.primary} />
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={availableRegions}
                    keyExtractor={(item: RegionItem) => item.id}
                    renderItem={({ item }: { item: RegionItem }) => (
                        <TouchableOpacity
                            style={[
                                styles.regionItem,
                                regionId === item.id && styles.selectedRegionItem,
                            ]}
                            onPress={() => changeRegion(item.id)}
                        >
                            <Text
                                style={[
                                    styles.regionName,
                                    regionId === item.id && styles.selectedRegionName,
                                ]}
                            >
                                {item.name}
                            </Text>
                            {regionId === item.id && (
                                <MaterialCommunityIcons name="check" size={20} color={SepiaColors.accent.gold} />
                            )}
                        </TouchableOpacity>
                    )}
                />
            </View>
        </View>
    </Modal>
);
