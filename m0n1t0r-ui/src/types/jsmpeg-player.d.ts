declare module "@cycjimmy/jsmpeg-player" {
  namespace JSMpeg {
    interface PlayerOptions {
      canvas?: HTMLCanvasElement;
      audio?: boolean;
      video?: boolean;
      autoplay?: boolean;
      loop?: boolean;
      pauseWhenHidden?: boolean;
      disableGl?: boolean;
      disableWebAssembly?: boolean;
      preserveDrawingBuffer?: boolean;
      progressive?: boolean;
      throttled?: boolean;
      chunkSize?: number;
      decodeFirstFrame?: boolean;
      videoBufferSize?: number;
      audioBufferSize?: number;
      maxAudioLag?: number;
      reconnectInterval?: number;
      onPlay?: () => void;
      onPause?: () => void;
      onEnded?: () => void;
      onStalled?: () => void;
      onSourceEstablished?: () => void;
      onSourceCompleted?: () => void;
    }

    class Player {
      constructor(url: string, options?: PlayerOptions);
      destroy(): void;
      play(): void;
      pause(): void;
      stop(): void;
      volume: number;
      currentTime: number;
    }
  }

  export default JSMpeg;
}
