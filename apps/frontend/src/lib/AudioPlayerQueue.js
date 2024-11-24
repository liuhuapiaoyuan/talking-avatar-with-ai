export class AudioPlayerQueue {
    /**
     * 
     * @param {HTMLAudioElement} audioElement   音频元素
     */
    constructor(audioElement) {
      this.audioElement = audioElement;
      this.audioQueue = [];
      this.isPlaying = false;
    }
  
    enqueueAudio(audioBlob) {
      this.audioQueue.push(audioBlob);
      if (!this.isPlaying) {
        this.playNextAudio();
      }
    }
  
    playNextAudio() {
      if (this.audioQueue.length === 0) {
        this.isPlaying = false;
        return;
      }
  
      this.isPlaying = true;
      const audioUrl = this.audioQueue.shift();
      //const audioUrl = URL.createObjectURL(audioBlob);
      
      this.audioElement.pause();
      this.audioElement.src = audioUrl;
      
      this.audioElement.onended = () => {
        URL.revokeObjectURL(audioUrl);
        this.playNextAudio();
      };
  
      this.audioElement.play().catch(err => {
        console.error('播放失败:', err);
        this.playNextAudio();
      });
    }
  
    interruptAndClearAudio() {
      if (this.isPlaying) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        URL.revokeObjectURL(this.audioElement.src);
        this.isPlaying = false;
      }
      // 清空队列
      this.audioQueue.length = 0;
    }
  }
  