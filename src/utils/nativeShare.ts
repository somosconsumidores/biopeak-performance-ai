export const shareNatively = async (blob: Blob, platform: string) => {
  // Dynamically load Capacitor plugins only when needed (Android native)
  const [{ Share }, { Filesystem, Directory }] = await Promise.all([
    import('@capacitor/share'),
    import('@capacitor/filesystem'),
  ]);

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
    directory: Directory.Cache,
  });

  // Get full URI for the saved file
  const fileUri = await Filesystem.getUri({
    path: fileName,
    directory: Directory.Cache,
  });

  // Share using native share dialog
  await Share.share({
    title: 'Meu Treino BioPeak',
    text: 'Confira meu treino no BioPeak! 🏃‍♂️💪',
    url: fileUri.uri,
    dialogTitle: 'Compartilhar no Instagram ou Facebook',
  });
};
