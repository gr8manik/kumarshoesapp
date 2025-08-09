// --- File: screens/StockMatchingScreen.js ---
// This version fixes the "missing camera" layout bug AND restores the correct workflow.
// MODIFIED: Added Code 39 scanning capability.

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, Button, FlatList, Keyboard, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAppContext } from '../App';
import { Audio } from 'expo-av';

export default function StockMatchingScreen({ route, navigation }) {
  const { rackNumber } = route.params;
  const { stockData, addScannedItem, scanData, updateRackItems } = useAppContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualBarcode, setManualBarcode] = useState('');
  const [sound, setSound] = useState();
  const [isScanningPaused, setScanningPaused] = useState(false);
  
  const scannedItems = scanData[rackNumber] || [];

  // This is all your stable, working logic. It is unchanged.
  useEffect(() => {
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(require('../assets/beep.mp3'));
        setSound(sound);
      } catch (error) { console.log("Error loading sound file:", error); }
    };
    loadSound();
    return () => { sound && sound.unloadAsync(); };
  }, []);

  const processBarcode = (barcode) => {
    if (!barcode) return;
    setScanningPaused(true);
    let itemData = { barcode, name: 'Unknown Item', description: 'Scanned barcode not in master list.' };
    if (stockData[barcode]) { itemData = { ...stockData[barcode], barcode }; }
    addScannedItem(rackNumber, itemData);
    sound?.replayAsync().catch(e => console.log("Error playing sound:", e));
    setTimeout(() => setScanningPaused(false), 1500);
  };

  const handleManualAdd = () => { processBarcode(manualBarcode.trim()); setManualBarcode(''); Keyboard.dismiss(); };
  const handleBarcodeScanned = ({ data }) => { if (!isScanningPaused) { processBarcode(data); } };
  const handleDeleteItem = (indexToDelete) => {
    const currentItems = [...scannedItems].reverse();
    currentItems.splice(indexToDelete, 1);
    updateRackItems(rackNumber, currentItems.reverse());
  };
  
  if (!permission) return <View />;
  if (!permission.granted) { return ( <View style={styles.centerContainer}><Text style={styles.centerText}>We need camera permission</Text><Button onPress={requestPermission} title="Grant Permission" /></View> ); }

  // --- This is the corrected JSX with the layout fix ---
  return (
    <View style={styles.container}>
      {/* This CameraView will now be visible */}
      <CameraView 
        style={styles.camera} // This style now has flex: 1
        onBarcodeScanned={handleBarcodeScanned} 
        // --- THIS IS THE ONLY CHANGE ---
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "qr", "code128", "code39"] }} 
      />
      {isScanningPaused && <View style={styles.cooldownOverlay}><Text style={styles.cooldownText}>PAUSED</Text></View>}
      
      {/* This container for controls will also be visible */}
      <View style={styles.bottomContainer}> 
        <View style={styles.manualEntry}>
          <TextInput style={styles.input} placeholder="Manual Barcode Entry" value={manualBarcode} onChangeText={setManualBarcode} onSubmitEditing={handleManualAdd} />
          <Button title="Add" onPress={handleManualAdd} disabled={!manualBarcode.trim()} />
        </View>

        <Text style={styles.listHeader}>Scanned Items ({scannedItems.length})</Text>
        <FlatList
          data={[...scannedItems].reverse()}
          keyExtractor={(item, index) => `${item.barcode}-${index}`}
          renderItem={({ item, index }) => (
            <View style={styles.listItem}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemBarcode}>{item.barcode}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteItem(index)} style={styles.deleteButton}>
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.emptyListText}>Scan an item to begin...</Text>}
        />
        
        {/* WORKFLOW FIX: This button now correctly goes back to the list */}
        <View style={styles.footer}>
            <Button title="Finish Scanning" onPress={() => navigation.goBack()} color="#28a745" />
        </View>
      </View>
    </View>
  );
}

// --- These are the corrected styles that fix the layout bug ---
const styles = StyleSheet.create({
  // LAYOUT FIX: The main container must have flex: 1
  container: { flex: 1, backgroundColor: 'black' },
  // LAYOUT FIX: The camera must have flex: 1 to take up its share of the space
  camera: { flex: 1 },
  // LAYOUT FIX: The bottom container must also have flex: 1 to take up its share
  bottomContainer: { flex: 1, backgroundColor: '#f5f5f5', padding: 10, borderTopLeftRadius: 10, borderTopRightRadius: 10 },
  
  // The rest of your stable styles are unchanged
  cooldownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 0, 0.3)', justifyContent: 'center', alignItems: 'center' },
  cooldownText: { color: 'white', fontSize: 24, fontWeight: 'bold', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 5 },
  manualEntry: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { flex: 1, height: 40, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, backgroundColor: 'white', marginRight: 10 },
  listHeader: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  listItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', padding: 10, borderRadius: 5, marginVertical: 4, elevation: 1 },
  itemInfo: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 16, fontWeight: '500' },
  itemBarcode: { fontSize: 12, color: '#666' },
  deleteButton: { backgroundColor: '#D9534F', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 5 },
  deleteButtonText: { color: 'white', fontWeight: 'bold' },
  emptyListText: { textAlign: 'center', color: '#888', marginTop: 20 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerText: { fontSize: 18 },
  footer: { paddingTop: 10, marginTop: 5, borderTopWidth: 1, borderTopColor: '#ccc' }
});