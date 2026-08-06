import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import MediaPlayer, { type Track } from '@/app/media/MediaPlayer';

type UpcomingTrack = { track: Track; index: number };

// Mirrors nextTrack()'s wraparound in MediaPlayer, so "up next" always
// matches what gesture/button skips will actually play.
function getUpcoming(playlist: Track[], currentIndex: number): UpcomingTrack[] {
  const total = playlist.length;
  if (total <= 1) return [];
  return Array.from({ length: total - 1 }, (_, i) => {
    const index = (currentIndex + 1 + i) % total;
    return { track: playlist[index], index };
  });
}

export default function QueueScreen() {
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const refresh = useCallback(() => {
    setPlaylist(MediaPlayer.getPlaylist());
    setCurrentIndex(MediaPlayer.getCurrentIndex());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const interval = setInterval(refresh, 1000);
      return () => clearInterval(interval);
    }, [refresh]),
  );

  async function playTrack(index: number) {
    try {
      await MediaPlayer.playAt(index);
    } finally {
      refresh();
    }
  }

  const currentTrack = playlist[currentIndex] ?? null;
  const upcoming = getUpcoming(playlist, currentIndex);

  if (!playlist.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Queue</Text>
        <View style={styles.emptyState}>
          <Ionicons name="musical-notes-outline" size={48} color="#555" />
          <Text style={styles.emptyText}>
            Your queue is empty. Add songs from the Play tab.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Queue</Text>

      <View style={styles.nowPlayingCard}>
        <Text style={styles.nowPlayingLabel}>Now Playing</Text>
        <View style={styles.nowPlayingRow}>
          <Ionicons name="musical-note" size={20} color="#4c8bf5" />
          <Text style={styles.nowPlayingTitle} numberOfLines={1} ellipsizeMode="tail">
            {currentTrack?.name}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>
        Up Next{upcoming.length ? ` (${upcoming.length})` : ''}
      </Text>

      <FlatList
        data={upcoming}
        keyExtractor={(item) => `${item.index}-${item.track.uri}`}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyUpNext}>No more songs queued up.</Text>
        }
        renderItem={({ item, index: position }) => (
          <TouchableOpacity
            style={styles.trackRow}
            onPress={() => playTrack(item.index)}
          >
            <Text style={styles.trackPosition}>{position + 1}</Text>
            <Text style={styles.trackName} numberOfLines={1} ellipsizeMode="tail">
              {item.track.name}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#111',
  },

  header: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  emptyText: {
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 24,
  },

  nowPlayingCard: {
    backgroundColor: '#1b1b1b',
    borderColor: '#3a3a3a',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },

  nowPlayingLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },

  nowPlayingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  nowPlayingTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    flexShrink: 1,
  },

  sectionTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },

  listContent: {
    gap: 4,
  },

  emptyUpNext: {
    color: '#555',
    fontStyle: 'italic',
  },

  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b1b1b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    gap: 12,
  },

  trackPosition: {
    color: '#4c8bf5',
    fontWeight: 'bold',
    width: 20,
    textAlign: 'center',
  },

  trackName: {
    color: 'white',
    flexShrink: 1,
  },
});
