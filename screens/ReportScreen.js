import React, { useState, useEffect, memo } from 'react';
import { View, Text, StyleSheet, FlatList, SafeAreaView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { useAppContext } from '../App';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

const ReportItem = memo(({ title, details, color }) => (
  <View style={styles.itemContainer}>
    <Text style={[styles.itemTitle, { color }]}>{title}</Text>
    <Text style={styles.itemDetails}>{details}</Text>
  </View>
));

export default function ReportScreen({ route, navigation }) {
  const { rackId, scannedItems } = route.params;
  const { stockData } = useAppContext();

  const [isLoading, setIsLoading] = useState(true);
  const [report, setReport] = useState(null); // Start with null to be explicit

  // --- FIX: Add a guard clause to prevent crash if stockData is missing ---
  if (!stockData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Master Stock Data Not Loaded</Text>
            <Text style={styles.errorSubText}>Please go back and ensure the master list is synced from the home screen before generating a report.</Text>
            <Pressable style={styles.exportButton} onPress={() => navigation.goBack()}>
                <Text style={styles.exportButtonText}>Go Back</Text>
            </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  useEffect(() => {
    const generateReportFastAsync = async () => {
      const finalReport = { matched: [], missing: [], mismatched: [], extra: [] };
      const isStoreWide = rackId === 'STORE-WIDE';
      const relevantMasterStock = {};
      for (const barcode in stockData) {
        const masterItem = stockData[barcode];
        const masterItemRack = masterItem.Rack ? masterItem.Rack.toUpperCase() : '';
        if (isStoreWide || masterItemRack === rackId) {
          relevantMasterStock[barcode] = { ...masterItem };
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      for (const barcode in scannedItems) {
        const scannedItem = scannedItems[barcode];
        const masterItem = relevantMasterStock[barcode];
        if (masterItem) {
          const scannedQty = scannedItem.quantity;
          const expectedQty = masterItem.expectedQty || 0;
          if (scannedQty === expectedQty) {
            finalReport.matched.push({ ...masterItem, barcode, foundQty: scannedQty });
          } else {
            const reportItem = { ...masterItem, barcode, foundQty: scannedQty, foundInRacks: scannedItem?.foundInRacks };
            reportItem.details = `Expected ${expectedQty}, but found ${scannedQty}.`;
            finalReport.mismatched.push(reportItem);
          }
          delete relevantMasterStock[barcode];
        } else {
          const details = `Found ${scannedItem.quantity} of this unlisted item.`;
          finalReport.extra.push({ ...scannedItem, name: scannedItem.name || 'Unknown Item', barcode, foundQty: scannedItem.quantity, details });
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
      for (const barcode in relevantMasterStock) {
        const missingItem = relevantMasterStock[barcode];
        const reportItem = { ...missingItem, barcode: barcode, details: `Expected ${missingItem.expectedQty || 0}, but none were found.`, foundQty: 0 };
        finalReport.missing.push(reportItem);
      }
      setReport(finalReport);
      setIsLoading(false);
    };
    generateReportFastAsync();
  }, [stockData, scannedItems, rackId]);

  const handleExport = async () => {
    if (!report || !(await Sharing.isAvailableAsync())) return;
    const dataToExport = [];
    const header = ['Status', 'Barcode', 'Name', 'ExpectedQty', 'FoundQty', 'Rack(s)'];
    const processItem = (item, status) => {
      let itemRack = rackId;
      if (rackId === 'STORE-WIDE' && item.foundInRacks && item.foundInRacks.length > 0) { itemRack = Array.from(new Set(item.foundInRacks)).join(', '); }
      else if (rackId === 'STORE-WIDE' && item.Rack) { itemRack = item.Rack; }
      dataToExport.push({ Status: status, Barcode: item.barcode, Name: item.name, ExpectedQty: item.expectedQty ?? 0, FoundQty: item.foundQty ?? 0, 'Rack(s)': itemRack });
    };
    report.mismatched.forEach(item => processItem(item, 'MISMATCHED'));
    report.missing.forEach(item => processItem(item, 'MISSING'));
    report.extra.forEach(item => processItem(item, 'EXTRA'));
    if (dataToExport.length === 0) { Alert.alert("No Discrepancies", "There are no items to export. Everything is a perfect match!"); return; }
    const csvString = Papa.unparse({ fields: header, data: dataToExport });
    const date = new Date().toISOString().split('T')[0];
    const filename = `report-discrepancy-${rackId.replace(/ /g, '_')}-${date}.csv`;
    const fileUri = FileSystem.cacheDirectory + filename;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csvString, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', dialogTitle: 'Share Discrepancy Report' });
    } catch (error) { Alert.alert('Export Failed', 'Could not save or share the report file.'); }
  };

  if (isLoading || !report) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007BFF" />
          <Text style={styles.loadingText}>Generating Report...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sections = [
    { title: 'Mismatched Quantities', data: report.mismatched, color: '#F0AD4E' },
    { title: 'Missing Items', data: report.missing, color: '#D9534F' },
    { title: 'Extra / Unlisted Items', data: report.extra, color: '#5BC0DE' },
  ].filter(section => section.data.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Report for: {rackId}</Text>
      {sections.length === 0 ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>✅ Perfect Match!</Text><Text style={styles.emptySubText}>No discrepancies found against the master list.</Text></View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          renderItem={({ item: section }) => ( <View style={styles.section}><Text style={styles.header}>{section.title} ({section.data.length})</Text>{section.data.map((item) => ( <ReportItem key={item.barcode} title={item.name || `Unknown: ${item.barcode}`} details={item.details} color={section.color} /> ))}</View> )}
        />
      )}
      <View style={styles.footer}>
        <Pressable style={styles.exportButton} onPress={handleExport}><Text style={styles.exportButtonText}>Export Discrepancy Report</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', padding: 15, color: '#333' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 22, fontWeight: 'bold', color: '#D9534F', textAlign: 'center', marginBottom: 15},
  errorSubText: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30},
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { fontSize: 24, fontWeight: 'bold', color: '#28a745' },
  emptySubText: { fontSize: 16, color: '#666', marginTop: 10, textAlign: 'center' },
  section: { backgroundColor: 'white', marginHorizontal: 10, marginVertical: 5, padding: 15, borderRadius: 8, elevation: 1 },
  header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 5 },
  itemContainer: { marginVertical: 8, paddingLeft: 5 },
  itemTitle: { fontSize: 16, fontWeight: 'bold' },
  itemDetails: { fontSize: 14, color: '#555', marginTop: 2, fontStyle: 'italic' },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#e0e0e0', backgroundColor: 'white' },
  exportButton: { backgroundColor: '#007BFF', padding: 15, borderRadius: 8, alignItems: 'center', minWidth: 150 },
  exportButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});