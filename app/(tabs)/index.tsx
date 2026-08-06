import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Buffer } from 'buffer';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  BleManager,
  Characteristic,
  Device,
  Subscription,
} from 'react-native-ble-plx';
import { isDebounced, resolveGestureAction } from '@/app/gesture/gestureAction';
import MediaPlayer, { type Track } from '@/app/media/MediaPlayer';
global.Buffer = Buffer;

// Must stay in sync with firmware/gesture_inference/gesture_inference.ino — see BLE_PROTOCOL.md
const TARGET_DEVICE_NAME = 'GestureBoard';
const SERVICE_UUID = '19B10000-E8F2-537E-4F6C-D104768A1214';
const GESTURE_CHAR_UUID = '19B10001-E8F2-537E-4F6C-D104768A1214';
const CONFIDENCE_CHAR_UUID = '19B10002-E8F2-537E-4F6C-D104768A1214';

export default function MainScreen() {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width - 48, 340);
  const controlSize = width < 380 ? 64 : 72;
  const controlIconSize = width < 380 ? 28 : 32;
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeButton, setActiveButton] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState<number>(1);
  const [duration, setDuration] = useState<number | null>(null);
  const [songInfo, setSongInfo] = useState<{
    title: string;
    artist: string;
    album: string;
    artwork?: string;
  }>({ title: '', artist: '', album: '' });
  const [position, setPosition] = useState<number>(0);
  const [bleStatus, setBleStatus] = useState<
    'disconnected' | 'scanning' | 'connecting' | 'connected'
  >('disconnected');
  const [latestGesture, setLatestGesture] = useState<string>('-');
  const [latestConfidence, setLatestConfidence] = useState<string>('-');
  const managerRef = useRef<BleManager | null>(null);
  const connectedDeviceRef = useRef<Device | null>(null);
  const gestureSubRef = useRef<Subscription | null>(null);
  const confidenceSubRef = useRef<Subscription | null>(null);
  const lastActionRef = useRef<{ gesture: string; timestamp: number }>({
    gesture: '',
    timestamp: 0,
  });

  async function requestBlePermissions(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    const apiLevel = Number(Platform.Version);
    if (apiLevel >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);

      return (
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
          PermissionsAndroid.RESULTS.GRANTED &&
        result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED
      );
    }

    const locationResult = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return locationResult === PermissionsAndroid.RESULTS.GRANTED;
  }

  function decodeBase64Value(characteristic: Characteristic | null): string {
    if (!characteristic?.value) {
      return '';
    }
    return Buffer.from(characteristic.value, 'base64')
      .toString('utf8')
      .replace(/\0/g, '')
      .trim();
  }

  function decodeFloatValue(
    characteristic: Characteristic | null,
  ): number | null {
    if (!characteristic?.value) return null;
    const bytes = Buffer.from(characteristic.value, 'base64');
    if (bytes.length < 4) return null;
    return bytes.readFloatLE(0);
  }

  function cleanupBleSubscriptions() {
    gestureSubRef.current?.remove();
    confidenceSubRef.current?.remove();
    gestureSubRef.current = null;
    confidenceSubRef.current = null;
  }

  async function handleGestureAction(gesture: string) {
    const now = Date.now();
    if (
      isDebounced(
        lastActionRef.current.gesture,
        lastActionRef.current.timestamp,
        gesture,
        now,
      )
    ) {
      return;
    }
    lastActionRef.current = { gesture, timestamp: now };

    switch (resolveGestureAction(gesture)) {
      case 'togglePlay':
        await togglePlay();
        break;
      case 'volumeUp':
        await volumeUp();
        break;
      case 'volumeDown':
        await volumeDown();
        break;
      case 'nextTrack':
        await nextTrack();
        break;
    }
  }

  async function subscribeToGestureCharacteristics(device: Device) {
    cleanupBleSubscriptions();

    gestureSubRef.current = device.monitorCharacteristicForService(
      SERVICE_UUID,
      GESTURE_CHAR_UUID,
      async (error, characteristic) => {
        if (error) {
          setBleStatus('disconnected');
          return;
        }
        const gesture = decodeBase64Value(characteristic).toLowerCase();
        if (!gesture) {
          return;
        }
        setLatestGesture(gesture);
        await handleGestureAction(gesture);
      },
    );

    confidenceSubRef.current = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CONFIDENCE_CHAR_UUID,
      (error, characteristic) => {
        if (error) {
          return;
        }
        const confidence = decodeFloatValue(characteristic);
        if (confidence !== null) {
          setLatestConfidence(confidence.toFixed(2));
        }
      },
    );
  }

  async function startBleIntegration() {
    const manager = managerRef.current;
    if (!manager) {
      return;
    }

    const hasPermissions = await requestBlePermissions();
    if (!hasPermissions) {
      setBleStatus('disconnected');
      return;
    }

    cleanupBleSubscriptions();
    await connectedDeviceRef.current?.cancelConnection().catch(() => undefined);
    connectedDeviceRef.current = null;
    setBleStatus('scanning');

    manager.stopDeviceScan();
    manager.startDeviceScan(null, null, async (error, scannedDevice) => {
      if (error) {
        setBleStatus('disconnected');
        manager.stopDeviceScan();
        return;
      }

      const name = scannedDevice?.name ?? scannedDevice?.localName;
      if (name !== TARGET_DEVICE_NAME || !scannedDevice) {
        return;
      }

      manager.stopDeviceScan();
      setBleStatus('connecting');

      try {
        const connected = await scannedDevice.connect();
        await connected.discoverAllServicesAndCharacteristics();
        connectedDeviceRef.current = connected;
        await subscribeToGestureCharacteristics(connected);
        setBleStatus('connected');

        connected.onDisconnected(() => {
          cleanupBleSubscriptions();
          connectedDeviceRef.current = null;
          setBleStatus('disconnected');
        });
      } catch {
        setBleStatus('disconnected');
      }
    });
  }
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    async function updatePosition() {
      const currentPosition = await MediaPlayer.getPosition();
      setPosition(currentPosition);
    }
    if (isPlaying) {
      interval = setInterval(updatePosition, 500); // update twice per second
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying]);
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      interruptionModeAndroid: 1,
      interruptionModeIOS: 1,
      shouldDuckAndroid: true,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  useEffect(() => {
    // react-native-ble-plx has no web implementation — constructing BleManager
    // there throws immediately. Skip BLE entirely on web; the Simulate Gesture
    // panel (dev builds only) is the intended way to drive the app there.
    if (Platform.OS === 'web') {
      return;
    }

    managerRef.current = new BleManager();
    startBleIntegration();

    return () => {
      const manager = managerRef.current;
      manager?.stopDeviceScan();
      cleanupBleSubscriptions();
      connectedDeviceRef.current?.cancelConnection().catch(() => undefined);
      connectedDeviceRef.current = null;
      manager?.destroy();
      managerRef.current = null;
    };
  }, []);

  function flashButton(name: string) {
    setActiveButton(name);
    setTimeout(() => {
      setActiveButton(null);
    }, 500);
  }

  async function addSong() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'audio/*',
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const files = result.assets;
    const tracks = files.map((f) => ({ uri: f.uri, name: f.name }));
    await MediaPlayer.addToPlaylist(tracks);
    const current = MediaPlayer.getCurrentTrack();
    if (current) {
      setFileName(current.name);
      await loadMetadata(current);
    }

    if (!isPlaying) {
      await MediaPlayer.play();
      const d = await MediaPlayer.getDuration();
      setDuration(d);
      setIsPlaying(true);
    }
  }

  async function loadMetadata(track: Track) {
    const title1 = track.name.replace(/\.[^/.]+$/, '');
    setSongInfo({
      title: title1,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
    });
  }

  function formatDuration(ms: number | null) {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  async function togglePlay() {
    await MediaPlayer.togglePlayPause();
    setIsPlaying((prev) => !prev);
    flashButton('play');
  }

  async function volumeUp() {
    await MediaPlayer.volumeUp();
    const vol = await MediaPlayer.getVolume();
    setVolume(vol);
    flashButton('volUp');
  }

  async function volumeDown() {
    await MediaPlayer.volumeDown();
    const vol = await MediaPlayer.getVolume();
    setVolume(vol);
    flashButton('volDown');
  }

  async function nextTrack() {
    await MediaPlayer.nextTrack();
    const current = MediaPlayer.getCurrentTrack();
    if (current) {
      setFileName(current.name);
      await loadMetadata(current);
    }
    const d = await MediaPlayer.getDuration();
    setDuration(d);
    setPosition(0);
    flashButton('next');
  }

  return (
    <View style={styles.container}>
      {/* ADD SONG */}
      <TouchableOpacity style={styles.addButton} onPress={addSong}>
        <Text style={styles.addText}>Add Song</Text>
      </TouchableOpacity>

      <View style={styles.bleDebugCard}>
        <Text style={styles.bleDebugText}>BLE Status: {bleStatus}</Text>
        <Text style={styles.bleDebugText}>Latest Gesture: {latestGesture}</Text>
        <Text style={styles.bleDebugText}>
          Latest Confidence: {latestConfidence}
        </Text>
      </View>

      {__DEV__ && bleStatus !== 'connected' && (
        <View style={styles.simulateCard}>
          <Text style={styles.simulateTitle}>Simulate Gesture (dev only)</Text>
          <View style={styles.simulateRow}>
            {(['up', 'down', 'left', 'right'] as const).map((gesture) => (
              <TouchableOpacity
                key={gesture}
                style={styles.simulateButton}
                onPress={() => {
                  setLatestGesture(gesture);
                  handleGestureAction(gesture);
                }}
              >
                <Text style={styles.simulateButtonText}>{gesture}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* FILE NAME */}
      <View style={styles.songInfoContainer}>
        <View style={styles.artworkPlaceholder}>
          {songInfo.artwork ? (
            <Image
              source={{ uri: songInfo.artwork }}
              style={{ width: 180, height: 180, borderRadius: 12 }}
            />
          ) : (
            <Ionicons name="musical-notes" size={60} color="#888" />
          )}
        </View>
        <Text style={styles.trackTitle} numberOfLines={1} ellipsizeMode="tail">
          {songInfo.title || fileName || 'No track loaded'}
        </Text>
        <View style={styles.sliderBlock}>
          <Slider
            style={{ width: contentWidth, height: 40 }}
            minimumValue={0}
            maximumValue={duration || 1}
            value={position}
            minimumTrackTintColor="#4c8bf5"
            maximumTrackTintColor="#ccc"
            thumbTintColor="#4c8bf5"
            onSlidingComplete={async (val) => {
              await MediaPlayer.seekTo(val);
              setPosition(val);
            }}
          />
          <Text style={styles.durationText}>
            {formatDuration(position)} / {formatDuration(duration)}
          </Text>
        </View>
      </View>

      <View style={styles.controlsSection}>
        <View style={styles.primaryControlsRow}>
          <ControlButton
            icon={isPlaying ? 'pause' : 'play'}
            active={activeButton === 'play'}
            onPress={togglePlay}
            size={controlSize}
            iconSize={controlIconSize}
          />
          <ControlButton
            icon="play-skip-forward"
            active={activeButton === 'next'}
            onPress={nextTrack}
            size={controlSize}
            iconSize={controlIconSize}
          />
        </View>
      </View>

      {/* VOLUME SLIDER */}
      <View style={styles.volumeContainer}>
        <Text style={{ marginBottom: 4, fontWeight: 'bold', color: 'white' }}>
          Volume
        </Text>
        <Slider
          style={{ width: contentWidth, height: 40 }}
          minimumValue={0}
          maximumValue={1}
          value={volume}
          minimumTrackTintColor="#4c8bf5"
          maximumTrackTintColor="#ccc"
          thumbTintColor="#4c8bf5"
          step={0.01}
          onValueChange={async (val) => {
            setVolume(val);
            await MediaPlayer.setVolume(val);
          }}
        />
      </View>
      <View style={styles.controlsSection}>
        <View style={styles.primaryControlsRow}>
          <ControlButton
            icon={'volume-low'}
            active={activeButton === 'volDown'}
            onPress={volumeDown}
            size={controlSize}
            iconSize={controlIconSize}
          />
          <ControlButton
            icon={'volume-high'}
            active={activeButton === 'volUp'}
            onPress={volumeUp}
            size={controlSize}
            iconSize={controlIconSize}
          />
        </View>
      </View>
    </View>
  );
}
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
function ControlButton({
  icon,
  onPress,
  active,
  size,
  iconSize,
}: {
  icon: IoniconName;
  onPress: () => void;
  active: boolean;
  size: number;
  iconSize: number;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.controlButton,
        { width: size, height: size, borderRadius: size / 2 },
        active && styles.activeButton,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color="white" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#111',
  },

  addButton: {
    backgroundColor: '#4c8bf5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },

  addText: {
    color: 'white',
    fontWeight: 'bold',
  },

  bleDebugCard: {
    backgroundColor: '#1b1b1b',
    borderColor: '#3a3a3a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },

  bleDebugText: {
    color: 'white',
    marginBottom: 2,
  },

  simulateCard: {
    backgroundColor: '#1b1b1b',
    borderColor: '#3a3a3a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },

  simulateTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },

  simulateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },

  simulateButton: {
    flex: 1,
    backgroundColor: '#333',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
  },

  simulateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textTransform: 'capitalize',
  },

  controlsSection: {
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'center',
  },

  primaryControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },

  controlButton: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },

  activeButton: {
    backgroundColor: '#4c8bf5',
  },

  songInfoContainer: {
    alignItems: 'center',
    marginBottom: 18,
    width: '100%',
  },

  artworkPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },

  trackTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },

  durationText: {
    marginTop: 6,
    fontWeight: 'bold',
    color: 'white',
  },

  sliderBlock: {
    width: '100%',
    alignItems: 'center',
    marginTop: 6,
  },

  volumeContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
});
