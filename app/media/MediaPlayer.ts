import { Audio } from "expo-av";

class MediaPlayer {
  private sound: Audio.Sound | null = null;
  private playlist: string[] = [];
  private currentIndex = 0;
  private duration: number | null = null;

  /*async loadPlaylist(files: string[]) {
    this.playlist = files;
    this.currentIndex = 0;
  }*/

  async addToPlaylist(files: string[]) {
    this.playlist.push(...files);

    if (!this.sound && this.playlist.length > 0) {
      this.currentIndex = 0;
    }
  }

  async play() {
    if (!this.playlist.length) return;

    if (this.sound) {
      await this.sound.playAsync();
      return;
    }

    const { sound, status } = await Audio.Sound.createAsync(
      { uri: this.playlist[this.currentIndex] },
      { shouldPlay: true }
    );

    this.sound = sound;

    if (status.isLoaded) {
      this.duration = status.durationMillis || null;
    }
  }

  async pause() {
    if (this.sound) {
      await this.sound.pauseAsync();
    }
  }

  async togglePlayPause() {
    if (!this.sound) {
      await this.play();
      return;
    }

    const status = await this.sound.getStatusAsync();

    if (status.isLoaded && status.isPlaying) {
      await this.pause();
    } else {
      await this.sound.playAsync();
    }
  }

  async nextTrack() {
    if (!this.playlist.length) return;

    this.currentIndex =
      (this.currentIndex + 1) % this.playlist.length;

    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }

    await this.play();
  }

  async volumeUp() {
    if (!this.sound) return;

    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) return;

    const newVolume = Math.min(status.volume + 0.1, 1);
    await this.sound.setVolumeAsync(newVolume);
  }

  async volumeDown() {
    if (!this.sound) return;

    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) return;

    const newVolume = Math.max(status.volume - 0.1, 0);
    await this.sound.setVolumeAsync(newVolume);
  }

  async getDuration() {
    return this.duration;
  }

  async getPosition() {
    if (!this.sound) return 0;
    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) return 0;
    return status.positionMillis;
  }

  async seekTo(positionMillis: number) {
    if (!this.sound) return;
    await this.sound.setPositionAsync(positionMillis);
  }

  async setVolume(volume: number) {
    if (!this.sound) return;
    await this.sound.setVolumeAsync(volume);
  }

  async getVolume() {
    if (!this.sound) return 0;
    const status = await this.sound.getStatusAsync();
    if (!status.isLoaded) return 0;
    return status.volume;
}
}

export default new MediaPlayer();