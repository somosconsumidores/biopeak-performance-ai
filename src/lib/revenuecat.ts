import { Purchases, PurchasesOffering, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

export interface RevenueCatOffering {
  identifier: string;
  serverDescription: string;
  monthly?: {
    identifier: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  annual?: {
    identifier: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
}

export interface RevenueCatCustomerInfo {
  entitlements: {
    active: {
      [key: string]: {
        identifier: string;
        isActive: boolean;
        willRenew: boolean;
        expirationDate?: string;
      };
    };
  };
  originalAppUserId: string;
}

class RevenueCatService {
  private initialized = false;

  async initialize(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.initialized) {
      return;
    }

    try {
      // RevenueCat API Key from environment
      const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY || 'appl_YOUR_REVENUECAT_API_KEY_HERE';
      
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      await Purchases.configure({ apiKey, appUserID: userId });
      
      this.initialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<RevenueCatOffering | null> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      return null;
    }

    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        return null;
      }

      const monthly = currentOffering.monthly;
      const annual = currentOffering.annual;

      return {
        identifier: currentOffering.identifier,
        serverDescription: currentOffering.serverDescription,
        monthly: monthly ? {
          identifier: monthly.identifier,
          price: monthly.product.price,
          priceString: monthly.product.priceString,
          currencyCode: monthly.product.currencyCode,
        } : undefined,
        annual: annual ? {
          identifier: annual.identifier,
          price: annual.product.price,
          priceString: annual.product.priceString,
          currencyCode: annual.product.currencyCode,
        } : undefined,
      };
    } catch (error) {
      console.error('Failed to get offerings:', error);
      throw error;
    }
  }

  async purchasePackage(packageIdentifier: string): Promise<RevenueCatCustomerInfo> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      throw new Error('RevenueCat not available on this platform');
    }

    try {
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        throw new Error('No offerings available');
      }

      let packageToPurchase;
      if (packageIdentifier === 'monthly' && currentOffering.monthly) {
        packageToPurchase = currentOffering.monthly;
      } else if (packageIdentifier === 'annual' && currentOffering.annual) {
        packageToPurchase = currentOffering.annual;
      }

      if (!packageToPurchase) {
        throw new Error(`Package ${packageIdentifier} not found`);
      }

      const purchaseResult = await Purchases.purchasePackage({ 
        aPackage: packageToPurchase 
      });

      return purchaseResult.customerInfo;
    } catch (error) {
      console.error('Purchase failed:', error);
      throw error;
    }
  }

  async restorePurchases(): Promise<RevenueCatCustomerInfo> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      throw new Error('RevenueCat not available on this platform');
    }

    try {
      const result = await Purchases.restorePurchases();
      return result.customerInfo;
    } catch (error) {
      console.error('Restore purchases failed:', error);
      throw error;
    }
  }

  async getCustomerInfo(): Promise<RevenueCatCustomerInfo | null> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      return null;
    }

    try {
      const result = await Purchases.getCustomerInfo();
      return result.customerInfo;
    } catch (error) {
      console.error('Failed to get customer info:', error);
      return null;
    }
  }

  async logIn(userId: string): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      return;
    }

    try {
      await Purchases.logIn({ appUserID: userId });
    } catch (error) {
      console.error('Failed to log in to RevenueCat:', error);
    }
  }

  async logOut(): Promise<void> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      return;
    }

    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('Failed to log out from RevenueCat:', error);
    }
  }

  isNativePlatform(): boolean {
    return Capacitor.isNativePlatform();
  }
}

export const revenueCat = new RevenueCatService();