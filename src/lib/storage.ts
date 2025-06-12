// Web-compatible AsyncStorage implementation
class WebAsyncStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error getting item from storage:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error setting item in storage:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error removing item from storage:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }

  async getAllKeys(): Promise<string[]> {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.error('Error getting all keys from storage:', error);
      return [];
    }
  }
}

export const AsyncStorage = new WebAsyncStorage();

// Hybrid storage service
export class HybridStorage {
  private static instance: HybridStorage;
  private isOnline: boolean = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncOfflineData();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  static getInstance(): HybridStorage {
    if (!HybridStorage.instance) {
      HybridStorage.instance = new HybridStorage();
    }
    return HybridStorage.instance;
  }

  async store(key: string, data: any): Promise<void> {
    const serializedData = JSON.stringify(data);
    
    if (this.isOnline) {
      // Store in cloud (Supabase) and local storage
      await this.storeInCloud(key, data);
      await AsyncStorage.setItem(key, serializedData);
    } else {
      // Store locally and mark for sync
      await AsyncStorage.setItem(key, serializedData);
      await this.markForSync(key, data);
    }
  }

  async retrieve(key: string): Promise<any> {
    try {
      if (this.isOnline) {
        // Try cloud first, fallback to local
        const cloudData = await this.retrieveFromCloud(key);
        if (cloudData) return cloudData;
      }
      
      // Fallback to local storage
      const localData = await AsyncStorage.getItem(key);
      return localData ? JSON.parse(localData) : null;
    } catch (error) {
      console.error('Error retrieving data:', error);
      return null;
    }
  }

  private async storeInCloud(key: string, data: any): Promise<void> {
    // Implementation would depend on your cloud storage strategy
    // This is a placeholder for Supabase integration
    console.log('Storing in cloud:', { key, data });
  }

  private async retrieveFromCloud(key: string): Promise<any> {
    // Implementation would depend on your cloud storage strategy
    console.log('Retrieving from cloud:', key);
    return null;
  }

  private async markForSync(key: string, data: any): Promise<void> {
    const syncQueue = await this.getSyncQueue();
    syncQueue.push({ key, data, timestamp: Date.now() });
    await AsyncStorage.setItem('syncQueue', JSON.stringify(syncQueue));
  }

  private async getSyncQueue(): Promise<any[]> {
    const queue = await AsyncStorage.getItem('syncQueue');
    return queue ? JSON.parse(queue) : [];
  }

  private async syncOfflineData(): Promise<void> {
    try {
      const syncQueue = await this.getSyncQueue();
      
      for (const item of syncQueue) {
        await this.storeInCloud(item.key, item.data);
      }
      
      // Clear sync queue after successful sync
      await AsyncStorage.removeItem('syncQueue');
      
      console.log('Offline data synced successfully');
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  }

  isConnected(): boolean {
    return this.isOnline;
  }
}

export const hybridStorage = HybridStorage.getInstance();