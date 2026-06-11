import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type Stage = 'home' | 'scanning' | 'result';

export default function HomeScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>('home');
  const [scannedData, setScannedData] = useState<string | null>(null);
  const canScan = useRef(true);

  const handleGetStarted = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setStage('scanning');
    canScan.current = true;
  };

  const handleBarcodeScanned = (result: { data: string }) => {
    if (!canScan.current) return;
    canScan.current = false;
    setScannedData(result.data);
    setStage('result');
  };

  const handleReset = () => {
    setStage('home');
    setScannedData(null);
    canScan.current = true;
  };

  if (stage === 'scanning') {
    return (
      <ThemedView style={styles.container}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}>
          <SafeAreaView style={styles.scannerOverlay}>
            <Pressable
              style={({ pressed }) => pressed && styles.pressed}
              onPress={handleReset}>
              <ThemedText type="code" style={styles.cancelText}>
                cancel
              </ThemedText>
            </Pressable>
          </SafeAreaView>
        </CameraView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          {stage === 'result' && scannedData ? (
            <ThemedText type="code" style={styles.scannedResult} selectable>
              {scannedData}
            </ThemedText>
          ) : (
            <ThemedText type="title" style={styles.title}>
              Scanner
            </ThemedText>
          )}
        </ThemedView>

        <Pressable
          style={({ pressed }) => pressed && styles.pressed}
          onPress={stage === 'result' ? handleReset : handleGetStarted}>
          <ThemedText type="code" style={styles.code}>
            {stage === 'result' ? 'scan again' : 'get started'}
          </ThemedText>
        </Pressable>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: 'center',
  },
  code: {
    textTransform: 'uppercase',
  },
  pressed: {
    opacity: 0.7,
  },
  camera: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scannerOverlay: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'flex-start',
  },
  cancelText: {
    textTransform: 'uppercase',
    color: 'white',
  },
  scannedResult: {
    textAlign: 'center',
  },
});
