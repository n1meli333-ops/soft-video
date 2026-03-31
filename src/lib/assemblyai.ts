import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || "",
});

export interface TranscriptResult {
  text: string;
  timestamps: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transcript = await (client.transcripts.transcribe as any)({
    audio: audioPath,
    speech_models: ["universal-3-pro", "universal-2"],
  });

  if (transcript.status === "error") {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

  const text = transcript.text || "";
  const timestamps = (transcript.words || []).map((word: { text: string; start: number; end: number }) => ({
    text: word.text,
    start: word.start,
    end: word.end,
  }));

  return { text, timestamps };
}
