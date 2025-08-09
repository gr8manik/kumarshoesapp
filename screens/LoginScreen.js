// --- File: screens/LoginScreen.js ---

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { useAppContext } from '../App';

export default function LoginScreen() {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const { signIn } = useAppContext(); // THE FIX: Using the correct context hook

  const handleLogin = () => {
    if (userId.toLowerCase() === 'admin' && password === '1234') {
      signIn({ id: userId });
    } else {
      Alert.alert('Login Failed', 'Invalid User ID or Password.');
    }
  };

  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: 'https://i.imgur.com/OEVyA0e.png' }} 
        style={styles.logo} 
      />
      <Text style={styles.title}>Kumar Shoes</Text>
      <Text style={styles.subtitle}>Inventory Management</Text>
      <TextInput
        style={styles.input}
        placeholder="User ID"
        value={userId}
        onChangeText={setUserId}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <Text style={styles.buttonText}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f5f5f5' },
  logo: { width: 120, height: 120, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  input: { width: '100%', height: 50, backgroundColor: 'white', borderColor: '#ddd', borderWidth: 1, borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16 },
  button: { width: '100%', height: 50, backgroundColor: '#007BFF', justifyContent: 'center', alignItems: 'center', borderRadius: 8, marginTop: 10 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});