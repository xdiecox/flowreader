/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SavedAudio {
  id: string;
  title: string;
  text: string;
  voiceName: string;
  rate: number;
  pitch: number;
  date: number;
}

export interface VoiceOption {
  name: string;
  originalName: string;
  lang: string;
  voice: SpeechSynthesisVoice;
}
