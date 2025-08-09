import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  Keyboard, 
  Button, 
  Alert, 
  FlatList, 
  SafeAreaView, 
  TouchableOpacity, 
  Modal,
  ActivityIndicator,
  Platform
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useAppContext } from '../App';

const ScanScreen = ({ route, navigation }) => {
  const { rackId } = route.params;
  const { scanData, stockData, updateRackScans } = useAppContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningPaused, setIsScanningPaused] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  
  const soundObject = useRef(null);
  const flatListRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  const currentScannedItems = useMemo(() => scanData[rackId] || {}, [scanData, rackId]);

  const scannedItemsArray = useMemo(() => 
    Object.values(currentScannedItems).sort((a, b) => (b.lastScannedAt || 0) - (a.lastScannedAt || 0)),
    [currentScannedItems]
  );

  useEffect(() => {
    let isMounted = true;
    
    const initSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../assets/beep.mp3'),
          { shouldPlay: false }
        );
        if (isMounted) {
          soundObject.current = sound;
        }
      } catch (error) {
        console.error('Error loading sound:', error);
      }
    };

    initSound();

    return () => {
      isMounted = false;
      if (soundObject.current) {
        soundObject.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const playBeep = useCallback(async () => {
    try {
      if (soundObject.current) {
        await soundObject.current.replayAsync();
      }
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, []);

  const processBarcode = useCallback((barcode) => {
    if (!barcode || isScanningPaused) return;
    
    const trimmedBarcode = barcode.trim();
    if (!trimmedBarcode) return;

    // --- MODIFIED: Replaced validation with a specific Regex ---
    const isValidFormat = /^[tT]\d{5}$/.test(trimmedBarcode);
    
    if (!isValidFormat) {
      setFeedbackMessage('Invalid: Format must be T + 5 digits (e.g., T12345)');
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => setFeedbackMessage(null), 2500); // Longer timeout for more complex message
      return; 
    }
    // --- END MODIFICATION ---

    setFeedbackMessage(null);
    
    if (!stockData) {
      Alert.alert(
        'Error',
        'Master stock data not loaded. Please sync from the home screen.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    setIsScanningPaused(true);
    playBeep();

    try {
      const newItems = { ...currentScannedItems };
      const currentItem = newItems[trimmedBarcode];
      const newCount = (currentItem?.quantity || 0) + 1;
      const shoeInfo = stockData[trimmedBarcode] || { name: `Unknown: ${trimmedBarcode}` };
      
      newItems[trimmedBarcode] = { 
        barcode: trimmedBarcode, 
        name: shoeInfo.name,
        quantity: newCount,
        lastScannedAt: Date.now()
      };
      
      updateRackScans(rackId, newItems);
      setLastScanned(newItems[trimmedBarcode]);
      
      if (flatListRef.current && scannedItemsArray.length > 0) {
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      Alert.alert('Error', 'Failed to process barcode. Please try again.');
    }
    
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => setIsScanningPaused(false), 800);

  }, [isScanningPaused, stockData, currentScannedItems, rackId, updateRackScans, playBeep, navigation, scannedItemsArray.length]);

  const handleBarcodeScanned = useCallback(({ data }) => {
    if (data && typeof data === 'string') {
      processBarcode(data);
    }
  }, [processBarcode]);

  const handleManualAdd = useCallback(() => {
    const trimmedBarcode = manualBarcode.trim();
    if (trimmedBarcode) {
      processBarcode(trimmedBarcode);
      setManualBarcode('');
      Keyboard.dismiss();
    }
  }, [manualBarcode, processBarcode]);

  const handleDelete = useCallback((barcode) => {
    const item = currentScannedItems[barcode];
    if (!item) return;

    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item.name}" from this rack?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            try {
              const newItems = { ...currentScannedItems };
              delete newItems[barcode];
              updateRackScans(rackId, newItems);
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item. Please try again.');
            }
          }
        }
      ]
    );
  }, [currentScannedItems, rackId, updateRackScans]);

  const openEditModal = useCallback((item) => {
    setItemToEdit(item);
    setEditQuantity(item.quantity.toString());
    setEditModalVisible(true);
  }, []);

  const handleEditSave = useCallback(() => {
    const newQty = parseInt(editQuantity, 10);
    if (isNaN(newQty) || newQty < 1) {
      Alert.alert('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    
    if (!itemToEdit) return;

    try {
      const newItems = { ...currentScannedItems };
      if (newItems[itemToEdit.barcode]) {
        newItems[itemToEdit.barcode].quantity = newQty;
        newItems[itemToEdit.barcode].lastScannedAt = Date.now();
        updateRackScans(rackId, newItems);
      }
      setEditModalVisible(false);
      setItemToEdit(null);
      setEditQuantity('');
    } catch (error) {
      console.error('Error updating quantity:', error);
      Alert.alert('Error', 'Failed to update quantity. Please try again.');
    }
  }, [editQuantity, itemToEdit, currentScannedItems, rackId, updateRackScans]);

  const renderScannedItem = useCallback(({ item }) => (
    <View style={styles.scannedItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemBarcode}>{item.barcode}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => openEditModal(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => handleDelete(item.barcode)}
          activeOpacity={0.7}
        >
          <Text style={styles.actionButtonText}>Del</Text>
        </TouchableOpacity>
        <View style={styles.quantityBadge}>
          <Text style={styles.quantityText}>{item.quantity}</Text>
        </View>
      </View>
    </View>
  ), [openEditModal, handleDelete]);

  const keyExtractor = useCallback((item) => item.barcode, []);

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>Camera permission is required to scan barcodes.</Text>
        <Button title="Grant Permission" onPress={requestPermission} />
      </View>
    );
  }

  const totalItems = scannedItemsArray.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <SafeAreaView style={styles.container}>
      <Modal
        visible={editModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <Pressable 
          style={styles.modalContainer}
          onPress={() => setEditModalVisible(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Edit Quantity</Text>
            <Text style={styles.modalItemName} numberOfLines={2}>{itemToEdit?.name}</Text>
            <TextInput
              style={styles.modalInput}
              value={editQuantity}
              onChangeText={setEditQuantity}
              keyboardType="numeric"
              placeholder="Enter quantity"
              selectTextOnFocus
              maxLength={5}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={handleEditSave}
              >
                <Text style={styles.modalButtonText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.cameraContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={isScanningPaused ? undefined : handleBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ["code39"] }}
        />
        <View style={styles.cameraOverlay}>
          <View style={styles.topOverlay}>
            <Text style={styles.scanInstruction}>Scanning for Rack: {rackId}</Text>
            <Text style={styles.scanSubInstruction}>Code 39 Only</Text>
            
            {feedbackMessage && (
                <View style={styles.feedbackBox}>
                    <Text style={styles.feedbackText}>{feedbackMessage}</Text>
                </View>
            )}
            {isScanningPaused && lastScanned && !feedbackMessage && (
              <View style={styles.lastScannedBox}>
                <Text style={styles.lastScannedText} numberOfLines={1}>✓ {lastScanned.name}</Text>
                <Text style={styles.lastScannedQty}>Count: {lastScanned.quantity}</Text>
              </View>
            )}
            
          </View>
          <View style={styles.viewfinder} />
        </View>
      </View>
      
      <View style={styles.bottomSection}>
        <View style={styles.manualEntryContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Enter Barcode Manually" 
            placeholderTextColor="#999" 
            value={manualBarcode} 
            onChangeText={setManualBarcode} 
            onSubmitEditing={handleManualAdd}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Pressable 
            style={[styles.addButton, !manualBarcode.trim() && styles.addButtonDisabled]} 
            onPress={handleManualAdd}
            disabled={!manualBarcode.trim()}
          >
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
        
        <View style={styles.listHeader}>
          <Text style={styles.listHeaderText}>Scanned Items ({totalItems} total)</Text>
          <Pressable style={styles.doneButton} onPress={() => navigation.goBack()}>
            <Text style={styles.doneButtonText}>Done</Text>
          </Pressable>
        </View>
        
        <FlatList
          ref={flatListRef}
          data={scannedItemsArray}
          keyExtractor={keyExtractor}
          renderItem={renderScannedItem}
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={10}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No items scanned yet</Text>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: 'black' 
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'black' 
  },
  permissionText: {
    color: 'white',
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraOverlay: { 
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20 
  },
  topOverlay: { 
    width: '100%', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.7)', 
    padding: 15, 
    borderRadius: 10, 
    marginTop: 10 
  },
  scanInstruction: { 
    color: 'white', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  scanSubInstruction: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 2,
  },
  lastScannedBox: { 
    marginTop: 10, 
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#28a745', 
    borderRadius: 5, 
    width: '100%', 
    alignItems: 'center' 
  },
  lastScannedText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  lastScannedQty: { 
    color: 'white', 
    fontSize: 14,
    marginTop: 2
  },
  feedbackBox: { 
    marginTop: 10, 
    paddingVertical: 8,
    paddingHorizontal: 12, 
    backgroundColor: '#D9534F',
    borderRadius: 5, 
    width: '100%', 
    alignItems: 'center' 
  },
  feedbackText: { 
      color: 'white', 
      fontSize: 15, 
      fontWeight: 'bold',
      textAlign: 'center'
  },
  viewfinder: { 
    width: '85%', 
    height: '35%', 
    borderWidth: 2, 
    borderColor: 'rgba(255, 255, 255, 0.5)', 
    borderRadius: 10,
  },
  bottomSection: {
    backgroundColor: '#f5f5f5',
    maxHeight: '45%',
    minHeight: '35%',
  },
  manualEntryContainer: { 
    flexDirection: 'row', 
    backgroundColor: 'white',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  input: { 
    flex: 1, 
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10, 
    fontSize: 16 
  },
  addButton: { 
    backgroundColor: '#007BFF', 
    paddingHorizontal: 20, 
    justifyContent: 'center', 
    borderRadius: 8 
  },
  addButtonDisabled: {
    backgroundColor: '#ccc',
  },
  addButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  doneButton: { 
    backgroundColor: '#28a745', 
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  doneButtonText: { 
    color: 'white', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  listContent: {
    paddingBottom: 10,
  },
  scannedItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    marginHorizontal: 10,
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  itemBarcode: {
    fontSize: 13,
    color: '#666',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#F0AD4E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 6,
  },
  deleteButton: {
    backgroundColor: '#D9534F',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 10,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  quantityBadge: {
    backgroundColor: '#007BFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  quantityText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    marginTop: 50,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalItemName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#6c757d',
    marginRight: 10,
  },
  saveButton: {
    backgroundColor: '#28a745',
    marginLeft: 10,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ScanScreen;