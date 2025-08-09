import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Pressable } from 'react-native';
import { useAppContext } from '../App';

export default function RackDetailScreen({ route, navigation }) {
  const { rackId } = route.params;
  // --- FIX: Get both stockData and scanData from context ---
  const { scanData, stockData, updateRackScans } = useAppContext();
  
  const scannedItems = scanData[rackId] || {};
  const scannedItemsArray = Object.values(scannedItems);
  const isDataReadyForReport = scannedItemsArray.length > 0 && !!stockData;

  const handleQuantityChange = (barcode, change) => {
    const newItems = { ...scannedItems };
    if (!newItems[barcode]) return;
    const newQuantity = newItems[barcode].quantity + change;

    if (newQuantity > 0) {
      newItems[barcode].quantity = newQuantity;
    } else {
      delete newItems[barcode];
    }
    updateRackScans(rackId, newItems);
  };

  const handleRemoveAll = (barcode) => {
    Alert.alert( "Confirm Removal", `Are you sure you want to remove all units of "${scannedItems[barcode].name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => {
          const newItems = { ...scannedItems };
          delete newItems[barcode];
          updateRackScans(rackId, newItems);
        }}
      ]
    )
  };

  const handleGenerateReport = () => {
    if (!isDataReadyForReport) {
        Alert.alert("Cannot Generate Report", "Please ensure items are scanned and the master list is synced from the home screen.");
        return;
    }
    navigation.navigate('Report', { scannedItems, rackId });
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Pressable style={styles.scanButton} onPress={() => navigation.navigate('Scan', { rackId })}>
          <Text style={styles.scanButtonText}>Scan Items</Text>
        </Pressable>
      </View>

      <FlatList
        data={scannedItemsArray}
        keyExtractor={item => item.barcode}
        ListHeaderComponent={<Text style={styles.header}>Adjust Scanned Items</Text>}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemBarcode}>{item.barcode}</Text>
            </View>
            <View style={styles.controls}>
              <TouchableOpacity style={styles.button} onPress={() => handleQuantityChange(item.barcode, -1)}><Text style={styles.buttonText}>-</Text></TouchableOpacity>
              <Text style={styles.quantity}>{item.quantity}</Text>
              <TouchableOpacity style={styles.button} onPress={() => handleQuantityChange(item.barcode, 1)}><Text style={styles.buttonText}>+</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.removeButton]} onPress={() => handleRemoveAll(item.barcode)}><Text style={styles.buttonText}>Del</Text></TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No items scanned for this rack yet.{"\n"}Press "Scan Items" to begin.</Text>}
        contentContainerStyle={{ flexGrow: 1 }}
      />
       <View style={styles.footer}>
        {/* --- FIX: Button is now disabled if data isn't ready --- */}
        <Pressable 
            style={[styles.reportButton, !isDataReadyForReport && styles.disabledButton]} 
            onPress={handleGenerateReport} 
            disabled={!isDataReadyForReport}
        >
            <Text style={styles.scanButtonText}>Generate Mismatch Report</Text>
        </Pressable>
       </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  headerContainer: { padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eee' },
  scanButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center' },
  scanButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  reportButton: { backgroundColor: '#28a745', padding: 15, borderRadius: 8, alignItems: 'center' },
  disabledButton: { backgroundColor: '#9c9c9c' },
  header: { fontSize: 18, fontWeight: 'bold', padding: 20, textAlign: 'center', color: '#666' },
  itemContainer: { backgroundColor: 'white', padding: 15, marginVertical: 4, marginHorizontal: 10, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemInfo: { flex: 1, marginRight: 8 },
  itemName: { fontSize: 16, fontWeight: 'bold' },
  itemBarcode: { color: '#666' },
  controls: { flexDirection: 'row', alignItems: 'center' },
  button: { backgroundColor: '#5bc0de', borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginHorizontal: 5 },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  quantity: { fontSize: 18, fontWeight: 'bold', marginHorizontal: 10, minWidth: 25, textAlign: 'center' },
  removeButton: { backgroundColor: '#D9534F' },
  emptyText: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: '#888', fontSize: 16 },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: 'white' }
});