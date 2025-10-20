import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';

const App = () => {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      setAudioSrc(null);
      setError(null);
    }
  };

  const handleExtractAudio = async () => {
    if (!videoFile) return;

    setIsLoading(true);
    setError(null);
    setAudioSrc(null);

    try {
      // FIX: Cast `window` to `any` to allow access to the vendor-prefixed `webkitAudioContext` for older browsers.
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await videoFile.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const wavBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      setAudioSrc(url);
    } catch (err) {
      console.error("Error extracting audio:", err);
      setError("Failed to extract audio. The file might be corrupted or in an unsupported format.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to convert AudioBuffer to a WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArray = new ArrayBuffer(length);
    const view = new DataView(bufferArray);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;

    // Write WAV container
    // RIFF chunk descriptor
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    // FMT sub-chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16); // format chunk size
    setUint16(1); // PCM, 1 for linear quantization
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2); // block align
    setUint16(16); // bits per sample
    // data sub-chunk
    setUint32(0x61746164); // "data"
    setUint32(length - pos - 4); // chunk length

    function setUint16(data: number) {
      view.setUint16(pos, data, true);
      pos += 2;
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
    
    // Write PCM samples
    for (i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (i = 0; i < numOfChan; i++) {
        // Interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
        // scale to 16-bit signed int
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        view.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  return (
    <div className="container">
      <h1>Audio Extractor</h1>
      <p>Upload a video file to extract its audio track as a WAV file.</p>
      
      <div className="upload-section">
        <label htmlFor="file-upload" className="file-input-label" aria-label="Upload video file">
          {videoFile ? 'Select Another Video' : 'Upload Video'}
        </label>
        <input id="file-upload" type="file" accept="video/*" onChange={handleFileChange} />
        {videoFile && <div className="file-name">{videoFile.name}</div>}
      </div>

      <button
        className="action-button"
        onClick={handleExtractAudio}
        disabled={!videoFile || isLoading}
        aria-disabled={!videoFile || isLoading}
      >
        {isLoading ? 'Extracting...' : 'Extract Audio'}
      </button>

      {isLoading && <div role="status" aria-live="polite"><div className="loading-spinner"></div></div>}

      {error && <div className="error-message" role="alert">{error}</div>}

      {audioSrc && (
        <div className="result-section">
          <h2>Extraction Complete!</h2>
          <audio controls src={audioSrc} aria-label="Extracted Audio Player"></audio>
          <a href={audioSrc} download="extracted_audio.wav" className="download-link">
            Download Audio
          </a>
        </div>
      )}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);