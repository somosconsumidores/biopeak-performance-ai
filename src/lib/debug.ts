// Debug helper - only logs in development mode
const isDev = import.meta.env.DEV;

export const debugLog = (message: string, data?: any) => {
  if (isDev) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

export const debugError = (message: string, error?: any) => {
  if (isDev) {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
};

export const debugWarn = (message: string, data?: any) => {
  if (isDev) {
    if (data) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }
};
