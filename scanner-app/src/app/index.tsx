// import { CameraView, useCameraPermissions } from 'expo-camera';
// import { useRef, useState } from 'react';
// import { Platform, Pressable, StyleSheet } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';

// import { ThemedText } from '@/components/themed-text';
// import { ThemedView } from '@/components/themed-view';
// import { WebBadge } from '@/components/web-badge';
// import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// type Stage = 'home' | 'scanning' | 'result';

// export default function HomeScreen() {
//   const [permission, requestPermission] = useCameraPermissions();
//   const [stage, setStage] = useState<Stage>('home');
//   const [scannedData, setScannedData] = useState<string | null>(null);
//   const canScan = useRef(true);

//   const handleGetStarted = async () => {
//     if (!permission?.granted) {
//       const result = await requestPermission();
//       if (!result.granted) return;
//     }
//     setStage('scanning');
//     canScan.current = true;
//   };

//   const handleBarcodeScanned = (result: { data: string }) => {
//     if (!canScan.current) return;
//     canScan.current = false;
//     setScannedData(result.data);
//     setStage('result');
//   };

//   const handleReset = () => {
//     setStage('home');
//     setScannedData(null);
//     canScan.current = true;
//   };

//   if (stage === 'scanning') {
//     return (
//       <ThemedView style={styles.container}>
//         <CameraView
//           style={styles.camera}
//           facing="back"
//           barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
//           onBarcodeScanned={handleBarcodeScanned}>
//           <SafeAreaView style={styles.scannerOverlay}>
//             <Pressable
//               style={({ pressed }) => pressed && styles.pressed}
//               onPress={handleReset}>
//               <ThemedText type="code" style={styles.cancelText}>
//                 cancel
//               </ThemedText>
//             </Pressable>
//           </SafeAreaView>
//         </CameraView>
//       </ThemedView>
//     );
//   }

//   return (
//     <ThemedView style={styles.container}>
//       <SafeAreaView style={styles.safeArea}>
//         <ThemedView style={styles.heroSection}>
//           {stage === 'result' && scannedData ? (
//             <ThemedText type="code" style={styles.scannedResult} selectable>
//               {scannedData}
//             </ThemedText>
//           ) : (
//             <ThemedText type="title" style={styles.title}>
//               Steeze
//             </ThemedText>
//           )}
//         </ThemedView>

//         <Pressable
//           style={({ pressed }) => pressed && styles.pressed}
//           onPress={stage === 'result' ? handleReset : handleGetStarted}>
//           <ThemedText type="code" style={styles.code}>
//             {stage === 'result' ? 'scan again' : 'Scan Here'}
//           </ThemedText>
//         </Pressable>

//         {Platform.OS === 'web' && <WebBadge />}
//       </SafeAreaView>
//     </ThemedView>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//     justifyContent: 'center',
//     flexDirection: 'row',
//   },
//   safeArea: {
//     flex: 1,
//     paddingHorizontal: Spacing.four,
//     alignItems: 'center',
//     gap: Spacing.three,
//     paddingBottom: BottomTabInset + Spacing.three,
//     maxWidth: MaxContentWidth,
//   },
//   heroSection: {
//     alignItems: 'center',
//     justifyContent: 'center',
//     flex: 1,
//     paddingHorizontal: Spacing.four,
//     gap: Spacing.four,
//   },
//   title: {
//     textAlign: 'center',
//   },
//   code: {
//     textTransform: 'uppercase',
//     backgroundColor: "red",
//     padding: 20,
//     borderRadius:5,
//   },
//   pressed: {
//     opacity: 0.7,
//   },
//   camera: {
//     flex: 1,
//     alignSelf: 'stretch',
//   },
//   scannerOverlay: {
//     flex: 1,
//     padding: Spacing.four,
//     alignItems: 'flex-start',
//   },
//   cancelText: {
//     textTransform: 'uppercase',
//     color: 'white',
//   },
//   scannedResult: {
//     textAlign: 'center',
//   },
// });


import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, ActivityIndicator, Alert, Image, Dimensions } from 'react-native';
import * as FileSystem from 'expo-file-system';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL!;
const ROOT_FOLDER_ID = process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID!;

export default function DocumentViewer() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failedThumbs, setFailedThumbs] = useState(new Set());
  const [folderHistory, setFolderHistory] = useState([ROOT_FOLDER_ID]);

  const currentFolderId = folderHistory[folderHistory.length - 1];

  // Fetch file list from your Node server
  const fetchFolderContents = async (folderId, isRefresh = false) => {
    try {
      const response = await fetch(`${BACKEND_URL}/list/${folderId}`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data = await response.json();
      if (data.success) {
        setItems(data.items);
      }
      else{setItems([])}
    } catch (error) {
      Alert.alert('Error', `Could not sync folder data: ${error.message}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // console.log(BACKEND_URL, ROOT_FOLDER_ID);

  useEffect(() => {
    fetchFolderContents(currentFolderId);
  }, [currentFolderId]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFolderContents(currentFolderId, true);
  }, [currentFolderId]);

  // Download and handle the PDF binary chunk stream 
  const handleDownloadAndPreview = async (fileId, fileName) => {
    try {
      setLoading(true);
      const remoteUrl = `${BACKEND_URL}/download/${fileId}`;
      const localTargetUri = `${FileSystem.documentDirectory}${fileName}`;

      // Streams binary file chunks directly into local file cache storage
      const downloadResult = await FileSystem.downloadAsync(remoteUrl, localTargetUri);
      
      setLoading(false);
      Alert.alert('Downloaded Successfully!', `Saved to: ${downloadResult.uri}`);
      
      // PRO-TIP: You can now pass 'downloadResult.uri' to a viewer UI component
    } catch (error) {
      setLoading(false);
      Alert.alert('Download Error', 'Could not open this PDF document.');
    }
  };

  const handleItemPress = (item) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      // Step deeper into the folder tree structure
      setFolderHistory([...folderHistory, item.id]);
    } else if (item.mimeType === 'application/pdf') {
      // Stream the document locally
      handleDownloadAndPreview(item.id, item.name);
    }
  };

  const handleGoBack = () => {
    if (folderHistory.length > 1) {
      const updatedHistory = [...folderHistory];
      updatedHistory.pop();
      setFolderHistory(updatedHistory);
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0000ff" /></View>;
  }

  return (
    <View style={styles.container}>
      {folderHistory.length > 1 && (
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backText}>⬅️ Back to Parent Folder</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleItemPress(item)} activeOpacity={0.7}>
            <View style={styles.thumbnail}>
              {item.mimeType === 'application/vnd.google-apps.folder' ? (
                <Text style={styles.thumbnailIcon}>📁</Text>
              ) : failedThumbs.has(item.id) ? (
                <Text style={styles.thumbnailIcon}>📄</Text>
              ) : (
                <Image
                  source={{ uri: `${BACKEND_URL}/thumbnail/${item.id}` }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                  onError={() => setFailedThumbs(prev => new Set(prev).add(item.id))}
                />
              )}
            </View>
            <Text style={styles.cardName} numberOfLines={2}>
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - CARD_GAP * 3) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backButton: { padding: 15, backgroundColor: '#eee', margin: 10, borderRadius: 5 },
  backText: { fontWeight: 'bold', color: '#333' },
  grid: {
    padding: CARD_GAP,
  },
  row: {
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  thumbnail: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#e8e8e8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailIcon: {
    fontSize: 48,
  },
  cardName: {
    fontSize: 13,
    padding: 10,
    color: '#333',
  },
});
