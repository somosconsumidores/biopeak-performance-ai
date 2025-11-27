import { Capacitor } from '@capacitor/core';

export const shareNatively = async (blob: Blob, platform: string) => {
  // Access plugins from global Capacitor object (no npm imports needed)
  const plugins = (Capacitor as any).Plugins;
  const Share = plugins.Share;
  const Filesystem = plugins.Filesystem;
  
  if (!Share || !Filesystem) {
    throw new Error('Native plugins not available');
  }

  // Convert blob to base64
  const reader = new FileReader();
  reader.readAsDataURL(blob);
  
  await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
  });

  const base64Data = reader.result as string;
  const base64String = base64Data.split(',')[1];

  // Save to filesystem temporarily
  const fileName = `workout-biopeak-${Date.now()}.png`;
  await Filesystem.writeFile({
    path: fileName,
    data: base64String,
    directory: 'CACHE',
  });

  // Get full URI for the saved file
  const fileUri = await Filesystem.getUri({
    path: fileName,
    directory: 'CACHE',
  });

  // Share using native share dialog
  await Share.share({
    title: 'Meu Treino BioPeak',
    text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
    url: fileUri.uri,
    dialogTitle: 'Compartilhar no Instagram ou Facebook',
  });
};
