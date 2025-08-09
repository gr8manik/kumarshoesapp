import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_STATE_KEY = '@KumarShoesApp:state';

export const saveState = async (state) => {
  try {
    const jsonState = JSON.stringify(state);
    await AsyncStorage.setItem(APP_STATE_KEY, jsonState);
  } catch (e) {
    console.error("Failed to save state to storage", e);
  }
};

export const loadState = async () => {
  try {
    const jsonState = await AsyncStorage.getItem(APP_STATE_KEY);
    return jsonState ? JSON.parse(jsonState) : null;
  } catch (e) {
    console.error("Failed to load state from storage", e);
    return null;
  }
};