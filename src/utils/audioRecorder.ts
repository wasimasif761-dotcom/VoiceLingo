export interface AudioRecorderState {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
}

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private startTime = 0;
  private timerInterval: any = null;

  public async startRecording(onTick?: (seconds: number) => void): Promise<AnalyserNode | null> {
    this.stopRecording(); // cleanup if any

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Set up Web Audio Analyser
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      this.audioContext = new AudioContextClass();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 128;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
      this.sourceNode.connect(this.analyser);
    }

    // Set up MediaRecorder
    this.audioChunks = [];
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        mimeType = '';
      }
    }

    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(250); // Slice every 250ms
    this.startTime = Date.now();

    if (onTick) {
      this.timerInterval = setInterval(() => {
        const secs = Math.floor((Date.now() - this.startTime) / 1000);
        onTick(secs);
      }, 500);
    }

    return this.analyser;
  }

  public async stopRecording(): Promise<{ blob: Blob | null; url: string | null; duration: number }> {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    const duration = this.startTime ? Math.max(1, Math.floor((Date.now() - this.startTime) / 1000)) : 0;
    this.startTime = 0;

    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.cleanupAudioContext();
        resolve({ blob: null, url: null, duration: 0 });
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        this.cleanupAudioContext();
        resolve({ blob, url, duration });
      };

      try {
        this.mediaRecorder.stop();
      } catch (e) {
        this.cleanupAudioContext();
        resolve({ blob: null, url: null, duration: 0 });
      }
    });
  }

  private cleanupAudioContext() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch (e) {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.sourceNode = null;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }
}
