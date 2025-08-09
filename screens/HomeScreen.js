import React, { useEffect, useState, useCallback } from 'react';
// --- CHANGE 1: Import Linking ---
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Button, ActivityIndicator, Linking } from 'react-native';
import { useAppContext } from '../App';
import Papa from 'papaparse';

const MASTER_STOCK_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjsvniHwbhUdhnY6LnInjsy5JvM3rt3EFylQ3zPEtFcnqKnmsM6H97gPFpyP2yzy-5mcpfmcGR7_sm/pub?gid=612699279&single=true&output=csv';

// --- CHANGE 2: Update module to use 'url' instead of 'screen' ---
const modules = [
  { id: '1', title: 'Stock Matching', screen: 'RackList', enabled: true },
  { id: '5', title: 'Sync Master List', action: 'sync', enabled: true },
  { id: '2', title: 'Stock Intake', url: 'https://docs.google.com/forms/d/e/1FAIpQLSe-tSzvObWNbWDP8Z7yPEM819g-JYGdpjDqES9Ug2F_p72w0w/viewform?usp=dialog', enabled: true },
  { id: '3', title: 'Order Picking', screen: 'OrderPicking', enabled: false },
];

export default function HomeScreen({ navigation }) {
  const { signOut, loadStockData, stockData } = useAppContext();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      const response = await fetch(MASTER_STOCK_URL);
      if (!response.ok) throw new Error(`Server responded with status: ${response.status}`);
      
      const csvString = await response.text();
      const { data: parsedData } = Papa.parse(csvString, { header: true, skipEmptyLines: true });

      if (parsedData.length === 0) {
        Alert.alert('Data Error', 'The fetched master list is empty after parsing.');
        setIsSyncing(false);
        return;
      }

      const formattedData = parsedData.reduce((acc, row) => {
        const barcode = row.Barcode || row.barcode;
        const rack = row.Rack || row.rack;
        const name = row.Name || row.name;
        const size = row.Size || row.size;
        const expectedQty = row.ExpectedQty || row['Expected Qty'] || row.expectedqty;

        if (barcode) { 
          acc[barcode] = { 
            name: name || 'N/A', 
            size: size || 'N/A',
            Rack: rack || 'N/A',
            expectedQty: parseInt(expectedQty, 10) || 0 
          }; 
        }
        return acc;
      }, {});
      
      const itemCount = Object.keys(formattedData).length;
      if (itemCount === 0) {
        Alert.alert('Sync Warning', 'No items with a "Barcode" column were found. Please check your sheet headers.');
      } else {
        loadStockData(formattedData);
        Alert.alert('Sync Successful!', `${itemCount} items loaded into stock.`);
      }

    } catch (err) {
      console.error("Sync Error:", err);
      Alert.alert('Sync Error', `Could not fetch or process master data. Error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadStockData]);

  useEffect(() => {
    if (!stockData) {
        handleSync();
    }
  }, [stockData, handleSync]);

  // --- CHANGE 3: Update handlePress to open URLs ---
  const handlePress = async (item) => {
    if (!item.enabled) {
      Alert.alert('Coming Soon', `${item.title} feature is not yet available.`);
      return;
    }
    
    // If the item has a screen, navigate to it
    if (item.screen) {
      if (item.screen === 'RackList' && !stockData) {
        Alert.alert('No Stock Data', 'Please sync the master list first.');
        return;
      }
      navigation.navigate(item.screen);
    } 
    // If the item has a URL, open it in the browser
    else if (item.url) {
        try {
            const supported = await Linking.canOpenURL(item.url);
            if (supported) {
                await Linking.openURL(item.url);
            } else {
                Alert.alert("Error", `Don't know how to open this URL: ${item.url}`);
            }
        } catch (error) {
            Alert.alert("Error", "An error occurred while trying to open the link.");
            console.error("Linking Error:", error);
        }
    } 
    // If the item has an action, perform it
    else if (item.action === 'sync') {
      handleSync();
    }
  };

  const renderGridItem = ({ item }) => (
    <TouchableOpacity 
      style={[styles.gridItem, !item.enabled && styles.gridItemDisabled]} 
      onPress={() => handlePress(item)}
      disabled={isSyncing && item.action === 'sync'}
    >
      {isSyncing && item.action === 'sync' ? (
        <ActivityIndicator size="large" color="#007BFF" />
      ) : (
        <Text style={styles.gridText}>{item.title}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList data={modules} renderItem={renderGridItem} keyExtractor={(item) => item.id} numColumns={2} contentContainerStyle={styles.list} />
      <View style={styles.footer}><Button title="Logout" onPress={signOut} color="#FF3B30" /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' }, list: { padding: 10 },
  gridItem: { flex: 1, margin: 10, height: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', borderRadius: 10, elevation: 3 },
  gridItemDisabled: { backgroundColor: '#e0e0e0', opacity: 0.6 },
  gridText: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#ccc' }
});