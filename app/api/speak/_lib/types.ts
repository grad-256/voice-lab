import {
  ELEVENLABS_FLASH,
  ELEVENLABS_MULTILINGUAL,
  ELEVENLABS_TURBO,
  ELEVENLABS_V3,
} from "@/lib/models";

export const ALLOWED_MODELS = [
  ELEVENLABS_MULTILINGUAL,
  ELEVENLABS_V3,
  ELEVENLABS_TURBO,
  ELEVENLABS_FLASH,
] as const;

export type AllowedModel = (typeof ALLOWED_MODELS)[number];
export const DEFAULT_MODEL: AllowedModel = ELEVENLABS_MULTILINGUAL;

export type RequestBody = {
  text: string;
  voiceId?: string;
  modelId?: string;
  speed?: number;
};
