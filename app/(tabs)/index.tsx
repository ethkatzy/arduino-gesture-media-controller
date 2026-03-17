//TODO:
//1. Add ability to load multiple songs into the playlist and skip between them
//Do we want to have it so songs dont need to be added every time the app is opened? Maybe we can save the playlist to local storage and load it on startup?
//1.a look at queue?
//2. Fix metadata reading
//3. Notification
//4. BLE integration


import { Buffer } from "buffer"; 
global.Buffer = Buffer; 
import React, { useState, useEffect } from "react"; 
import { View, Text, TouchableOpacity, StyleSheet } from "react-native"; 
import * as DocumentPicker from "expo-document-picker"; 
import { Ionicons } from "@expo/vector-icons"; 
import MediaPlayer from "../media/MediaPlayer"; 
import * as MusicInfo from "expo-music-info-2"; 
import { decode as atob } from "base-64"; 
import Slider from "@react-native-community/slider";
import { Audio } from "expo-av"; 
export default function MainScreen() { 
  const [fileName, setFileName] = useState<string | null>(null); 
  const [activeButton, setActiveButton] = useState<string | null>(null); 
  const [isPlaying, setIsPlaying] = useState(false); 
  const [volume, setVolume] = useState<number>(1); 
  const [duration, setDuration] = useState<number | null>(null); 
  const [songInfo, setSongInfo] = useState<{
    title: String; 
    artist: String; 
    album: String; 
    artwork?: string}>
    ({ title: "", artist: "", album: "", }); 
  const [position, setPosition] = useState<number>(0); 
  useEffect(() => { let interval: NodeJS.Timer; async function updatePosition() { 
    if (MediaPlayer.sound) { 
      const status = await MediaPlayer.sound.getStatusAsync(); 
      if (status.isLoaded) setPosition(status.positionMillis); 
    } 
    }  
    if (isPlaying) { 
      interval = setInterval(updatePosition, 500); // update twice per second 
    } 
    return () => clearInterval(interval); 
}, [isPlaying]); 
useEffect(() => { 
  Audio.setAudioModeAsync({ 
    staysActiveInBackground: true, 
    interruptionModeAndroid: 1, 
    interruptionModeIOS: 1, 
    shouldDuckAndroid: true, 
    playsInSilentModeIOS: true, 
    playThroughEarpieceAndroid: false, 
  }); }, []); 

function flashButton(name: string) { 
setActiveButton(name); 
setTimeout(() => { 
  setActiveButton(null);
  }, 500); } 

async function addSong() { 
  const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", }); 
  if (result.canceled) return; 
  const file = result.assets[0]; 
  setFileName(file.name); 
  await MediaPlayer.loadPlaylist([file.uri]); 
  /*console.log("URI:", file.uri);
  const metadata = await MusicInfo.getMusicInfoAsync(file.uri, { 
      title: true, 
      artist: true, 
      album: true, 
      artwork: true, });
  console.log("Metadata:", metadata);*/

  await MediaPlayer.play(); 
  const d = await MediaPlayer.getDuration(); 
  setDuration(d); await MediaPlayer.pause(); 
  await togglePlay(); //try this 
  try { 
    const metadata = await MusicInfo.getMusicInfoAsync(file.uri, { 
      title: true, 
      artist: true, 
      album: true, 
      artwork: true, }); 
    setSongInfo({ 
      title: metadata?.title || file.name, 
      artist: metadata?.artist || "Unknown Artist", 
      album: metadata?.album || "Unknown Album", 
      artwork: metadata?.artwork || undefined, }); 
  } catch (err) { 
    console.warn("Failed to read metadata", err); 
    setSongInfo({ 
      title: file.name, 
      artist: "Unknown Artist", 
      album: "Unknown Album", 
      artwork: undefined, }); 
  } } 
  
  function formatDuration(ms: number | null) { 
    if (!ms) return "--:--"; 
    const totalSeconds = Math.floor(ms / 1000); 
    const minutes = Math.floor(totalSeconds / 60); 
    const seconds = totalSeconds % 60; 
    return `${minutes}:${seconds.toString().padStart(2, "0")}`; 
  } 
  
  async function togglePlay() { 
    await MediaPlayer.togglePlayPause(); 
    setIsPlaying(!isPlaying); 
    flashButton("play"); 
  } 

  /*async function syncVolume() {
    if (MediaPlayer.sound) {
      const status = await MediaPlayer.sound.getStatusAsync();
      if (status.isLoaded) setVolume(status.volume);
  }*/
  
  async function volumeUp() { 
    await MediaPlayer.volumeUp(); 
    //await syncVolume();
    flashButton("volUp"); 
  } 
    
  async function volumeDown() { 
    await MediaPlayer.volumeDown(); 
    //await syncVolume();
    flashButton("volDown"); 
  } 
  
  async function nextTrack() { 
    await MediaPlayer.nextTrack(); 
    flashButton("next"); 
  } 
  
  return ( 
    <View style={styles.container}> 
      {/* TEMPORARY GESTURE BUTTONS */} 
      <View style={styles.gestureRow}> 
        <TouchableOpacity onPress={togglePlay} style={styles.tempButton}> 
          <Text>P</Text> 
        </TouchableOpacity> 
        <TouchableOpacity onPress={volumeUp} style={styles.tempButton}> 
          <Text>V+</Text> 
        </TouchableOpacity> 
        <TouchableOpacity onPress={volumeDown} style={styles.tempButton}> 
          <Text>V-</Text> 
        </TouchableOpacity> 
        <TouchableOpacity onPress={nextTrack} style={styles.tempButton}> 
          <Text>N</Text> 
        </TouchableOpacity> 
      </View> 

      {/* ADD SONG */} 
      <TouchableOpacity style={styles.addButton} onPress={addSong}> 
        <Text style={styles.addText}>Add Song</Text> 
      </TouchableOpacity> 

      {/* FILE NAME */} 
      <View style={styles.songInfoContainer}> 
        <View style={styles.artworkPlaceholder}> 
          {songInfo.artwork ? (<Image source={{ uri: songInfo.artwork }} style={{ width: 180, height: 180, borderRadius: 12 }} />) : 
          (<Ionicons name="musical-notes" size={60} color="#888" />)} 
        </View> 
        <Text style={styles.trackTitle} numberOfLines={1} ellipsizeMode="tail">{songInfo.title ||fileName || "No track loaded"}</Text> 
        <Text style={styles.metaText}>{songInfo.artist || "Unknown Artist"}</Text> 
        <Text style={styles.metaText}>{songInfo.album || "Unknown Album"}</Text> 
        <View style={{ width: 220, alignItems: "center", marginTop: 6 }}> <Slider style={{ width: 220, height: 40 }} minimumValue={0} maximumValue={duration || 1} // fallback to 1 to avoid zero 
        
          value={position} minimumTrackTintColor="#4c8bf5" maximumTrackTintColor="#ccc" thumbTintColor="#4c8bf5" 
          onSlidingComplete={async (val) => { 
            if (MediaPlayer.sound) { 
              await MediaPlayer.sound.setPositionAsync(val); setPosition(val); 
            } }} /> 
          <Text style={styles.durationText}>{formatDuration(position)} / {formatDuration(duration)}</Text> 
        </View> </View> 
        
        {/* D-PAD */} 
        <View style={styles.dpadContainer}> 
          <View style={styles.dpadRow}> 
            <ControlButton icon="volume-high" active={activeButton === "volUp"} onPress={volumeUp} /> 
          </View> 
          <View style={styles.dpadRow}> 
            <ControlButton icon={isPlaying ? "pause" : "play"} active={activeButton === "play"} onPress={togglePlay} /> 
            <ControlButton icon="play-skip-forward" active={activeButton === "next"} onPress={nextTrack} /> 
          </View> 
          <View style={styles.dpadRow}> 
            <ControlButton icon="volume-low" active={activeButton === "volDown"} onPress={volumeDown} /> 
          </View> 
        </View> 
        
        {/* VOLUME SLIDER */} 
        <View style={styles.volumeContainer}> 
          <Text style={{ marginBottom: 4, fontWeight: "bold" }}>Volume</Text> 
          <Slider style={{ width: 220, height: 40 }} minimumValue={0} maximumValue={1} value={volume} minimumTrackTintColor="#4c8bf5" maximumTrackTintColor="#ccc" thumbTintColor="#4c8bf5" step={0.01} onValueChange={async (val) => { setVolume(val); if (MediaPlayer.sound) { await MediaPlayer.sound.setVolumeAsync(val); } }} /> 

          </View> 
        </View> 
      ); } 
function ControlButton({ icon, onPress, active }) { 
  return ( <TouchableOpacity onPress={onPress} style={[styles.controlButton, active && styles.activeButton]} > <Ionicons name={icon} size={32} color="white" /> </TouchableOpacity> 

  ); }
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  gestureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },

  tempButton: {
    padding: 10,
    backgroundColor: "#ddd",
    borderRadius: 6,
  },

  addButton: {
    backgroundColor: "#4c8bf5",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },

  addText: {
    color: "white",
    fontWeight: "bold",
  },

  fileSection: {
    alignItems: "center",
    marginBottom: 30,
  },

  fileLabel: {
    fontWeight: "bold",
  },

  dpadContainer: {
    flex: 1,
    justifyContent: "center",
  },

  dpadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginVertical: 15,
  },

  controlButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },

  activeButton: {
    backgroundColor: "#4c8bf5",
  },

  songInfoContainer: {
    alignItems: "center",
    marginBottom: 30,
  },

  artworkPlaceholder: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },

  trackTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },

  metaText: {
    color: "#666",
  },

  durationText: {
    marginTop: 6,
    fontWeight: "bold",
    color: "white",
  },

  progressContainer: {
    width: 200,
    height: 6,
    backgroundColor: "#ccc",
    borderRadius: 3,
    marginTop: 8,
    marginBottom: 12,
  },

  progressFill: {
    height: 6,
    backgroundColor: "#4c8bf5",
    borderRadius: 3,
  },

  volumeContainer: {
  alignItems: "center",
  marginTop: 20,
},
});