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
    if (!Capacitor.isNativePlatform()) {
      console.log('🔵 RevenueCat: Not on native platform, skipping initialization');
      return;
    }
    
    if (this.initialized) {
      console.log('🔵 RevenueCat: Already initialized');
      return;
    }

    try {
      // RevenueCat API Key from environment
      const apiKey = import.meta.env.VITE_REVENUECAT_API_KEY || 'appl_YOUR_REVENUECAT_API_KEY_HERE';
      
      console.log('🔵 RevenueCat: Initializing with API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'Missing');
      console.log('🔵 RevenueCat: User ID:', userId);
      
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      await Purchases.configure({ apiKey, appUserID: userId });
      
      this.initialized = true;
      console.log('🟢 RevenueCat: Successfully initialized');
      
      // Test fetching offerings immediately after initialization
      const offerings = await Purchases.getOfferings();
      console.log('🔵 RevenueCat: Post-init offerings test:', offerings?.current ? 'Success' : 'No offerings');
      
    } catch (error) {
      console.error('🔴 RevenueCat: Failed to initialize:', error);
      throw error;
    }
  }

  async getOfferings(): Promise<RevenueCatOffering | null> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      console.log('🔵 RevenueCat getOfferings: Not on native platform or not initialized');
      return null;
    }

    try {
      console.log('🔵 RevenueCat: Fetching offerings...');
      const offerings = await Purchases.getOfferings();
      console.log('🔵 RevenueCat: Raw offerings received:', offerings);
      
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        console.log('🔵 RevenueCat: No current offering found');
        return null;
      }

      console.log('🔵 RevenueCat: Current offering identifier:', currentOffering.identifier);
      console.log('🔵 RevenueCat: Available packages:', Object.keys(currentOffering.availablePackages || {}));

      // Look for our specific product by identifier
      let monthlyPackage = null;
      let annualPackage = null;

      // Check all available packages for our products
      if (currentOffering.availablePackages) {
        for (const packageObj of currentOffering.availablePackages) {
          console.log('🔵 RevenueCat: Checking package:', packageObj.identifier, 'Product ID:', packageObj.product?.identifier);
          
          if (packageObj.product?.identifier === 'biopeak_pro_monthly') {
            monthlyPackage = packageObj;
            console.log('🔵 RevenueCat: Found monthly product!', packageObj);
          }
          if (packageObj.product?.identifier === 'biopeak_pro_annual') {
            annualPackage = packageObj;
            console.log('🔵 RevenueCat: Found annual product!', packageObj);
          }
        }
      }

      // Fallback to the legacy monthly/annual properties
      if (!monthlyPackage && currentOffering.monthly) {
        monthlyPackage = currentOffering.monthly;
        console.log('🔵 RevenueCat: Using fallback monthly package');
      }
      if (!annualPackage && currentOffering.annual) {
        annualPackage = currentOffering.annual;
        console.log('🔵 RevenueCat: Using fallback annual package');
      }

      return {
        identifier: currentOffering.identifier,
        serverDescription: currentOffering.serverDescription,
        monthly: monthlyPackage ? {
          identifier: monthlyPackage.identifier,
          price: monthlyPackage.product.price,
          priceString: monthlyPackage.product.priceString,
          currencyCode: monthlyPackage.product.currencyCode,
        } : undefined,
        annual: annualPackage ? {
          identifier: annualPackage.identifier,
          price: annualPackage.product.price,
          priceString: annualPackage.product.priceString,
          currencyCode: annualPackage.product.currencyCode,
        } : undefined,
      };
    } catch (error: any) {
      console.error('🔴 RevenueCat: Failed to get offerings:', error);
      
      // Check for specific error types related to product approval status
      if (error.message?.includes('WAITING_FOR_REVIEW') || 
          error.message?.includes('None of the products registered') ||
          error.code === '23') {
        console.log('🟠 RevenueCat: Products are waiting for App Store approval');
        // Return null instead of throwing - let the app fallback to Stripe gracefully
        return null;
      }
      
      throw error;
    }
  }

  async purchasePackage(packageIdentifier: string): Promise<RevenueCatCustomerInfo> {
    if (!Capacitor.isNativePlatform() || !this.initialized) {
      throw new Error('RevenueCat not available on this platform');
    }

    try {
      console.log('🔵 RevenueCat: Starting purchase for package:', packageIdentifier);
      
      const offerings = await Purchases.getOfferings();
      const currentOffering = offerings.current;
      
      if (!currentOffering) {
        throw new Error('No offerings available');
      }

      let packageToPurchase;
      
      // Look for the specific product by product identifier
      if (currentOffering.availablePackages) {
        for (const packageObj of currentOffering.availablePackages) {
          console.log('🔵 RevenueCat: Checking package for purchase:', packageObj.identifier, 'Product ID:', packageObj.product?.identifier);
          
          if (packageIdentifier === 'monthly' && packageObj.product?.identifier === 'biopeak_pro_monthly') {
            packageToPurchase = packageObj;
            console.log('🔵 RevenueCat: Found monthly package for purchase!');
            break;
          }
          if (packageIdentifier === 'annual' && packageObj.product?.identifier === 'biopeak_pro_annual') {
            packageToPurchase = packageObj;
            console.log('🔵 RevenueCat: Found annual package for purchase!');
            break;
          }
        }
      }

      // Fallback to legacy approach
      if (!packageToPurchase) {
        if (packageIdentifier === 'monthly' && currentOffering.monthly) {
          packageToPurchase = currentOffering.monthly;
          console.log('🔵 RevenueCat: Using fallback monthly package for purchase');
        } else if (packageIdentifier === 'annual' && currentOffering.annual) {
          packageToPurchase = currentOffering.annual;
          console.log('🔵 RevenueCat: Using fallback annual package for purchase');
        }
      }

      if (!packageToPurchase) {
        const availablePackages = currentOffering.availablePackages?.map(p => p.identifier).join(', ') || 'none';
        console.error('🔴 RevenueCat: Package not found. Available:', availablePackages);
        throw new Error(`Package ${packageIdentifier} not found. Available: ${availablePackages}`);
      }

      console.log('🔵 RevenueCat: Initiating purchase for package:', packageToPurchase.identifier);
      
      const purchaseResult = await Purchases.purchasePackage({ 
        aPackage: packageToPurchase 
      });

      console.log('🟢 RevenueCat: Purchase successful!', purchaseResult);
      return purchaseResult.customerInfo;
    } catch (error) {
      console.error('🔴 RevenueCat: Purchase failed:', error);
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