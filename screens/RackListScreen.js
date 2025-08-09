import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator, Pressable, Button, SafeAreaView } from 'react-native';
import { useAppContext } from '../App';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export default function RackListScreen({ navigation }) {
  const { scanData, stockData, deleteRack, renameRack } = useAppContext();
  const [newRackId, setNewRackId] = useState('');
  const [isModalVisible, setModalVisible] = useState(false);
  const [rackToEdit, setRackToEdit] = useState(null);
  const [editedRackName, setEditedRackName] = useState('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);

  const rackKeys = Object.keys(scanData || {});

  const handleStartScan = () => {
    const trimmedRack = newRackId.trim().toUpperCase();
    if (!trimmedRack) {
      Alert.alert('Invalid Rack ID', 'Please enter a valid rack ID.');
      return;
    }
    navigation.navigate('Scan', { rackId: trimmedRack });
    setNewRackId('');
  };

  const handleDelete = (rack) => {
    Alert.alert('Delete Rack', `Are you sure you want to permanently delete rack "${rack}"?`, [ { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteRack(rack) } ]);
  };

  const openRenameModal = (rack) => {
    setRackToEdit(rack);
    setEditedRackName(rack);
    setModalVisible(true);
  };

  const handleRename = () => {
    const success = renameRack(rackToEdit, editedRackName.trim().toUpperCase());
    if (!success) { Alert.alert('Error', 'New rack name is invalid or already exists.'); }
    setModalVisible(false);
    setRackToEdit(null);
  };

  const handleExportToExcel = async () => {
    if (isExportingExcel) return;
    setIsExportingExcel(true);
    try {
      const masterStockArray = Object.entries(stockData).map(([barcode, item]) => ({ Barcode: barcode, Name: item.name, Size: item.size, Rack: item.Rack, ExpectedQty: item.expectedQty, }));
      const storeWideScannedItems = {};
      Object.values(scanData).forEach(rackItems => { Object.entries(rackItems).forEach(([barcode, details]) => { storeWideScannedItems[barcode] = (storeWideScannedItems[barcode] || 0) + details.quantity; }); });
      const scannedDataArray = Object.entries(storeWideScannedItems).map(([barcode, quantity]) => ({ Barcode: barcode, Name: stockData[barcode]?.name || 'Unknown Item', ScannedQty: quantity, }));
      const comparisonData = [];
      const tempStockData = { ...stockData };
      for (const barcode in storeWideScannedItems) {
        const scannedQty = storeWideScannedItems[barcode];
        const masterItem = tempStockData[barcode];
        if (masterItem) {
          const expectedQty = masterItem.expectedQty || 0;
          let status = 'MATCHED'; if (scannedQty > expectedQty) status = 'EXTRA'; if (scannedQty < expectedQty) status = 'MISMATCHED';
          comparisonData.push({ Status: status, Barcode: barcode, Name: masterItem.name, Rack: masterItem.Rack, ExpectedQty: expectedQty, ScannedQty: scannedQty, Difference: scannedQty - expectedQty, });
          delete tempStockData[barcode];
        } else {
          comparisonData.push({ Status: 'UNLISTED', Barcode: barcode, Name: 'Unknown Item', Rack: 'N/A', ExpectedQty: 0, ScannedQty: scannedQty, Difference: scannedQty, });
        }
      }
      Object.values(tempStockData).forEach(item => { if(item.barcode) { comparisonData.push({ Status: 'MISSING', Barcode: item.barcode, Name: item.name, Rack: item.Rack, ExpectedQty: item.expectedQty, ScannedQty: 0, Difference: -item.expectedQty, }); } });
      const wb = XLSX.utils.book_new();
      const wsMaster = XLSX.utils.json_to_sheet(masterStockArray);
      const wsScanned = XLSX.utils.json_to_sheet(scannedDataArray);
      const wsComparison = XLSX.utils.json_to_sheet(comparisonData);
      XLSX.utils.book_append_sheet(wb, wsMaster, "Master Stock"); XLSX.utils.book_append_sheet(wb, wsScanned, "Scanned Data"); XLSX.utils.book_append_sheet(wb, wsComparison, "Comparison Report");
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const date = new Date().toISOString().split('T')[0];
      const filename = `Store-Report-${date}.xlsx`;
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', dialogTitle: 'Share Full Excel Report' });
    } catch (error) {
      console.error("Excel Export Error:", error);
      Alert.alert("Export Failed", "An error occurred while creating the Excel file.");
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleGenerateStoreWideReport = () => {
    if (rackKeys.length === 0) { Alert.alert('No Data', 'You must scan at least one rack to generate a report.'); return; }
    if (isGeneratingReport) return;
    setIsGeneratingReport(true);
    setTimeout(() => {
      try {
        const storeWideScannedItems = {};
        Object.entries(scanData).forEach(([rack, rackItems]) => {
          Object.entries(rackItems).forEach(([barcode, details]) => {
            if (!storeWideScannedItems[barcode]) { storeWideScannedItems[barcode] = { ...details, quantity: 0, foundInRacks: [] }; }
            storeWideScannedItems[barcode].quantity += details.quantity;
            storeWideScannedItems[barcode].foundInRacks.push(rack);
          });
        });
        navigation.navigate('Report', { scannedItems: storeWideScannedItems, rackId: 'STORE-WIDE' });
      } catch (error) {
        console.error("Report Generation Error:", error);
        Alert.alert("Error", "An unexpected error occurred while generating the report.");
      } finally {
        setIsGeneratingReport(false);
      }
    }, 100);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Modal visible={isModalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={{fontSize: 18, fontWeight: 'bold'}}>Rename Rack '{rackToEdit}'</Text>
            <TextInput style={[styles.input, {marginTop: 20}]} value={editedRackName} onChangeText={setEditedRackName} autoCapitalize="characters" />
            <View style={{flexDirection: 'row', justifyContent: 'space-around', marginTop: 20}}>
                <Button title="Cancel" onPress={() => setModalVisible(false)} color="#666" />
                <Button title="Save" onPress={handleRename} />
            </View>
          </View>
        </View>
      </Modal>
      
      <View style={styles.newRackSection}>
        <TextInput style={styles.input} placeholder="Enter New or Existing Rack ID" value={newRackId} onChangeText={setNewRackId} autoCapitalize="characters" />
        <TouchableOpacity style={styles.addButton} onPress={handleStartScan}>
          <Text style={styles.actionText}>Scan Items for Rack</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.header}>Existing Racks (Tap to Manage)</Text>
      <FlatList
        data={rackKeys.sort()}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const totalItems = Object.values(scanData[item] || {}).reduce((sum, details) => sum + details.quantity, 0);
          return (
            <View style={styles.rackItemContainer}>
              <TouchableOpacity style={styles.rackButton} onPress={() => navigation.navigate('RackDetail', { rackId: item })}>
                <Text style={styles.rackButtonText}>{item}</Text>
                <Text style={styles.rackButtonSubText}>{totalItems} items scanned</Text>
              </TouchableOpacity>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.editButton} onPress={() => openRenameModal(item)}><Text style={styles.actionText}>Rename</Text></TouchableOpacity>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}><Text style={styles.actionText}>Delete</Text></TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={ <View style={styles.emptyListContainer}><Text style={styles.emptyText}>No racks have been scanned yet.</Text></View> }
      />
      
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.footerButton, (rackKeys.length === 0 || isGeneratingReport) && styles.footerButtonDisabled]}
          onPress={handleGenerateStoreWideReport} 
          disabled={rackKeys.length === 0 || isGeneratingReport}
        >
          {isGeneratingReport ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerButtonText}>Generate In-App Report</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.excelButton, (rackKeys.length === 0 || isExportingExcel || !stockData) && styles.footerButtonDisabled]}
          onPress={handleExportToExcel} 
          disabled={rackKeys.length === 0 || isExportingExcel || !stockData}
        >
          {isExportingExcel ? <ActivityIndicator color="#fff" /> : <Text style={styles.footerButtonText}>Export Full Excel Report</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    newRackSection: { margin: 15, backgroundColor: 'white', padding: 15, borderRadius: 8, elevation: 2 },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, marginLeft: 15 },
    input: { height: 50, borderColor: 'ccc', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 16, marginBottom: 15 },
    addButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center' },
    rackItemContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 5, marginHorizontal: 15 },
    rackButton: { backgroundColor: 'white', borderWidth: 1, borderColor: '#ddd', padding: 15, borderRadius: 8, flex: 1 },
    rackButtonText: { color: '#333', fontSize: 18, fontWeight: 'bold' },
    rackButtonSubText: { color: '#666', fontSize: 14 },
    actionButtons: { flexDirection: 'row', marginLeft: 10 },
    editButton: { backgroundColor: '#F0AD4E', padding: 12, borderRadius: 8, justifyContent: 'center' },
    deleteButton: { backgroundColor: '#D9534F', padding: 12, borderRadius: 8, justifyContent: 'center' },
    actionText: { color: 'white', fontWeight: 'bold' },
    emptyListContainer: { marginTop: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', color: '#666', fontSize: 16 },
    modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    modalContent: { width: '80%', backgroundColor: 'white', padding: 20, borderRadius: 10, elevation: 5 },
    footer: { padding: 15, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: '#f5f5f5' },
    footerButton: { backgroundColor: '#5bc0de', paddingVertical: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
    excelButton: { backgroundColor: '#28a745', paddingVertical: 15, borderRadius: 8, alignItems: 'center' },
    footerButtonDisabled: { backgroundColor: '#9c9c9c' },
    footerButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});