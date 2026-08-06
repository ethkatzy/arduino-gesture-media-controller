import { Audio } from 'expo-av';
import { MediaPlayerClass } from './MediaPlayer';

jest.mock('expo-av', () => {
  function createMockSound(shouldPlay: boolean) {
    const state = { isPlaying: shouldPlay, volume: 1, positionMillis: 0 };
    return {
      playAsync: jest.fn(async () => {
        state.isPlaying = true;
      }),
      pauseAsync: jest.fn(async () => {
        state.isPlaying = false;
      }),
      unloadAsync: jest.fn(async () => {
        state.isPlaying = false;
      }),
      setVolumeAsync: jest.fn(async (volume: number) => {
        state.volume = volume;
      }),
      setPositionAsync: jest.fn(async (positionMillis: number) => {
        state.positionMillis = positionMillis;
      }),
      getStatusAsync: jest.fn(async () => ({
        isLoaded: true,
        isPlaying: state.isPlaying,
        volume: state.volume,
        positionMillis: state.positionMillis,
        durationMillis: 10000,
      })),
    };
  }

  return {
    Audio: {
      Sound: {
        createAsync: jest.fn(
          async (
            _source: unknown,
            options?: { shouldPlay?: boolean },
          ) => ({
            sound: createMockSound(Boolean(options?.shouldPlay)),
            status: { isLoaded: true, durationMillis: 10000 },
          }),
        ),
      },
    },
  };
});

const mockedCreateAsync = Audio.Sound.createAsync as jest.Mock;

describe('MediaPlayer', () => {
  let player: MediaPlayerClass;

  beforeEach(() => {
    player = new MediaPlayerClass();
    mockedCreateAsync.mockClear();
  });

  it('has no current track before anything is added', () => {
    expect(player.getCurrentTrack()).toBeNull();
  });

  it('does nothing when playing an empty playlist', async () => {
    await player.play();
    expect(mockedCreateAsync).not.toHaveBeenCalled();
  });

  it('loads and plays the first track once added', async () => {
    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);
    expect(player.getCurrentTrack()).toEqual({
      uri: 'file://a.mp3',
      name: 'a.mp3',
    });

    await player.play();
    expect(mockedCreateAsync).toHaveBeenCalledTimes(1);
    expect(mockedCreateAsync).toHaveBeenCalledWith(
      { uri: 'file://a.mp3' },
      { shouldPlay: true },
    );
    expect(await player.getDuration()).toBe(10000);
  });

  it('toggles play/pause without reloading the sound', async () => {
    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);

    // First call: no sound loaded yet, so this loads and plays.
    await player.togglePlayPause();
    expect(mockedCreateAsync).toHaveBeenCalledTimes(1);

    // Second call: sound is playing, so this should pause.
    await player.togglePlayPause();
    // Third call: sound is paused, so this should resume.
    await player.togglePlayPause();
    expect(mockedCreateAsync).toHaveBeenCalledTimes(1); // never recreated the sound
  });

  it('advances to the next track and wraps around', async () => {
    await player.addToPlaylist([
      { uri: 'file://a.mp3', name: 'a.mp3' },
      { uri: 'file://b.mp3', name: 'b.mp3' },
    ]);
    await player.play();

    await player.nextTrack();
    expect(player.getCurrentTrack()).toEqual({
      uri: 'file://b.mp3',
      name: 'b.mp3',
    });

    await player.nextTrack();
    expect(player.getCurrentTrack()).toEqual({
      uri: 'file://a.mp3',
      name: 'a.mp3',
    });
  });

  it('clamps volume between 0 and 1', async () => {
    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);
    await player.play();

    for (let i = 0; i < 20; i++) {
      await player.volumeUp();
    }
    expect(await player.getVolume()).toBe(1);

    for (let i = 0; i < 20; i++) {
      await player.volumeDown();
    }
    expect(await player.getVolume()).toBe(0);
  });

  it('seeks to a given position', async () => {
    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);
    await player.play();

    await player.seekTo(5000);
    expect(await player.getPosition()).toBe(5000);
  });

  it('reports zero position and volume before any track is loaded', async () => {
    expect(await player.getPosition()).toBe(0);
    expect(await player.getVolume()).toBe(0);
  });

  it('exposes the full playlist and current index', async () => {
    expect(player.getPlaylist()).toEqual([]);
    expect(player.getCurrentIndex()).toBe(0);

    await player.addToPlaylist([
      { uri: 'file://a.mp3', name: 'a.mp3' },
      { uri: 'file://b.mp3', name: 'b.mp3' },
    ]);

    expect(player.getPlaylist()).toEqual([
      { uri: 'file://a.mp3', name: 'a.mp3' },
      { uri: 'file://b.mp3', name: 'b.mp3' },
    ]);
    expect(player.getCurrentIndex()).toBe(0);
  });

  it('jumps directly to a given playlist index and plays it', async () => {
    await player.addToPlaylist([
      { uri: 'file://a.mp3', name: 'a.mp3' },
      { uri: 'file://b.mp3', name: 'b.mp3' },
      { uri: 'file://c.mp3', name: 'c.mp3' },
    ]);
    await player.play();

    await player.playAt(2);
    expect(player.getCurrentIndex()).toBe(2);
    expect(player.getCurrentTrack()).toEqual({
      uri: 'file://c.mp3',
      name: 'c.mp3',
    });
    expect(mockedCreateAsync).toHaveBeenLastCalledWith(
      { uri: 'file://c.mp3' },
      { shouldPlay: true },
    );
  });

  it('ignores an out-of-range index for playAt', async () => {
    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);
    await player.play();

    await player.playAt(5);
    await player.playAt(-1);
    expect(player.getCurrentIndex()).toBe(0);
  });

  it('reports whether a track is currently playing', async () => {
    expect(await player.isCurrentlyPlaying()).toBe(false);

    await player.addToPlaylist([{ uri: 'file://a.mp3', name: 'a.mp3' }]);
    await player.play();
    expect(await player.isCurrentlyPlaying()).toBe(true);

    await player.pause();
    expect(await player.isCurrentlyPlaying()).toBe(false);
  });
});
