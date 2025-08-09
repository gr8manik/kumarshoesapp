import React, { useState, useMemo, createContext, useContext, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator } from 'react-native';
import { saveState, loadState } from './storage';

// --- THIS IS THE NEW LINE TO INITIALIZE FIREBASE ---
import './firebaseConfig'; 

import LoginScreen from './screens/LoginScreen';
import HomeScreen from './screens/HomeScreen';
import ReportScreen from './screens/ReportScreen';
import RackListScreen from './screens/RackListScreen';
import RackDetailScreen from './screens/RackDetailScreen';
import ScanScreen from './screens/ScanScreen';

const Stack = createNativeStackNavigator();
const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

function AppNavigator() {
  const { user } = useAppContext();
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Kumar Shoes Dashboard' }}/>
            <Stack.Screen name="RackList" component={RackListScreen} options={{ title: 'Select Rack' }} />
            <Stack.Screen name="RackDetail" component={RackDetailScreen} options={({ route }) => ({ title: `Manage Rack: ${route.params.rackId}` })} />
            <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} /> 
            <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Mismatch Report' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [scanData, setScanData] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const rehydrateState = async () => {
      const persistedState = await loadState();
      if (persistedState) {
        // We will soon change how the user object is persisted
        setUser(persistedState.user || null); 
        setScanData(persistedState.scanData || {});
      }
      setIsLoading(false);
    };
    rehydrateState();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      // We will adjust this to not save the firebase user object directly
      saveState({ user, scanData });
    }
  }, [user, scanData, isLoading]);

  const appContextValue = useMemo(
    () => ({
      user, stockData, scanData,
      signIn: (data) => setUser(data),
      signOut: () => { setUser(null); setScanData({}); },
      loadStockData: (data) => setStockData(data),
      updateRackScans: (rackId, updatedItems) => {
        setScanData(prevData => ({ ...prevData, [rackId]: updatedItems }));
      },
      deleteRack: (rackId) => {
        setScanData(prevData => {
          const newData = { ...prevData };
          delete newData[rackId];
          return newData;
        });
      },
      renameRack: (oldName, newName) => {
        if (oldName === newName || !scanData[oldName] || scanData[newName]) return false;
        setScanData(prevData => {
          const newData = { ...prevData };
          newData[newName] = newData[oldName];
          delete newData[oldName];
          return newData;
        });
        return true;
      },
    }),
    [user, stockData, scanData]
  );
  
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AppContext.Provider value={appContextValue}>
      <AppNavigator />
    </AppContext.Provider>
  );
}