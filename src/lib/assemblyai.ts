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
  const transcript = await client.transcripts.transcribe({
    audio: audioPath,
    speech_model: "universal-3-pro" as unknown as "best",
  });

  if (transcript.status === "error") {
    throw new Error(`Transcription failed: ${transcript.error}`);
  }

  const text = transcript.text || "";
  const timestamps = (transcript.words || []).map((word) => ({
    text: word.text,
    start: word.start,
    end: word.end,
  }));

  return { text, timestamps };
}
